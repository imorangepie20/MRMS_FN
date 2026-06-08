export type TeamMember = { name: string; email: string; role: string; avatar?: string };
export type Payment = {
  id: string; customer: string; email: string; amount: number;
  status: "success" | "processing" | "failed";
};
export type Notification = { id: string; title: string; description: string; time: string; read: boolean };

export type TeamRole = "Owner" | "Member" | "Viewer" | "Developer" | "Billing";
export type TeamMemberWithRole = TeamMember & { role: TeamRole };

export const teamMembers: TeamMemberWithRole[] = [
  { name: "Sofia Davis", email: "m@example.com", role: "Owner" },
  { name: "Jackson Lee", email: "p@example.com", role: "Developer" },
  { name: "Isabella Nguyen", email: "i@example.com", role: "Viewer" },
  { name: "Olivia Martin", email: "o@example.com", role: "Billing" },
];

export const latestPayments: Payment[] = [
  { id: "m5gr84i9", customer: "Ken Russell", email: "ken99@example.com", amount: 316, status: "success" },
  { id: "3u1reuv4", customer: "Abe Davis", email: "abe45@example.com", amount: 242, status: "success" },
  { id: "derv1ws0", customer: "Monserrat Lang", email: "monserrat44@example.com", amount: 837, status: "processing" },
  { id: "5kma53ae", customer: "Silas Mendoza", email: "silas22@example.com", amount: 874, status: "success" },
  { id: "bhqecj4p", customer: "Carmella Johnson", email: "carmella@example.com", amount: 721, status: "failed" },
  { id: "p0r2f11x", customer: "Jason Wu", email: "jason.wu@example.com", amount: 459, status: "processing" },
  { id: "n3v8sd2c", customer: "Emma Brown", email: "emma.b@example.com", amount: 638, status: "success" },
  { id: "k9f3la7q", customer: "Liam Garcia", email: "liam.g@example.com", amount: 192, status: "failed" },
  { id: "z2x7cv1m", customer: "Noah Wilson", email: "noah.w@example.com", amount: 545, status: "success" },
];

export const notifications: Notification[] = [
  { id: "1", title: "New subscriber", description: "You gained a new subscriber.", time: "2m ago", read: false },
  { id: "2", title: "Payment received", description: "$1,999 from Olivia Martin.", time: "1h ago", read: false },
  { id: "3", title: "Server update", description: "Deployment finished successfully.", time: "3h ago", read: true },
];

export const subscriptionsSeries = [
  { month: "Jan", value: 1200 }, { month: "Feb", value: 2100 }, { month: "Mar", value: 800 },
  { month: "Apr", value: 1600 }, { month: "May", value: 900 }, { month: "Jun", value: 1700 },
  { month: "Jul", value: 2400 }, { month: "Aug", value: 1300 }, { month: "Sep", value: 2200 },
  { month: "Oct", value: 1900 }, { month: "Nov", value: 2600 }, { month: "Dec", value: 4850 },
];

export const revenueSeries = [
  { month: "Jan", value: 4200 }, { month: "Feb", value: 5100 }, { month: "Mar", value: 4800 },
  { month: "Apr", value: 6100 }, { month: "May", value: 7300 }, { month: "Jun", value: 6900 },
  { month: "Jul", value: 8200 }, { month: "Aug", value: 9100 }, { month: "Sep", value: 10300 },
  { month: "Oct", value: 11900 }, { month: "Nov", value: 13600 }, { month: "Dec", value: 15231 },
];

export const exerciseSeries = [
  { day: "Mon", thisMonth: 62, average: 45 }, { day: "Tue", thisMonth: 50, average: 48 },
  { day: "Wed", thisMonth: 73, average: 52 }, { day: "Thu", thisMonth: 80, average: 55 },
  { day: "Fri", thisMonth: 68, average: 60 }, { day: "Sat", thisMonth: 95, average: 70 },
  { day: "Sun", thisMonth: 88, average: 66 },
];

export type ChatMessage = { from: "them" | "me"; content: string };
export const chatMessages: ChatMessage[] = [
  { from: "them", content: "Hi, how can I help you today?" },
  { from: "me", content: "Hey, I'm having trouble with my account." },
  { from: "them", content: "What seems to be the problem?" },
  { from: "me", content: "I can't log in." },
];

export const chatContact = { name: "Sofia Davis", email: "m@example.com" };

export const dashboardDateRange = "10 May 2026 - 06 Jun 2026";
