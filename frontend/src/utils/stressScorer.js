const BASELINE_WARMUP_EVENTS = 80;   
const BASELINE_ALPHA         = 0.05; 
const MODEL_WEIGHT           = 0.25; 
const RULE_WEIGHT            = 0.75;

const BS_LOW    = 0.03; 
const BS_HIGH   = 0.12;  

const WPM_SLOW  = 0.75; 
const WPM_FAST  = 1.35;  

const CV_LOW    = 0.4;   
const CV_HIGH   = 1.0;   

let baseline = {
  wpm:          null,
  hold:         null,
  latency:      null,
  pauseRate:    null,
  eventCount:   0,
  ready:        false,
};

export function resetBaseline() {
  baseline = { wpm: null, hold: null, latency: null, pauseRate: null, eventCount: 0, ready: false };
}

function ewma(prev, next, alpha) {
  if (prev === null) return next;
  return alpha * next + (1 - alpha) * prev;
}

export function computeStressScore(metrics, modelProb) {
  const { wpm, backspaceRate, avgHold, latencyCV, pauseRate, totalEvents } = metrics;

  baseline.eventCount += totalEvents;

  const alpha = baseline.ready ? BASELINE_ALPHA : 0.15;

  baseline.wpm       = ewma(baseline.wpm,       wpm,          alpha);
  baseline.hold      = ewma(baseline.hold,       avgHold,      alpha);
  baseline.latency   = ewma(baseline.latency,    latencyCV,    alpha);
  baseline.pauseRate = ewma(baseline.pauseRate,  pauseRate,    alpha);

  if (!baseline.ready && baseline.eventCount >= BASELINE_WARMUP_EVENTS) {
    baseline.ready = true;
  }

  const bsScore = clamp01((backspaceRate - BS_LOW) / (BS_HIGH - BS_LOW));

  let wpmScore = 0;
  if (baseline.wpm && baseline.wpm > 0) {
    const ratio = wpm / baseline.wpm;
    if (ratio < 1.0) {
      wpmScore = clamp01((WPM_SLOW - ratio) / (WPM_SLOW - 0.3));
    } else {
      wpmScore = clamp01((ratio - WPM_FAST) / (2.0 - WPM_FAST));
    }
  }
  if (!baseline.ready) wpmScore = 0;

  const cvScore = clamp01((latencyCV - CV_LOW) / (CV_HIGH - CV_LOW));

  let pauseScore = 0;
  if (baseline.pauseRate !== null) {
    const pauseDelta = pauseRate - baseline.pauseRate;
    pauseScore = clamp01(pauseDelta / 0.3);
  }

  const ruleScore =
    bsScore    * 0.45 +
    wpmScore   * 0.20 +
    cvScore    * 0.25 +
    pauseScore * 0.10;

  const mw = baseline.ready ? MODEL_WEIGHT : 0.10;
  const rw = baseline.ready ? RULE_WEIGHT  : 0.90;

  const blended = clamp01(modelProb * mw + ruleScore * rw);

  return {
    score: blended,
    label: blended >= 0.5 ? 'stressed' : 'relaxed',
    signals: {
      backspaceRate: +(backspaceRate * 100).toFixed(1),  
      wpm:           +wpm.toFixed(1),
      baselineWpm:   baseline.wpm ? +baseline.wpm.toFixed(1) : null,
      latencyCV:     +latencyCV.toFixed(3),
      pauseRate:     +pauseRate.toFixed(3),
      bsScore:       +bsScore.toFixed(2),
      wpmScore:      +wpmScore.toFixed(2),
      cvScore:       +cvScore.toFixed(2),
      baselineReady: baseline.ready,
    },
  };
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
