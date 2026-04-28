import React from 'react';

interface Props {
  size?: number;
  strokeWidth?: number;
  className?: string;
  color?: string;
}

const EggHenLoaderIcon: React.FC<Props> = ({
  size = 28, // Bumped default size to feel more substantial
  strokeWidth = 2,
  className = "",
  color = "currentColor",
}) => {
  const duration = "4s";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <style>{`
        @keyframes egg-lifecycle {
          0%, 10% { transform: scale(1); opacity: 1; }
          15% { transform: scale(1.15, 0.85); } /* More pronounced squash */
          20%, 30% { transform: rotate(-12deg); } 
          25%, 35% { transform: rotate(12deg); }
          40% { transform: rotate(0) scale(1); opacity: 1; }
          45%, 85% { opacity: 0; } 
          95%, 100% { opacity: 1; }
        }

        @keyframes egg-crack {
          0%, 40% { stroke-dashoffset: 12; opacity: 0; }
          42% { opacity: 1; stroke-dashoffset: 0; }
          45%, 100% { opacity: 0; }
        }

        @keyframes chick-hen {
          0%, 45% { transform: scale(0); opacity: 0; }
          55% { transform: scale(0.8); opacity: 1; } 
          65%, 80% { transform: scale(1.1); opacity: 1; } /* Slightly larger hen */
          85% { transform: translateX(-6px) scale(0.8); opacity: 0; } 
          100% { opacity: 0; }
        }

        .egg-shell {
          transform-origin: 12px 21px; /* Grounded origin */
          animation: egg-lifecycle ${duration} ease-in-out infinite;
        }

        .crack {
          stroke-dasharray: 12;
          animation: egg-crack ${duration} ease-in-out infinite;
        }

        .hen {
          transform-origin: 12px 18px;
          animation: chick-hen ${duration} ease-in-out infinite;
        }
      `}</style>

      {/* Main Egg - Path widened to fill more of the 24px box */}
      <g className="egg-shell">
        <path d="M12 21c-3.5 0-6-2.5-6-7s3-9 6-9 6 4.5 6 9-2.5 7-6 7z" />
      </g>

      {/* Crack line */}
      <path 
        className="crack" 
        d="M8 14l2.5 2 3-2 2.5 2" 
        strokeWidth={strokeWidth * 0.9} 
      />

      {/* Hen / Chick Morph */}
      <g className="hen">
        {/* Larger Hen Body */}
        <path d="M12 20c-4 0-7-3-7-7s3-8 7-8 7 4 7 8-3 7-7 7z" />
        {/* Beak */}
        <path d="M18 12l3 1.5-3 1.5" />
        {/* Comb */}
        <path d="M10 6c0-1.5 1.5-2 2.5-1.5s1 .5 1 2" />
        {/* Eye */}
        <circle cx="15" cy="11.5" r="0.6" fill={color} stroke="none" />
      </g>
    </svg>
  );
};

export default EggHenLoaderIcon;