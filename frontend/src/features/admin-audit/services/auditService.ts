import { api, toList, toTotal } from "@/src/lib/http/axios";

export interface AuditLog {
  id: string;
  user?: { name?: string; email?: string } | null;
  action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  details?: string | null;
  ip_address?: string | null;
  created_at: string;
}

export const auditService = {
  async list(params: { skip: number; limit: number; action?: string }) {
    const { data } = await api.get("/audit-logs", { params });
    const items = toList<AuditLog>(data);
    return { items, total: toTotal(data, items.length) };
  },
};
