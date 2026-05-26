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
  { href: '/chat', label: 'Chat' },
  { href: '/about', label: 'About' }
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
      className="sticky top-0 z-50 border-b border-white/10 bg-slate-950 text-white shadow-[0_12px_30px_rgba(2,6,23,0.28)]"
    >
      <div className="section-container grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3">
        <Link to="/dashboard" className="group flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-teal-400 via-blue-500 to-amber-400 text-sm font-black text-slate-950 shadow-lg shadow-teal-500/20">CS</span>
          <span className="hidden text-xl font-black tracking-tight text-white min-[380px]:inline">CampusSwap</span>
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
          <button onClick={toggleTheme} className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10">{dark ? 'Light' : 'Dark'}</button>
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
                <button onClick={toggleTheme} className="rounded-lg border border-white/15 px-3 py-2 text-sm">{dark ? 'Light' : 'Dark'}</button>
                <button onClick={handleLogout} className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-black text-slate-950">Logout</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
