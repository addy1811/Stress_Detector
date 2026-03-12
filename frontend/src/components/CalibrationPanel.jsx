
import React from "react";
import { glassCard, calibBtnStyle } from "../styles";

const CALIBRATION_SECS = 15;

export default function CalibrationPanel({
  calibrating,
  calibrated,
  calibCountdown,
  baselineValue,   // number 0–1, the computed baseline
  onStart,
}) {
  return (
    <div style={{ ...glassCard, padding: '0.9rem 1.25rem' }}>

      {/* ── Idle: not yet calibrated ── */}
      {!calibrating && !calibrated && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <div style={{ color: 'rgba(200,230,255,0.9)', fontSize: '0.82rem', fontWeight: 600 }}>
              Calibrate to your baseline
            </div>
            <div style={{ color: 'rgba(150,190,220,0.6)', fontSize: '0.72rem', marginTop: '0.15rem' }}>
              Type relaxed for {CALIBRATION_SECS}s — reduces false stress readings
            </div>
          </div>
          <button onClick={onStart} style={calibBtnStyle}>Calibrate</button>
        </div>
      )}

      {/* ── In progress ── */}
      {calibrating && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: 16, height: 16,
            border: '2px solid rgba(100,200,255,0.3)',
            borderTop: '2px solid #4fc3f7',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            flexShrink: 0,
          }} />
          <div>
            <div style={{ color: '#4fc3f7', fontSize: '0.82rem', fontWeight: 600 }}>
              Calibrating… type naturally
            </div>
            <div style={{ color: 'rgba(150,190,220,0.6)', fontSize: '0.72rem' }}>
              {calibCountdown}s remaining
            </div>
          </div>
        </div>
      )}

      {/* ── Done ── */}
      {calibrated && !calibrating && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#81c784', fontSize: '0.82rem' }}>
            ✓ Baseline set — {baselineValue ?? 'your typing pattern recorded'}
          </span>
          <button
            onClick={onStart}
            style={{
              ...calibBtnStyle,
              background: 'transparent',
              border: '1px solid #4fc3f7',
              color: '#4fc3f7',
              padding: '0.25rem 0.75rem',
              fontSize: '0.72rem',
            }}
          >
            Recalibrate
          </button>
        </div>
      )}
    </div>
  );
}
