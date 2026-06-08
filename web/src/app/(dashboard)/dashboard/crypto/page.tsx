import { CryptoKpis } from "@/components/dashboards/crypto/kpis";
import { BitcoinPriceCard } from "@/components/dashboards/crypto/bitcoin-price-card";
import { TradeCard } from "@/components/dashboards/crypto/trade-card";
import { WalletsCard } from "@/components/dashboards/crypto/wallets-card";
import { RecentActivitiesCard } from "@/components/dashboards/crypto/recent-activities-card";
import { BalanceSummary } from "@/components/dashboards/crypto/balance-summary";

export default function CryptoPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Crypto</h1>

      {/* KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CryptoKpis />
      </div>

      {/* Bitcoin Price + Trade */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <BitcoinPriceCard />
        <TradeCard />
      </div>

      {/* Wallets + Recent Activities */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="lg:w-72 xl:w-80 shrink-0">
          <WalletsCard />
        </div>
        <RecentActivitiesCard />
      </div>

      {/* Balance Summary */}
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold tracking-tight">Balance Summary</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <BalanceSummary />
        </div>
      </div>
    </div>
  );
}
