import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type KpiCardProps = {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down";
  sublabel?: string;
  icon?: LucideIcon;
};

export function KpiCard({ label, value, delta, trend = "up", sublabel, icon: Icon }: KpiCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center justify-between">
          {label}
          {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
        </CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        {delta ? (
          <p
            className={cn(
              "flex items-center gap-1 text-xs",
              trend === "up" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            )}
          >
            {trend === "up" ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {delta}
            {sublabel ? <span className="text-muted-foreground">{sublabel}</span> : null}
          </p>
        ) : null}
      </CardHeader>
    </Card>
  );
}
