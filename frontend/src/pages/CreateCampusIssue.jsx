import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, PremiumCard } from '../components/ui';
import {
  BackToReports, IssueDisclaimer, IssueLayout, IssueLoadError, IssuePagination
} from '../components/CampusIssueUi';
import { useCampusIssueRequest } from '../hooks/useCampusIssueRequest';
import { useIssuePhotoUrl } from '../components/CampusIssueEvidence';
import { campusIssueAPI, campusLocationAPI } from '../services/api';
import {
  ISSUE_CATEGORIES, ISSUE_LIMITS, ISSUE_PHOTO_TYPES, buildIssuePayload, issueSubmitError, normalizeIssue,
  normalizeIssueLocation, readIssuePage, validateIssuePhotos
} from '../utils/campusIssues';

export default function CreateCampusIssue() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', description: '', category: '', locationDescription: '' });
  const [location, setLocation] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [photos, setPhotos] = useState([]);
  const [photoError, setPhotoError] = useState('');
  const nextPhotoId = useRef(0);
  const submissionKey = useRef(null);
  const locked = useRef(false);
  const set = (key) => (event) => setForm((previous) => ({ ...previous, [key]: event.target.value }));

  function selectPhotos(event) {
    const files = [...event.target.files];
    event.target.value = '';
    try {
      validateIssuePhotos(files, photos.length);
      setPhotoError('');
      const selected = files.map((file) => ({ id: nextPhotoId.current++, file }));
      setPhotos((previous) => [...previous, ...selected]);
    } catch (invalid) {
      setPhotoError(invalid.message);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (locked.current) return;
    let payload;
    try {
      payload = buildIssuePayload({ ...form, campusLocation: location?.id });
    } catch (invalid) {
      setError(invalid.message);
      return;
    }

    locked.current = true;
    setPending(true);
    setError('');
    try {
      if (photos.length && !submissionKey.current) submissionKey.current = crypto.randomUUID();
      const response = await campusIssueAPI.create(payload, photos.map(({ file }) => file), submissionKey.current);
      const { data } = response;
      const issue = normalizeIssue(data?.data);
      if (!data?.success || !issue) throw new Error('Invalid issue response');
      navigate(`/campus-issues/${issue.id}`, { replace: true, state: { submitted: true, replayed: response.status === 200 } });
    } catch (failure) {
      setError(issueSubmitError(failure));
    } finally {
      locked.current = false;
      setPending(false);
    }
  }

  return <IssueLayout>
    <BackToReports />
    <header className="space-y-2"><h1 className="text-section-title">Submit New Issue</h1><IssueDisclaimer /></header>
    <PremiumCard hover={false}>
      <form noValidate onSubmit={submit}>
        <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="issue-title" className="text-sm font-semibold">Title</label>
            <input id="issue-title" className="form-control mt-1 min-h-11 w-full" required
              maxLength={ISSUE_LIMITS.title} value={form.title} onChange={set('title')} />
          </div>
          <div className="min-w-0">
            <label htmlFor="issue-category" className="text-sm font-semibold">Category</label>
            <select id="issue-category" className="form-control mt-1 min-h-11 w-full" required value={form.category} onChange={set('category')}>
              <option value="">Choose a category</option>
              {Object.entries(ISSUE_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="issue-description" className="text-sm font-semibold">Description</label>
            <textarea id="issue-description" className="form-control mt-1 w-full" required rows={6}
              maxLength={ISSUE_LIMITS.description} value={form.description} onChange={set('description')} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="issue-location-description" className="text-sm font-semibold">Location description (optional)</label>
            <input id="issue-location-description" className="form-control mt-1 min-h-11 w-full" placeholder="Building, floor, or nearby landmark"
              maxLength={ISSUE_LIMITS.locationDescription} value={form.locationDescription} onChange={set('locationDescription')} />
          </div>
          <div className="min-w-0 space-y-3 sm:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" aria-expanded={showPicker} onClick={() => setShowPicker((value) => !value)}>
                {showPicker ? 'Hide campus locations' : 'Choose a campus location (optional)'}
              </Button>
              {location && <>
                <p className="min-w-0 break-words text-sm">Selected: {location.name}</p>
                <Button type="button" variant="secondary" onClick={() => setLocation(null)}>Remove location</Button>
              </>}
            </div>
            {showPicker && <LocationPicker select={(item) => { setLocation(item); setShowPicker(false); }} />}
          </div>
          <div className="min-w-0 space-y-2 sm:col-span-2">
            <label htmlFor="issue-photos" className="block text-sm font-semibold">Photo evidence (optional)</label>
            <p id="issue-photo-limits" className="text-sm">Up to 3 JPEG, PNG, or WebP photos, 5 MB each.</p>
            <input id="issue-photos" type="file" multiple accept={ISSUE_PHOTO_TYPES.join(',')}
              aria-describedby="issue-photo-limits" className="form-control w-full min-w-0" onChange={selectPhotos} />
            {photoError && <p role="alert">{photoError}</p>}
            {photos.length > 0 && <ul aria-label="Selected photos" className="grid min-w-0 gap-3 sm:grid-cols-3">
              {photos.map(({ id, file }) => <PhotoSelection key={id} file={file} remove={() => {
                setPhotos((previous) => previous.filter((photo) => photo.id !== id));
                setPhotoError('');
              }} />)}
            </ul>}
          </div>
          <div className="space-y-3 sm:col-span-2">
            {error && <p role="alert" className="break-words rounded-lg bg-rose-50 p-3 text-rose-900 dark:bg-rose-950 dark:text-rose-100">{error}</p>}
            <Button type="submit" disabled={pending}>
              {pending ? (photos.length ? 'Processing photos and submitting…' : 'Submitting…') : 'Submit Report'}
            </Button>
          </div>
        </fieldset>
      </form>
    </PremiumCard>
  </IssueLayout>;
}

function PhotoSelection({ file, remove }) {
  const url = useIssuePhotoUrl(file);
  const [failed, setFailed] = useState(false);
  return <li className="min-w-0 space-y-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
    {failed ? <p className="text-sm">Preview unavailable.</p> : url &&
      <img src={url} alt={`Preview of ${file.name}`} className="mx-auto max-h-32 max-w-full object-contain"
        onError={() => setFailed(true)} />}
    <p className="break-all text-sm">{file.name} · {Math.ceil(file.size / 1024)} KB</p>
    <Button type="button" variant="secondary" aria-label={`Remove ${file.name}`} onClick={remove}>Remove</Button>
  </li>;
}

function LocationPicker({ select }) {
  const [search, setSearch] = useState('');
  const [{ keyword, page }, setQuery] = useState({ keyword: '', page: 1 });
  useEffect(() => {
    const timer = setTimeout(() => setQuery((current) =>
      current.keyword === search.trim() ? current : { keyword: search.trim(), page: 1 }
    ), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const load = useCallback(async (signal) => {
    const { data } = await campusLocationAPI.getAll({ page, limit: 8, ...(keyword && { search: keyword }) }, { signal });
    return readIssuePage(data, normalizeIssueLocation, page);
  }, [page, keyword]);
  const [result, retry] = useCampusIssueRequest(load);

  return <section aria-label="Published campus locations" className="min-w-0 space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
    <label htmlFor="issue-campus-search" className="text-sm font-semibold">Search campus locations</label>
    <input id="issue-campus-search" type="search" className="form-control min-h-11 w-full" maxLength={100}
      value={search} onChange={(event) => setSearch(event.target.value)} />
    {result.busy || keyword !== search.trim() ? <p role="status">Loading campus locations…</p>
      : result.error ? <IssueLoadError message="Campus locations could not be loaded. You can still use the location description." retry={retry} />
      : <>
        {result.data.data.length ? <ul className="space-y-1">
          {result.data.data.map((item) => <li key={item.id}>
            <button type="button" onClick={() => select(item)}
              className="min-h-11 w-full break-words rounded-lg px-3 py-2 text-left font-medium hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800">{item.name}</button>
          </li>)}
        </ul> : <p role="status">{keyword ? 'No campus locations match your search.' : 'No campus locations are available yet.'} You can still use the location description.</p>}
        <IssuePagination page={page} totalPages={result.data.totalPages} label="Campus location pagination"
          setPage={(value) => setQuery((current) => ({ ...current, page: value }))} />
      </>}
  </section>;
}
