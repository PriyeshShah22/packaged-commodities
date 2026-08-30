import React from 'react';
import { Check, AlertCircle } from 'lucide-react';

/**
 * AuthInput
 * 
 * High-precision, readable form input field with enhanced scale:
 * - Comfortable height (48px / h-12)
 * - Clear, high-contrast label typography
 * - Smooth focus state with precision accent ring
 * - Inline validation (Valid checkmark, Invalid concise error message)
 * - Accessible aria-invalid and aria-describedby
 */
export default function AuthInput({
  id,
  name,
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  isValid,
  icon: Icon,
  required = false,
  autoComplete,
  disabled = false,
  helperText,
  rightElement = null,
  className = '',
}) {
  const inputId = id || name;
  const errorId = error ? `${inputId}-error` : undefined;
  const helperId = helperText ? `${inputId}-helper` : undefined;

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      {/* Field Label */}
      <div className="flex items-center justify-between">
        <label
          htmlFor={inputId}
          className="block text-xs font-bold uppercase tracking-wider text-slate-800 select-none"
        >
          {label} {required && <span className="text-sky-600 font-normal">*</span>}
        </label>
        {isValid && !error && (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-emerald-600">
            <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Valid
          </span>
        )}
      </div>

      {/* Input Box Wrapper */}
      <div className="relative rounded-xl shadow-xs">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
            <Icon className="w-4.5 h-4.5" />
          </div>
        )}

        <input
          id={inputId}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId || helperId}
          className={`block w-full h-12 rounded-xl text-sm sm:text-base bg-white text-slate-900 placeholder:text-slate-400 transition-all duration-150 ${
            Icon ? 'pl-11' : 'pl-4'
          } ${rightElement ? 'pr-12' : isValid ? 'pr-11' : 'pr-4'} ${
            error
              ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 text-rose-950 bg-rose-50/10'
              : isValid
              ? 'border-slate-300 focus:border-sky-600 focus:ring-2 focus:ring-sky-500/20'
              : 'border-slate-300 hover:border-slate-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-500/20'
          } border disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`}
        />

        {/* Right side elements: Custom element or Checkmark */}
        {rightElement ? (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {rightElement}
          </div>
        ) : isValid && !error ? (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-emerald-500">
            <Check className="w-4.5 h-4.5 stroke-[2.5]" />
          </div>
        ) : null}
      </div>

      {/* Error Message or Helper */}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold animate-fade-in-up pt-0.5"
        >
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p id={helperId} className="text-[11px] text-slate-500 font-mono">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
