import { useState } from 'react';
import { Link } from 'react-router-dom';
import ReportDialog from '../components/ReportDialog';
import { useAuth } from '../hooks/useAuth';

export default function Footer() {
  const { user } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <footer className="relative z-10 border-t border-slate-800 bg-slate-950 py-10 text-white">
      <div className="section-container flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-teal-400 via-blue-500 to-amber-400 text-sm font-black text-slate-950">CS</span>
            <p className="text-lg font-black tracking-tight text-white">CampusSwap</p>
          </div>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">Campus marketplace, requests, notes, chat, connections, and admin moderation in one student platform.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link className="rounded-lg border border-white/15 px-3 py-2 font-semibold text-slate-100 hover:bg-white/10" to="/about">About</Link>
          <Link className="rounded-lg border border-white/15 px-3 py-2 font-semibold text-slate-100 hover:bg-white/10" to="/notifications">Notifications</Link>
          <Link className="rounded-lg border border-teal-300/30 px-3 py-2 font-semibold text-teal-100 hover:bg-teal-400/10" to="/feedback">Feedback Form</Link>
          {user?.role === 'admin' && <Link className="rounded-lg border border-white/15 px-3 py-2 font-semibold text-slate-100 hover:bg-white/10" to="/admin">Admin</Link>}
          {user && (
            <button className="rounded-lg bg-amber-400 px-3 py-2 font-black text-slate-950 hover:bg-amber-300" onClick={() => setReportOpen(true)}>
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
