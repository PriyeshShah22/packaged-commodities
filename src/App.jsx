import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import LoginRoute from './routes/LoginRoute';
import SignupRoute from './routes/SignupRoute';
import DashboardPlaceholder from './routes/DashboardPlaceholder';
import InspectorTestRoute from './routes/InspectorTestRoute';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/signup" element={<SignupRoute />} />
          <Route path="/dashboard" element={<DashboardPlaceholder />} />
          <Route path="/inspector-test" element={<InspectorTestRoute />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
