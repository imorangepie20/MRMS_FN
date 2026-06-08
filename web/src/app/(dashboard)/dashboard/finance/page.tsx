import { FinanceKpis } from "@/components/dashboards/finance/kpis";
import {
  MonthlyExpensesCard,
  ExpenseSummaryCard,
} from "@/components/dashboards/finance/charts";
import {
  IncomeSourcesCard,
  FinanceTransactionsCard,
  SavingGoalCard,
  MyWalletCard,
} from "@/components/dashboards/finance/widgets";

export default function FinancePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Finance</h1>

      {/* KPI Row */}
      <FinanceKpis />

      {/* Monthly Expenses (wider) + Income Sources */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MonthlyExpensesCard />
        </div>
        <IncomeSourcesCard />
      </div>

      {/* Expense Summary + Saving Goal + My Wallet */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ExpenseSummaryCard />
        <SavingGoalCard />
        <MyWalletCard />
      </div>

      {/* Transactions (full width) */}
      <FinanceTransactionsCard />
    </div>
  );
}
