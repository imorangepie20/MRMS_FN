import Link from "next/link";
import { Home, Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function Error404Page() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center gap-6 text-center px-4">
      {/* Large number with icon overlay */}
      <div className="relative select-none">
        <span className="text-[8rem] font-extrabold leading-none tracking-tighter text-foreground/5 sm:text-[10rem]">
          404
        </span>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-muted shadow-sm ring-1 ring-foreground/10">
            <Search className="size-7 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Text */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          Sorry, we couldn&apos;t find the page you&apos;re looking for. It may
          have been moved, deleted, or never existed.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/default" className={buttonVariants()}>
          <Home className="size-3.5" />
          Go home
        </Link>
        <Link
          href="/dashboard/default"
          className={buttonVariants({ variant: "outline" })}
        >
          Go back
        </Link>
      </div>
    </div>
  );
}
