import React from 'react';

/**
 * PasswordStrengthMeter
 * 
 * Compact, restrained 3-tier password strength feedback (Weak / Moderate / Strong).
 * Evaluates length, character diversity, and numbers/symbols.
 */
export default function PasswordStrengthMeter({ password = '' }) {
  if (!password) return null;

  const calculateStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 2) {
      return {
        level: 'weak',
        label: 'Weak',
        score: 1,
        color: 'bg-rose-500',
        textColor: 'text-rose-600',
        hint: 'Use 8+ characters with mixed case & numbers'
      };
    }
    if (score <= 4) {
      return {
        level: 'moderate',
        label: 'Moderate',
        score: 2,
        color: 'bg-amber-500',
        textColor: 'text-amber-600',
        hint: 'Add symbols to increase security'
      };
    }
    return {
      level: 'strong',
      label: 'Strong',
      score: 3,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-600',
      hint: 'Compliance-grade password strength'
    };
  };

  const strength = calculateStrength(password);

  return (
    <div className="mt-2 space-y-1.5 animate-fade-in-up">
      {/* 3-segment bar */}
      <div className="flex items-center gap-1.5 h-1.5 w-full">
        <div
          className={`h-full flex-1 rounded-full transition-all duration-300 ${
            strength.score >= 1 ? strength.color : 'bg-slate-200'
          }`}
        />
        <div
          className={`h-full flex-1 rounded-full transition-all duration-300 ${
            strength.score >= 2 ? strength.color : 'bg-slate-200'
          }`}
        />
        <div
          className={`h-full flex-1 rounded-full transition-all duration-300 ${
            strength.score >= 3 ? strength.color : 'bg-slate-200'
          }`}
        />
      </div>

      {/* Label and Hint */}
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-slate-500">
          Strength:{' '}
          <span className={`font-semibold ${strength.textColor}`}>
            {strength.label}
          </span>
        </span>
        <span className="text-slate-400 text-[10px] truncate max-w-[200px]">
          {strength.hint}
        </span>
      </div>
    </div>
  );
}
