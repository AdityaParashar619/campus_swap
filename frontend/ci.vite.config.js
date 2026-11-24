import baseConfig from './vite.config.js';

const target = 'http://127.0.0.1:5194';

export default {
  ...baseConfig,
  server: {
    host: '127.0.0.1',
    strictPort: true,
    proxy: {
      '/api': { target, changeOrigin: true },
      '/socket.io': { target, changeOrigin: true, ws: true }
    }
  }
};
