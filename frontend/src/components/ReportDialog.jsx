import { useState } from 'react';
import { Button } from './ui';
import { reportAPI } from '../services/api';

const reasons = [
  ['abusive_chat', 'Abusive chat'],
  ['harassment', 'Harassment'],
  ['spam', 'Spam'],
  ['scam', 'Scam'],
  ['illegal_content', 'Illegal content'],
  ['feedback', 'Feedback'],
  ['other', 'Other']
];

export default function ReportDialog({ open, onClose, targetType = 'user', targetId = 'general', targetUserId = '', title = 'Report an issue' }) {
  const [reason, setReason] = useState('abusive_chat');
  const [explanation, setExplanation] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const submitReport = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus('');

    try {
      await reportAPI.create({
        targetType,
        targetId,
        targetUserId: targetUserId || undefined,
        reason,
        explanation
      });
      setStatus('Report submitted to admin');
      setExplanation('');
      setTimeout(onClose, 700);
    } catch (error) {
      setStatus(error.userMessage || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/50 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200/30 bg-white p-6 shadow-2xl dark:bg-slate-950">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">Admins can review this and take action against abusive behavior.</p>
          </div>
          <button className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={onClose}>
            Close
          </button>
        </div>

        <form onSubmit={submitReport} className="space-y-4">
          <select className="premium-surface w-full px-4 py-3" value={reason} onChange={(event) => setReason(event.target.value)}>
            {reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>

          <textarea
            className="premium-surface w-full px-4 py-3"
            rows="4"
            placeholder="Describe what happened. Include chat context, time, or anything admins should know."
            value={explanation}
            onChange={(event) => setExplanation(event.target.value)}
            required
          />

          {status && <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">{status}</p>}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="gradient" disabled={submitting}>{submitting ? 'Submitting' : 'Submit Report'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
