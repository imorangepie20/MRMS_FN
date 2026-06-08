import { CrmKpis } from "@/components/dashboards/crm/kpis";
import { LeadsBySourceCard } from "@/components/dashboards/crm/charts";
import {
  MonthlyTargetCard,
  TasksCard,
  SalesPipelineCard,
  LeadsTableCard,
} from "@/components/dashboards/crm/widgets";

export default function CRMPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">CRM</h1>

      {/* KPI Row */}
      <CrmKpis />

      {/* Leads by Source + Monthly Target + Tasks */}
      <div className="grid gap-4 lg:grid-cols-3">
        <LeadsBySourceCard />
        <MonthlyTargetCard />
        <TasksCard />
      </div>

      {/* Sales Pipeline + Leads Table */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SalesPipelineCard />
        <LeadsTableCard />
      </div>
    </div>
  );
}
