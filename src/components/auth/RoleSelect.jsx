import React from 'react';
import { UserCheck, ChevronDown, AlertCircle } from 'lucide-react';

/**
 * RoleSelect
 * 
 * Accessible dropdown selector for designated PackMetrix workspace roles:
 * - Enforcement Officer
 * - Legal Metrology Inspector
 * - Metrology Inspector
 * - Department Administrator
 */
export default function RoleSelect({
  id = 'role',
  name = 'role',
  label = 'Designated Role',
  value,
  onChange,
  onBlur,
  error,
  required = true,
  disabled = false,
  className = '',
}) {
  const roles = [
    { value: '', label: 'Select your designated role...', disabled: true },
    { value: 'enforcement_officer', label: 'Enforcement Officer' },
    { value: 'legal_metrology_inspector', label: 'Legal Metrology Inspector' },
    { value: 'metrology_inspector', label: 'Metrology Inspector' },
    { value: 'department_administrator', label: 'Department Administrator' },
  ];

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="block text-xs font-bold uppercase tracking-wider text-slate-800 select-none"
        >
          {label} {required && <span className="text-sky-600 font-normal">*</span>}
        </label>
      </div>

      <div className="relative rounded-xl shadow-xs">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
          <UserCheck className="w-4.5 h-4.5" />
        </div>

        <select
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : `${id}-helper`}
          className={`block w-full h-12 rounded-xl text-sm sm:text-base bg-white text-slate-900 appearance-none pl-11 pr-11 transition-all duration-150 cursor-pointer ${
            error
              ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 bg-rose-50/10'
              : 'border-slate-300 hover:border-slate-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-500/20'
          } border disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`}
        >
          {roles.map((role) => (
            <option key={role.value} value={role.value} disabled={role.disabled}>
              {role.label}
            </option>
          ))}
        </select>

        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
          <ChevronDown className="w-4.5 h-4.5" />
        </div>
      </div>

      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold animate-fade-in-up pt-0.5"
        >
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
        </p>
      ) : (
        <p id={`${id}-helper`} className="text-[11px] text-slate-400 font-mono">
          Final permissions governed by backend RBAC clearance.
        </p>
      )}
    </div>
  );
}
