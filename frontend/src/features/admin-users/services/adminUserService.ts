import { api, toList } from "@/src/lib/http/axios";
import type { User } from "@/src/types/auth";

export const adminUserService = {
  async list() {
    const { data } = await api.get("/admin/users");
    return toList<User>(data);
  },
  approve(id: string) {
    return api.patch(`/admin/users/${id}/approval`, { approved: true });
  },
  reject(id: string, reason: string) {
    return api.patch(`/admin/users/${id}/approval`, { approved: false, reason });
  },
  changeRole(id: string, role: string) {
    return api.patch(`/admin/users/${id}/role`, { role });
  },
  suspend(id: string) {
    return api.patch(`/admin/users/${id}/suspend`);
  },
  activate(id: string) {
    return api.patch(`/admin/users/${id}/activate`);
  },
};
