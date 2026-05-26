import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { notificationAPI } from '../services/api';
import satiLogo from '../assets/sati-logo.jpg';

const baseLinks = [
  { href: '/listings', label: 'Marketplace' },
  { href: '/notes', label: 'Notes' },
  { href: '/bounties', label: 'Requests' },
  { href: '/network', label: 'Network' },
  { href: '/chat', label: 'Chat' },
  { href: '/about', label: 'About' }
];

const SunIcon = () => (
  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.36 6.36-1.42-1.42M7.06 7.06 5.64 5.64m12.72 0-1.42 1.42M7.06 16.94l-1.42 1.42" />
    <circle cx="12" cy="12" r="4" />
  </svg>
);

const MoonIcon = () => (
  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.7 6.7 0 0 0 21 12.8Z" />
  </svg>
);

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
      className="sticky top-0 z-50 border-b border-white/10 bg-slate-950 text-white shadow-[0_12px_30px_rgba(2,6,23,0.28)]"
    >
      <div className="section-container grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3">
        <Link to="/dashboard" className="group flex items-center gap-2">
          <img src={satiLogo} alt="SATI logo" className="h-10 w-10 rounded-lg border border-white/15 bg-white object-contain p-1 shadow-lg shadow-teal-500/20" />
          <span className="hidden leading-tight min-[380px]:block">
            <span className="block text-lg font-black tracking-tight text-white">SATI Swap</span>
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-300">Samrat Ashok Technological Institute</span>
          </span>
        </Link>

        <div className="mx-auto hidden items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] p-1 xl:flex">
          {links.map((link) => (
            <NavLink
              key={link.href}
              to={link.href}
              className={({ isActive }) => `rounded-md px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-200 hover:bg-white/10 hover:text-white'}`}
            >
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center justify-end gap-3 xl:flex">
          <Link to="/notifications" className="relative rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10">
            Notifications
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 bg-rose-500 text-white text-[10px] rounded-full flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
          <button
            onClick={toggleTheme}
            aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={dark ? 'Light theme' : 'Dark theme'}
            className="grid h-10 w-10 place-items-center rounded-lg border border-white/15 text-slate-100 hover:bg-white/10"
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
          <Link to="/profile" className="max-w-36 truncate text-sm font-bold text-slate-100">{user?.name || 'Profile'}</Link>
          <button onClick={handleLogout} className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-black text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-300">Logout</button>
        </div>

        <button className="rounded-lg border border-white/15 px-3 py-2 font-semibold xl:hidden" onClick={() => setIsOpen((v) => !v)}>
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
            className="overflow-hidden xl:hidden"
          >
            <div className="section-container flex flex-col gap-2 pb-4">
              <Link to="/notifications" className="rounded-lg bg-white/10 px-3 py-2" onClick={() => setIsOpen(false)}>
                Notifications {unreadCount > 0 ? `(${unreadCount})` : ''}
              </Link>
              {links.map((link) => (
                <Link key={link.href} to={link.href} className="rounded-lg bg-white/10 px-3 py-2" onClick={() => setIsOpen(false)}>
                  {link.label}
                </Link>
              ))}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Link to="/profile" className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold" onClick={() => setIsOpen(false)}>
                  {user?.name || 'Profile'}
                </Link>
                <button
                  onClick={toggleTheme}
                  aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
                  className="grid h-10 w-10 place-items-center rounded-lg border border-white/15"
                >
                  {dark ? <SunIcon /> : <MoonIcon />}
                </button>
                <button onClick={handleLogout} className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-black text-slate-950">Logout</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
