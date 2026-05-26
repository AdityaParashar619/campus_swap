import { createContext, useEffect, useState } from 'react';
import { authAPI } from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const hydrateAuth = async () => {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');

      if (token && userData) {
        try {
          setUser(JSON.parse(userData));
          const response = await authAPI.getMe();
          if (mounted && response?.data?.data) {
            setUser((prev) => ({ ...prev, ...response.data.data }));
          }
        } catch {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          if (mounted) setUser(null);
        }
      }

      if (mounted) setLoading(false);
    };

    hydrateAuth();
    return () => {
      mounted = false;
    };
  }, []);

  const login = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, logout, loading }}>{children}</AuthContext.Provider>;
};
