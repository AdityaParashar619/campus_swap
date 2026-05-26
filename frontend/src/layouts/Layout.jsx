import Navbar from './Navbar';
import { motion } from 'framer-motion';
import Footer from './Footer';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <motion.div
          className="absolute -top-32 -left-32 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl"
          animate={{ x: [0, 16, 0], y: [0, 10, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-48 -right-24 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl"
          animate={{ x: [0, -14, 0], y: [0, -8, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <Navbar />
      <div className="relative z-10">{children}</div>
      <Footer />
    </div>
  );
}
