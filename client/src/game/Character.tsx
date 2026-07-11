interface CharacterProps {
  facing: 'left' | 'right';
  isWalking: boolean;
  color?: string;
}

export function Character({ facing, isWalking, color = '#ff6b6b' }: CharacterProps) {
  return (
    <div
      className="pointer-events-none w-12 sm:w-14"
      style={{ transform: facing === 'left' ? 'scaleX(-1)' : undefined }}
    >
      <div
        className={`drop-shadow-md ${isWalking ? 'animate-walk-bounce' : 'animate-breathe'}`}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
          <defs>
            <radialGradient id="bodyGradient" cx="38%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
              <stop offset="35%" stopColor={color} stopOpacity="0.95" />
              <stop offset="100%" stopColor={color} />
            </radialGradient>
          </defs>

          <ellipse cx="50" cy="94" rx="22" ry="5" fill="#000000" opacity="0.18" />

          {/* legs */}
          <ellipse cx="38" cy="86" rx="8" ry="6" fill={color} />
          <ellipse cx="62" cy="86" rx="8" ry="6" fill={color} />

          {/* arms */}
          <ellipse cx="16" cy="58" rx="9" ry="7" fill={color} />
          <ellipse cx="84" cy="58" rx="9" ry="7" fill={color} />

          {/* body */}
          <circle cx="50" cy="52" r="38" fill="url(#bodyGradient)" />

          {/* cheeks */}
          <ellipse cx="30" cy="60" rx="7" ry="5" fill="#ffffff" opacity="0.35" />
          <ellipse cx="70" cy="60" rx="7" ry="5" fill="#ffffff" opacity="0.35" />

          {/* eyes */}
          <circle cx="36" cy="46" r="8" fill="#ffffff" />
          <circle cx="64" cy="46" r="8" fill="#ffffff" />
          <circle cx="38" cy="47" r="4" fill="#2b2b2b" />
          <circle cx="66" cy="47" r="4" fill="#2b2b2b" />
          <circle cx="39.5" cy="45.5" r="1.3" fill="#ffffff" />
          <circle cx="67.5" cy="45.5" r="1.3" fill="#ffffff" />

          {/* smile */}
          <path
            d="M 40 62 Q 50 70 60 62"
            stroke="#2b2b2b"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
