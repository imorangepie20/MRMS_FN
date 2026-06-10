"use client";

import { useState } from "react";

import type { IngestionRun } from "@/lib/types";


export function RunRow({ run }: { run: IngestionRun }) {
  const [open, setOpen] = useState(false);
  const time = run.started_at
    ? new Date(run.started_at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })
    : "—";
  const statusColor =
    run.status === "success"
      ? "text-emerald-700"
      : run.status === "failed"
        ? "text-(--mrms-rust)"
        : "text-(--mrms-ink-soft)";

  return (
    <div className="border-b border-(--mrms-rule)">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left grid grid-cols-[100px_120px_80px_1fr] gap-3 py-2.5 items-baseline bg-transparent border-0 cursor-pointer font-mono text-[11px]"
      >
        <span className="text-(--mrms-ink-mute) truncate">{run.id}</span>
        <span className="text-(--mrms-ink-soft)">{time}</span>
        <span className={statusColor}>{run.status}</span>
        <span className="text-(--mrms-ink-soft) truncate">
          {run.stages
            .map((s) => `${s.stage}=${s.status}`)
            .join(" · ")}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-4 font-mono text-[10px] text-(--mrms-ink-soft) space-y-1">
          {run.stages.map((s, i) => (
            <div key={i} className="border-l-2 border-(--mrms-rule) pl-2">
              <span className="text-(--mrms-ink) font-medium">{s.stage}</span>{" "}
              · {s.status}
              {s.tracks_new !== undefined && ` · +${s.tracks_new} new`}
              {s.tracks_existing !== undefined && ` · ${s.tracks_existing} existing`}
              {s.downloaded !== undefined && ` · downloaded ${s.downloaded}`}
              {s.failed !== undefined && s.failed > 0 && ` · failed ${s.failed}`}
              {s.duration_ms !== undefined && ` · ${Math.round((s.duration_ms ?? 0) / 1000)}s`}
              {s.error && (
                <div className="text-(--mrms-rust) mt-0.5 break-all">
                  ⚠ {s.error}
                </div>
              )}
              {s.status === "failed" && s.stderr && (
                <pre className="mt-1 p-2 bg-(--mrms-bg) text-(--mrms-ink-soft) text-[9px] leading-relaxed whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                  {s.stderr.slice(-1500)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
