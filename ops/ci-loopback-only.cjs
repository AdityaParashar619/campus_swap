const { Socket } = require('node:net');

const connect = Socket.prototype.connect;
Socket.prototype.connect = function (...args) {
  const [options, host] = Array.isArray(args[0]) ? args[0] : args;
  const address = typeof options === 'object' ? options.host : host;
  if (typeof address === 'string' && !['localhost', '127.0.0.1', '::1'].includes(address)) {
    throw new Error('External network access is blocked for CI test processes');
  }
  return connect.apply(this, args);
};
