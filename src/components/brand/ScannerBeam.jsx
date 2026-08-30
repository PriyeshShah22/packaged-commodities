import React from 'react';

/**
 * ScannerBeam
 * 
 * Reusable precision optical scanning beam.
 * Renders a focused hairline laser line with a subtle projection cone
 * simulating a handheld or stationary optical inspection device.
 */
export default function ScannerBeam({
  progress = 0, // 0 to 100
  isActive = false,
  orientation = 'horizontal', // 'horizontal' | 'vertical' | 'projected'
  className = '',
}) {
  if (!isActive) return null;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-30 overflow-hidden ${className}`}
    >
      {/* Horizontal sweeping line (moves down the label) */}
      {orientation === 'horizontal' && (
        <div
          style={{ top: `${progress}%` }}
          className="absolute inset-x-0 h-[2px] transition-all duration-75 ease-out"
        >
          {/* Main hairline beam */}
          <div className="w-full h-full bg-gradient-to-r from-transparent via-sky-500 to-transparent shadow-[0_0_12px_rgba(2,132,199,0.85)]" />
          
          {/* Subtle soft illumination band */}
          <div className="absolute left-1/2 -top-2 w-48 -translate-x-1/2 h-5 bg-sky-400/15 blur-xs rounded-full" />
        </div>
      )}

      {/* Vertical sweeping line (moves left to right) */}
      {orientation === 'vertical' && (
        <div
          style={{ left: `${progress}%` }}
          className="absolute inset-y-0 w-[2px] transition-all duration-75 ease-out"
        >
          <div className="w-full h-full bg-gradient-to-b from-transparent via-sky-500 to-transparent shadow-[0_0_12px_rgba(2,132,199,0.85)]" />
          <div className="absolute top-1/2 -left-2 h-48 -translate-y-1/2 w-5 bg-sky-400/15 blur-xs rounded-full" />
        </div>
      )}
    </div>
  );
}
