import { Wallet, ArrowLeftRight, DollarSign, Coins } from "lucide-react";
import { KpiCard } from "@/components/dashboards/shared/kpi-card";

export function CryptoKpis() {
  return (
    <>
      <KpiCard label="Transactions" value="150" icon={ArrowLeftRight} />
      <KpiCard label="Wallets" value="3" icon={Wallet} />
      <KpiCard label="Current Balance" value="$46,200" icon={DollarSign} />
      <KpiCard
        label="USDT Balance"
        value="4,620,910 USDT"
        delta="+12%"
        trend="up"
        icon={Coins}
      />
    </>
  );
}
