import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import satiLogo from '../assets/sati-logo.jpg';
import { useAuth } from '../hooks/useAuth';
import { notificationAPI } from '../services/api';
import { getAccountIdentity, getNavigationLinks } from '../utils/navigation';

const Icon = ({ children, className = 'h-5 w-5' }) => <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">{children}</svg>;
const SunIcon = () => <Icon><path strokeLinecap="round" d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.36 6.36-1.42-1.42M7.06 7.06 5.64 5.64m12.72 0-1.42 1.42M7.06 16.94l-1.42 1.42" /><circle cx="12" cy="12" r="4" /></Icon>;
const MoonIcon = () => <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.7 6.7 0 0 0 21 12.8Z" /></Icon>;
const BellIcon = () => <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M15 17H9m9-2v-4a6 6 0 0 0-12 0v4l-2 2h16l-2-2Zm-7 5h2" /></Icon>;
const MenuIcon = ({ open }) => <Icon><path strokeLinecap="round" strokeLinejoin="round" d={open ? 'M6 6l12 12M18 6 6 18' : 'M4 7h16M4 12h16M4 17h16'} /></Icon>;
const ChevronIcon = () => <Icon className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="m8 10 4 4 4-4" /></Icon>;

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigationButtonRef = useRef(null);
  const profileButtonRef = useRef(null);
  const navRef = useRef(null);
  const links = useMemo(() => getNavigationLinks(user?.role), [user?.role]);
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    let mounted = true;
    if (!user) return undefined;
    const load = async () => {
      try {
        const response = await notificationAPI.getAll();
        if (mounted) setUnreadCount((response.data.data || []).filter((item) => !item.isRead).length);
      } catch { if (mounted) setUnreadCount(0); }
    };
    load();
    const interval = setInterval(load, 30000);
    return () => { mounted = false; clearInterval(interval); };
  }, [user]);

  useEffect(() => {
    if (!navigationOpen && !profileOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      (profileOpen ? profileButtonRef : navigationButtonRef).current?.focus();
      setNavigationOpen(false); setProfileOpen(false);
    };
    const onPointerDown = (event) => {
      if (!navRef.current?.contains(event.target)) { setNavigationOpen(false); setProfileOpen(false); }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => { document.removeEventListener('keydown', onKeyDown); document.removeEventListener('pointerdown', onPointerDown); };
  }, [navigationOpen, profileOpen]);

  const { displayName, initials } = getAccountIdentity(user?.name);
  const handleLogout = () => { setProfileOpen(false); logout(); navigate('/'); };

  return (
    <nav ref={navRef} aria-label="Primary navigation" className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950 text-white shadow-sm">
      <div className="section-container flex h-16 items-center gap-2 sm:gap-3">
        <Link to="/dashboard" className="flex min-w-0 shrink items-center gap-2" aria-label="CampusSwap dashboard">
          <img src={satiLogo} alt="SATI logo" className="h-9 w-9 shrink-0 rounded-md border border-white/15 bg-white object-contain p-1" />
          <span className="hidden min-w-0 leading-tight sm:block">
            <span className="block truncate text-base font-extrabold tracking-tight sm:text-lg">CampusSwap</span>
            <span className="hidden truncate text-[9px] font-semibold uppercase tracking-wider text-slate-400 lg:block">Samrat Ashok Technological Institute</span>
          </span>
        </Link>

        <div className="ml-auto hidden min-w-0 items-center gap-0.5 min-[1440px]:flex">
          {links.map((link) => <NavLink key={link.href} to={link.href} className={({ isActive }) => `whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-semibold ${isActive ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>{link.label}</NavLink>)}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 min-[1440px]:ml-2 sm:gap-2">
          <button ref={navigationButtonRef} type="button" className="control-icon min-[1440px]:hidden" aria-label={`${navigationOpen ? 'Close' : 'Open'} navigation menu`} aria-expanded={navigationOpen} aria-controls="compact-navigation" onClick={() => { setNavigationOpen((value) => !value); setProfileOpen(false); }}><MenuIcon open={navigationOpen} /></button>
          <Link to="/notifications" className="control-icon relative" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}>
            <BellIcon />
            {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </Link>
          <button type="button" onClick={() => setDark((value) => !value)} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title={dark ? 'Use light theme' : 'Use dark theme'} className="control-icon">{dark ? <SunIcon /> : <MoonIcon />}</button>
          <div className="relative">
            <button ref={profileButtonRef} type="button" className="flex h-10 max-w-[9.5rem] items-center gap-2 rounded-lg border border-white/15 px-1.5 text-left hover:bg-slate-800 sm:max-w-[13rem] sm:pr-2" aria-label={`Account menu for ${displayName}`} aria-expanded={profileOpen} aria-controls="profile-menu" onClick={() => { setProfileOpen((value) => !value); setNavigationOpen(false); }}>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-blue-600 text-xs font-bold">{initials}</span>
              <span className="hidden min-w-0 flex-1 truncate text-sm font-semibold md:block">{displayName}</span>
              <span className="hidden text-slate-400 sm:block"><ChevronIcon /></span>
            </button>
            <AnimatePresence>{profileOpen && <motion.div id="profile-menu" role="menu" initial={reduceMotion ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute right-0 top-12 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 text-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-700"><p className="truncate text-sm font-bold">{displayName}</p><p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email || 'CampusSwap account'}</p></div>
              <Link role="menuitem" to="/profile" onClick={() => setProfileOpen(false)} className="mt-1 block rounded-md px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">View profile</Link>
              <button role="menuitem" type="button" onClick={handleLogout} className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40">Log out</button>
            </motion.div>}</AnimatePresence>
          </div>
        </div>
      </div>

      <AnimatePresence>{navigationOpen && <motion.div id="compact-navigation" initial={reduceMotion ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-t border-slate-800 min-[1440px]:hidden">
        <div className="section-container grid gap-1 py-3 sm:grid-cols-2 lg:grid-cols-3">{links.map((link) => <NavLink key={link.href} to={link.href} onClick={() => setNavigationOpen(false)} className={({ isActive }) => `min-h-11 rounded-lg px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-white text-slate-950' : 'text-slate-200 hover:bg-slate-800 hover:text-white'}`}>{link.label}</NavLink>)}</div>
      </motion.div>}</AnimatePresence>
    </nav>
  );
}
