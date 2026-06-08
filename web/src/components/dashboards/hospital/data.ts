// ─── Types ────────────────────────────────────────────────────────────────────

export type GenderVisitDataPoint = {
  month: string;
  male: number;
  female: number;
};

export type DepartmentDataPoint = {
  department: string;
  patients: number;
};

export type NoteItem = {
  title: string;
  time: string;
};

export type TreatmentItem = {
  name: string;
  patients: number;
  percentage: number;
};

export type AppointmentRow = {
  id: string;
  patient: string;
  date: string;
  time: string;
  doctor: string;
  department: string;
};

export type PatientProcedureRow = {
  initials: string;
  name: string;
  email: string;
  procedure: string;
  date: string;
};

// ─── Patient Visits by Gender ─────────────────────────────────────────────────

export const genderVisitData: GenderVisitDataPoint[] = [
  { month: "Jan", male: 420, female: 380 },
  { month: "Feb", male: 390, female: 410 },
  { month: "Mar", male: 460, female: 440 },
  { month: "Apr", male: 430, female: 470 },
  { month: "May", male: 510, female: 490 },
  { month: "Jun", male: 480, female: 520 },
];

// ─── Patients by Department ───────────────────────────────────────────────────

export const departmentData: DepartmentDataPoint[] = [
  { department: "Cardiology",   patients: 320 },
  { department: "Neurology",    patients: 210 },
  { department: "Orthopedics",  patients: 180 },
  { department: "Pediatrics",   patients: 260 },
  { department: "Oncology",     patients: 140 },
  { department: "ENT",          patients: 95  },
];

// ─── Notes ────────────────────────────────────────────────────────────────────

export const noteItems: NoteItem[] = [
  { title: "Surgery",              time: "09:00 AM" },
  { title: "Team meeting",         time: "11:30 AM" },
  { title: "New staff orientation", time: "02:00 PM" },
  { title: "Patient checkup",      time: "04:15 PM" },
];

// ─── Top Treatment ────────────────────────────────────────────────────────────

export const topTreatments: TreatmentItem[] = [
  { name: "Physical Therapy",    patients: 500, percentage: 78 },
  { name: "Cardiac Care",        patients: 350, percentage: 48 },
  { name: "Orthopedic Surgery",  patients: 220, percentage: 35 },
  { name: "Dental Care",         patients: 180, percentage: 28 },
];

// ─── Upcoming Appointments ────────────────────────────────────────────────────

export const upcomingAppointments: AppointmentRow[] = [
  {
    id: "#AP-001",
    patient: "Alice Johnson",
    date: "Jun 8, 2026",
    time: "09:00 AM",
    doctor: "Dr. Sarah Lee",
    department: "Cardiology",
  },
  {
    id: "#AP-002",
    patient: "Bob Martinez",
    date: "Jun 8, 2026",
    time: "10:30 AM",
    doctor: "Dr. James Chen",
    department: "Neurology",
  },
  {
    id: "#AP-003",
    patient: "Carol White",
    date: "Jun 8, 2026",
    time: "11:15 AM",
    doctor: "Dr. Emily Park",
    department: "Orthopedics",
  },
  {
    id: "#AP-004",
    patient: "David Kim",
    date: "Jun 9, 2026",
    time: "09:45 AM",
    doctor: "Dr. Michael Torres",
    department: "Pediatrics",
  },
  {
    id: "#AP-005",
    patient: "Emma Davis",
    date: "Jun 9, 2026",
    time: "01:00 PM",
    doctor: "Dr. Rachel Green",
    department: "Oncology",
  },
  {
    id: "#AP-006",
    patient: "Frank Wilson",
    date: "Jun 10, 2026",
    time: "02:30 PM",
    doctor: "Dr. Kevin Brown",
    department: "ENT",
  },
  {
    id: "#AP-007",
    patient: "Grace Lee",
    date: "Jun 10, 2026",
    time: "04:00 PM",
    doctor: "Dr. Sarah Lee",
    department: "Cardiology",
  },
];

// ─── Patients with Last Procedure ─────────────────────────────────────────────

export const patientProcedures: PatientProcedureRow[] = [
  {
    initials: "AJ",
    name: "Alice Johnson",
    email: "alice.johnson@email.com",
    procedure: "Echocardiogram",
    date: "Jun 5, 2026",
  },
  {
    initials: "BM",
    name: "Bob Martinez",
    email: "bob.martinez@email.com",
    procedure: "MRI Brain Scan",
    date: "Jun 4, 2026",
  },
  {
    initials: "CW",
    name: "Carol White",
    email: "carol.white@email.com",
    procedure: "Knee Arthroscopy",
    date: "Jun 3, 2026",
  },
  {
    initials: "DK",
    name: "David Kim",
    email: "david.kim@email.com",
    procedure: "Pediatric Checkup",
    date: "Jun 2, 2026",
  },
  {
    initials: "ED",
    name: "Emma Davis",
    email: "emma.davis@email.com",
    procedure: "Chemotherapy",
    date: "Jun 1, 2026",
  },
];
