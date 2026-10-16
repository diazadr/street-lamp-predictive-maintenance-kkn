import { useEffect, useState } from "react";
import { publicService, type PublicLamp } from "../services/publicService";

// Data contoh (Bandung) dipakai bila backend belum berjalan — peta tetap informatif.
const DEMO_AREAS = [
  { place: "Jl. Ganesha", lat: -6.8915, lng: 107.6107, prefix: "A" },
  { place: "Taman Lansia", lat: -6.903, lng: 107.6225, prefix: "B" },
  { place: "Kawasan Dago", lat: -6.8845, lng: 107.6135, prefix: "C" },
  { place: "Jl. Asia Afrika", lat: -6.9217, lng: 107.6071, prefix: "D" },
];
const DEMO_STATUS = ["online", "online", "online", "warning", "online", "online", "fault", "online", "online", "offline", "online", "maintenance", "online", "online", "warning", "online", "online", "online", "online", "online"];

export const DEMO_LAMPS: PublicLamp[] = DEMO_STATUS.map((status, i) => {
  const area = DEMO_AREAS[i % DEMO_AREAS.length];
  // sebaran deterministik di sekitar titik area (tanpa Math.random agar SSR/CSR konsisten)
  const angle = i * 2.4;
  const r = 0.0012 + (i % 5) * 0.0006;
  const battery = status === "fault" ? 9 : status === "warning" ? 31 + (i % 3) * 4 : status === "offline" ? null : 72 + ((i * 7) % 26);
  return {
    code: `PJU-${area.prefix}${String(i + 1).padStart(2, "0")}`,
    place: area.place,
    latitude: area.lat + Math.sin(angle) * r,
    longitude: area.lng + Math.cos(angle) * r,
    status,
    battery,
    brightness: status === "online" || status === "warning" ? 80 : 0,
    health_score: status === "fault" ? 22 : status === "warning" ? 58 : status === "offline" ? null : 84 + (i % 4) * 3,
    risk_level: status === "fault" ? "high" : status === "warning" ? "medium" : status === "offline" ? "unknown" : "low",
    last_seen: null,
  };
});

export function usePublicLamps() {
  const [lamps, setLamps] = useState<PublicLamp[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    publicService
      .getLamps()
      .then((data) => !cancelled && setLamps(data))
      .catch(() => !cancelled && setLamps([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const isLive = !!lamps?.length;
  return { isLoading: lamps === null, isLive, lamps: isLive ? lamps! : DEMO_LAMPS };
}
