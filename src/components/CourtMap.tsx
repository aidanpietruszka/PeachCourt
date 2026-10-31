import { useEffect, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Court } from "../types/types";
import { PIEDMONT_PARK, formatActivity } from "../utils/geo";
import "./CourtMap.css";

export interface CourtMapItem {
  court: Court;
  reported: number | null;
  openGames: number;
}

interface CourtMapProps {
  items: CourtMapItem[];
  userLocation: [number, number] | null;
  fitToItems?: boolean;
  centerSerial?: number;
}

interface FitToItemsProps {
  items: CourtMapItem[];
  enabled: boolean;
}

interface CenterOnUserProps {
  position: [number, number] | null;
  centerSerial: number;
}

const FixSize: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 300);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

const CenterOnUser: React.FC<CenterOnUserProps> = ({ position, centerSerial }) => {
  const map = useMap();
  const centeredForSerial = useRef(0);

  useEffect(() => {
    if (position && centeredForSerial.current !== centerSerial) {
      map.setView(position, map.getZoom(), { animate: true });
      centeredForSerial.current = centerSerial;
    }
  }, [map, position, centerSerial]);

  return null;
};

const FitToItems: React.FC<FitToItemsProps> = ({ items, enabled }) => {
  const map = useMap();
  const latest = useRef(items);
  const key = items.map(({ court }) => court.id).join("|");

  useEffect(() => {
    latest.current = items;
  });

  useEffect(() => {
    if (!enabled || key === "") {
      return;
    }
    const points = latest.current.map(
      ({ court }) => [court.latitude, court.longitude] as [number, number],
    );
    map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 15 });
  }, [map, enabled, key]);

  return null;
};

const pinIcon = (isActive: boolean) =>
  L.divIcon({
    className: "",
    html: `<div class="court-pin court-pin--${isActive ? "active" : "idle"}"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });

const userLocationIcon = L.divIcon({
  className: "",
  html: '<div class="user-location-pin"><span></span></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});

const CourtMap: React.FC<CourtMapProps> = ({
  items,
  userLocation,
  fitToItems = false,
  centerSerial = 1,
}) => (
  <MapContainer
    center={PIEDMONT_PARK}
    zoom={13}
    className="court-map"
    zoomControl={false}
  >
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
    <FixSize />
    <CenterOnUser position={userLocation} centerSerial={centerSerial} />
    <FitToItems items={items} enabled={fitToItems} />
    {userLocation && (
      <Marker
        position={userLocation}
        icon={userLocationIcon}
        zIndexOffset={1000}
      >
        <Popup>Your location</Popup>
      </Marker>
    )}
    {items.map(({ court, reported, openGames }) => (
      <Marker
        key={court.id}
        position={[court.latitude, court.longitude]}
        icon={pinIcon(reported !== null || openGames > 0)}
        zIndexOffset={reported !== null || openGames > 0 ? 500 : 0}
      >
        <Popup>
          <div className="court-popup__name">{court.name}</div>
          <div className="court-popup__status">
            {formatActivity(reported, openGames)}
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
