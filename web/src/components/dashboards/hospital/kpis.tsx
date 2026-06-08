import { KpiCard } from "@/components/dashboards/shared/kpi-card";

export function HospitalKpis() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Total Appointments"
        value="1,250"
        delta="+20.1%"
        trend="up"
        sublabel=" from last month"
      />
      <KpiCard
        label="New Patients"
        value="320"
        delta="+180.1%"
        trend="up"
        sublabel=" from last month"
      />
      <KpiCard
        label="Operations"
        value="86"
        delta="-19%"
        trend="down"
        sublabel=" from last month"
      />
      <KpiCard
        label="Total Revenue"
        value="$45,231.89"
        delta="+20.1%"
        trend="up"
        sublabel=" from last month"
      />
    </div>
  );
}
