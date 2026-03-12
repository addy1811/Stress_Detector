
const WINDOW_SIZE  = 50;
const PAUSE_THRESH = 0.4;  

function parseEvents(events) {
  const holdDurations = [];
  const latencies     = [];
  let   backspaces    = 0;
  let   totalKeys     = 0;
  let   pauseCount    = 0;
  let   charCount     = 0;

  let lastPressTime = null;
  const pressStack  = {};

  const sessionStart = events[0].time / 1000;
  let   sessionEnd   = sessionStart;

  for (const { type, key, time } of events) {
    const ts = time / 1000;
    sessionEnd = Math.max(sessionEnd, ts);

    if (type === 'press') {
      totalKeys++;
      if (lastPressTime !== null) {
        const lat = ts - lastPressTime;
        latencies.push(lat);
        if (lat > PAUSE_THRESH) pauseCount++;
      }
      lastPressTime   = ts;
      pressStack[key] = ts;

      if (key === 'Backspace') backspaces++;
      else charCount++;

    } else if (type === 'release') {
      if (pressStack[key] !== undefined) {
        holdDurations.push(ts - pressStack[key]);
        delete pressStack[key];
      }
    }
  }

  const elapsedMin = Math.max((sessionEnd - sessionStart) / 60, 1e-6);
  const wpm        = (charCount / 5.0) / elapsedMin;
  const cpm        = charCount / elapsedMin;
  const errorRate  = totalKeys > 0 ? backspaces / totalKeys : 0;

  const latMean = latencies.length > 0
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  const latStd  = latencies.length > 1
    ? Math.sqrt(latencies.map(l => (l - latMean) ** 2).reduce((a,b)=>a+b, 0) / latencies.length)
    : 0;
  const latencyCV = latMean > 0 ? latStd / latMean : 0;

  const avgHold = holdDurations.length > 0
    ? holdDurations.reduce((a, b) => a + b, 0) / holdDurations.length : 0;

  return {
    holdDurations, latencies, wpm, cpm, pauses: pauseCount,
    errorRate, avgHold, latencyCV,
    pauseRate: latencies.length > 0 ? pauseCount / latencies.length : 0,
    totalEvents: events.length, charCount, backspaces, totalKeys,
  };
}


export function extractFeatures(events, userBaseline = null, windowSize = WINDOW_SIZE) {
  if (!events || events.length === 0) return [];

  const m = parseEvents(events);
  const wpmDelta     = userBaseline ? m.wpm     - userBaseline.wpm     : 0;
  const holdDelta    = userBaseline ? m.avgHold  - userBaseline.hold    : 0;
  const latencyDelta = userBaseline ? (m.latencies.length > 0
    ? m.latencies.reduce((a,b)=>a+b,0)/m.latencies.length : 0) - userBaseline.latency
    : 0;

  const padTrim = (arr, len, fill = 0) => {
    const a = arr.slice(0, len);
    while (a.length < len) a.push(fill);
    return a;
  };

  const hd  = padTrim(m.holdDurations, windowSize);
  const lat = padTrim(m.latencies,     windowSize);

  return hd.map((h, i) => [
    h,              
    lat[i],          
    m.wpm,          
    m.pauses,       
    m.cpm,           
    m.errorRate,     
    wpmDelta,        
    holdDelta,      
    latencyDelta,    
  ]);
}

export function extractMetrics(events) {
  if (!events || events.length === 0) return null;
  const m = parseEvents(events);
  return {
    wpm:           m.wpm,
    cpm:           m.cpm,
    backspaceRate: m.errorRate,
    avgHold:       m.avgHold,
    latencyCV:     m.latencyCV,
    pauseRate:     m.pauseRate,
    totalEvents:   m.totalEvents,
    charCount:     m.charCount,
    backspaces:    m.backspaces,
  
    latencyMean: m.latencies.length > 0
      ? m.latencies.reduce((a,b)=>a+b,0) / m.latencies.length : 0,
  };
}
