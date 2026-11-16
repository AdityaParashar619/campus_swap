import { useEffect, useRef, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { getApiErrorMessage, listingAPI } from '../services/api';

export default function FavoriteButton({ listingId, initialFavorite = false, onChange, className = '' }) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const { showToast } = useToast();
  useEffect(() => setFavorite(initialFavorite), [initialFavorite]);
  const update = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const response = favorite ? await listingAPI.removeFavorite(listingId) : await listingAPI.addFavorite(listingId);
      const next = response.data.data.isFavorite;
      setFavorite(next); onChange?.(next);
      showToast(next ? 'Saved to favorites.' : 'Removed from favorites.', 'success');
    } catch (error) { showToast(getApiErrorMessage(error, 'Could not update favorites.'), 'error'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <button type="button" onClick={update} disabled={busy} aria-pressed={favorite} aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'} className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60 ${favorite ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-300 bg-white text-slate-700'} ${className}`}>{favorite ? '♥ Saved' : '♡ Save'}</button>;
}

