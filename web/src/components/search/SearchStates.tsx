"use client";

import { Skeleton } from "@/components/ui/skeleton";

const SAMPLES = ["NewJeans", "jazz", "lo-fi", "BTS", "city pop", "Radiohead"];

/** 검색 전 idle 프롬프트 + 예시 칩(클릭 시 검색 실행). */
export function SearchIdle({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="max-w-xl">
      <div className="mb-3 font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
        무엇을 찾고 있나요?
      </div>
      <p className="mb-5 font-display text-[15px] leading-relaxed text-(--mrms-ink-soft)">
        트랙 · 앨범 · 플레이리스트를 검색하면 결과가 EMP에 자동 적재됩니다.
      </p>
      <div className="flex flex-wrap gap-2">
        {SAMPLES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="cursor-pointer border border-(--mrms-rule) bg-transparent px-3 py-1 font-mono text-[11px] tracking-editorial text-(--mrms-ink-soft) transition-colors hover:border-(--mrms-rust) hover:text-(--mrms-rust)"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 검색 결과 0건 editorial empty state. */
export function SearchEmptyState({
  query,
  skipped,
}: {
  query: string;
  skipped: string[];
}) {
  return (
    <div className="max-w-xl py-6">
      <div className="mb-2 font-display text-[18px] text-(--mrms-ink)">
        <span className="text-(--mrms-ink-mute)">&ldquo;</span>
        {query}
        <span className="text-(--mrms-ink-mute)">&rdquo; 결과 없음</span>
      </div>
      <p className="font-mono text-[11px] leading-relaxed text-(--mrms-ink-mute)">
        다른 검색어로 시도해보세요.
        {skipped.length > 0 && (
          <>
            {" · "}
            <span className="text-(--mrms-rust)">{skipped.join(", ")} 미연동</span>
            {" — 연동하면 더 많은 결과가 나옵니다."}
          </>
        )}
      </p>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-2">
      <Skeleton className="size-10 rounded-none bg-(--mrms-rule)" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-2/5 rounded-none bg-(--mrms-rule)" />
        <Skeleton className="h-2.5 w-1/4 rounded-none bg-(--mrms-rule)" />
      </div>
    </div>
  );
}

function SkeletonHeading({ label }: { label: string }) {
  return (
    <div className="mb-4 border-b border-(--mrms-ink) pb-1 font-mono text-[10px] uppercase tracking-editorial text-(--mrms-ink-mute)">
      {label}
    </div>
  );
}

/** 로딩 스켈레톤 — 트랙 행 + 카드 그리드 placeholder (editorial 톤). */
export function SearchSkeleton() {
  return (
    <div>
      <SkeletonHeading label="Tracks" />
      <div className="mb-8">
        {Array.from({ length: 5 }, (_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
      <SkeletonHeading label="Albums" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4 sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-none bg-(--mrms-rule)" />
        ))}
      </div>
    </div>
  );
}
