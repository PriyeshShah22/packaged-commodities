import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import AuthInput from './AuthInput';
import PasswordStrengthMeter from './PasswordStrengthMeter';

/**
 * PasswordInput
 * 
 * Secure password input field with visibility toggle and optional
 * compact password-strength indicator for the signup flow.
 */
export default function PasswordInput({
  id,
  name = 'password',
  label = 'Password',
  value,
  onChange,
  onBlur,
  placeholder = '••••••••••••',
  error,
  isValid,
  required = true,
  showStrength = false,
  autoComplete = 'current-password',
  disabled = false,
  helperText,
}) {
  const [showPassword, setShowPassword] = useState(false);

  const toggleVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const toggleButton = (
    <button
      type="button"
      onClick={toggleVisibility}
      tabIndex={0}
      disabled={disabled}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
      className="p-1 rounded text-slate-400 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 transition-colors"
    >
      {showPassword ? (
        <EyeOff className="w-4 h-4" />
      ) : (
        <Eye className="w-4 h-4" />
      )}
    </button>
  );

  return (
    <div className="w-full">
      <AuthInput
        id={id}
        name={name}
        label={label}
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        error={error}
        isValid={isValid}
        icon={Lock}
        required={required}
        autoComplete={autoComplete}
        disabled={disabled}
        helperText={helperText}
        rightElement={toggleButton}
      />

      {showStrength && value && (
        <PasswordStrengthMeter password={value} />
      )}
    </div>
  );
}
