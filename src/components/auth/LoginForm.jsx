import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, AlertCircle, KeyRound } from 'lucide-react';
import AuthInput from './AuthInput';
import PasswordInput from './PasswordInput';
import AuthButton from './AuthButton';
import ForgotPasswordModal from './ForgotPasswordModal';
import { useAuth } from '../../context/auth-context';

/**
 * LoginForm
 * 
 * Clean, high-presence login form adhering to exact PackMetrix specifications:
 * - Heading: "Welcome back"
 * - Supporting text: "Sign in to continue"
 * - Large 48px inputs with clear labels
 * - Prominent CTA: "Sign in →"
 */
export default function LoginForm() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    remember: false,
  });

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  const validateField = (name, value) => {
    let error = '';
    if (name === 'email') {
      if (!value) {
        error = 'Enter a valid work email.';
      } else if (!/\S+@\S+\.\S+/.test(value)) {
        error = 'Enter a valid work email.';
      }
    } else if (name === 'password') {
      if (!value) {
        error = 'Password is required.';
      }
    }
    return error;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    
    setFormData((prev) => ({
      ...prev,
      [name]: val,
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
    if (formError) setFormError('');
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    const error = validateField(name, value);
    if (error) {
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const emailErr = validateField('email', formData.email);
    const passErr = validateField('password', formData.password);

    if (emailErr || passErr) {
      setErrors({
        email: emailErr,
        password: passErr,
      });
      return;
    }

    setIsLoading(true);

    try {
      await login({
        email: formData.email,
        password: formData.password,
        _remember: formData.remember,
      });

      navigate('/dashboard');
    } catch (err) {
      setFormError(err.message || 'Incorrect email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoFill = () => {
    setFormData({
      email: 'officer.sharma@consumeraffairs.gov.in',
      password: 'LegalMetrology2026!',
      remember: true,
    });
    setErrors({});
    setFormError('');
  };

  return (
    <div className="w-full max-w-[460px] mx-auto space-y-8 animate-fade-in-up">
      {/* Form Header */}
      <div className="space-y-1.5 text-left">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
          Welcome back
        </h1>
        <p className="text-base text-slate-500 font-normal">
          Sign in to continue
        </p>
      </div>

      {/* Global Form Error Banner */}
      {formError && (
        <div
          role="alert"
          className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-sm font-medium animate-fade-in-up"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{formError}</span>
        </div>
      )}

      {/* Main Form Fields */}
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* Work Email */}
        <AuthInput
          id="login-email"
          name="email"
          label="WORK EMAIL"
          type="email"
          placeholder="name@organization.gov.in"
          icon={Mail}
          value={formData.email}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.email}
          isValid={Boolean(formData.email && !errors.email && /\S+@\S+\.\S+/.test(formData.email))}
          required
          autoComplete="email"
          disabled={isLoading}
        />

        {/* Password */}
        <PasswordInput
          id="login-password"
          name="password"
          label="PASSWORD"
          value={formData.password}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.password}
          isValid={Boolean(formData.password && !errors.password)}
          required
          autoComplete="current-password"
          disabled={isLoading}
        />

        {/* Remember Session & Forgot Password Row */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              name="remember"
              checked={formData.remember}
              onChange={handleChange}
              disabled={isLoading}
              className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500/20 cursor-pointer"
            />
            <span className="font-medium">Remember session</span>
          </label>

          <button
            type="button"
            onClick={() => setIsForgotModalOpen(true)}
            className="text-sm font-semibold text-sky-700 hover:text-sky-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
          >
            Forgot password?
          </button>
        </div>

        {/* Submit Primary CTA */}
        <div className="pt-2">
          <AuthButton
            type="submit"
            isLoading={isLoading}
            loadingText="Signing in..."
          >
            Sign in
          </AuthButton>
        </div>
      </form>

      {/* Switch to Signup & Discreet Demo Action */}
      <div className="pt-6 text-center border-t border-slate-200/80 flex flex-col items-center gap-3">
        <p className="text-sm text-slate-600">
          New to PackMetrix?{' '}
          <Link
            to="/signup"
            className="font-bold text-slate-900 hover:text-sky-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded px-1 py-0.5 inline-block"
          >
            Create account
          </Link>
        </p>

        {/* Discreet demo credentials helper */}
        <button
          type="button"
          onClick={handleQuickDemoFill}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-slate-700 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-500 rounded px-2.5 py-1"
        >
          <KeyRound className="w-3.5 h-3.5 text-slate-400" />
          <span>Demo credentials</span>
        </button>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
      />
    </div>
  );
}
