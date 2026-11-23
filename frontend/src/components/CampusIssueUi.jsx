import { Link } from 'react-router-dom';
import { Button, PageTransition, PremiumCard } from './ui';
import Layout from '../layouts/Layout';
import { ISSUE_CATEGORIES, ISSUE_STATUSES } from '../utils/campusIssues';

const statusColors = {
  submitted: 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  under_review: 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  resolved: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  closed: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
};
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export const issueLinkClass = 'inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-bold underline focus-visible:ring-2 focus-visible:ring-blue-500';

export function IssueLayout({ children }) {
  return <PageTransition><Layout><main className="section-container max-w-5xl space-y-5 py-8 sm:py-10">{children}</main></Layout></PageTransition>;
}

export function BackToReports() {
  return <Link to="/campus-issues" className={issueLinkClass}>Back to My Reports</Link>;
}

export function IssueDisclaimer() {
  return <p className="text-body-sm">CampusSwap is a student-run reporting platform. For official grievances or emergencies, use the college’s official channels.</p>;
}

export function IssueBadges({ issue }) {
  return <div className="flex flex-wrap gap-2 text-sm">
    <span className="chip">{ISSUE_CATEGORIES[issue.category]}</span>
    <span className={`rounded-full px-3 py-1 font-semibold ${statusColors[issue.status]}`}>{ISSUE_STATUSES[issue.status]}</span>
  </div>;
}

export function IssueDate({ value }) {
  return value ? <time dateTime={value}>{dateFormat.format(new Date(value))}</time> : null;
}

export function IssueLoading({ label }) {
  return <div role="status" className="space-y-3"><span className="sr-only">{label}</span>
    <div className="skeleton h-24" /><div className="skeleton h-24" />
  </div>;
}

export function IssueLoadError({ message, retry }) {
  return <PremiumCard hover={false}><div role="alert" className="space-y-3">
    <p>{message}</p>
    {retry && <Button variant="secondary" onClick={retry}>Retry</Button>}
  </div></PremiumCard>;
}

export function IssuePagination({ page, totalPages, setPage, label }) {
  if (totalPages < 2 && page === 1) return null;
  return <nav aria-label={label} className="flex flex-wrap items-center gap-3">
    <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
    <span className="text-sm">Page {page} of {Math.max(page, totalPages)}</span>
    <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
  </nav>;
}
