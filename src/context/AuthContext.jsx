import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('packmetrix_mock_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [simulatedNetworkError, setSimulatedNetworkError] = useState(false);

  useEffect(() => {
    if (user) {
      sessionStorage.setItem('packmetrix_mock_user', JSON.stringify(user));
    } else {
      sessionStorage.removeItem('packmetrix_mock_user');
    }
  }, [user]);

  /**
   * Mock login function with realistic response delay and validation
   */
  const login = async ({ email, password, _remember = false }) => {
    // Artificial realistic inspection network latency
    await new Promise((resolve) => setTimeout(resolve, 750));

    if (simulatedNetworkError) {
      throw new Error('Something went wrong. Try again.');
    }

    // Validate demo error triggers
    if (password === 'wrongpassword' || password === 'error') {
      throw new Error('Incorrect email or password.');
    }

    // Default successful login
    const mockUser = {
      email,
      name: email.split('@')[0].replace('.', ' ').replace(/(^\w|\s\w)/g, m => m.toUpperCase()),
      organization: email.includes('.gov.in') ? 'Department of Consumer Affairs (Legal Metrology Division)' : 'Compliance Audit Directorate',
      role: 'Legal Metrology Inspector',
      token: 'mock-jwt-lm-' + Math.random().toString(36).substring(2),
      signedInAt: new Date().toISOString(),
    };

    setUser(mockUser);
    return mockUser;
  };

  /**
   * Mock signup function
   */
  const signup = async ({ name, email, organization, role, _password }) => {
    await new Promise((resolve) => setTimeout(resolve, 850));


    if (simulatedNetworkError) {
      throw new Error('Something went wrong. Try again.');
    }

    const mockUser = {
      name,
      email,
      organization,
      role: role || 'Enforcement Officer',
      token: 'mock-jwt-lm-' + Math.random().toString(36).substring(2),
      signedInAt: new Date().toISOString(),
    };

    setUser(mockUser);
    return mockUser;
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        login,
        signup,
        logout,
        simulatedNetworkError,
        setSimulatedNetworkError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
