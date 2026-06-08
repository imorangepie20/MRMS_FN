import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="text-muted-foreground">This page could not be found.</p>
      <Link href="/dashboard/default" className={buttonVariants()}>
        Back to dashboard
      </Link>
    </div>
  );
}
