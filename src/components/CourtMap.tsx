import { useEffect } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Court, OccupancyStatus } from '../types/types.ts';
import { PIEDMONT_PARK } from '../data/sampleCourts';
import './CourtMap.css';

export interface CourtMapItem {
  court: Court;
  players: number;
  status: OccupancyStatus;
}

interface CourtMapProps {
  items: CourtMapItem[];
}

const STATUS_LABEL: Record<OccupancyStatus, string> = {
  open: 'Open',
  busy: 'Busy',
  full: 'Full',
};

/** Ionic pages animate in, so Leaflet measures a wrong size at first.
 *  This re-measures once the page has settled. */
const FixSize: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 300);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

const pinIcon = (status: OccupancyStatus) =>
  L.divIcon({
    className: '',
    html: `<div class="court-pin court-pin--${status}"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });

const CourtMap: React.FC<CourtMapProps> = ({ items }) => (
  <MapContainer center={PIEDMONT_PARK} zoom={13} className="court-map" zoomControl={false}>
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
    <FixSize />
    {items.map(({ court, players, status }) => (
      <Marker
        key={court.id}
        position={[court.latitude, court.longitude]}
        icon={pinIcon(status)}
      >
        <Popup>
          <div className="court-popup__name">{court.name}</div>
          <div className="court-popup__status">
            {players} playing · {STATUS_LABEL[status]}
          </div>
          <Link className="court-popup__link" to={`/courts/${court.id}`}>
            View court
          </Link>
        </Popup>
      </Marker>
    ))}
  </MapContainer>
);

export default CourtMap;