import React, { useState, useRef, useEffect } from 'react';

/**
 * PackMetrixLogo
 * 
 * Signature brand wordmark with "Scan the Name" interaction:
 * 
 * NORMAL STATE:
 * - Clean "PackMetrix." with "Metrix" visually stronger
 * - No underline, no permanent tagline, no decorative borders
 * 
 * HOVER INTERACTION:
 * 1. Thin optical scan line appears at left edge
 * 2. Line sweeps left -> right across the letters (~580ms) with subtle highlight
 * 3. Tagline "Scan. Verify. Comply." fades in directly below (6-10px spacing)
 * 4. Stays visible while hovering; fades out smoothly on mouse leave
 * 5. Positioned safely without clipping or causing page layout shift
 */
export default function PackMetrixLogo({
  size = 'md', // 'sm' | 'md' | 'lg'
  className = '',
  onClick = null,
}) {
  const [isScanning, setIsScanning] = useState(false);
  const [showTagline, setShowTagline] = useState(false);
  const scanTimerRef = useRef(null);

  const handleMouseEnter = () => {
    // Check reduced motion preference
    const prefersReducedMotion = typeof window !== 'undefined' && 
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setShowTagline(true);
      return;
    }

    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    
    // 1. Begin laser sweep across the wordmark
    setIsScanning(true);

    // 2. Once scan sweeps past the end (~550ms), reveal tagline
    scanTimerRef.current = setTimeout(() => {
      setIsScanning(false);
      setShowTagline(true);
    }, 550);
  };

  const handleMouseLeave = () => {
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    setIsScanning(false);
    setShowTagline(false);
  };

  useEffect(() => {
    return () => {
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    };
  }, []);

  const sizeConfigs = {
    sm: {
      pack: 'text-xl tracking-tight font-medium text-slate-800',
      metrix: 'text-xl font-extrabold tracking-tight text-slate-950',
      dot: 'w-1.5 h-1.5',
      beamWidth: 'w-12',
      tagline: 'text-[12px]',
      containerHeight: 'min-h-[38px]',
    },
    md: {
      pack: 'text-2xl sm:text-[28px] tracking-tight font-medium text-slate-800',
      metrix: 'text-2xl sm:text-[28px] font-extrabold tracking-tight text-slate-950',
      dot: 'w-2 h-2',
      beamWidth: 'w-16',
      tagline: 'text-[13px]',
      containerHeight: 'min-h-[48px]',
    },
    lg: {
      pack: 'text-3xl sm:text-4xl lg:text-[40px] tracking-tight font-light text-slate-800',
      metrix: 'text-3xl sm:text-4xl lg:text-[40px] font-black tracking-tight text-slate-950',
      dot: 'w-2.5 h-2.5',
      beamWidth: 'w-20',
      tagline: 'text-[14px]',
      containerHeight: 'min-h-[58px]',
    }
  };

  const config = sizeConfigs[size] || sizeConfigs.md;

  return (
    <div
      role="banner"
      tabIndex={0}
      aria-label="PackMetrix Legal Metrology Inspection"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      onClick={onClick}
      className={`relative inline-flex flex-col items-start select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 focus-visible:rounded-lg ${config.containerHeight} ${className}`}
    >
      {/* Main Wordmark Line */}
      <div className="relative inline-block overflow-hidden py-0.5">
        <div className="flex items-baseline tracking-tight">
          <span className={`${config.pack} transition-colors duration-200`}>
            Pack
          </span>
          <span className={`${config.metrix} transition-colors duration-200 relative`}>
            Metrix
            {/* Precision accent dot */}
            <span className={`inline-block ${config.dot} rounded-xs bg-sky-600 ml-1 mb-0.5 transition-all duration-300 ${
              isScanning ? 'scale-125 bg-sky-500 shadow-[0_0_8px_rgba(2,132,199,0.8)]' : ''
            }`} />
          </span>
        </div>

        {/* Optical Scanning Line Sweeping Across the Letters */}
        {isScanning && (
          <div
            aria-hidden="true"
            className={`absolute inset-y-0 pointer-events-none ${config.beamWidth} animate-scan-beam bg-gradient-to-r from-transparent via-sky-400/30 to-transparent`}
          >
            {/* Focused Vertical Laser Hairline */}
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1.5px] bg-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.95)]" />
          </div>
        )}
      </div>

      {/* Tagline revealed directly below with 8px spacing, zero clipping & zero page jump */}
      <div
        aria-live="polite"
        className={`pt-1.5 pointer-events-none transition-all duration-300 ${
          showTagline
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-1 pointer-events-none'
        }`}
      >
        <div className={`font-mono font-medium text-sky-900 tracking-wider leading-none ${config.tagline}`}>
          Scan. Verify. Comply.
        </div>
      </div>
    </div>
  );
}
