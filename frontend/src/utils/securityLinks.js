export const resolveSocketUrl = (configuredUrl, currentOrigin) =>
  String(configuredUrl || '').trim() || currentOrigin;

export const consumeTokenFragment = (hash, location, history) => {
  const token = new URLSearchParams(String(hash || '').replace(/^#/, '')).get('token') || '';
  if (token && location && history) {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }
  return token;
};
