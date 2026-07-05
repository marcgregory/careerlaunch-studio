"use client";

/** Circular score gauge showing 0–100 with colour coding */
function healthLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Needs Work";
  return "Needs Improvement";
}

export function ScoreGauge({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.max(0, Math.min(100, score)) / 100;
  const offset = circumference * (1 - fraction);

  const color =
    score >= 80 ? "#123c3a" : score >= 60 ? "#b9ff66" : score >= 40 ? "#e0aa22" : "#cf3a2a";
  const label = healthLabel(score);

  return (
    <div className="inline-flex items-center gap-4">
      <div className="relative h-24 w-24 shrink-0">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
          {/* Background ring */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="rgba(18,60,58,0.08)"
            strokeWidth="8"
          />
          {/* Score ring */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-signal text-2xl font-black tracking-[-0.04em]">
          {score}
        </span>
      </div>
      <div>
        <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-[#00796f]">
          Resume Health
        </p>
        <p className="font-signal text-5xl font-black leading-none tracking-[-0.06em]">
          {score}
          <span className="text-2xl font-black text-[#123c3a]">/100</span>
        </p>
        <p className="mt-0.5 text-sm font-black text-[#4b4b4b]">{label}</p>
      </div>
    </div>
  );
}
