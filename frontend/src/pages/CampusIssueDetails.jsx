import { useCallback } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { PremiumCard } from '../components/ui';
import { BackToReports, IssueBadges, IssueDate, IssueLayout, IssueLoadError, IssueLoading } from '../components/CampusIssueUi';
import { CampusIssueEvidence } from '../components/CampusIssueEvidence';
import { useCampusIssueRequest } from '../hooks/useCampusIssueRequest';
import { campusIssueAPI } from '../services/api';
import { isIssueObjectId, normalizeIssue } from '../utils/campusIssues';

export default function CampusIssueDetails() {
  const { id } = useParams();
  const { state } = useLocation();
  const validId = isIssueObjectId(id);
  const load = useCallback(async (signal) => {
    if (!validId) return null;
    const { data } = await campusIssueAPI.get(id, signal);
    const issue = normalizeIssue(data?.data);
    if (!data?.success || !issue || issue.id.toLowerCase() !== id.toLowerCase()) throw new Error('Invalid issue response');
    return issue;
  }, [id, validId]);
  const [result, retry] = useCampusIssueRequest(load);
  const unavailable = !validId || [401, 403, 404].includes(result.error?.response?.status);
  return <IssueLayout>
    <BackToReports />
    {unavailable ? <IssueLoadError message="This report is unavailable." />
      : result.busy ? <IssueLoading label="Loading report details" />
      : result.error ? <IssueLoadError message="Report details could not be loaded." retry={retry} />
      : <>
        {state?.submitted === true && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          {state.replayed ? 'This report was already submitted.' : 'Report submitted.'}
        </p>}
        <IssueDetails issue={result.data} />
      </>}
  </IssueLayout>;
}

function IssueDetails({ issue }) {
  const dates = [
    ['Submitted', issue.createdAt], ['Last reviewed', issue.reviewedAt],
    ['Resolved', issue.status === 'resolved' ? issue.resolvedAt : null],
    ['Closed', issue.status === 'closed' ? issue.closedAt : null]
  ].filter(([, value]) => value);

  return <article className="space-y-4 break-words">
    <PremiumCard hover={false}>
      <header className="space-y-3">
        <h1 className="text-section-title">{issue.title}</h1>
        <IssueBadges issue={issue} />
      </header>
      {dates.length > 0 && <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {dates.map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd><IssueDate value={value} /></dd></div>)}
      </dl>}
      <section className="mt-5 space-y-2">
        <h2 className="text-feature-title">Description</h2>
        <p className="whitespace-pre-wrap">{issue.description}</p>
      </section>
      {(issue.locationDescription || issue.campusLocation) && <section className="mt-5 space-y-2">
        <h2 className="text-feature-title">Location</h2>
        {issue.campusLocation && <p className="font-medium">{issue.campusLocation.name}</p>}
        {issue.locationDescription && <p className="whitespace-pre-wrap">{issue.locationDescription}</p>}
      </section>}
    </PremiumCard>
    {issue.evidence?.length > 0 && <PremiumCard hover={false}>
      <CampusIssueEvidence issue={issue} loadPhoto={campusIssueAPI.evidence} />
    </PremiumCard>}
    {issue.adminResponse && <IssueNote title="Latest admin response" value={issue.adminResponse} />}
    {issue.status === 'resolved' && issue.resolutionNote && <IssueNote title="Resolution note" value={issue.resolutionNote} />}
    {issue.status === 'closed' && issue.resolutionNote && <IssueNote title="Closure explanation" value={issue.resolutionNote} />}
  </article>;
}

function IssueNote({ title, value }) {
  return <PremiumCard hover={false}><section>
    <h2 className="text-feature-title">{title}</h2><p className="mt-2 whitespace-pre-wrap">{value}</p>
  </section></PremiumCard>;
}
