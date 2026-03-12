export const glassCard = {
    background: 'rgba(5, 15, 30, 0.65)',
    border: '1px solid rgba(100, 180, 255, 0.15)',
    borderRadius: 8,
    padding: '1.25rem 1.5rem',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  };
  
  export const calibBtnStyle = {
    background: '#4fc3f7',
    color: '#000',
    border: 'none',
    borderRadius: 4,
    padding: '0.4rem 1rem',
    fontSize: '0.78rem',
    fontWeight: 700,
    letterSpacing: '0.1em',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: 'inherit',
  };
  
  export function stressColor(level) {
    if (level < 0.4)  return '#4fc3f7';  // cyan  — relaxed
    if (level < 0.65) return '#ffb74d';  // amber — moderate
    return '#ef5350';                     // red   — stressed
  }
  