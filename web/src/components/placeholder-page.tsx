import { Construction } from "lucide-react";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-24 text-center">
      <Construction className="size-8 text-muted-foreground" />
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">This page is coming in a later phase.</p>
    </div>
  );
}
