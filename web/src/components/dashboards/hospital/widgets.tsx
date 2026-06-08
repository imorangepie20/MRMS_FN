import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { noteItems, topTreatments, upcomingAppointments, patientProcedures } from "./data";

// ─── Notes ────────────────────────────────────────────────────────────────────

export function NotesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {noteItems.map((item) => (
            <div
              key={item.title}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <span className="text-sm font-medium">{item.title}</span>
              <span className="text-xs text-muted-foreground">{item.time}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Top Treatment ────────────────────────────────────────────────────────────

export function TopTreatmentCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Treatment</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {topTreatments.map((t) => (
            <div key={t.name} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{t.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t.patients.toLocaleString()} patients
                </span>
              </div>
              <Progress value={t.percentage} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Upcoming Appointments ────────────────────────────────────────────────────

export function UpcomingAppointmentsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Appointments</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-(--card-spacing)">Patient</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead className="pr-(--card-spacing)">Department</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {upcomingAppointments.map((appt) => (
              <TableRow key={appt.id}>
                <TableCell className="pl-(--card-spacing) font-medium">
                  {appt.patient}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {appt.date}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {appt.time}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {appt.doctor}
                </TableCell>
                <TableCell className="pr-(--card-spacing) text-muted-foreground">
                  {appt.department}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Patients with Last Procedure ─────────────────────────────────────────────

export function PatientProceduresCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Patients with Last Procedure</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {patientProcedures.map((p) => (
            <div key={p.email} className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>{p.initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{p.name}</p>
                <p className="text-xs text-muted-foreground truncate">{p.email}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-medium">{p.procedure}</p>
                <p className="text-xs text-muted-foreground">{p.date}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
