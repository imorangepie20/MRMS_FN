"use client";

import { useEffect, useState } from "react";

import { fetchAdminUsers, runMrt, type AdminUser } from "@/lib/api/admin-emp";
import { useUser } from "@/lib/hooks/use-user";


interface Props {
  /** 전체 큐잉 후 Runs 목록 새로고침 (선택) */
  onAllQueued?: () => void;
}


export function RunMrtCard({ onAllQueued }: Props) {
  const { user } = useUser();
  const [target, setTarget] = useState<"user" | "all">("user");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedEmail, setSelectedEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 대상 선택용 사용자 목록 로드 (track_count 내림차순 — 라이브러리 보유 우선).
  useEffect(() => {
    fetchAdminUsers()
      .then(setUsers)
      .catch((e) => setError((e as Error).message));
  }, []);

  // 기본 선택 = 관리자 본인(목록에 있으면), 없으면 첫 사용자. 수동 선택(selectedEmail)이 우선.
  // 상태 동기화 대신 렌더에서 파생 (effect 내 setState 회피).
  const defaultEmail =
    user?.email && users.some((u) => u.email === user.email)
      ? user.email
      : users[0]?.email ?? "";
  const effectiveEmail = selectedEmail || defaultEmail;

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await runMrt(target, target === "user" ? effectiveEmail : undefined);
      if (r.mode === "all") {
        setResult(`${r.queued}명 큐잉됨 — 아래 Runs에서 확인`);
        onAllQueued?.();
      } else if (r.regenerated) {
        setResult(`재생성 완료 — 사용 트랙 ${r.tracks_used}, discovery ${r.discovery_count}`);
      } else {
        setResult(`건너뜀 — ${r.reason}`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-6 border border-(--mrms-rule) p-4">
      <div className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute) mb-3">
        추천 실행 (MRT + discovery)
      </div>
      <div className="flex items-center gap-4 mb-3 text-[13px] text-(--mrms-ink)">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            checked={target === "user"}
            onChange={() => setTarget("user")}
          />
          특정 유저
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            checked={target === "all"}
            onChange={() => setTarget("all")}
          />
          전체
        </label>
      </div>
      {target === "user" && (
        <select
          value={effectiveEmail}
          onChange={(e) => setSelectedEmail(e.target.value)}
          className="w-full mb-3 bg-(--mrms-paper) border border-(--mrms-ink) px-2 py-1.5 font-mono text-[12px] text-(--mrms-ink)"
        >
          {users.length === 0 && <option value="">— 사용자 없음 —</option>}
          {users.map((u) => (
            <option key={u.email} value={u.email}>
              {u.email}
              {u.display_name ? ` (${u.display_name})` : ""} · {u.track_count}곡
            </option>
          ))}
        </select>
      )}
      <button
        onClick={run}
        disabled={busy || (target === "user" && !effectiveEmail)}
        className="bg-(--mrms-ink) text-(--mrms-paper) px-3 py-1.5 font-mono text-[11px] tracking-editorial uppercase border-0 cursor-pointer hover:bg-(--mrms-rust) disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? "실행 중…" : "추천 실행"}
      </button>
      {result && (
        <div className="mt-3 font-mono text-[11px] text-(--mrms-ink-soft)">{result}</div>
      )}
      {error && (
        <div className="mt-3 font-mono text-[11px] text-(--mrms-rust)">{error}</div>
      )}
    </div>
  );
}
