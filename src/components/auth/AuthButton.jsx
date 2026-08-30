import React from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

/**
 * AuthButton
 * 
 * Scaled Primary CTA Button:
 * - 48px height (h-12) with solid visual weight
 * - High contrast dark slate / precision accent styling
 * - Smooth micro-interaction with animated arrow on hover
 * - Stable height & layout during loading state (no content shifting)
 * - Accessible focus-visible state
 */
export default function AuthButton({
  children,
  type = 'submit',
  isLoading = false,
  loadingText = 'Authenticating...',
  onClick,
  disabled = false,
  showArrow = true,
  variant = 'primary', // 'primary' | 'secondary'
  className = '',
}) {
  const isButtonDisabled = disabled || isLoading;

  const baseStyles = "group relative w-full h-12 inline-flex items-center justify-center font-semibold rounded-xl text-sm sm:text-base px-5 transition-all duration-150 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
  
  const variants = {
    primary: "bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white shadow-sm hover:shadow-md focus-visible:ring-slate-900 border border-slate-900",
    secondary: "bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 hover:text-slate-950 border border-slate-300 shadow-2xs focus-visible:ring-sky-500",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isButtonDisabled}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${
        isButtonDisabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
    >
      <span className="flex items-center justify-center gap-2.5">
        {isLoading ? (
          <>
            <Loader2 className="w-4.5 h-4.5 animate-spin text-sky-400" />
            <span className="font-mono text-xs sm:text-sm tracking-tight">{loadingText}</span>
          </>
        ) : (
          <>
            <span>{children}</span>
            {showArrow && (
              <ArrowRight className="w-4.5 h-4.5 transition-transform duration-200 group-hover:translate-x-1.5 text-slate-300 group-hover:text-white" />
            )}
          </>
        )}
      </span>
    </button>
  );
}
