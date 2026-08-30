import React from 'react';
import AuthLayout from '../components/auth/AuthLayout';
import SignupForm from '../components/auth/SignupForm';

export default function SignupRoute() {
  return (
    <AuthLayout>
      <SignupForm />
    </AuthLayout>
  );
}
