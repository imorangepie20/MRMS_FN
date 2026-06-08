export type UserRole = "Admin" | "Editor" | "Viewer";
export type UserStatus = "Active" | "Invited" | "Suspended";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastActive: string; // ISO date string, e.g. "2026-05-20"
  initials: string;
}

export const USERS: User[] = [
  { id: "u1",  name: "Sofia Davis",      email: "sofia@example.com",    role: "Admin",  status: "Active",    lastActive: "2026-06-06", initials: "SD" },
  { id: "u2",  name: "Jackson Lee",      email: "jackson@example.com",  role: "Editor", status: "Active",    lastActive: "2026-06-05", initials: "JL" },
  { id: "u3",  name: "Isabella Nguyen",  email: "isabella@example.com", role: "Viewer", status: "Invited",   lastActive: "2026-05-30", initials: "IN" },
  { id: "u4",  name: "Olivia Martin",    email: "olivia@example.com",   role: "Admin",  status: "Active",    lastActive: "2026-06-04", initials: "OM" },
  { id: "u5",  name: "Liam Garcia",      email: "liam@example.com",     role: "Editor", status: "Active",    lastActive: "2026-06-01", initials: "LG" },
  { id: "u6",  name: "Emma Brown",       email: "emma@example.com",     role: "Viewer", status: "Suspended", lastActive: "2026-04-15", initials: "EB" },
  { id: "u7",  name: "Noah Wilson",      email: "noah@example.com",     role: "Viewer", status: "Active",    lastActive: "2026-05-28", initials: "NW" },
  { id: "u8",  name: "Ava Thompson",     email: "ava@example.com",      role: "Editor", status: "Invited",   lastActive: "2026-06-03", initials: "AT" },
  { id: "u9",  name: "James Anderson",   email: "james@example.com",    role: "Viewer", status: "Active",    lastActive: "2026-06-02", initials: "JA" },
  { id: "u10", name: "Charlotte Harris", email: "charlotte@example.com",role: "Editor", status: "Active",    lastActive: "2026-06-05", initials: "CH" },
  { id: "u11", name: "Elijah Martinez",  email: "elijah@example.com",   role: "Admin",  status: "Suspended", lastActive: "2026-03-10", initials: "EM" },
  { id: "u12", name: "Amelia Robinson",  email: "amelia@example.com",   role: "Viewer", status: "Invited",   lastActive: "2026-05-25", initials: "AR" },
];
