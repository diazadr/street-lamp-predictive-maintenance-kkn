"use client";

import { useEffect, useRef } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TILE_LAYERS, STATUS_COLORS, createIcon } from "@/src/features/map/components/LampMap";
import type { PublicLamp } from "../../services/publicService";

function FitBounds({ lamps }: { lamps: PublicLamp[] }) {
  const map = useMap();
  const lastKey = useRef("");
  useEffect(() => {
    if (!lamps.length) return;
    const key = lamps.map((l) => l.code).join(",");
    if (key === lastKey.current) return;
    lastKey.current = key;
    map.fitBounds(L.latLngBounds(lamps.map((l) => [l.latitude, l.longitude] as [number, number])), { padding: [40, 40], maxZoom: 16 });
  }, [lamps, map]);
  return null;
}

function FlyTo({ lamp }: { lamp: PublicLamp | null }) {
  const map = useMap();
  useEffect(() => {
    if (lamp) map.flyTo([lamp.latitude, lamp.longitude], Math.max(map.getZoom(), 16), { duration: 0.8 });
  }, [lamp, map]);
  return null;
}

/** Marker terpilih: lebih besar dengan cincin gelap agar menonjol dari marker lain. */
function selectedIcon(status: string) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.offline;
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:26px;height:26px;border-radius:50%;background:${color};border:4px solid #fff;box-shadow:0 0 0 3px #0f2557,0 4px 10px rgba(0,0,0,.4)"></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

interface Props {
  lamps: PublicLamp[];
  selected: PublicLamp | null;
  onSelect: (lamp: PublicLamp) => void;
}

/** Peta publik: marker berwarna status; klik marker memilih lampu (detail ditampilkan di panel samping). */
export default function PublicLampMap({ lamps, selected, onSelect }: Props) {
  const layer = TILE_LAYERS.street;
  return (
    <MapContainer center={[-6.9, 107.61]} zoom={14} scrollWheelZoom={false} className="map-street h-full w-full" zoomControl>
      <TileLayer url={layer.url} attribution={layer.attribution} />
      <FitBounds lamps={lamps} />
      <FlyTo lamp={selected} />
      {lamps.map((lamp) => (
        <Marker
          key={lamp.code}
          position={[lamp.latitude, lamp.longitude]}
          icon={selected?.code === lamp.code ? selectedIcon(lamp.status) : createIcon(lamp.status)}
          zIndexOffset={selected?.code === lamp.code ? 1000 : 0}
          eventHandlers={{ click: () => onSelect(lamp) }}
        />
      ))}
    </MapContainer>
  );
}
