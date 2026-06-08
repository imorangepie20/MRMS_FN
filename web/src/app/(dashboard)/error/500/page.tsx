import Link from "next/link";
import { Home, RefreshCw, AlertTriangle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function Error500Page() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center gap-6 text-center px-4">
      {/* Large number with icon overlay */}
      <div className="relative select-none">
        <span className="text-[8rem] font-extrabold leading-none tracking-tighter text-foreground/5 sm:text-[10rem]">
          500
        </span>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-amber-100 shadow-sm ring-1 ring-amber-200 dark:bg-amber-950 dark:ring-amber-900">
            <AlertTriangle className="size-7 text-amber-600 dark:text-amber-400" />
          </div>
        </div>
      </div>

      {/* Text */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Something went wrong
        </h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          We&apos;re sorry — an unexpected error occurred on our end. Our team
          has been notified. Please try again in a moment.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/default" className={buttonVariants()}>
          <RefreshCw className="size-3.5" />
          Try again
        </Link>
        <Link
          href="/dashboard/default"
          className={buttonVariants({ variant: "outline" })}
        >
          <Home className="size-3.5" />
          Go home
        </Link>
      </div>
    </div>
  );
}
