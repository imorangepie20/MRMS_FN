import { HospitalKpis } from "@/components/dashboards/hospital/kpis";
import {
  PatientVisitsByGenderCard,
  PatientsByDepartmentCard,
} from "@/components/dashboards/hospital/charts";
import {
  NotesCard,
  TopTreatmentCard,
  UpcomingAppointmentsCard,
  PatientProceduresCard,
} from "@/components/dashboards/hospital/widgets";
import { CalendarCard } from "@/components/dashboards/hospital/calendar-widget";

export default function HospitalPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Hospital</h1>

      {/* KPI Row */}
      <HospitalKpis />

      {/* Patient Visits by Gender + Patients by Department */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PatientVisitsByGenderCard />
        <PatientsByDepartmentCard />
      </div>

      {/* Calendar + Notes + Top Treatment */}
      <div className="grid gap-4 lg:grid-cols-3">
        <CalendarCard />
        <NotesCard />
        <TopTreatmentCard />
      </div>

      {/* Upcoming Appointments (wider) + Patients with Last Procedure */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <UpcomingAppointmentsCard />
        </div>
        <PatientProceduresCard />
      </div>
    </div>
  );
}
