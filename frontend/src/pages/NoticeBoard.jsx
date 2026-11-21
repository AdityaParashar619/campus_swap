import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import Layout from '../layouts/Layout';
import { noticeAPI } from '../services/api';
import { NOTICE_CATEGORIES, NOTICE_PRIORITIES, normalizeNoticeList, noticePreview, noticeScopeLabel } from '../utils/notices';

const priorityStyle = { normal: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200', important: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200', urgent: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200' };
const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : 'Publication date unavailable';

export default function NoticeBoard() {
  const [filters, setFilters] = useState({ search: '', category: '', priority: '', page: 1 });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState({ loading: true, error: '', notices: [], pagination: { page: 1, totalPages: 0, total: 0 } });
  const requestId = useRef(0);

  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(filters.search.trim()), 300); return () => clearTimeout(timer); }, [filters.search]);
  useEffect(() => {
    const controller = new AbortController();
    const current = ++requestId.current;
    setState((previous) => ({ ...previous, loading: true, error: '' }));
    const params = { page: filters.page, limit: 12, ...(debouncedSearch ? { search: debouncedSearch } : {}), ...(filters.category ? { category: filters.category } : {}), ...(filters.priority ? { priority: filters.priority } : {}) };
    noticeAPI.getAll(params, { signal: controller.signal }).then((response) => {
      if (current !== requestId.current) return;
      setState({ loading: false, error: '', ...normalizeNoticeList(response.data) });
    }).catch((error) => {
      if (controller.signal.aborted || current !== requestId.current) return;
      setState((previous) => ({ ...previous, loading: false, error: error.userMessage || 'Notices could not be loaded.' }));
    });
    return () => controller.abort();
  }, [debouncedSearch, filters.category, filters.priority, filters.page, refreshKey]);

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value, page: key === 'page' ? value : 1 }));
  const retry = () => setRefreshKey((current) => current + 1);

  return <PageTransition><Layout><main className="min-h-screen py-8 sm:py-10"><div className="section-container max-w-6xl space-y-6">
    <header><p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-300">College Services</p><h1 className="text-section-title mt-1">Campus Notice Board</h1><p className="text-body-sm mt-2">Announcements relevant to your campus life</p></header>
    <PremiumCard hover={false}><div className="grid gap-4 md:grid-cols-[1fr_12rem_12rem]">
      <div><label htmlFor="notice-search" className="text-sm font-semibold">Search notices</label><input id="notice-search" type="search" value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} className="form-control mt-1" placeholder="Search title or content" /></div>
      <Filter label="Category" value={filters.category} onChange={(value) => updateFilter('category', value)} options={NOTICE_CATEGORIES} />
      <Filter label="Priority" value={filters.priority} onChange={(value) => updateFilter('priority', value)} options={NOTICE_PRIORITIES} />
    </div></PremiumCard>
    {state.error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"><p className="font-bold">Unable to load notices</p><p className="mt-1 text-sm">{state.error}</p><Button className="mt-3" variant="secondary" onClick={retry}>Retry</Button></div>
      : state.loading ? <div role="status" aria-live="polite" className="grid gap-4 md:grid-cols-2"><span className="sr-only">Loading notices</span>{[1,2,3,4].map((item) => <div key={item} className="skeleton h-56" />)}</div>
      : state.notices.length === 0 ? <PremiumCard hover={false}><div className="py-10 text-center"><h2 className="text-feature-title">No notices available</h2><p className="text-body-sm mt-2">New announcements will appear here when they are published.</p></div></PremiumCard>
      : <section aria-label="Notice feed" className="grid gap-4 md:grid-cols-2">{state.notices.map((notice) => <NoticeCard key={notice.id} notice={notice} />)}</section>}
    {!state.error && !state.loading && state.pagination.totalPages > 1 && <nav aria-label="Notice pagination" className="flex items-center justify-center gap-3"><Button variant="secondary" disabled={filters.page <= 1} onClick={() => updateFilter('page', filters.page - 1)}>Previous</Button><span className="text-sm font-semibold">Page {state.pagination.page} of {state.pagination.totalPages}</span><Button variant="secondary" disabled={filters.page >= state.pagination.totalPages} onClick={() => updateFilter('page', filters.page + 1)}>Next</Button></nav>}
  </div></main></Layout></PageTransition>;
}

function Filter({ label, value, onChange, options }) {
  const id = `notice-${label.toLowerCase()}`;
  return <div><label htmlFor={id} className="text-sm font-semibold">{label}</label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="form-control mt-1"><option value="">All {label.toLowerCase()}s</option>{options.map((option) => <option key={option} value={option}>{option[0].toUpperCase() + option.slice(1)}</option>)}</select></div>;
}

function NoticeCard({ notice }) {
  return <PremiumCard hover={false} className="h-full"><article className="flex h-full flex-col"><div className="flex flex-wrap items-center gap-2"><span className="chip capitalize">{notice.category}</span><span className={`rounded-full px-2 py-1 text-xs font-bold capitalize ${priorityStyle[notice.priority]}`}>{notice.priority}</span><span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{noticeScopeLabel(notice.targetScope)}</span></div><h2 className="mt-3 break-words text-xl font-black text-slate-950 dark:text-white">{notice.title}</h2><p className="mt-2 flex-1 whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-300">{noticePreview(notice.content)}</p><div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div><time dateTime={notice.publishedAt || ''} className="block text-xs text-slate-500">{formatDate(notice.publishedAt)}</time><span className="text-xs text-slate-500">Published on CampusSwap</span></div><Link to={`/notices/${notice.id}`} className="inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">View Details</Link></div></article></PremiumCard>;
}
