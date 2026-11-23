import { useEffect } from 'react';
import { icon } from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import markerImage from 'leaflet/dist/images/marker-icon.png';
import markerRetina from 'leaflet/dist/images/marker-icon-2x.png';
import 'leaflet/dist/leaflet.css';

const markerIcon = icon({
  iconUrl: markerImage, iconRetinaUrl: markerRetina, iconSize: [25, 41], iconAnchor: [12, 41]
});

const normalizePoint = (point) => point.lng < -180 || point.lng > 180 ? point.wrap() : point;

export default function CampusCoordinatePicker({ point, onSelect }) {
  return (
    <section aria-label="Coordinate picker" className="isolate overflow-hidden rounded-xl border border-slate-300">
      <MapContainer center={point ?? [23.5, 78]} zoom={point ? 17 : 8}
        scrollWheelZoom={false} className="h-[340px] w-full bg-slate-200">
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}
          referrerPolicy="strict-origin-when-cross-origin"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
        <CoordinateSelection point={point} onSelect={onSelect} />
      </MapContainer>
    </section>
  );
}

function CoordinateSelection({ point, onSelect }) {
  const map = useMap();
  const latitude = point?.[0];
  const longitude = point?.[1];
  useMapEvents({ click: ({ latlng }) => onSelect(normalizePoint(latlng)) });
  useEffect(() => {
    if (latitude != null && longitude != null && !map.getBounds().contains([latitude, longitude])) {
      map.panTo([latitude, longitude], { animate: false });
    }
  }, [latitude, longitude, map]);
  return point && (
    <Marker position={point} icon={markerIcon} draggable title="Selected coordinates" alt="Selected coordinates"
      eventHandlers={{ dragend: ({ target }) => onSelect(normalizePoint(target.getLatLng())) }} />
  );
}
