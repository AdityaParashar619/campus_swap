import { motion } from 'framer-motion';

export const Button = ({ children, onClick, variant = 'primary', size = 'md', ...props }) => {
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  };

  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/40',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 shadow-md',
    danger: 'bg-red-500 text-white hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/30',
    gradient: 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/40 font-semibold',
    glass: 'bg-white/20 backdrop-blur-md border border-white/30 text-white hover:bg-white/30 hover:shadow-lg hover:shadow-white/20 font-semibold'
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`${sizeClasses[size]} rounded-xl font-semibold transition-all duration-300 cursor-pointer ${variants[variant]}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </motion.button>
  );
};

export const GradientButton = ({ children, onClick, size = 'md', ...props }) => {
  return (
    <Button variant="gradient" size={size} onClick={onClick} {...props}>
      {children}
    </Button>
  );
};

export const GlassButton = ({ children, onClick, size = 'md', ...props }) => {
  return (
    <Button variant="glass" size={size} onClick={onClick} {...props}>
      {children}
    </Button>
  );
};

export const Card = ({ children, className = '', ...props }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.05, y: -5, boxShadow: '0 25px 60px rgba(79, 70, 229, 0.25)' }}
      transition={{ duration: 0.3 }}
      className={`p-6 bg-white/10 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 transition-all duration-300 ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const PremiumCard = ({ children, className = '', hover = true, ...props }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={hover ? {
        scale: 1.02,
        y: -8,
        boxShadow: '0 30px 70px rgba(79, 70, 229, 0.25)',
      } : {}}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`p-8 bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 transition-all duration-300 ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const PageTransition = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
};
