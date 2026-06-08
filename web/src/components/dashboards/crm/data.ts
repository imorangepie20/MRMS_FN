// ─── Types ────────────────────────────────────────────────────────────────────

export type LeadSource = {
  source: string;
  count: number;
};

export type TaskPriority = "high" | "medium" | "low";

export type Task = {
  title: string;
  priority: TaskPriority;
  dueDate: string;
};

export type PipelineStage = {
  stage: string;
  deals: number;
  value: string;
  percent: number;
};

export type LeadStatus = "New" | "Contacted" | "Qualified" | "Lost";

export type Lead = {
  id: string;
  status: LeadStatus;
  email: string;
  amount: string;
};

// ─── Leads by Source ──────────────────────────────────────────────────────────

export const leadsBySource: LeadSource[] = [
  { source: "Social", count: 275 },
  { source: "Email",  count: 200 },
  { source: "Call",   count: 287 },
  { source: "Others", count: 173 },
];

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const tasks: Task[] = [
  { title: "Follow up with Acme Inc.",    priority: "high",   dueDate: "Today"     },
  { title: "Prepare quarterly report",    priority: "medium", dueDate: "Tomorrow"  },
  { title: "Update customer profiles",    priority: "low",    dueDate: "In 3 days" },
];

// ─── Sales Pipeline ───────────────────────────────────────────────────────────

export const pipelineStages: PipelineStage[] = [
  { stage: "Lead",         deals: 235, value: "$420,500", percent: 38 },
  { stage: "Qualified",    deals: 146, value: "$267,800", percent: 24 },
  { stage: "Proposal",     deals: 84,  value: "$192,400", percent: 18 },
  { stage: "Negotiation",  deals: 52,  value: "$129,600", percent: 12 },
  { stage: "Closed Won",   deals: 36,  value: "$87,200",  percent: 8  },
];

// ─── Leads Table ─────────────────────────────────────────────────────────────

export const leads: Lead[] = [
  { id: "#L-1001", status: "New",       email: "sarah.johnson@techcorp.io",    amount: "$12,400" },
  { id: "#L-1002", status: "Contacted", email: "m.rodriguez@globalventures.co", amount: "$8,750"  },
  { id: "#L-1003", status: "Qualified", email: "alex.chen@innovatehq.com",      amount: "$31,200" },
  { id: "#L-1004", status: "Lost",      email: "t.miller@enterprise-net.org",   amount: "$5,600"  },
  { id: "#L-1005", status: "Contacted", email: "priya.kapoor@nexusdigital.io",  amount: "$18,900" },
];
