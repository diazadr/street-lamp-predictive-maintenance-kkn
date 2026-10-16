import { api, toList } from "@/src/lib/http/axios";
import type { Lamp, Place } from "@/src/types/domain";

export interface PlacePayload {
  name: string;
  type?: string | null;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export const placeService = {
  async list() {
    const { data } = await api.get("/places");
    return toList<Place>(data);
  },
  async get(id: string) {
    const { data } = await api.get<Place>(`/places/${id}`);
    return data;
  },
  async lamps(id: string) {
    const { data } = await api.get(`/places/${id}/lamps`);
    return toList<Lamp>(data);
  },
  async create(payload: PlacePayload) {
    const { data } = await api.post<Place>("/places", payload);
    return data;
  },
};
