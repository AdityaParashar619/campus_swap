import { useState } from 'react';
import { Link } from 'react-router-dom';
import ReportDialog from '../components/ReportDialog';
import { useAuth } from '../hooks/useAuth';

export default function Footer() {
  const { user } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <footer className="relative z-10 border-t border-slate-200/25 bg-white/60 py-8 backdrop-blur-xl dark:bg-slate-950/60">
      <div className="section-container flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-black text-lg tracking-tight bg-gradient-to-r from-blue-600 to-violet-500 bg-clip-text text-transparent">CampusSwap</p>
          <p className="mt-1 text-sm text-slate-500">Campus marketplace, requests, notes, chat, and moderation.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link className="rounded-xl border border-slate-300/30 px-3 py-2 text-slate-700 dark:text-slate-200" to="/notifications">Notifications</Link>
          {user?.role === 'admin' && <Link className="rounded-xl border border-slate-300/30 px-3 py-2 text-slate-700 dark:text-slate-200" to="/admin">Admin</Link>}
          {user && (
            <button className="rounded-xl bg-rose-500 px-3 py-2 font-semibold text-white" onClick={() => setReportOpen(true)}>
              Feedback / Report
            </button>
          )}
        </div>
      </div>

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="user"
        targetId="general-feedback"
        title="Feedback or report"
      />
    </footer>
  );
}
