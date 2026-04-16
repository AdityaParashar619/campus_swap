import PropTypes from 'prop-types';

export default function Avatar({ user, initials, size = 'sm' }) {
  // Generate initials from user name if not provided
  const displayInitials =
    initials ||
    (user?.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase() ?? '?');

  // Color palette - deterministic based on initials
  const colors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-green-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-rose-500',
    'bg-fuchsia-500',
    'bg-amber-500',
    'bg-lime-500',
    'bg-emerald-500'
  ];

  // Deterministic color assignment based on initials
  const colorIndex =
    displayInitials.charCodeAt(0) % colors.length;
  const bgColor = colors[colorIndex];

  // Size classes
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-2xl'
  };

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold text-white ${bgColor} ${sizeClasses[size]} flex-shrink-0`}
      title={user?.name}
    >
      {displayInitials}
    </div>
  );
}

Avatar.propTypes = {
  user: PropTypes.shape({
    name: PropTypes.string
  }),
  initials: PropTypes.string,
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl'])
};
