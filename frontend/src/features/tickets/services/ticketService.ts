import { api, toList } from "@/src/lib/http/axios";
import type { Attachment, Ticket, TicketLog, TicketPriority, TicketStatus } from "@/src/types/domain";

export interface TicketPayload {
  lamp_id: string;
  title: string;
  description?: string;
  priority: TicketPriority;
}

export const ticketService = {
  async list(params: { status?: string; lamp_id?: string } = {}) {
    const { data } = await api.get("/tickets", { params: { limit: 200, ...params } });
    return toList<Ticket>(data);
  },
  async get(id: string) {
    const { data } = await api.get<Ticket>(`/tickets/${id}`);
    return data;
  },
  async logs(id: string) {
    const { data } = await api.get(`/tickets/${id}/logs`);
    return toList<TicketLog>(data);
  },
  async create(payload: TicketPayload) {
    const { data } = await api.post<Ticket>("/tickets", payload);
    return data;
  },
  async updateStatus(id: string, status: TicketStatus) {
    return api.patch(`/tickets/${id}/status`, { status });
  },
  async addNote(id: string, note: string) {
    return api.post(`/tickets/${id}/logs`, { action: "note", note });
  },
  async attachments(id: string) {
    const { data } = await api.get(`/tickets/${id}/attachments`);
    return toList<Attachment>(data);
  },
  async upload(id: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    return api.post(`/tickets/${id}/attachments`, form, { headers: { "Content-Type": "multipart/form-data" } });
  },
};
