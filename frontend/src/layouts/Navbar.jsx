import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-50 backdrop-blur-md bg-white/70 shadow-sm border-b border-white/20"
    >
      <div className="section-container py-4 flex justify-between items-center">
        {/* Logo */}
        <Link to="/dashboard">
          <motion.div
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            className="text-2xl font-display font-black text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text cursor-pointer"
          >
            CampusSwap
          </motion.div>
        </Link>

        {/* Navigation Links */}
        <div className="flex gap-8">
          {[
            { href: '/listings', label: 'Listings', icon: '📦' },
            { href: '/bounties', label: 'Bounties', icon: '🎯' },
            { href: '/chat', label: 'Chat', icon: '💬' }
          ].map((link) => (
            <Link key={link.href} to={link.href}>
              <motion.div
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
                className="text-gray-700 font-medium transition-all duration-200 cursor-pointer relative group flex items-center gap-2"
              >
                <span className="text-lg group-hover:scale-110 transition-transform">{link.icon}</span>
                <span>{link.label}</span>
                <motion.span
                  initial={{ scaleX: 0 }}
                  whileHover={{ scaleX: 1 }}
                  transition={{ duration: 0.3 }}
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-600 to-purple-600 origin-left"
                />
              </motion.div>
            </Link>
          ))}
        </div>

        {/* User Menu */}
        <div className="flex gap-4 items-center">
          <Link to="/profile">
            <motion.div
              whileHover={{ scale: 1.05, color: '#4F46E5' }}
              whileTap={{ scale: 0.95 }}
              className="text-gray-700 font-medium transition-all duration-200 cursor-pointer flex items-center gap-2"
            >
              <span>👤</span>
              {user?.name || 'Profile'}
            </motion.div>
          </Link>
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 10px 25px rgba(239, 68, 68, 0.3)' }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLogout}
            className="px-6 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-300"
          >
            Logout
          </motion.button>
        </div>
      </div>
    </motion.nav>
  );
}
