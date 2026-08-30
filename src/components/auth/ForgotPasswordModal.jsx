import React, { useState } from 'react';
import { X, Mail, CheckCircle2 } from 'lucide-react';

import AuthInput from './AuthInput';
import AuthButton from './AuthButton';

/**
 * ForgotPasswordModal
 * 
 * Accessible dialog for password recovery instructions.
 */
export default function ForgotPasswordModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError('Enter a valid work email.');
      return;
    }

    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 650));
    setIsSubmitting(false);
    setIsSent(true);
  };

  const handleClose = () => {
    setIsSent(false);
    setEmail('');
    setError('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="forgot-password-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in-up"
    >
      <div className="relative w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-2xl p-6">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1 rounded-md text-slate-400 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {isSent ? (
          <div className="space-y-4 py-2">
            <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Recovery email dispatched</h3>
              <p className="text-xs text-slate-600">
                Instructions to reset your inspection credentials have been sent to <span className="font-mono font-medium text-slate-800">{email}</span>.
              </p>
            </div>
            <AuthButton onClick={handleClose} showArrow={false} variant="secondary">
              Back to Sign in
            </AuthButton>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <h3 id="forgot-password-title" className="text-lg font-bold text-slate-900">
                Reset Password
              </h3>
              <p className="text-xs text-slate-600">
                Enter your registered work email to receive password reset instructions.
              </p>
            </div>

            <AuthInput
              id="reset-email"
              label="Work email"
              type="email"
              placeholder="name@organization.gov.in"
              icon={Mail}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              error={error}
              required
            />

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="w-1/2 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <div className="w-1/2">
                <AuthButton
                  type="submit"
                  isLoading={isSubmitting}
                  loadingText="Sending..."
                >
                  Send link
                </AuthButton>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
