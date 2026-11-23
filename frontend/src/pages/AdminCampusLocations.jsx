import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import CampusCoordinatePicker from '../components/CampusCoordinatePicker';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import Layout from '../layouts/Layout';
import { adminCampusLocationAPI as locationsAPI, getApiErrorMessage } from '../services/api';
import { CAMPUS_CATEGORIES, validCoordinates } from '../utils/campusMap';
import { ADVANCED_FIELDS, buildLocationPayload, canPublishLocation, locationChanges, locationToForm, readCoordinate } from '../utils/campusLocationAdmin';

const statuses = ['draft', 'published', 'archived'];
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function AdminCampusLocations() {
  const [filters, setFilters] = useState({ search: '', category: '', status: '', page: 1 });
  const [search, setSearch] = useState('');
  const [result, setResult] = useState({ busy: true, error: '', data: [], totalPages: 0 });
  const [revision, refresh] = useState(0);
  const [editor, setEditor] = useState(null);
  const searching = filters.search.trim() !== search;
  const reloadList = () => refresh((value) => value + 1);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(filters.search.trim()), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const { category, status, page } = filters;
  useEffect(() => {
    if (searching) return;
    const controller = new AbortController();
    setResult((previous) => ({ ...previous, busy: true, error: '' }));
    locationsAPI.list({ page, limit: 12, ...(search && { search }), ...(category && { category }), ...(status && { status }) }, controller.signal)
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        const lastPage = Math.max(1, data.pagination.totalPages);
        if (page > lastPage) {
          setFilters((current) => ({ ...current, page: lastPage }));
          return;
        }
        setResult({ busy: false, error: '', data: data.data, totalPages: data.pagination.totalPages });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({ busy: false, error: getApiErrorMessage(error), data: [], totalPages: 0 });
        }
      });
    return () => controller.abort();
  }, [category, status, page, search, searching, revision]);

  const filter = (key, value) => setFilters((previous) => ({ ...previous, [key]: value, page: 1 }));

  return (
    <PageTransition><Layout>
      <main className="section-container max-w-6xl space-y-5 py-8">
        <Link to="/admin" className="inline-flex min-h-11 items-center text-sm font-bold underline">Back to Admin Panel</Link>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-section-title">Campus Locations</h1>
          <Button disabled={editor !== null} onClick={() => setEditor('new')}>Add Location</Button>
        </header>
        {editor !== null && <LocationEditor key={editor} id={editor === 'new' ? null : editor}
          onClose={() => setEditor(null)} onMutation={reloadList} />}
        <PremiumCard hover={false}>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_11rem]">
            <Field label="Search locations" type="search" maxLength={100} value={filters.search}
              onChange={(value) => filter('search', value)} placeholder="Name, building code or alias" />
            <Select label="Category filter" options={CAMPUS_CATEGORIES} emptyLabel="All Categories" value={category} onChange={(value) => filter('category', value)} />
            <Select label="Status filter" options={statuses} emptyLabel="All Statuses" value={status} onChange={(value) => filter('status', value)} />
          </div>
        </PremiumCard>
        {searching || result.busy ? <p role="status">Loading campus locations…</p>
          : result.error ? <div role="alert"><p>{result.error}</p><Button className="mt-2" onClick={reloadList}>Retry</Button></div>
          : !result.data.length ? <PremiumCard hover={false}><p role="status">No campus locations match these filters.</p></PremiumCard>
          : <ul aria-label="Managed campus locations" className="space-y-3">
            {result.data.map((location) => (
              <li key={location._id}><PremiumCard hover={false}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 break-words">
                    <h2 className="text-feature-title">{location.name}</h2>
                    <p className="mt-1 text-sm"><span className="capitalize">{location.category}</span>{location.buildingCode && ` · ${location.buildingCode}`}</p>
                    <LocationStatus location={location} />
                    {validCoordinates(location) && <p className="mt-2 text-sm">Coordinates: {location.latitude}, {location.longitude}</p>}
                    {location.updatedAt && <p className="mt-1 text-sm">Updated <time dateTime={location.updatedAt}>{dateFormat.format(new Date(location.updatedAt))}</time></p>}
                  </div>
                  <Button variant="secondary" disabled={editor !== null} onClick={() => setEditor(location._id)}>Edit Location</Button>
                </div>
              </PremiumCard></li>
            ))}
          </ul>}
        {!searching && !result.busy && result.totalPages > 1 && (
          <nav aria-label="Campus location pagination" className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setFilters({ ...filters, page: page - 1 })}>Previous</Button>
            <span>Page {page} of {result.totalPages}</span>
            <Button variant="secondary" disabled={page >= result.totalPages} onClick={() => setFilters({ ...filters, page: page + 1 })}>Next</Button>
          </nav>
        )}
      </main>
    </Layout></PageTransition>
  );
}

function LocationEditor({ id, onClose, onMutation }) {
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(() => locationToForm());
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(null);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const [conflicted, setConflicted] = useState(false);
  const [message, setMessage] = useState(null);
  const [source, setSource] = useState('');
  const [review, setReview] = useState(false);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    const target = reload?.id ?? id;
    if (!target) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    locationsAPI.get(target, controller.signal).then(({ data }) => {
      if (controller.signal.aborted) return;
      setSaved(data.data);
      setForm(locationToForm(data.data));
      setConflicted(false);
      setReview(false);
      setSource('');
      setMessage(null);
      setShowMap(false);
    }).catch((error) => {
      if (!controller.signal.aborted) setLoadError(getApiErrorMessage(error));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [id, reload]);

  const set = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const baseline = locationToForm(saved ?? {});
  const dirty = Object.keys(form).some((key) => form[key] !== baseline[key]);
  const coordinates = { latitude: readCoordinate(form.latitude, 90), longitude: readCoordinate(form.longitude, 180) };
  const point = validCoordinates(coordinates) ? [coordinates.latitude, coordinates.longitude] : null;
  const changedPoint = saved && Object.keys(coordinates).some((key) => coordinates[key] !== (saved[key] ?? null));
  const selectPoint = ({ lat, lng }) => {
    if (!lock.current) setForm((previous) => ({ ...previous, latitude: String(lat), longitude: String(lng) }));
  };

  async function mutate(request, feedback) {
    if (lock.current || conflicted) return;
    lock.current = true;
    setPending(true);
    setMessage(null);
    try {
      const { data } = await request();
      setSaved(data.data);
      setForm(locationToForm(data.data));
      setReview(false);
      setSource('');
      setMessage({ text: feedback });
      onMutation();
    } catch (error) {
      const duplicateCode = error.response?.status === 409 && error.response.data?.details?.field === 'buildingCode';
      const stale = error.response?.status === 409 && !duplicateCode;
      setConflicted(stale);
      setMessage({ error: true, text: duplicateCode ? 'This building code is already in use.' : getApiErrorMessage(error) });
      if (stale) onMutation();
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  function save(event) {
    event.preventDefault();
    if (lock.current || conflicted) return;
    try {
      const payload = buildLocationPayload(form);
      if (!saved) return void mutate(() => locationsAPI.create(payload), 'Draft saved.');
      const patch = locationChanges(saved, payload);
      if (!Object.keys(patch).length) {
        setForm(baseline);
        setMessage({ text: 'No changes to save.' });
        return;
      }
      void mutate(() => locationsAPI.update(saved._id, patch, saved.__v),
        changedPoint && saved.status === 'published' ? 'Changes saved. Location moved to draft and requires verification.' : 'Changes saved.');
    } catch (error) {
      setMessage({ error: true, text: error.message });
    }
  }

  const busy = pending || loading;
  const actionDisabled = busy || conflicted || dirty || Boolean(loadError);
  const reloadSaved = () => {
    if (!dirty || window.confirm('Discard unsaved edits and load the latest saved location?')) {
      setReload({ id: saved?._id ?? id });
    }
  };

  return (
    <PremiumCard hover={false}>
      <section aria-label="Location editor" className="space-y-4">
        <div className="flex flex-wrap justify-between gap-3">
          <h2 className="text-feature-title">{id || saved ? 'Edit Location' : 'Add Location'}</h2>
          <Button variant="secondary" disabled={busy} onClick={() => {
            if (!dirty || window.confirm('Discard unsaved edits?')) onClose();
          }}>Close editor</Button>
        </div>
        {loading && <p role="status">Loading saved location…</p>}
        {loadError && <div role="alert"><p>{loadError}</p><Button onClick={reloadSaved}>Retry loading location</Button></div>}
        {message && <p role={message.error ? 'alert' : 'status'}>{message.text}</p>}
        {conflicted && <div className="space-y-2">
          <p>Your edits are still in the form. Load the latest saved version before applying them again.</p>
          <Button variant="secondary" disabled={busy} onClick={reloadSaved}>Reload saved location</Button>
        </div>}
        {(!id || saved) && <>
          {saved && <LocationStatus location={saved} />}
          <form noValidate onSubmit={save}>
            <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
              <Field label="Location name" required maxLength={120} value={form.name} onChange={(value) => set('name', value)} />
              <Select label="Category" required options={CAMPUS_CATEGORIES} emptyLabel="Select category" value={form.category} onChange={(value) => set('category', value)} />
              <Field label="Building code" maxLength={24} value={form.buildingCode} onChange={(value) => set('buildingCode', value)} />
              <Field label="Aliases (one per line)" multiline value={form.aliases} onChange={(value) => set('aliases', value)} />
              <div className="sm:col-span-2"><Field label="Description" multiline maxLength={2000} value={form.description} onChange={(value) => set('description', value)} /></div>
              <Field label="Latitude" inputMode="decimal" value={form.latitude} onChange={(value) => set('latitude', value)} />
              <Field label="Longitude" inputMode="decimal" value={form.longitude} onChange={(value) => set('longitude', value)} />
              <div className="space-y-3 sm:col-span-2">
                <Button type="button" variant="secondary" aria-expanded={showMap} onClick={() => setShowMap((value) => !value)}>{showMap ? 'Hide map' : 'Select on Map'}</Button>
                {showMap && <><p className="text-sm">Click the map or drag the marker to select coordinates. You can also enter them above.</p><CampusCoordinatePicker point={point} onSelect={selectPoint} /></>}
                {changedPoint && saved.coordinateVerificationStatus === 'verified' && <p role="note" className="text-sm">
                  Saving changed coordinates clears verification.{saved.status === 'published' && ' This location will move to draft and disappear from the student map.'}
                </p>}
              </div>
              <details className="min-w-0 sm:col-span-2">
                <summary className="cursor-pointer py-2 font-semibold">Advanced Details</summary>
                <div className="mt-2 grid gap-4 sm:grid-cols-2">
                  {ADVANCED_FIELDS.map(([key, label, maxLength]) => <Field key={key} label={label} maxLength={maxLength} value={form[key]} onChange={(value) => set(key, value)} />)}
                </div>
              </details>
              <div className="sm:col-span-2"><Button type="submit" disabled={busy || conflicted || Boolean(loadError)}>{pending ? 'Saving…' : saved ? 'Save Changes' : 'Save Draft'}</Button></div>
            </fieldset>
          </form>
          {saved && <section aria-label="Publication actions" className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
            {dirty && <p className="text-sm">Save your edits before verifying or changing publication.</p>}
            <div className="flex flex-wrap gap-2">
              {saved.coordinateVerificationStatus !== 'verified' && <Button variant="secondary" disabled={actionDisabled || !validCoordinates(saved)} onClick={() => setReview(true)}>Verify Coordinates</Button>}
              {saved.status !== 'published' && <Button disabled={actionDisabled || !canPublishLocation(saved)}
                onClick={() => void mutate(() => locationsAPI.publish(saved._id, saved.__v), 'Location published.')}>{saved.status === 'archived' ? 'Republish' : 'Publish'}</Button>}
              {saved.status === 'published' && <Button variant="danger" disabled={actionDisabled} onClick={() => {
                if (window.confirm(`Archive "${saved.name}" and hide it from the student map?`)) {
                  void mutate(() => locationsAPI.archive(saved._id, saved.__v), 'Location archived.');
                }
              }}>Archive</Button>}
            </div>
            {review && <form className="space-y-3" onSubmit={(event) => {
              event.preventDefault();
              if (actionDisabled || !source.trim() || !validCoordinates(saved)) return;
              const { latitude, longitude } = saved;
              void mutate(() => locationsAPI.verify(saved._id, { latitude, longitude, coordinateSource: source.trim() }, saved.__v), 'Coordinates verified.');
            }}>
              <p className="break-words">Confirm that you checked this saved point: {saved.latitude}, {saved.longitude}.</p>
              <Field label="Coordinate source" maxLength={500} required disabled={actionDisabled} value={source} onChange={setSource}
                placeholder="How did you check the point?" />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={actionDisabled || !source.trim()}>Confirm Verification</Button>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => { setReview(false); setSource(''); }}>Cancel verification</Button>
              </div>
            </form>}
          </section>}
        </>}
      </section>
    </PremiumCard>
  );
}

function LocationStatus({ location }) {
  return <p className="mt-2 flex flex-wrap gap-2 text-sm">
    <span className="chip capitalize">{location.status}</span>
    <span className="chip">{location.coordinateVerificationStatus === 'verified' ? 'Verified' : 'Unverified'}</span>
  </p>;
}

function Field({ label, value, onChange, multiline, ...input }) {
  const id = useId();
  const Control = multiline ? 'textarea' : 'input';
  return <div className="min-w-0">
    <label htmlFor={id} className="block text-sm font-semibold">{label}</label>
    <Control {...input} id={id} className="form-control mt-1 min-h-11 w-full" value={value}
      onChange={(event) => onChange(event.target.value)} />
  </div>;
}

function Select({ label, options, emptyLabel, value, onChange, required }) {
  const id = useId();
  return <div className="min-w-0">
    <label htmlFor={id} className="block text-sm font-semibold">{label}</label>
    <select id={id} className="form-control mt-1 min-h-11 w-full" required={required} value={value}
      onChange={(event) => onChange(event.target.value)}>
      <option value="">{emptyLabel}</option>
      {options.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}
    </select>
  </div>;
}
