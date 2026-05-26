import { useState } from 'react';
import { Link } from 'react-router-dom';
import ReportDialog from '../components/ReportDialog';
import { useAuth } from '../hooks/useAuth';

export default function Footer() {
  const { user } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <footer className="relative z-10 border-t border-slate-800 bg-slate-950 py-10 text-white">
      <div className="section-container flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-lg font-black tracking-tight text-white">CampusSwap</p>
          <p className="mt-1 text-sm text-slate-300">Campus marketplace, requests, notes, chat, and moderation.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link className="rounded-lg border border-white/15 px-3 py-2 text-slate-100 hover:bg-white/10" to="/about">About</Link>
          <Link className="rounded-lg border border-white/15 px-3 py-2 text-slate-100 hover:bg-white/10" to="/notifications">Notifications</Link>
          <Link className="rounded-lg border border-white/15 px-3 py-2 text-slate-100 hover:bg-white/10" to="/feedback">Feedback Form</Link>
          {user?.role === 'admin' && <Link className="rounded-lg border border-white/15 px-3 py-2 text-slate-100 hover:bg-white/10" to="/admin">Admin</Link>}
          {user && (
            <button className="rounded-lg bg-gradient-to-r from-rose-500 to-amber-500 px-3 py-2 font-semibold text-white" onClick={() => setReportOpen(true)}>
              Quick Report
            </button>
          )}
        </div>
      </div>

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="feedback"
        targetId="general-feedback"
        title="Feedback or report"
      />
    </footer>
  );
}
