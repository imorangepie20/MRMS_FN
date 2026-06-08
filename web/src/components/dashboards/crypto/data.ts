// ─── Types ────────────────────────────────────────────────────────────────────

export type BtcPricePoint = {
  time: string;
  price: number;
};

export type Wallet = {
  id: string;
  name: string;
  symbol: string;
  amount: string;
  fiatValue: string;
  color: string;
  fallback: string;
};

export type Activity = {
  id: string;
  type: "Buy" | "Sell" | "Send";
  coin: string;
  date: string;
  btcAmount: string;
  usdAmount: string;
};

// ─── Bitcoin Price (last 7 days, ~24 hourly candles) ─────────────────────────
// Ends at ~$46,200 to match headline value
export const btcPriceData: BtcPricePoint[] = [
  { time: "Day 1 00:00", price: 41200 },
  { time: "Day 1 06:00", price: 41800 },
  { time: "Day 1 12:00", price: 42100 },
  { time: "Day 1 18:00", price: 41600 },
  { time: "Day 2 00:00", price: 41900 },
  { time: "Day 2 06:00", price: 42500 },
  { time: "Day 2 12:00", price: 43100 },
  { time: "Day 2 18:00", price: 42800 },
  { time: "Day 3 00:00", price: 43400 },
  { time: "Day 3 06:00", price: 43900 },
  { time: "Day 3 12:00", price: 44200 },
  { time: "Day 3 18:00", price: 43600 },
  { time: "Day 4 00:00", price: 43200 },
  { time: "Day 4 06:00", price: 43800 },
  { time: "Day 4 12:00", price: 44500 },
  { time: "Day 4 18:00", price: 44100 },
  { time: "Day 5 00:00", price: 44800 },
  { time: "Day 5 06:00", price: 45200 },
  { time: "Day 5 12:00", price: 45600 },
  { time: "Day 5 18:00", price: 45100 },
  { time: "Day 6 00:00", price: 45500 },
  { time: "Day 6 06:00", price: 45900 },
  { time: "Day 6 12:00", price: 46400 },
  { time: "Day 6 18:00", price: 46200 },
];

// ─── Wallets ──────────────────────────────────────────────────────────────────
export const wallets: Wallet[] = [
  {
    id: "btc",
    name: "Bitcoin",
    symbol: "BTC",
    amount: "4.434953 BTC",
    fiatValue: "$204,895",
    color: "bg-amber-500",
    fallback: "B",
  },
  {
    id: "eth",
    name: "Ethereum",
    symbol: "ETH",
    amount: "4.434953 ETH",
    fiatValue: "$14,820",
    color: "bg-blue-500",
    fallback: "E",
  },
  {
    id: "avax",
    name: "Avalanche",
    symbol: "AVAX",
    amount: "3.434953 AVAX",
    fiatValue: "$137",
    color: "bg-red-500",
    fallback: "A",
  },
];

// ─── Recent Activities ────────────────────────────────────────────────────────
export const recentActivities: Activity[] = [
  {
    id: "act-1",
    type: "Buy",
    coin: "Bitcoin",
    date: "Jun 06, 2026",
    btcAmount: "+0.341200 BTC",
    usdAmount: "$15,755",
  },
  {
    id: "act-2",
    type: "Sell",
    coin: "Ethereum",
    date: "Jun 05, 2026",
    btcAmount: "-1.200000 ETH",
    usdAmount: "$4,012",
  },
  {
    id: "act-3",
    type: "Send",
    coin: "Bitcoin",
    date: "Jun 04, 2026",
    btcAmount: "-0.050000 BTC",
    usdAmount: "$2,310",
  },
  {
    id: "act-4",
    type: "Buy",
    coin: "Avalanche",
    date: "Jun 03, 2026",
    btcAmount: "+3.434953 AVAX",
    usdAmount: "$137",
  },
  {
    id: "act-5",
    type: "Sell",
    coin: "Bitcoin",
    date: "Jun 02, 2026",
    btcAmount: "-0.201055 BTC",
    usdAmount: "$9,289",
  },
  {
    id: "act-6",
    type: "Send",
    coin: "Ethereum",
    date: "Jun 01, 2026",
    btcAmount: "-0.500000 ETH",
    usdAmount: "$1,672",
  },
];

// ─── Balance Summary ──────────────────────────────────────────────────────────
export const balanceSummary = [
  { label: "Total Received", value: "2.010550 BTC" },
  { label: "Total Send", value: "1.201055 BTC" },
  { label: "Total Withdraw", value: "5.41055 BTC" },
];
