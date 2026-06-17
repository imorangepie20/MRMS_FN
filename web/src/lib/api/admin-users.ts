import { apiFetch } from "./http";

export interface AdminUser {
  user_id: string;
  email: string;
  nickname: string | null;
  role: "user" | "admin" | "superadmin";
  created_at: string | null;
  track_count: number;
  primary_platform: "tidal" | "spotify" | "youtube" | null;
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const r = await apiFetch("/api/admin/users", {}, "admin users");
  return (await r.json()).users;
}

export async function setUserRole(
  userId: string,
  role: "admin" | "user",
): Promise<void> {
  await apiFetch(
    `/api/admin/users/${userId}/role`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    },
    "set role",
  );
}
