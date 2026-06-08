import { BalancesCard } from "@/components/dashboards/payment/balances-card";
import { VerificationAlert } from "@/components/dashboards/payment/verification-alert";
import { ExchangeRatesCard } from "@/components/dashboards/payment/exchange-rates-card";
import { ConvertCurrenciesCard } from "@/components/dashboards/payment/convert-currencies-card";
import { TransactionsCard } from "@/components/dashboards/payment/transactions-card";

export default function PaymentPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Payment</h1>

      {/* Top row: Balances + Verification + Exchange Rates */}
      <div className="grid gap-4 lg:grid-cols-3">
        <BalancesCard />
        <div className="flex flex-col gap-4">
          <VerificationAlert />
        </div>
        <ExchangeRatesCard />
      </div>

      {/* Bottom row: Convert Currencies + Transactions */}
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <ConvertCurrenciesCard />
        <TransactionsCard />
      </div>
    </div>
  );
}
