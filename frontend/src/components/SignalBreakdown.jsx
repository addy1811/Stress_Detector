import { glassCard, stressColor } from "../styles";

export default function SignalBreakdown({ signals }) {
  if (!signals) return null;

  const {
    backspaceRate,  
    wpm,
    baselineWpm,
    latencyCV,
    bsScore,
    wpmScore,
    cvScore,
    baselineReady,
  } = signals;

  const rows = [
    {
      key:   'Error Rate',
      icon:  '⌫',
      value: `${backspaceRate}%`,
      hint:  backspaceRate < 3   ? 'Very clean typing'
           : backspaceRate < 8   ? 'Some corrections'
           : backspaceRate < 15  ? 'Frequent corrections'
                                 : 'Many mistakes',
      score: bsScore,
    },
    {
      key:   'Speed vs Baseline',
      icon:  '⚡',
      value: baselineWpm
        ? `${wpm.toFixed(0)} WPM  (yours: ${baselineWpm} WPM)`
        : `${wpm.toFixed(0)} WPM  (calibrating…)`,
      hint:  !baselineReady       ? 'Learning your normal speed…'
           : wpmScore < 0.2       ? 'Normal pace'
           : wpmScore < 0.5       ? 'Slightly off pace'
                                  : 'Significantly off pace',
      score: wpmScore,
    },
    {
      key:   'Rhythm Steadiness',
      icon:  '〜',
      value: `CV ${latencyCV.toFixed(2)}`,
      hint:  cvScore < 0.2 ? 'Very steady rhythm'
           : cvScore < 0.5 ? 'Slightly erratic'
                           : 'Erratic / hesitating',
      score: cvScore,
    },
  ];

  return (
    <div style={{ ...glassCard, padding: '0.9rem 1.25rem' }}>
      <div style={{ fontSize: '0.62rem', letterSpacing: '0.2em', color: 'rgba(150,200,255,0.45)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
         Signal Breakdown {!baselineReady && <span style={{ color: '#ffb74d', marginLeft: '0.5rem' }}>— building your baseline…</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        {rows.map(({ key, icon, value, hint, score }) => (
          <div key={key} style={{ display: 'grid', gridTemplateColumns: '1.5rem 8rem 1fr 2.5rem', alignItems: 'center', gap: '0.6rem' }}>

            <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>{icon}</span>
            <span style={{ fontSize: '0.72rem', color: 'rgba(180,210,240,0.7)', letterSpacing: '0.05em' }}>{key}</span>

            <div>
              <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', marginBottom: '0.2rem' }}>
                <div style={{
                  height: '100%',
                  width: `${score * 100}%`,
                  background: `linear-gradient(90deg, #4fc3f7, ${stressColor(score)})`,
                  borderRadius: 2,
                  transition: 'width 0.8s ease, background 0.8s ease',
                }} />
              </div>
              <span style={{ fontSize: '0.62rem', color: 'rgba(150,180,210,0.5)' }}>{value} — {hint}</span>
            </div>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: stressColor(score),
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {(score * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
