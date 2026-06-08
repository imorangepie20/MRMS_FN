// ─── Types ────────────────────────────────────────────────────────────────────

export type MonthlyExpensePoint = {
  month: string;
  expenses: number;
};

export type ExpenseCategory = {
  name: string;
  value: number;
  fill: string;
};

export type IncomeSource = {
  label: string;
  amount: number;
  formatted: string;
};

export type FinanceTransaction = {
  id: string;
  name: string;
  date: string;
  type: "Income" | "Expenses";
  amount: string;
  positive: boolean;
};

export type WalletEntry = {
  brand: string;
  masked: string;
  balance: string;
};

// ─── Monthly Expenses (area chart, last 6 months) ─────────────────────────────

export const monthlyExpenses: MonthlyExpensePoint[] = [
  { month: "Jan", expenses: 18200 },
  { month: "Feb", expenses: 20400 },
  { month: "Mar", expenses: 19800 },
  { month: "Apr", expenses: 22100 },
  { month: "May", expenses: 23500 },
  { month: "Jun", expenses: 26450 },
];

// ─── Expense Summary (donut) ──────────────────────────────────────────────────

export const expenseCategories: ExpenseCategory[] = [
  { name: "Food & Drink", value: 48, fill: "var(--chart-1)" },
  { name: "Grocery",      value: 32, fill: "var(--chart-2)" },
  { name: "Shopping",     value: 13, fill: "var(--chart-3)" },
  { name: "Transport",    value:  7, fill: "var(--chart-4)" },
];

// ─── Income Sources ───────────────────────────────────────────────────────────

export const totalIncome = 92000;

export const incomeSources: IncomeSource[] = [
  { label: "Rental",      amount: 35000, formatted: "$35,000" },
  { label: "Investments", amount: 28000, formatted: "$28,000" },
  { label: "Business",    amount: 18000, formatted: "$18,000" },
  { label: "Freelance",   amount: 11000, formatted: "$11,000" },
];

// ─── Transactions ─────────────────────────────────────────────────────────────

export const financeTransactions: FinanceTransaction[] = [
  { id: "#FT-001", name: "Salary Deposit",        date: "Jun 1, 2026",  type: "Income",   amount: "+$8,500.00",  positive: true  },
  { id: "#FT-002", name: "Grocery Store",         date: "Jun 2, 2026",  type: "Expenses", amount: "-$142.30",    positive: false },
  { id: "#FT-003", name: "Freelance Payment",     date: "Jun 3, 2026",  type: "Income",   amount: "+$2,200.00",  positive: true  },
  { id: "#FT-004", name: "Electricity Bill",      date: "Jun 4, 2026",  type: "Expenses", amount: "-$95.00",     positive: false },
  { id: "#FT-005", name: "Investment Dividend",   date: "Jun 5, 2026",  type: "Income",   amount: "+$1,340.00",  positive: true  },
  { id: "#FT-006", name: "Restaurant Dining",     date: "Jun 6, 2026",  type: "Expenses", amount: "-$67.50",     positive: false },
  { id: "#FT-007", name: "Rental Income",         date: "Jun 7, 2026",  type: "Income",   amount: "+$2,916.67",  positive: true  },
];

// ─── My Wallet ────────────────────────────────────────────────────────────────

export const walletEntries: WalletEntry[] = [
  { brand: "Visa",       masked: "•••• 4242", balance: "$15,743.21" },
  { brand: "Mastercard", masked: "•••• 8815", balance: "$8,420.50"  },
  { brand: "Amex",       masked: "•••• 3700", balance: "$4,100.00"  },
  { brand: "PayPal",     masked: "•••• 9981", balance: "$2,156.89"  },
];
