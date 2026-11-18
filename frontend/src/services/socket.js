import { io } from 'socket.io-client';
import { getAccessToken, refreshAuthSession, setAccessToken } from './api';
import { resolveSocketUrl } from '../utils/securityLinks';

const SOCKET_URL = resolveSocketUrl(import.meta.env.VITE_SOCKET_URL, window.location.origin);
let socket;
let socketToken = '';
let reconnecting;

export const refreshAndReconnectSocket = ({ activeSocket, refresh = refreshAuthSession } = {}) => {
  if (reconnecting) return reconnecting;
  reconnecting = Promise.resolve(refresh())
    .then((response) => {
      const token = response?.data?.token;
      if (!token) throw new Error('Refresh response did not include an access token.');
      setAccessToken(token);
      socketToken = token;
      activeSocket.auth = { token };
      if (!activeSocket.connected) activeSocket.connect();
      return token;
    })
    .catch((error) => {
      setAccessToken(null);
      window.dispatchEvent(new Event('campusswap:session-expired'));
      throw error;
    })
    .finally(() => { reconnecting = undefined; });
  return reconnecting;
};

export const getSocket = () => {
  const token = getAccessToken();
  if (!socket) {
    socket = io(SOCKET_URL, { path: '/socket.io/', auth: { token }, autoConnect: false });
    socket.on('session:expired', () => { void refreshAndReconnectSocket({ activeSocket: socket }).catch(() => {}); });
  }
  if (socket.connected && socketToken !== token) socket.disconnect();
  socketToken = token || '';
  socket.auth = { token };
  if (!socket.connected) socket.connect();
  return socket;
};

export const disconnectSocket = () => {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = undefined;
  socketToken = '';
  reconnecting = undefined;
};
