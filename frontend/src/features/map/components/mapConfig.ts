/** Konstanta peta tanpa impor Leaflet — aman dipakai komponen yang dirender di server. */

export const STATUS_COLORS: Record<string, string> = {
  online: "#6b8a2e",
  warning: "#d97706",
  fault: "#dc2626",
  maintenance: "#1f4e9e",
  offline: "#94a3b8",
};

// Catatan: basemap CARTO kini mewajibkan API key, jadi dipakai OpenStreetMap
// (mode gelap memakai filter CSS pada tile, lihat globals.css).
export const TILE_LAYERS = {
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri",
  },
} as const;

export type TileKey = keyof typeof TILE_LAYERS;
