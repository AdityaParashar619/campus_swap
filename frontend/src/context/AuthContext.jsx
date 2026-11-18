import { createContext, useEffect, useState } from 'react';
import { authAPI, refreshAuthSession, setAccessToken } from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profileStats, setProfileStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyProfile = (profile, stats) => {
    setUser(profile);
    if (stats !== undefined) setProfileStats(stats);
    localStorage.setItem('user', JSON.stringify(profile));
  };

  useEffect(() => {
    let mounted = true;
    const hydrateAuth = async () => {
      try {
        const session = await refreshAuthSession();
        if (!mounted) return;
        setAccessToken(session.data.token);
        const response = await authAPI.getMe();
        const restored = response?.data?.data || session.data.user || null;
        if (mounted) {
          setUser(restored);
          setProfileStats(response?.data?.stats || null);
          if (restored) localStorage.setItem('user', JSON.stringify(restored));
        }
      } catch {
        localStorage.removeItem('user');
        setAccessToken(null);
        if (mounted) setUser(null);
        if (mounted) setProfileStats(null);
      }

      if (mounted) setLoading(false);
    };

    hydrateAuth();
    return () => {
      mounted = false;
    };
  }, []);

  const login = (userData, token) => {
    setAccessToken(token);
    setProfileStats(null);
    applyProfile(userData);
  };

  const logout = async () => {
    try { await authAPI.logout(); } catch { /* Clear local state even when offline. */ }
    setAccessToken(null);
    localStorage.removeItem('user');
    setUser(null);
    setProfileStats(null);
  };

  useEffect(() => {
    const expire = () => {
      setAccessToken(null);
      localStorage.removeItem('user');
      setUser(null);
      setProfileStats(null);
    };
    window.addEventListener('campusswap:session-expired', expire);
    return () => window.removeEventListener('campusswap:session-expired', expire);
  }, []);

  return <AuthContext.Provider value={{ user, profileStats, login, logout, loading, applyProfile }}>{children}</AuthContext.Provider>;
};
