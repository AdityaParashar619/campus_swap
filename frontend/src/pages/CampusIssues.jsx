import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { PremiumCard } from '../components/ui';
import {
  IssueBadges, IssueDate, IssueDisclaimer, IssueLayout, IssueLoadError,
  IssueLoading, IssuePagination, issueLinkClass
} from '../components/CampusIssueUi';
import { useCampusIssueRequest } from '../hooks/useCampusIssueRequest';
import { campusIssueAPI } from '../services/api';
import { ISSUE_CATEGORIES, ISSUE_STATUSES, normalizeIssue, readIssuePage } from '../utils/campusIssues';

export default function CampusIssues() {
  const [{ status, category, page, view }, setFilters] = useState({ status: '', category: '', page: 1, view: 'recent' });
  const load = useCallback(async (signal) => {
    const { data } = await campusIssueAPI.listMine({
      page, limit: 10, view, ...(status && { status }), ...(category && { category })
    }, signal);
    return readIssuePage(data, normalizeIssue, page);
  }, [page, status, category, view]);
  const [result, retry] = useCampusIssueRequest(load);
  const setFilter = (field, value) => setFilters((previous) => ({ ...previous, [field]: value, page: 1 }));

  return <IssueLayout>
    <header className="space-y-2">
      <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Campus Issues</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-section-title">My Reports</h1>
        <Link to="/campus-issues/new" className={`${issueLinkClass} bg-blue-700 text-white no-underline`}>Submit New Issue</Link>
      </div>
      <IssueDisclaimer />
    </header>
    <PremiumCard hover={false}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="min-w-0">
          <label htmlFor="report-view" className="text-sm font-semibold">Report view</label>
          <select id="report-view" className="form-control mt-1 min-h-11 w-full" value={view}
            onChange={(event) => setFilter('view', event.target.value)}>
            <option value="recent">Active / Recent</option>
            <option value="history">History</option>
          </select>
        </div>
        <ReportFilter id="report-status" label="Status" options={ISSUE_STATUSES} value={status} onChange={(value) => setFilter('status', value)} />
        <ReportFilter id="report-category" label="Category" options={ISSUE_CATEGORIES} value={category} onChange={(value) => setFilter('category', value)} />
      </div>
    </PremiumCard>
    {result.busy ? <IssueLoading label="Loading your reports" />
      : result.error ? <IssueLoadError message="Your reports could not be loaded." retry={retry} />
      : <>
        {result.data.data.length === 0
          ? <PremiumCard hover={false}><p role="status">
            {status || category ? 'No reports match these filters.' : (view === 'history'
              ? 'No reports in History.' : 'No active or recent reports. Older resolved and closed reports appear in History.')}
          </p></PremiumCard>
          : <ul aria-label="Your campus reports" className="grid gap-4 sm:grid-cols-2">
            {result.data.data.map((issue) => <li key={issue.id} className="min-w-0">
              <PremiumCard hover={false} className="h-full break-words">
                <IssueBadges issue={issue} />
                <h2 className="mt-3 text-lg font-bold">{issue.title}</h2>
                {issue.createdAt && <p className="mt-1 text-sm">Submitted <IssueDate value={issue.createdAt} /></p>}
                {issue.locationDescription && <p className="mt-2 whitespace-pre-wrap text-sm">{issue.locationDescription}</p>}
                {issue.adminResponse && <div className="mt-3 text-sm">
                  <p className="font-semibold">Latest admin response</p>
                  <p className="whitespace-pre-wrap">{issue.adminResponse}</p>
                </div>}
                <Link to={`/campus-issues/${issue.id}`} aria-label={`View report: ${issue.title}`} className={issueLinkClass}>View Details</Link>
              </PremiumCard>
            </li>)}
          </ul>}
        <IssuePagination page={page} totalPages={result.data.totalPages} label="Report pagination"
          setPage={(value) => setFilters((previous) => ({ ...previous, page: value }))} />
      </>}
  </IssueLayout>;
}

function ReportFilter({ id, label, options, value, onChange }) {
  return <div className="min-w-0">
    <label htmlFor={id} className="text-sm font-semibold">{label}</label>
    <select id={id} className="form-control mt-1 min-h-11 w-full" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">All {label === 'Status' ? 'statuses' : 'categories'}</option>
      {Object.entries(options).map(([key, text]) => <option key={key} value={key}>{text}</option>)}
    </select>
  </div>;
}
