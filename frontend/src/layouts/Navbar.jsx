import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { notificationAPI } from '../services/api';

const baseLinks = [
  { href: '/listings', label: 'Marketplace' },
  { href: '/notes', label: 'Notes' },
  { href: '/bounties', label: 'Requests' },
  { href: '/network', label: 'Network' },
  { href: '/chat', label: 'Chat' }
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    let mounted = true;
    if (!user) return undefined;

    const load = async () => {
      try {
        const response = await notificationAPI.getAll();
        const unread = (response.data.data || []).filter((n) => !n.isRead).length;
        if (mounted) setUnreadCount(unread);
      } catch {
        if (mounted) setUnreadCount(0);
      }
    };

    load();
    const interval = setInterval(load, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [user]);

  const links = [...baseLinks];
  if (user?.role === 'admin') links.push({ href: '/admin', label: 'Admin' });

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const toggleTheme = () => {
    setDark((v) => !v);
  };

  return (
    <motion.nav
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-50 border-b border-slate-200/20 bg-white/70 dark:bg-slate-950/65 backdrop-blur-2xl supports-[backdrop-filter]:bg-white/55"
    >
      <div className="section-container py-3 flex items-center justify-between gap-4">
        <Link to="/dashboard" className="font-black text-xl tracking-tight bg-gradient-to-r from-blue-600 to-violet-500 bg-clip-text text-transparent">
          CampusSwap
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {links.map((link) => (
            <NavLink
              key={link.href}
              to={link.href}
              className={({ isActive }) => `text-sm font-medium transition ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300 hover:text-blue-500'}`}
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link to="/notifications" className="relative px-3 py-2 rounded-xl border border-slate-300/30 text-sm">
            Notifications
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 bg-rose-500 text-white text-[10px] rounded-full flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
          <button onClick={toggleTheme} className="px-3 py-2 rounded-xl border border-slate-300/30 text-sm">{dark ? 'Light' : 'Dark'}</button>
          <Link to="/profile" className="text-sm font-medium text-slate-700 dark:text-slate-200">{user?.name || 'Profile'}</Link>
          <button onClick={handleLogout} className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 text-white text-sm font-semibold">Logout</button>
        </div>

        <button className="md:hidden px-3 py-2 rounded-xl border border-slate-300/30" onClick={() => setIsOpen((v) => !v)}>
          Menu
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.24 }}
            className="md:hidden overflow-hidden"
          >
            <div className="section-container pb-4 flex flex-col gap-2">
              <Link to="/notifications" className="px-3 py-2 rounded-xl bg-white/50 dark:bg-slate-900/40" onClick={() => setIsOpen(false)}>
                Notifications {unreadCount > 0 ? `(${unreadCount})` : ''}
              </Link>
              {links.map((link) => (
                <Link key={link.href} to={link.href} className="px-3 py-2 rounded-xl bg-white/50 dark:bg-slate-900/40" onClick={() => setIsOpen(false)}>
                  {link.label}
                </Link>
              ))}
              <div className="flex gap-2 mt-2">
                <button onClick={toggleTheme} className="px-3 py-2 rounded-xl border border-slate-300/30 text-sm">{dark ? 'Light' : 'Dark'}</button>
                <button onClick={handleLogout} className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 text-white text-sm font-semibold">Logout</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
