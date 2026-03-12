import React, { useState, useCallback, useEffect, useRef } from "react";
import axios from "axios";

import ShaderBackground  from "./components/ShaderBackground";
import RealTimeTypingBox from "./components/RealTimeTypingBox";
import FeaturePlot       from "./components/FeaturePlot";
import StressDisplay     from "./components/StressDisplay";
import CalibrationPanel  from "./components/CalibrationPanel";
import StatsRow          from "./components/StatsRow";
import SignalBreakdown   from "./components/SignalBreakdown";

import { extractFeatures, extractMetrics } from "./utils/featureEngine";
import { computeStressScore, resetBaseline } from "./utils/stressScorer";
import { glassCard } from "./styles";

const SMOOTHING_ALPHA  = 0.20;
const CALIBRATION_SECS = 15;

export default function App() {
  const [smoothedProb,   setSmoothedProb]   = useState(null);
  const [label,          setLabel]          = useState(null);
  const [signals,        setSignals]        = useState(null);
  const [featureHistory, setFeatureHistory] = useState([]);
  const [lastTyped,      setLastTyped]      = useState(Date.now());
  const [errorMsg,       setErrorMsg]       = useState(null);
  const [isLoading,      setIsLoading]      = useState(false);
  const [showChart,      setShowChart]      = useState(false);
  const [calibrating,    setCalibrating]    = useState(false);
  const [calibrated,     setCalibrated]     = useState(false);
  const [calibCountdown, setCalibCountdown] = useState(CALIBRATION_SECS);

  const ewmaRef       = useRef(null);
  const calibStart    = useRef(null);
  const userBaseline  = useRef(null);
  const calibMetrics  = useRef([]);  

  const smoothDisplay = (score) => {
    if (ewmaRef.current === null) ewmaRef.current = score;
    ewmaRef.current = SMOOTHING_ALPHA * score + (1 - SMOOTHING_ALPHA) * ewmaRef.current;
    return ewmaRef.current;
  };

  //  <<<<<<    Calibration timer >>>>>>>>
  useEffect(() => {
    if (!calibrating) return;
    const id = setInterval(() => {
      const remaining = Math.max(0, CALIBRATION_SECS - (Date.now() - calibStart.current) / 1000);
      setCalibCountdown(Math.ceil(remaining));
      if (remaining <= 0) {
        const samples = calibMetrics.current;
        if (samples.length > 0) {
          const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
          userBaseline.current = {
            wpm:     avg(samples.map(m => m.wpm)),
            hold:    avg(samples.map(m => m.avgHold)),
            latency: avg(samples.map(m => m.latencyMean)),
          };
          console.log(" User baseline set:", userBaseline.current);
        }
        calibMetrics.current = [];
        setCalibrating(false);
        setCalibrated(true);
      }
    }, 500);
    return () => clearInterval(id);
  }, [calibrating]);

  const startCalibration = () => {
    resetBaseline();
    ewmaRef.current      = null;
    userBaseline.current = null;
    calibMetrics.current = [];
    calibStart.current   = Date.now();
    setCalibrating(true);
    setCalibrated(false);
    setCalibCountdown(CALIBRATION_SECS);
    setSmoothedProb(null);
    setLabel(null);
    setSignals(null);
  };

  const handleEvents = useCallback(async (events) => {
    setLastTyped(Date.now());
    if (events.length < 10) return;

    const metrics  = extractMetrics(events);
    if (!metrics) return;
    if (calibrating) {
      calibMetrics.current.push(metrics);
      return;
    }

    const features = extractFeatures(events, userBaseline.current);
    if (!features.length) return;

    setFeatureHistory(h => [...h.slice(-200), ...features]);
    setIsLoading(true);

    try {
      let modelProb = 0.5; 
      try {
        const { data } = await axios.post(
          "http://localhost:5000/predict",
          { features },
          { timeout: 2000 }
        );
        modelProb = data.stress_prob;
        setErrorMsg(null);
      } catch {
        setErrorMsg("Model offline — using rule-based scoring only.");
      }

      // Hybrid score: rules (75%) + LSTM (25%)
      const result = computeStressScore(metrics, modelProb);
      const final  = smoothDisplay(result.score);

      setSmoothedProb(final);
      setLabel(result.label);
      setSignals(result.signals);

    } finally {
      setIsLoading(false);
    }
  }, [calibrating]);

  // 15s idle
  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() - lastTyped > 15000) {
        setSmoothedProb(null);
        setLabel(null);
        setSignals(null);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [lastTyped]);

  return (
    <div style={{ minHeight: '100vh', position: 'relative', fontFamily: "'Rajdhani', monospace" }}>

      <ShaderBackground stressLevel={smoothedProb ?? 0} />

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', padding: '0 1rem 4rem' }}>

        <header style={{ maxWidth: 800, margin: '0 auto', padding: '2.5rem 0 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2rem', filter: 'drop-shadow(0 0 12px rgba(100,200,255,0.8))' }}>⌨</div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#fff', textShadow: '0 0 20px rgba(100,200,255,0.6)' }}>
              Keystroke Stress Monitor
            </h1>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(150,220,255,0.7)', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '0.2rem' }}>
              Real-time cognitive load via typing dynamics
            </p>
          </div>
          {isLoading && (
            <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#4fc3f7', boxShadow: '0 0 12px #4fc3f7', animation: 'pulse 1s infinite' }} />
          )}
        </header>

        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <StressDisplay
            stressProb={smoothedProb}
            label={label}
            calibrating={calibrating}
            calibCountdown={calibCountdown}
            baselineReady={signals?.baselineReady}
          />

          {signals && <SignalBreakdown signals={signals} />}

          <div style={glassCard}>
            <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: 'rgba(150,200,255,0.5)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
               Type Anything
            </div>
            <RealTimeTypingBox onEvents={handleEvents} />
            {errorMsg && (
              <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.75rem', background: 'rgba(255,180,0,0.1)', border: '1px solid rgba(255,180,0,0.3)', borderRadius: 4, color: '#ffb74d', fontSize: '0.78rem' }}>
                 {errorMsg}
              </div>
            )}
          </div>

          <CalibrationPanel
            calibrating={calibrating}
            calibrated={calibrated}
            calibCountdown={calibCountdown}
            baselineValue={userBaseline.current
              ? `WPM ${userBaseline.current.wpm.toFixed(0)}, hold ${(userBaseline.current.hold * 1000).toFixed(0)}ms`
              : null}
            onStart={startCalibration}
          />

          <StatsRow featureHistory={featureHistory} />

          {featureHistory.length > 0 && (
            <div style={glassCard}>
              <button
                onClick={() => setShowChart(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(150,200,255,0.7)', fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', width: '100%', textAlign: 'left', padding: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'inherit' }}
              >
                <span> Feature Trends</span>
                <span style={{ transition: 'transform 0.3s', transform: showChart ? 'rotate(180deg)' : 'none', display: 'inline-block' }}>▼</span>
              </button>
              {showChart && <div style={{ marginTop: '1rem' }}><FeaturePlot featureHistory={featureHistory} /></div>}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700;800&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes spin  { to{transform:rotate(360deg)} }
        * { box-sizing: border-box; }
        body { margin: 0; background: #020508; }
      `}</style>
    </div>
  );
}
