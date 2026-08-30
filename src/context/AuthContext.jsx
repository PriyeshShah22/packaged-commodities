import React, { useEffect, useState } from 'react';
import { loginAccount, signupAccount, verifySession } from '../lib/api';
import { AuthContext } from './auth-context';

const SESSION_KEY = 'packmetrix_session';

function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession);
  const [checkingSession, setCheckingSession] = useState(Boolean(session?.token));

  useEffect(() => {
    if (!session?.token) return;
    verifySession(session.token)
      .then((user) => setSession((current) => ({ ...current, user })))
      .catch(() => setSession(null))
      .finally(() => setCheckingSession(false));
  }, [session?.token]);

  useEffect(() => {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  }, [session]);

  const login = async ({ email, password }) => {
    const response = await loginAccount(email, password);
    const next = { token: response.access_token, user: response.user };
    setSession(next);
    return response.user;
  };

  const signup = async ({ name, email, organization, password, _password }) => {
    const response = await signupAccount({ name, email, organization, password: password || _password });
    const next = { token: response.access_token, user: response.user };
    setSession(next);
    return response.user;
  };

  const logout = () => setSession(null);
  const hasRole = (...roles) => Boolean(session?.user?.roles?.some((role) => roles.includes(role)));

  return <AuthContext.Provider value={{ user: session?.user || null, token: session?.token || null, isAuthenticated: Boolean(session?.token && session?.user), checkingSession, login, signup, logout, hasRole }}>{children}</AuthContext.Provider>;
}
