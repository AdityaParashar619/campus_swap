import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';

export const Button = ({ children, onClick, variant = 'primary', size = 'md', className = '', ...props }) => {
  const reduceMotion = useReducedMotion();
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-slate-100/80 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    gradient: 'bg-blue-600 text-white hover:bg-blue-700',
    glass: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'
  };

  return (
    <motion.button
      whileHover={reduceMotion ? undefined : { y: -1 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      className={`${sizeClasses[size]} rounded-lg font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </motion.button>
  );
};

export const GradientButton = (props) => <Button variant="gradient" {...props} />;
export const GlassButton = (props) => <Button variant="glass" {...props} />;

export const Card = ({ children, className = '', ...props }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    whileInView={{ opacity: 1, y: 0 }}
    className={`premium-card p-6 ${className}`}
    {...props}
  >
    {children}
  </motion.div>
);

export const PremiumCard = ({ children, className = '', hover = true, ...props }) => (
  <motion.div
    whileHover={hover ? { y: -2 } : undefined}
    transition={{ duration: 0.16 }}
    className={`premium-card p-6 ${className}`}
    {...props}
  >
    {children}
  </motion.div>
);

export const PageTransition = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -12 }}
    transition={{ duration: 0.3 }}
  >
    {children}
  </motion.div>
);

export const PageLoader = ({ label = 'Loading...' }) => (
  <div className="min-h-[50vh] flex items-center justify-center" role="status" aria-live="polite">
    <div className="text-center">
      <div className="w-10 h-10 mx-auto rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" aria-hidden="true" />
      <p className="mt-4 text-sm text-slate-500">{label}</p>
    </div>
  </div>
);

export const Reveal = ({ children, className = '', delay = 0, y = 18 }) => (
  <motion.div
    initial={{ opacity: 0, y }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.2 }}
    transition={{ duration: 0.45, delay }}
    className={className}
  >
    {children}
  </motion.div>
);

export const Stagger = ({ children, className = '', stagger = 0.08 }) => (
  <motion.div
    initial="hidden"
    whileInView="show"
    viewport={{ once: true, amount: 0.15 }}
    variants={{
      hidden: {},
      show: { transition: { staggerChildren: stagger } }
    }}
    className={className}
  >
    {children}
  </motion.div>
);

export const StaggerItem = ({ children, className = '' }) => (
  <motion.div
    variants={{
      hidden: { opacity: 0, y: 16 },
      show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
    }}
    className={className}
  >
    {children}
  </motion.div>
);

export const CountUp = ({ to = 100, suffix = '', duration = 1200, className = '' }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-20% 0px' });
  const [value, setValue] = useState(0);
  const target = useMemo(() => Number(to) || 0, [to]);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, target, duration]);

  return (
    <span ref={ref} className={className}>
      {value}{suffix}
    </span>
  );
};
