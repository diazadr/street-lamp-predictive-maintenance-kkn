export type UserRole = "admin" | "operator" | "viewer";

export type UserStatus = "pending" | "awaiting_approval" | "active" | "rejected" | "suspended";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at?: string;
}
