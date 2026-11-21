import { useEffect, useRef, useState } from 'react';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import Layout from '../layouts/Layout';
import { adminAPI } from '../services/api';
import { NOTICE_CATEGORIES, NOTICE_PRIORITIES } from '../utils/notices';
import { buildNoticePayload, emptyNoticeForm, noticeToForm, targetAudienceLabel, validateNoticeForm } from '../utils/noticeAdmin';

const statusTone = { draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200', published: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200', archived: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200' };

export default function AdminNotices() {
  const [items, setItems] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0, total: 0 });
  const [filters, setFilters] = useState({ search: '', status: '', category: '', page: 1 });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [form, setForm] = useState({ ...emptyNoticeForm, targetPrograms: [] });
  const [editing, setEditing] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const requestId = useRef(0);

  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(filters.search.trim()), 300); return () => clearTimeout(timer); }, [filters.search]);
  const load = async (signal) => {
    const current = ++requestId.current;
    setLoading(true);
    try {
      const params = { page: filters.page, limit: 12, ...(debouncedSearch ? { search: debouncedSearch } : {}), ...(filters.status ? { status: filters.status } : {}), ...(filters.category ? { category: filters.category } : {}) };
      const response = await adminAPI.notices(params, { signal });
      if (current !== requestId.current) return;
      setItems(response.data.data || []); setPrograms(response.data.programs || []); setPagination(response.data.pagination || { page: 1, totalPages: 0, total: 0 });
    } catch (error) {
      if (signal?.aborted || current !== requestId.current) return;
      setMessage({ type: 'error', text: error.userMessage || 'Notices could not be loaded.' });
    } finally { if (current === requestId.current) setLoading(false); }
  };
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [debouncedSearch, filters.status, filters.category, filters.page]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value, page: key === 'page' ? value : 1 }));
  const toggleProgram = (code) => setForm((current) => ({ ...current, targetPrograms: current.targetPrograms.includes(code) ? current.targetPrograms.filter((item) => item !== code) : [...current.targetPrograms, code] }));
  const reset = () => { setForm({ ...emptyNoticeForm, targetPrograms: [], attachments: [] }); setPendingFiles([]); setUploadProgress(0); setEditing(''); };
  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const validation = validateNoticeForm(form);
    if (validation) { setMessage({ type: 'error', text: validation }); return; }
    setSubmitting(true); setMessage({ type: '', text: '' });
    try {
      const payload = buildNoticePayload(form);
      const saved = editing ? await adminAPI.updateNotice(editing, payload) : await adminAPI.createNotice(payload);
      const noticeId = saved.data.data._id;
      if (pendingFiles.length) {
        setUploadProgress(1);
        try { await adminAPI.uploadNoticeAttachments(noticeId, pendingFiles, (event) => setUploadProgress(event.total ? Math.round((event.loaded / event.total) * 100) : 1)); }
        catch (error) {
          try { const current = await adminAPI.notice(noticeId); setForm((value) => ({ ...value, attachments: current.data.data.attachments || [] })); } catch { /* Keep entered form content even when refresh fails. */ }
          setEditing(noticeId); setMessage({ type: 'error', text: `${editing ? 'Notice changes were saved' : 'Draft was saved'}, but attachments failed to upload. ${error.userMessage || 'Please retry.'}` });
          await load(); return;
        }
      }
      setMessage({ type: 'success', text: editing ? 'Notice changes saved.' : 'Notice saved as a draft.' });
      reset(); await load();
    } catch (error) { setMessage({ type: 'error', text: error.userMessage || 'Notice could not be saved.' }); }
    finally { setSubmitting(false); }
  };
  const edit = (notice) => { setEditing(notice._id); setForm(noticeToForm(notice)); setPendingFiles([]); setUploadProgress(0); setMessage({ type: '', text: '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const chooseFiles = (files) => {
    const selected = Array.from(files || []);
    if (form.attachments.length + selected.length > 5) { setMessage({ type: 'error', text: 'A notice can contain at most 5 attachments.' }); return; }
    setPendingFiles(selected); setMessage({ type: '', text: '' });
  };
  const removeExisting = async (attachment) => {
    if (!editing || busy || !window.confirm(`Remove ${attachment.displayName}?`)) return;
    setBusy(attachment._id || attachment.id);
    try {
      const response = await adminAPI.removeNoticeAttachment(editing, attachment._id || attachment.id);
      setForm((current) => ({ ...current, attachments: response.data.data.attachments || [] }));
      setMessage({ type: 'success', text: response.data.cleanup === 'cleanup_required' ? 'Attachment removed. Provider cleanup remains pending.' : 'Attachment removed.' });
      await load();
    } catch (error) { setMessage({ type: 'error', text: error.userMessage || 'Attachment could not be removed.' }); }
    finally { setBusy(''); }
  };
  const transition = async (notice, action) => {
    if (busy) return;
    if ((action === 'archive' || notice.status === 'archived') && !window.confirm(action === 'archive' ? 'Archive this notice?' : 'Republish this archived notice?')) return;
    setBusy(notice._id); setMessage({ type: '', text: '' });
    try {
      if (action === 'archive') await adminAPI.archiveNotice(notice._id); else await adminAPI.publishNotice(notice._id);
      setMessage({ type: 'success', text: action === 'archive' ? 'Notice archived.' : notice.status === 'archived' ? 'Notice republished.' : 'Notice published.' });
      await load();
    } catch (error) { setMessage({ type: 'error', text: error.userMessage || 'Notice status could not be changed.' }); }
    finally { setBusy(''); }
  };

  return <PageTransition><Layout><main className="min-h-screen py-8 sm:py-10"><div className="section-container max-w-7xl space-y-6">
    <header><p className="chip">Admin controls</p><h1 className="text-section-title mt-3">Notice Management</h1><p className="text-body-sm mt-2">Create targeted CampusSwap notices, publish reviewed drafts, and archive outdated announcements.</p></header>
    {message.text && <p role={message.type === 'error' ? 'alert' : 'status'} className={`rounded-lg p-4 text-sm ${message.type === 'error' ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'}`}>{message.text}</p>}
    <PremiumCard hover={false}><h2 className="text-feature-title">{editing ? 'Edit notice' : 'Create Notice'}</h2><form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
      <Field label="Title" value={form.title} onChange={(value) => set('title', value)} required />
      <Select label="Category" value={form.category} onChange={(value) => set('category', value)} options={NOTICE_CATEGORIES} />
      <div className="md:col-span-2"><label htmlFor="admin-notice-content" className="text-sm font-semibold">Content</label><textarea id="admin-notice-content" rows="6" className="form-control mt-1" value={form.content} onChange={(event) => set('content', event.target.value)} required /></div>
      <Select label="Priority" value={form.priority} onChange={(value) => set('priority', value)} options={NOTICE_PRIORITIES} />
      <Select label="Target scope" value={form.targetScope} onChange={(value) => setForm((current) => ({ ...current, targetScope: value, ...(value === 'college' ? { targetPrograms: [], targetSemester: '' } : value === 'program' ? { targetSemester: '' } : {}) }))} options={[["college", "College-wide"], ["program", "Selected programs"], ["semester", "Selected programs + semester"]]} />
      {form.targetScope !== 'college' && <fieldset className="rounded-xl border border-slate-200 p-4 dark:border-slate-700 md:col-span-2"><legend className="px-1 text-sm font-bold">Programs</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{programs.map((program) => <label key={program.programCode} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"><input type="checkbox" checked={form.targetPrograms.includes(program.programCode)} onChange={() => toggleProgram(program.programCode)} />{program.displayName}</label>)}</div></fieldset>}
      {form.targetScope === 'semester' && <Select label="Semester" value={form.targetSemester} onChange={(value) => set('targetSemester', value)} options={['1','2','3','4','5','6','7','8']} blank="Select semester" />}
      <fieldset className="rounded-xl border border-slate-200 p-4 dark:border-slate-700 md:col-span-2"><legend className="px-1 text-sm font-bold">Attachments</legend><p className="text-xs text-slate-500">PDF, DOCX, JPEG, PNG, or WebP. Maximum 5 files and 10 MB each. Files upload only when you save.</p><input aria-label="Notice attachment files" className="form-control mt-3" type="file" multiple accept=".pdf,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp" onChange={(event) => chooseFiles(event.target.files)} disabled={submitting} />{pendingFiles.length > 0 && <ul className="mt-3 space-y-2">{pendingFiles.map((file, index) => <li key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 break-all">{file.name} · {formatBytes(file.size)}</span><Button type="button" size="sm" variant="secondary" disabled={submitting} onClick={() => setPendingFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove selected</Button></li>)}</ul>}{submitting && uploadProgress > 0 && <div className="mt-3" role="status"><p className="text-sm">Uploading attachments: {uploadProgress}%</p><progress className="w-full" max="100" value={uploadProgress}>{uploadProgress}%</progress></div>}{form.attachments.length > 0 && <div className="mt-4"><p className="text-sm font-bold">Uploaded files</p><ul className="mt-2 space-y-2">{form.attachments.map((attachment) => <li key={attachment._id || attachment.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700"><span className="min-w-0 break-all">{attachment.displayName} · {formatBytes(attachment.size)}</span><Button type="button" size="sm" variant="danger" disabled={Boolean(busy) || submitting} onClick={() => removeExisting(attachment)}>Remove uploaded</Button></li>)}</ul></div>}</fieldset>
      <details className="rounded-xl border border-slate-200 p-4 dark:border-slate-700 md:col-span-2"><summary className="cursor-pointer font-bold">Optional links and expiration</summary><div className="mt-4 grid gap-4 md:grid-cols-2"><Field label="Attachment HTTPS URL" value={form.attachmentUrl} onChange={(value) => set('attachmentUrl', value)} /><Field label="Attachment label" value={form.attachmentLabel} onChange={(value) => set('attachmentLabel', value)} /><Field label="Source HTTPS URL" value={form.sourceUrl} onChange={(value) => set('sourceUrl', value)} /><Field label="Source label" value={form.sourceLabel} onChange={(value) => set('sourceLabel', value)} /><div><label htmlFor="admin-notice-expires" className="text-sm font-semibold">Expiration date and time</label><input id="admin-notice-expires" type="datetime-local" className="form-control mt-1" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value, expiresAtOriginal: '' }))} /></div></div></details>
      <div className="flex flex-wrap gap-2 md:col-span-2"><Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : editing ? 'Save Changes' : 'Save Draft'}</Button>{editing && <Button type="button" variant="secondary" disabled={submitting} onClick={reset}>Cancel</Button>}</div>
    </form></PremiumCard>
    <PremiumCard hover={false}><div className="flex flex-col gap-4 lg:flex-row lg:items-end"><div className="flex-1"><label htmlFor="admin-notice-search" className="text-sm font-semibold">Search</label><input id="admin-notice-search" type="search" className="form-control mt-1" value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search title or content" /></div><Select label="Status filter" value={filters.status} onChange={(value) => updateFilter('status', value)} options={['draft','published','archived']} blank="All statuses" /><Select label="Category filter" value={filters.category} onChange={(value) => updateFilter('category', value)} options={NOTICE_CATEGORIES} blank="All categories" /></div>
      {loading ? <div role="status" className="mt-5 space-y-3"><span className="sr-only">Loading managed notices</span>{[1,2,3].map((item) => <div key={item} className="skeleton h-36" />)}</div> : items.length === 0 ? <p className="mt-5 text-sm text-slate-500">No notices match these filters.</p> : <div className="mt-5 space-y-3">{items.map((notice) => <NoticeRow key={notice._id} notice={notice} programs={programs} busy={busy} edit={edit} transition={transition} />)}</div>}
      {pagination.totalPages > 1 && <nav aria-label="Admin notice pagination" className="mt-5 flex items-center justify-center gap-3"><Button variant="secondary" disabled={filters.page <= 1} onClick={() => updateFilter('page', filters.page - 1)}>Previous</Button><span className="text-sm font-bold">Page {pagination.page} of {pagination.totalPages}</span><Button variant="secondary" disabled={filters.page >= pagination.totalPages} onClick={() => updateFilter('page', filters.page + 1)}>Next</Button></nav>}
    </PremiumCard>
  </div></main></Layout></PageTransition>;
}

function Field({ label, value, onChange, required = false }) { const id = `admin-notice-${label.toLowerCase().replaceAll(' ', '-')}`; return <div><label htmlFor={id} className="text-sm font-semibold">{label}</label><input id={id} className="form-control mt-1" value={value} onChange={(event) => onChange(event.target.value)} required={required} /></div>; }
function Select({ label, value, onChange, options, blank }) { const id = `admin-notice-${label.toLowerCase().replaceAll(' ', '-')}`; return <div><label htmlFor={id} className="text-sm font-semibold">{label}</label><select id={id} className="form-control mt-1" value={value} onChange={(event) => onChange(event.target.value)}>{blank !== undefined && <option value="">{blank}</option>}{options.map((option) => { const [key, text] = Array.isArray(option) ? option : [option, option[0].toUpperCase() + option.slice(1)]; return <option key={key} value={key}>{text}</option>; })}</select></div>; }
function NoticeRow({ notice, programs, busy, edit, transition }) { const date = notice.publishedAt || notice.createdAt; return <article className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap gap-2"><span className={`rounded-full px-2 py-1 text-xs font-bold capitalize ${statusTone[notice.status]}`}>{notice.status}</span><span className="chip capitalize">{notice.category}</span><span className="chip capitalize">{notice.priority}</span></div><h3 className="mt-2 break-words font-black">{notice.title}</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{targetAudienceLabel(notice, programs)}</p><time className="mt-1 block text-xs text-slate-500" dateTime={date || ''}>{date ? new Date(date).toLocaleString() : 'Date unavailable'}</time></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={Boolean(busy)} onClick={() => edit(notice)}>Edit</Button>{notice.status === 'draft' && <Button size="sm" disabled={Boolean(busy)} onClick={() => transition(notice, 'publish')}>{busy === notice._id ? 'Publishing…' : 'Publish'}</Button>}{notice.status === 'published' && <Button size="sm" variant="danger" disabled={Boolean(busy)} onClick={() => transition(notice, 'archive')}>{busy === notice._id ? 'Archiving…' : 'Archive'}</Button>}{notice.status === 'archived' && <Button size="sm" disabled={Boolean(busy)} onClick={() => transition(notice, 'publish')}>{busy === notice._id ? 'Republishing…' : 'Republish'}</Button>}</div></div></article>; }
const formatBytes = (bytes) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
