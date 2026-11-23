import { memo, useEffect, useMemo, useState } from 'react';
import { icon } from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import markerImage from 'leaflet/dist/images/marker-icon.png';
import markerRetina from 'leaflet/dist/images/marker-icon-2x.png';
import 'leaflet/dist/leaflet.css';
import Layout from '../layouts/Layout';
import { Button, PageTransition, PremiumCard } from '../components/ui';
import { campusLocationAPI } from '../services/api';
import { CAMPUS_CATEGORIES, LOCATION_DETAILS, directionsUrl, loadCampusLocations, normalizeLocation } from '../utils/campusMap';

const regionalCenter = [23.5, 78];
const regionalZoom = 8;
const tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const markerIcon = icon({
  iconUrl: markerImage, iconRetinaUrl: markerRetina, iconSize: [25, 41],
  iconAnchor: [12, 41], popupAnchor: [0, -36]
});
const emptyLocations = [];
const loading = { busy: true, error: '', data: null };

function useRequest(load) {
  const [attempt, retry] = useState(0);
  const [result, setResult] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then((data) => {
      if (!controller.signal.aborted) setResult({ load, attempt, data, error: '', busy: false });
    }).catch((error) => {
      if (!controller.signal.aborted) {
        setResult({ load, attempt, data: null, busy: false, error: error.userMessage || error.message || 'Request failed.' });
      }
    });
    return () => controller.abort();
  }, [load, attempt]);
  const current = result?.load === load && result.attempt === attempt ? result : loading;
  return [current, () => retry((count) => count + 1)];
}

export default function CampusMap() {
  const [search, setSearch] = useState('');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setKeyword(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const listRequest = useMemo(() => (signal) => loadCampusLocations(campusLocationAPI.getAll, {
    ...(category && { category }), ...(keyword && { search: keyword })
  }, signal), [category, keyword]);
  const [results, retry] = useRequest(listRequest);
  const searching = search.trim() !== keyword;
  const locations = searching ? emptyLocations : results.data ?? emptyLocations;

  return (
    <PageTransition><Layout>
      <main className="section-container max-w-7xl space-y-5 py-8 sm:py-10">
        <h1 className="text-section-title">Campus Map</h1>
        <PremiumCard hover={false}>
          <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <div className="min-w-0">
              <label className="text-sm font-semibold" htmlFor="campus-search">Search locations</label>
              <input id="campus-search" type="search" className="form-control mt-1 min-h-11 w-full"
                placeholder="Search buildings, departments, facilities..." maxLength={100} value={search}
                onChange={(event) => { setSearch(event.target.value); setSelected(''); }} />
            </div>
            <div>
              <label className="text-sm font-semibold" htmlFor="campus-category">Category</label>
              <select id="campus-category" className="form-control mt-1 min-h-11 w-full" value={category}
                onChange={(event) => { setCategory(event.target.value); setSelected(''); }}>
                <option value="">All Categories</option>
                {CAMPUS_CATEGORIES.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}
              </select>
            </div>
          </div>
        </PremiumCard>
        <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <MapView locations={locations} onSelect={setSelected} />
          <aside aria-label="Campus locations" className="min-w-0 space-y-4">
            {selected && <LocationDetails key={selected} id={selected} onClose={() => setSelected('')} />}
            <PremiumCard hover={false}>
              {searching || results.busy ? <p role="status">Loading locations…</p>
                : results.error ? <RequestError message={results.error} onRetry={retry} />
                : !locations.length ? <p role="status">{category || keyword ? 'No locations match your search or category.' : 'No campus locations are available yet. Verified locations will appear here once published.'}</p>
                : <>
                  <h2 className="text-feature-title">Locations</h2>
                  <ul aria-label="Location results" className="mt-3 max-h-96 space-y-1 overflow-y-auto">
                    {locations.map((location) => (
                      <li key={location.id}>
                        <button type="button" aria-pressed={selected === location.id}
                          className="min-h-11 w-full rounded-lg px-3 py-2 text-left hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 aria-pressed:bg-blue-50 dark:hover:bg-slate-800 dark:aria-pressed:bg-slate-800"
                          onClick={() => setSelected(location.id)}>
                          <span className="block break-words font-semibold">{location.name}</span>
                          <span className="text-sm capitalize">{location.category}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>}
            </PremiumCard>
          </aside>
        </div>
      </main>
    </Layout></PageTransition>
  );
}

const MapView = memo(function MapView({ locations, onSelect }) {
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const tileEvents = useMemo(() => ({
    loading: () => setTilesUnavailable(false),
    tileerror: () => setTilesUnavailable(true)
  }), []);
  const groups = useMemo(() => {
    const byPoint = new Map();
    for (const location of locations) {
      const key = `${location.latitude},${location.longitude}`;
      if (!byPoint.has(key)) byPoint.set(key, []);
      byPoint.get(key).push(location);
    }
    return [...byPoint.entries()];
  }, [locations]);

  return (
    <section aria-label="Interactive campus map" className="isolate min-w-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <MapContainer center={regionalCenter} zoom={regionalZoom} scrollWheelZoom={false}
        className="h-[52vh] min-h-[320px] max-h-[680px] w-full bg-slate-200">
        <TileLayer url={tileUrl} maxZoom={19} referrerPolicy="strict-origin-when-cross-origin"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          eventHandlers={tileEvents} />
        <FitLocations locations={locations} />
        {groups.map(([key, group]) => {
          const [first] = group;
          const title = group.length === 1 ? `${first.name} (${first.category})` : `${group.length} locations at this point`;
          return (
            <Marker key={key} position={[first.latitude, first.longitude]} icon={markerIcon}
              title={title} alt={title} eventHandlers={{ click: () => { if (group.length === 1) onSelect(first.id); } }}>
              <Popup>
                {group.map((location) => (
                  <button key={location.id} type="button" className="block min-h-11 break-words text-left font-semibold"
                    onClick={() => onSelect(location.id)}>{location.name} · {location.category}</button>
                ))}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      {tilesUnavailable && <p className="px-3 py-2 text-sm" role="status">Some map tiles are unavailable. You can still use the locations list.</p>}
    </section>
  );
});

function FitLocations({ locations }) {
  const map = useMap();
  useEffect(() => {
    if (!locations.length) return;
    const points = locations.map(({ latitude, longitude }) => [latitude, longitude]);
    if (points.length === 1) map.setView(points[0], 17);
    else map.fitBounds(points, { maxZoom: 17, padding: [25, 25], animate: false });
  }, [locations, map]);
  return null;
}

function LocationDetails({ id, onClose }) {
  const detailRequest = useMemo(() => async (signal) => {
    const { data } = await campusLocationAPI.getById(id, { signal });
    const location = normalizeLocation(data?.data);
    if (!data?.success || location?.id !== id) throw new Error('Location details are unavailable.');
    return location;
  }, [id]);
  const [detail, retry] = useRequest(detailRequest);
  const location = detail.data;

  return (
    <PremiumCard hover={false}>
      <section aria-label="Location details" className="min-w-0 break-words">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-feature-title" aria-live="polite">{location?.name ?? 'Location details'}</h2>
          <Button variant="secondary" onClick={onClose} className="min-h-11" aria-label="Close location details">Close</Button>
        </div>
        {detail.busy && <p role="status">Loading location details…</p>}
        {detail.error && <RequestError message={detail.error} onRetry={retry} />}
        {location && <>
          <p className="mt-2 text-sm capitalize">{location.category}</p>
          {location.description && <p className="mt-3 whitespace-pre-line">{location.description}</p>}
          <dl className="mt-3 space-y-2 text-sm">
            {Object.entries(LOCATION_DETAILS).map(([field, label]) => location[field] && (
              <div key={field}><dt className="font-semibold">{label}</dt><dd>{location[field]}</dd></div>
            ))}
          </dl>
          {location.imageUrl && <img className="mt-4 max-h-56 w-full rounded-lg object-contain" src={location.imageUrl}
            alt={location.name} loading="lazy" referrerPolicy="no-referrer" />}
          <a className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-blue-700 px-4 text-sm font-bold text-white"
            href={directionsUrl(location)} target="_blank" rel="noopener noreferrer">Get Directions</a>
        </>}
      </section>
    </PremiumCard>
  );
}

function RequestError({ message, onRetry }) {
  return <div role="alert"><p>{message}</p><Button className="mt-2 min-h-11" variant="secondary" onClick={onRetry}>Retry</Button></div>;
}
