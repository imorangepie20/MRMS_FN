/** "MRMS." 워드마크 — Fraunces 세리프, 마침표는 러스트. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-serif font-bold tracking-[-0.01em] text-(--mrms-ink) ${className}`}>
      MRMS<span className="text-(--mrms-rust)">.</span>
    </span>
  );
}
