import { api } from "@/src/lib/http/axios";

export const authService = {
  register(data: { name: string; email: string; password: string }) {
    return api.post("/auth/register", data);
  },
  verifyEmail(token: string) {
    return api.get("/auth/verify-email", { params: { token } });
  },
  resendVerification(email: string) {
    return api.post("/auth/resend-verification", { email });
  },
  forgotPassword(email: string) {
    return api.post("/auth/forgot-password", { email });
  },
  resetPassword(token: string, newPassword: string) {
    return api.post("/auth/reset-password", { token, new_password: newPassword });
  },
};
