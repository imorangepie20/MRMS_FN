"use client";

import { useEffect, useState } from "react";

import { fetchAdminUsers, setUserRole, type AdminUser } from "@/lib/api/admin-users";

export function AdminUsersClient() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminUsers().then(setUsers).catch((e) => setError((e as Error).message));
  }, []);

  async function toggle(u: AdminUser) {
    const next = u.role === "admin" ? "user" : "admin";
    setBusy(u.user_id);
    setError(null);
    const prev = users;
    setUsers((list) => list.map((x) => (x.user_id === u.user_id ? { ...x, role: next } : x)));
    try {
      await setUserRole(u.user_id, next);
    } catch (e) {
      setUsers(prev); // 롤백
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8">
      <h1 className="font-display font-bold text-(--mrms-ink) text-[26px] mb-1">회원 관리</h1>
      <p className="font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute) mb-6">
        Members · {users.length}
      </p>
      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      )}
      <div className="border-t border-(--mrms-ink)">
        {users.map((u) => {
          const isRoot = u.role === "superadmin";
          return (
            <div
              key={u.user_id}
              className="grid grid-cols-[1fr_auto_auto] gap-3 items-center py-2.5 border-b border-(--mrms-rule)"
            >
              <div className="min-w-0">
                <div className="font-display font-semibold text-[14px] truncate" title={u.email}>
                  {u.nickname || u.email}
                </div>
                <div className="font-mono text-[10px] text-(--mrms-ink-mute) truncate">
                  {u.email} · {u.primary_platform ?? "no platform"} · {u.track_count} tracks
                </div>
              </div>
              <span className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-soft)">
                {u.role}
              </span>
              <button
                onClick={() => toggle(u)}
                disabled={isRoot || busy === u.user_id}
                className="font-mono text-[10px] tracking-editorial uppercase border border-(--mrms-ink) px-2.5 py-1 cursor-pointer disabled:opacity-30 disabled:cursor-default hover:bg-(--mrms-ink) hover:text-(--mrms-paper)"
              >
                {isRoot ? "root" : u.role === "admin" ? "관리자 해임" : "관리자 임명"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
