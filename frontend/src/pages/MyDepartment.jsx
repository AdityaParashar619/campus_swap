import { useCallback, useEffect, useState } from 'react';
import { PageTransition, PremiumCard } from '../components/ui';
import Layout from '../layouts/Layout';
import { academicAPI } from '../services/api';
import { ACADEMIC_CATEGORIES, availabilityFor, normalizeAcademicResponse, resourceStatusLabel, resourcesByCategory } from '../utils/academicResources';
import { INSTITUTION_NAME } from '../utils/profileView';

const ExternalLink = ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 dark:ring-offset-slate-900">{children}</a>;

const directDocumentLabel = (resource) => resource.resourceType === 'syllabus' ? 'Open Syllabus PDF' : resource.resourceType === 'timetable' ? 'Open Timetable PDF' : `Open ${resource.resourceType.replace('_', ' ')}`;

const ResourceItem = ({ resource }) => <li className="min-w-0 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
  <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="min-w-0 break-words font-bold text-slate-950 dark:text-white">{resource.title}</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{resourceStatusLabel(resource.matchStatus)}</span></div>
  {resource.description && <p className="mt-2 break-words text-sm text-slate-600 dark:text-slate-300">{resource.description}</p>}
  <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">{resource.programCode && <div><dt className="inline font-bold">Program: </dt><dd className="inline">{resource.programCode}</dd></div>}{resource.semester && <div><dt className="inline font-bold">Semester: </dt><dd className="inline">{resource.semester}</dd></div>}{resource.matchStatus !== 'published_reference' && resource.academicSession && <div><dt className="inline font-bold">Session: </dt><dd className="inline">{resource.academicSession}</dd></div>}{resource.matchStatus !== 'published_reference' && resource.admissionBatch && <div><dt className="inline font-bold">Admission batch: </dt><dd className="inline">{resource.admissionBatch}</dd></div>}</dl>
  {resource.matchStatus === 'session_or_batch_unconfirmed' && <p role="note" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Your session or admission batch cannot be confirmed. This is not presented as a current exact document.</p>}
  {resource.matchStatus === 'official_reference' && <p role="note" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Reference only — applicability unconfirmed. This official document may be historical or follow a different curriculum batch. Review its session and admission-batch details before relying on it.</p>}
  {resource.uncertainty && resource.matchStatus === 'official_reference' && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Review note: {resource.uncertainty}</p>}
  {resource.url && resource.matchStatus === 'official_reference' && <div className="mt-4"><ExternalLink href={resource.url}>View reference PDF</ExternalLink></div>}
  {resource.url && resource.matchStatus === 'published_reference' && <div className="mt-4"><ExternalLink href={resource.url}>{directDocumentLabel(resource)}</ExternalLink></div>}
  {resource.url && resource.applicabilityConfirmed && <div className="mt-4"><ExternalLink href={resource.url}>{directDocumentLabel(resource)}</ExternalLink></div>}
</li>;

const EmptyCategory = ({ fallback }) => fallback.status === 'browsing_fallback'
  ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30"><p className="text-sm text-slate-700 dark:text-slate-200">No verified exact document is available. Use this verified official {fallback.resourceType.replace('_', ' ')} index.</p><div className="mt-3"><ExternalLink href={fallback.url}>Browse official {fallback.resourceType.replace('_', ' ')}</ExternalLink></div></div>
  : <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300"><p className="font-bold">Not yet available</p><p className="mt-1">A verified document has not been added for your program and semester.</p></div>;

export default function MyDepartment() {
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try { const response = await academicAPI.getMyResources(); setState({ loading: false, error: '', data: normalizeAcademicResponse(response?.data?.data) }); }
    catch (error) { setState({ loading: false, error: error.userMessage || 'Academic resources could not be loaded.', data: null }); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const grouped = state.data ? resourcesByCategory(state.data) : {};
  return <PageTransition><Layout><div className="min-h-screen py-8 sm:py-10"><div className="section-container max-w-7xl space-y-6">
    <header><p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-300">College Services</p><h1 className="text-section-title mt-1">My Department</h1><p className="text-body-sm mt-2">Published academic resources selected from your authenticated profile.</p></header>
    {state.loading ? <div role="status" aria-live="polite" className="grid gap-5 md:grid-cols-2"><div className="skeleton h-44" /><div className="skeleton h-44" /><span className="sr-only">Loading academic resources</span></div> : state.error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"><p className="font-bold">Unable to load My Department</p><p className="mt-1 text-sm">{state.error}</p><button type="button" onClick={load} className="mt-3 min-h-11 font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">Retry</button></div> : !state.data?.supported || !state.data.identity ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"><h2 className="font-bold">Academic profile incomplete</h2><p className="mt-1 text-sm">Your registered branch or semester could not be matched. Contact CampusSwap support; this page cannot change protected academic information.</p></div> : <>
      <PremiumCard hover={false}><div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Your program</p><h2 className="mt-1 text-2xl font-black break-words">{state.data.identity.programName}</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{INSTITUTION_NAME}</p></div><dl className="grid grid-cols-2 gap-3"><div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800"><dt className="text-xs text-slate-500">Program</dt><dd className="font-black">{state.data.identity.programCode}</dd></div><div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800"><dt className="text-xs text-slate-500">Semester</dt><dd className="font-black">{state.data.identity.semester}</dd></div></dl></div></PremiumCard>
      <div className="grid gap-5 lg:grid-cols-2">{ACADEMIC_CATEGORIES.map((category) => { const categoryResources = grouped[category.type] || []; const availability = availabilityFor(state.data, category.type); return <section key={category.type} className={category.priority ? '' : 'lg:col-span-1'} aria-labelledby={`academic-${category.type}`}><PremiumCard hover={false} className="h-full"><h2 id={`academic-${category.type}`} className={category.priority ? 'text-2xl font-black' : 'text-feature-title'}>{category.label}</h2><div className="mt-4 space-y-3">{categoryResources.length > 0 ? <ul className="space-y-3">{categoryResources.map((resource) => <ResourceItem key={resource.id || `${resource.title}-${resource.url || ''}`} resource={resource} />)}</ul> : <EmptyCategory fallback={availability} />}</div></PremiumCard></section>; })}</div>
      {state.data.resources.filter((resource) => !ACADEMIC_CATEGORIES.some(({ type }) => type === resource.resourceType)).length > 0 && <PremiumCard hover={false}><h2 className="text-feature-title">Additional resources</h2><ul className="mt-4 space-y-3">{state.data.resources.filter((resource) => !ACADEMIC_CATEGORIES.some(({ type }) => type === resource.resourceType)).map((resource) => <ResourceItem key={resource.id || resource.title} resource={resource} />)}</ul></PremiumCard>}
    </>}
  </div></div></Layout></PageTransition>;
}
