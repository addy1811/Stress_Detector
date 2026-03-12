import React, { useRef, useState, useEffect } from "react";

export default function RealTimeTypingBox({ onEvents }) {
  const [text, setText]   = useState("");
  const eventsRef         = useRef([]);

  const handleKeyDown = (e) => {
    eventsRef.current.push({ type: "press",   key: e.key, time: performance.now() });
  };
  const handleKeyUp = (e) => {
    eventsRef.current.push({ type: "release", key: e.key, time: performance.now() });
  };

  useEffect(() => {
    const id = setInterval(() => {
      if (eventsRef.current.length > 0) {
        onEvents(eventsRef.current.slice());
        eventsRef.current = [];
      }
    }, 3000);
    return () => clearInterval(id);
  }, [onEvents]);

  return (
    <textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      placeholder="Start typing here… the background will react to your stress level"
      style={{
        width: '100%',
        height: 130,
        background: 'rgba(0, 10, 25, 0.6)',
        color: 'rgba(200, 230, 255, 0.9)',
        fontFamily: "'Rajdhani', monospace",
        fontSize: '0.95rem',
        border: '1px solid rgba(100, 180, 255, 0.2)',
        borderRadius: 6,
        padding: '0.75rem 1rem',
        resize: 'none',
        outline: 'none',
        letterSpacing: '0.03em',
        transition: 'border-color 0.3s',
        caretColor: '#4fc3f7',
      }}
      onFocus={e => e.target.style.borderColor = 'rgba(100,180,255,0.5)'}
      onBlur={e  => e.target.style.borderColor = 'rgba(100,180,255,0.2)'}
    />
  );
}
