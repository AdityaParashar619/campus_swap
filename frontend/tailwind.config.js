export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },
      colors: {
        'glow-indigo': 'rgba(79, 70, 229, 0.3)',
        'glow-purple': 'rgba(139, 92, 246, 0.3)',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(79, 70, 229, 0.4)',
        'glow-lg': '0 0 30px rgba(79, 70, 229, 0.5)',
        'glow-purple': '0 0 20px rgba(139, 92, 246, 0.4)',
      },
      backdropBlur: {
        'xs': '2px',
      },
      letterSpacing: {
        'tight-hero': '-0.02em',
        'tight': '-0.01em',
      }
    }
  },
  plugins: []
};
