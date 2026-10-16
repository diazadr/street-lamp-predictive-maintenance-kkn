"use client";

import { useEffect, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Lamp } from "@/src/types/domain";

import { STATUS_COLORS, TILE_LAYERS, type TileKey } from "./mapConfig";

export { STATUS_COLORS, TILE_LAYERS, type TileKey };

/** Marker lingkaran berwarna sesuai status, dengan cincin putih agar kontras di semua basemap. */
export function createIcon(status: string) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.offline;
  const pulse = status === "fault" ? `<span style="position:absolute;inset:-6px;border-radius:50%;background:${color};opacity:.25;animation:ping 1.6s cubic-bezier(0,0,.2,1) infinite"></span>` : "";
  return L.divIcon({
    className: "",
    html: `<span style="position:relative;display:block;width:16px;height:16px">${pulse}<span style="position:absolute;inset:0;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });
}

/** Sesuaikan tampilan peta ke seluruh lampu saat data pertama kali tersedia/berubah. */
function FitBounds({ lamps }: { lamps: Lamp[] }) {
  const map = useMap();
  const lastKey = useRef("");
  useEffect(() => {
    if (!lamps.length) return;
    const key = lamps.map((l) => l.id).join(",");
    if (key === lastKey.current) return;
    lastKey.current = key;
    const bounds = L.latLngBounds(lamps.map((l) => [Number(l.latitude), Number(l.longitude)] as [number, number]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 17 });
  }, [lamps, map]);
  return null;
}

function FlyTo({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 17, { duration: 1.2 });
  }, [position, map]);
  return null;
}

interface LampMapProps {
  lamps: Lamp[];
  tile: TileKey;
  flyTo: [number, number] | null;
  renderPopup: (lamp: Lamp) => React.ReactNode;
}

export default function LampMap({ lamps, tile, flyTo, renderPopup }: LampMapProps) {
  const center: [number, number] = lamps.length
    ? [
        lamps.reduce((s, l) => s + Number(l.latitude), 0) / lamps.length,
        lamps.reduce((s, l) => s + Number(l.longitude), 0) / lamps.length,
      ]
    : [-6.9175, 107.6191];
  const layer = TILE_LAYERS[tile];

  return (
    <MapContainer center={center} zoom={lamps.length ? 14 : 6} className={`h-full w-full ${tile === "street" ? "map-street" : ""}`} zoomControl>
      <TileLayer key={tile} url={layer.url} attribution={layer.attribution} />
      <FitBounds lamps={lamps} />
      <FlyTo position={flyTo} />
      {lamps.map((lamp) => (
        <Marker key={lamp.id} position={[Number(lamp.latitude), Number(lamp.longitude)]} icon={createIcon(lamp.status)}>
          <Popup minWidth={220}>{renderPopup(lamp)}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
