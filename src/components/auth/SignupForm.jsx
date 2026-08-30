import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Building2, AlertCircle } from 'lucide-react';
import AuthInput from './AuthInput';
import PasswordInput from './PasswordInput';
import RoleSelect from './RoleSelect';
import AuthButton from './AuthButton';
import { useAuth } from '../../context/AuthContext';

/**
 * SignupForm
 * 
 * Clean, high-presence signup form matching exact PackMetrix specifications:
 * - Heading: "Create your account"
 * - Supporting text: "Set up your inspection workspace"
 * - Fields: FULL NAME, WORK EMAIL, ORGANIZATION / DIRECTORATE, DESIGNATED ROLE, PASSWORD, CONFIRM PASSWORD
 * - Primary CTA: "Create account →"
 */
export default function SignupForm() {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization: '',
    role: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validateField = (name, value, allValues = formData) => {
    let error = '';
    switch (name) {
      case 'name':
        if (!value.trim()) error = 'Full name is required.';
        break;
      case 'email':
        if (!value.trim()) {
          error = 'Enter a valid work email.';
        } else if (!/\S+@\S+\.\S+/.test(value)) {
          error = 'Enter a valid work email.';
        }
        break;
      case 'organization':
        if (!value.trim()) error = 'Organization name is required.';
        break;
      case 'role':
        if (!value) error = 'Please select a designated role.';
        break;
      case 'password':
        if (!value) {
          error = 'Password is required.';
        } else if (value.length < 8) {
          error = 'Password must be at least 8 characters.';
        }
        break;
      case 'confirmPassword':
        if (!value) {
          error = 'Please confirm your password.';
        } else if (value !== allValues.password) {
          error = "Passwords don't match.";
        }
        break;
      default:
        break;
    }
    return error;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updatedForm = { ...formData, [name]: value };
    setFormData(updatedForm);

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (formError) setFormError('');

    if (name === 'confirmPassword' && value !== formData.password) {
      if (errors.confirmPassword) {
        setErrors((prev) => ({ ...prev, confirmPassword: '' }));
      }
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    const error = validateField(name, value, formData);
    if (error) {
      setErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const newErrors = {};
    Object.keys(formData).forEach((key) => {
      const err = validateField(key, formData[key], formData);
      if (err) newErrors[key] = err;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    try {
      await signup({
        name: formData.name,
        email: formData.email,
        organization: formData.organization,
        role: formData.role,
        _password: formData.password,
      });

      navigate('/dashboard');
    } catch (err) {
      setFormError(err.message || 'Something went wrong. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[460px] mx-auto space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="space-y-1.5 text-left">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
          Create your account
        </h1>
        <p className="text-base text-slate-500 font-normal">
          Set up your inspection workspace
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

      {/* Main Signup Form */}
      <form onSubmit={handleSubmit} className="space-y-4.5" noValidate>
        {/* Full Name */}
        <AuthInput
          id="signup-name"
          name="name"
          label="FULL NAME"
          placeholder="e.g. Insp. Ramesh Sharma"
          icon={User}
          value={formData.name}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.name}
          isValid={Boolean(formData.name.trim() && !errors.name)}
          required
          autoComplete="name"
          disabled={isLoading}
        />

        {/* Work Email */}
        <AuthInput
          id="signup-email"
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

        {/* Organization */}
        <AuthInput
          id="signup-organization"
          name="organization"
          label="ORGANIZATION / DIRECTORATE"
          placeholder="e.g. Legal Metrology Department"
          icon={Building2}
          value={formData.organization}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.organization}
          isValid={Boolean(formData.organization.trim() && !errors.organization)}
          required
          disabled={isLoading}
        />

        {/* Designated Role */}
        <RoleSelect
          id="signup-role"
          name="role"
          value={formData.role}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.role}
          required
          disabled={isLoading}
        />

        {/* Password with Strength Indicator */}
        <PasswordInput
          id="signup-password"
          name="password"
          label="PASSWORD"
          value={formData.password}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.password}
          isValid={Boolean(formData.password && formData.password.length >= 8 && !errors.password)}
          required
          showStrength={true}
          autoComplete="new-password"
          disabled={isLoading}
        />

        {/* Confirm Password */}
        <PasswordInput
          id="signup-confirm-password"
          name="confirmPassword"
          label="CONFIRM PASSWORD"
          value={formData.confirmPassword}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.confirmPassword}
          isValid={Boolean(formData.confirmPassword && formData.confirmPassword === formData.password)}
          required
          showStrength={false}
          autoComplete="new-password"
          disabled={isLoading}
        />

        {/* Submit Primary CTA */}
        <div className="pt-2">
          <AuthButton
            type="submit"
            isLoading={isLoading}
            loadingText="Creating account..."
          >
            Create account →
          </AuthButton>
        </div>
      </form>

      {/* Switch to Login */}
      <div className="pt-5 text-center border-t border-slate-200/80">
        <p className="text-sm text-slate-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-bold text-slate-900 hover:text-sky-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded px-1 py-0.5 inline-block"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
