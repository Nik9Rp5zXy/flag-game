import { useEffect, useState } from 'react';

export default function TimerBar({ duration = 10000, onTimeUp, questionKey }) {
  const [elapsed, setElapsed] = useState(0);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    setElapsed(0);
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = now - startTime;
      setElapsed(Math.min(diff, duration));
      if (diff >= duration) {
        clearInterval(interval);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [questionKey]);

  const progress = Math.max(0, 1 - elapsed / duration);
  const remaining = Math.max(0, Math.ceil((duration - elapsed) / 1000));
  const isUrgent = remaining <= 3 && remaining > 0;

  // Renk gradyanı: yeşil → sarı → kırmızı
  let barColor = '#00FF66';
  if (progress < 0.5) barColor = '#facc15';
  if (progress < 0.3) barColor = '#FF003C';

  return (
    <div className="w-full max-w-3xl mx-auto mb-6">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Süre</span>
        <span
          className={`text-lg font-black tabular-nums ${isUrgent ? 'text-neon-red animate-timer-pulse' : 'text-gray-300'}`}
        >
          {remaining}s
        </span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
        <div
          className="h-full rounded-full transition-all duration-100 ease-linear"
          style={{
            width: `${progress * 100}%`,
            backgroundColor: barColor,
            boxShadow: `0 0 10px ${barColor}80, 0 0 20px ${barColor}40`
          }}
        />
      </div>
    </div>
  );
}
