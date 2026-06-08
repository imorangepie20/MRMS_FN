import { FileWarning } from "lucide-react";
import { KpiCard } from "@/components/dashboards/shared/kpi-card";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function FinanceKpis() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="My Balance"
        value="$125,430"
        delta="+12.5%"
        trend="up"
        sublabel="compared to last month"
      />
      <KpiCard
        label="Net Profit"
        value="$38,700"
        delta="+8.5%"
        trend="up"
        sublabel="compared to last month"
      />
      <KpiCard
        label="Expenses"
        value="$26,450"
        delta="+5.5%"
        trend="up"
        sublabel="compared to last month"
      />
      {/* Pending Invoices — no delta, sublabel shown directly */}
      <Card>
        <CardHeader>
          <CardDescription className="flex items-center justify-between">
            Pending Invoices
            <FileWarning className="size-4 text-muted-foreground" />
          </CardDescription>
          <CardTitle className="text-2xl tabular-nums">$3,200</CardTitle>
          <p className="text-xs text-muted-foreground">3 overdue invoices</p>
        </CardHeader>
      </Card>
    </div>
  );
}
