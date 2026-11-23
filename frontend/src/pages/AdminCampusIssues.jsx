import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, PremiumCard } from '../components/ui';
import { CampusIssueEvidence } from '../components/CampusIssueEvidence';
import {
  IssueBadges, IssueLayout, IssueLoadError, IssueLoading, IssuePagination, issueLinkClass
} from '../components/CampusIssueUi';
import { useCampusIssueRequest } from '../hooks/useCampusIssueRequest';
import { adminCampusIssueAPI as issuesAPI } from '../services/api';
import { ISSUE_CATEGORIES, ISSUE_STATUSES, readIssuePage } from '../utils/campusIssues';
import { buildIssueReview, issueReviewActions, normalizeAdminIssue, REVIEW_TEXT_LIMIT } from '../utils/campusIssueAdmin';

const timestamp = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

async function fetchIssue(id, signal) {
  const { data } = await issuesAPI.get(id, signal);
  const issue = normalizeAdminIssue(data?.data);
  if (!data?.success || issue?.id !== id) throw new Error('Invalid issue response');
  return issue;
}

export default function AdminCampusIssues() {
  const [search, setSearch] = useState('');
  const [{ keyword, category, status, page }, setQuery] = useState({ keyword: '', category: '', status: '', page: 1 });
  const [selected, setSelected] = useState(null);
  const detailRef = useRef(null);
  useEffect(() => {
    const timer = setTimeout(() => setQuery((previous) => previous.keyword === search.trim()
      ? previous : { ...previous, keyword: search.trim(), page: 1 }), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const load = useCallback(async (signal) => {
    const { data } = await issuesAPI.list({
      page, limit: 10, ...(keyword && { search: keyword }), ...(category && { category }), ...(status && { status })
    }, signal);
    return readIssuePage(data, normalizeAdminIssue, page);
  }, [keyword, category, status, page]);
  const [result, reloadQueue] = useCampusIssueRequest(load);
  const setFilter = (key, value) => setQuery((previous) => ({ ...previous, [key]: value, page: 1 }));
  const open = (id) => {
    setSelected(id);
    detailRef.current?.focus();
  };

  return <IssueLayout>
    <Link to="/admin" className={issueLinkClass}>Back to Admin Panel</Link>
    <header className="space-y-2">
      <h1 className="text-section-title">Campus Issues Management</h1>
      <p className="text-body-sm">Review private student reports. Use Resolved when an issue has been addressed and reasonably confirmed. Use Closed for reports such as duplicates or issues outside CampusSwap’s scope.</p>
    </header>
    <div ref={detailRef} tabIndex={-1} aria-label="Review report">
      {selected && <AdminIssueDetail key={selected} id={selected} close={() => setSelected(null)} onUpdate={reloadQueue} />}
    </div>
    <PremiumCard hover={false}>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]">
        <div className="min-w-0">
          <label htmlFor="admin-issue-search" className="text-sm font-semibold">Search reports</label>
          <input id="admin-issue-search" type="search" className="form-control mt-1 min-h-11 w-full" maxLength={100}
            placeholder="Title or description" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <IssueSelect id="admin-issue-category" label="Category" allLabel="All categories" options={ISSUE_CATEGORIES} value={category} onChange={(value) => setFilter('category', value)} />
        <IssueSelect id="admin-issue-status" label="Status" allLabel="All statuses" options={ISSUE_STATUSES} value={status} onChange={(value) => setFilter('status', value)} />
      </div>
    </PremiumCard>
    {result.busy || keyword !== search.trim() ? <IssueLoading label="Loading reports" />
      : result.error ? <IssueLoadError message="The report queue could not be loaded." retry={reloadQueue} />
      : <>
        {result.data.data.length ? <ul aria-label="Campus issue queue" className="grid gap-4 sm:grid-cols-2">
          {result.data.data.map((issue) => <li key={issue.id} className="min-w-0">
            <PremiumCard hover={false} className="h-full space-y-2 break-words">
              <IssueBadges issue={issue} />
              <h2 className="text-lg font-bold">{issue.title}</h2>
              {(issue.locationDescription || issue.campusLocation) && <p className="text-sm">{issue.locationDescription || issue.campusLocation.name}</p>}
              <IssueTimestamps issue={issue} />
              <Button variant="secondary" disabled={selected !== null} onClick={() => open(issue.id)}>View / Review</Button>
            </PremiumCard>
          </li>)}
        </ul> : <PremiumCard hover={false}><p role="status">No campus issues match these filters.</p></PremiumCard>}
        <IssuePagination page={page} totalPages={result.data.totalPages} label="Admin issue pagination"
          setPage={(value) => setQuery((previous) => ({ ...previous, page: value }))} />
      </>}
  </IssueLayout>;
}

function IssueSelect({ id, label, allLabel, options, value, onChange }) {
  return <div className="min-w-0">
    <label htmlFor={id} className="text-sm font-semibold">{label}</label>
    <select id={id} className="form-control mt-1 min-h-11 w-full" value={value} onChange={(event) => onChange(event.target.value)}>
      {allLabel && <option value="">{allLabel}</option>}
      {Object.entries(options).map(([key, text]) => <option key={key} value={key}>{text}</option>)}
    </select>
  </div>;
}

function IssueTimestamps({ issue, detail = false }) {
  const entries = [
    ['Submitted', issue.createdAt], ['Updated', issue.updatedAt],
    ...(detail ? [['Last reviewed', issue.reviewedAt], ['Resolved', issue.resolvedAt], ['Closed', issue.closedAt]] : [])
  ].filter(([, value]) => value);
  if (!entries.length) return null;
  return <dl className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
    {entries.map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt>
      <dd><time dateTime={value}>{timestamp.format(new Date(value))}</time></dd></div>)}
  </dl>;
}

function AdminIssueDetail({ id, close, onUpdate }) {
  const load = useCallback((signal) => fetchIssue(id, signal), [id]);
  const [result, retry] = useCampusIssueRequest(load);
  if (result.busy || result.error) return <PremiumCard hover={false} className="space-y-3">
    <Button variant="secondary" onClick={close}>Back to queue</Button>
    {result.busy ? <IssueLoading label="Loading report details" />
      : <IssueLoadError message="The report could not be loaded." retry={retry} />}
  </PremiumCard>;
  return <ReviewEditor initialIssue={result.data} close={close} onUpdate={onUpdate} />;
}

function ReviewEditor({ initialIssue, close, onUpdate }) {
  const [issue, setIssue] = useState(initialIssue);
  const [status, setStatus] = useState('under_review');
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);
  const [conflict, setConflict] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const lock = useRef(false);
  const labels = issueReviewActions(issue.status);
  const initialText = status === 'under_review' ? issue.adminResponse : '';
  const text = drafts[status] ?? initialText;
  const dirty = Object.entries(drafts).some(([key, value]) => value !== (key === 'under_review' ? issue.adminResponse : ''));

  function adopt(latest) {
    setIssue(latest);
    setStatus('under_review');
    setDrafts({});
    setConflict(false);
    setDeleteOpen(false);
    setConfirmation('');
  }

  async function run(kind, task) {
    if (lock.current) return;
    lock.current = true;
    setBusy(kind);
    setMessage(null);
    try {
      await task();
    } catch (error) {
      if (error.response?.status === 409) {
        setConflict(true);
        setMessage({ error: true, text: 'Another administrator may have updated this report. Reload Latest before saving. Your text is still in the form.' });
      } else if (kind === 'delete') {
        const { status, data } = error.response ?? {};
        setConflict(true);
        const detail = [400, 403, 404, 503].includes(status) && data?.message;
        setMessage({ error: true, text: `${detail || 'Report deletion could not be confirmed.'} Reload Latest before retrying.` });
      } else if (kind === 'reload' && error.response?.status === 404) {
        setMessage({ error: true, text: 'This report is no longer available. Return to the queue to refresh the list.' });
        onUpdate();
      } else {
        const detail = error.response?.status === 400 && error.response.data?.message;
        setMessage({ error: true, text: typeof detail === 'string' ? detail : 'The report could not be updated. Your text is still in the form.' });
      }
    } finally {
      lock.current = false;
      setBusy('');
    }
  }

  function submit(event) {
    event.preventDefault();
    if (lock.current || conflict) return;
    let payload;
    try {
      payload = buildIssueReview(issue, status, text);
    } catch (error) {
      setMessage({ error: true, text: error.message });
      return;
    }
    void run('save', async () => {
      const { data } = await issuesAPI.updateStatus(issue.id, payload.data, payload.ifMatch);
      const latest = normalizeAdminIssue(data?.data);
      if (!data?.success || latest?.id !== issue.id) throw new Error('Invalid update response');
      adopt(latest);
      setMessage({ text: 'Report updated.' });
      onUpdate();
    });
  }

  function reloadLatest() {
    if (dirty && !window.confirm('Discard unsaved review text and reload the latest report?')) return;
    void run('reload', async () => {
      adopt(await fetchIssue(issue.id));
      setMessage({ text: 'Latest report loaded.' });
      onUpdate();
    });
  }

  function deleteReport(event) {
    event.preventDefault();
    if (lock.current || conflict || !issue.canDeleteTestReport || confirmation !== 'DELETE') return;
    void run('delete', async () => {
      const { data } = await issuesAPI.deleteTestReport(issue.id, issue.version, confirmation);
      if (!data?.success) throw new Error('Invalid deletion response');
      onUpdate();
      close();
    });
  }

  const textLabel = status === 'resolved' ? 'Resolution note' : status === 'closed' ? 'Closure explanation' : 'Admin response';
  const textRequired = status !== 'under_review' || issue.status === 'under_review';
  return <PremiumCard hover={false}>
    <section aria-label="Report review" className="min-w-0 space-y-4 break-words">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="min-w-0 text-feature-title">{issue.title}</h2>
        <Button variant="secondary" disabled={Boolean(busy)} onClick={() => {
          if (!dirty || window.confirm('Discard unsaved review text?')) close();
        }}>Back to queue</Button>
      </header>
      <IssueBadges issue={issue} />
      <IssueTimestamps issue={issue} detail />
      <div><h3 className="font-semibold">Description</h3><p className="whitespace-pre-wrap">{issue.description}</p></div>
      {(issue.campusLocation || issue.locationDescription) && <div>
        <h3 className="font-semibold">Location</h3>
        {issue.campusLocation && <p>{issue.campusLocation.name}</p>}
        {issue.locationDescription && <p className="whitespace-pre-wrap">{issue.locationDescription}</p>}
      </div>}
      <CampusIssueEvidence issue={issue} loadPhoto={issuesAPI.evidence} />
      {issue.adminResponse && <div><h3 className="font-semibold">Latest admin response</h3>
        <p className="whitespace-pre-wrap">{issue.adminResponse}</p></div>}
      {issue.resolutionNote && ['closed', 'resolved'].includes(issue.status) && <div>
        <h3 className="font-semibold">{issue.status === 'closed' ? 'Closure explanation' : 'Resolution note'}</h3>
        <p className="whitespace-pre-wrap">{issue.resolutionNote}</p>
      </div>}
      {message && <p role={message.error ? 'alert' : 'status'}>{message.text}</p>}
      {conflict && <Button variant="secondary" disabled={Boolean(busy)} onClick={reloadLatest}>
        {busy === 'reload' ? 'Reloading…' : 'Reload Latest'}
      </Button>}
      {issue.cleanupPending && <p role="status">Evidence cleanup is pending. Retry deletion to finish removing this test report.</p>}
      {!deleteOpen && !issue.cleanupPending && Object.keys(labels).length > 0 &&
      <form noValidate onSubmit={submit} className="border-t border-slate-200 pt-4 dark:border-slate-700">
        <fieldset disabled={Boolean(busy)} className="min-w-0 space-y-3">
          <IssueSelect id="issue-review-action" label="Review action" options={labels} value={status} onChange={setStatus} />
          <div>
            <label htmlFor="issue-review-text" className="text-sm font-semibold">{textLabel}{!textRequired && ' (optional)'}</label>
            <textarea id="issue-review-text" className="form-control mt-1 w-full" rows={4} maxLength={REVIEW_TEXT_LIMIT}
              required={textRequired} value={text} onChange={(event) => {
                const value = event.target.value;
                setDrafts((previous) => ({ ...previous, [status]: value }));
              }} />
          </div>
          <Button type="submit" disabled={Boolean(busy) || conflict}>{busy === 'save' ? 'Saving…' : labels[status]}</Button>
        </fieldset>
      </form>}
      {issue.canDeleteTestReport && (deleteOpen
        ? <form aria-label="Confirm test report deletion" onSubmit={deleteReport}
            className="space-y-3 rounded-lg border border-rose-300 p-3 dark:border-rose-800">
          <h3 className="font-semibold">Confirm test report deletion</h3>
          <p className="break-words">{issue.title} <span className="break-all">({issue.id})</span></p>
          <p>This permanently removes the test report and its evidence photos.</p>
          <label htmlFor="delete-issue-confirmation" className="block text-sm font-semibold">Type DELETE to confirm</label>
          <input id="delete-issue-confirmation" autoComplete="off" className="form-control min-h-11 w-full" value={confirmation}
            disabled={Boolean(busy)} onChange={(event) => setConfirmation(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="danger" disabled={confirmation !== 'DELETE' || Boolean(busy) || conflict}>
              {busy === 'delete' ? 'Removing…' : 'Permanently delete'}
            </Button>
            <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => {
              setDeleteOpen(false);
              setConfirmation('');
            }}>Cancel deletion</Button>
          </div>
        </form>
        : <Button type="button" variant="danger" disabled={Boolean(busy) || conflict} onClick={() => setDeleteOpen(true)}>
          {issue.cleanupPending ? 'Retry Test Report Deletion' : 'Delete Test Report'}
        </Button>)}
    </section>
  </PremiumCard>;
}
