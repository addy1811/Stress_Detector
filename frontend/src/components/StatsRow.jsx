// StressDisplay.jsx — the big stress number, label badge, and progress bar

import React from "react";
import { glassCard, stressColor } from "../styles";

export default function StressDisplay({ stressProb, label, calibrating, calibCountdown, baselineReady }) {
  const level = stressProb ?? 0;

  return (
    <div style={{ ...glassCard, textAlign: 'center', padding: '2rem 1.5rem' }}>
      {stressProb == null ? (
        <div style={{
          color: 'rgba(150,200,255,0.5)',
          fontSize: '0.9rem',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}>
          {calibrating ? `⟳ Calibrating… ${calibCountdown}s` : '— Start typing —'}
        </div>
      ) : (
        <>
          <div style={{
            fontSize: 'clamp(3.5rem, 12vw, 7rem)',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            lineHeight: 1,
            color: stressColor(level),
            textShadow: `0 0 40px ${stressColor(level)}88`,
            transition: 'color 1.2s ease, text-shadow 1.2s ease',
          }}>
            {(level * 100).toFixed(1)}
            <span style={{ fontSize: '0.3em', opacity: 0.7 }}>%</span>
          </div>

          <div style={{
            marginTop: '0.5rem',
            display: 'inline-block',
            padding: '0.25rem 1.2rem',
            border: `1px solid ${stressColor(level)}`,
            borderRadius: 4,
            color: stressColor(level),
            fontSize: '0.75rem',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            textShadow: `0 0 10px ${stressColor(level)}`,
            boxShadow: `0 0 20px ${stressColor(level)}33`,
            transition: 'all 1.2s ease',
          }}>
            {label?.toUpperCase()}
          </div>

          <div style={{
            marginTop: '1.2rem',
            height: 4,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 2,
            overflow: 'hidden',
            width: '80%',
            margin: '1.2rem auto 0',
          }}>
            <div style={{
              height: '100%',
              width: `${level * 100}%`,
              background: `linear-gradient(90deg, #4fc3f7, ${stressColor(level)})`,
              boxShadow: `0 0 12px ${stressColor(level)}`,
              transition: 'width 1.2s ease, background 1.2s ease',
              borderRadius: 2,
            }} />
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '80%',
            margin: '0.3rem auto 0',
            fontSize: '0.6rem',
            color: 'rgba(255,255,255,0.3)',
            letterSpacing: '0.15em',
          }}>
            <span>RELAXED</span>
            <span>MODERATE</span>
            <span>STRESSED</span>
          </div>
          {!baselineReady && (
            <div style={{ marginTop: '0.6rem', fontSize: '0.62rem', color: '#ffb74d', letterSpacing: '0.1em' }}>
              ⟳ Learning your baseline… keep typing
            </div>
          )}
        </>
      )}
    </div>
  );
}
