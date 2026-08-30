import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/auth-context';
import LoginRoute from './routes/LoginRoute';
import SignupRoute from './routes/SignupRoute';
import DashboardPlaceholder from './routes/DashboardPlaceholder';
import InspectorTestRoute from './routes/InspectorTestRoute';
import NewInspectionRoute from './routes/NewInspectionRoute';
import ReportsRoute from './routes/ReportsRoute';
import ReportDetailRoute from './routes/ReportDetailRoute';
import ProductsRoute from './routes/ProductsRoute';

function ProtectedRoute() {
  const { isAuthenticated, checkingSession } = useAuth();
  if (checkingSession) return <div className="min-h-screen grid place-items-center text-sm text-slate-500">Verifying secure session…</div>;
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

function InspectorRoute() {
  const { hasRole } = useAuth();
  return hasRole('inspector', 'admin') ? <Outlet /> : <Navigate to="/reports" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/signup" element={<SignupRoute />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPlaceholder />} />
            <Route path="/reports" element={<ReportsRoute />} />
            <Route path="/reports/:id" element={<ReportDetailRoute />} />
            <Route path="/products" element={<ProductsRoute />} />
            <Route element={<InspectorRoute />}><Route path="/inspections/new" element={<NewInspectionRoute />} /></Route>
          </Route>
          <Route path="/inspector-test" element={<InspectorTestRoute />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
