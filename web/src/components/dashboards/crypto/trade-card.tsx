"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function TradeCard() {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [coin, setCoin] = useState("bitcoin");
  const [btcAmount, setBtcAmount] = useState("");
  const [usdAmount, setUsdAmount] = useState("");

  const coinLabels: Record<string, string> = {
    bitcoin: "Bitcoin",
    ethereum: "Ethereum",
    avalanche: "Avalanche",
  };

  const coinSymbols: Record<string, string> = {
    bitcoin: "BTC",
    ethereum: "ETH",
    avalanche: "AVAX",
  };

  const symbol = coinSymbols[coin] ?? "BTC";
  const coinName = coinLabels[coin] ?? "Bitcoin";
  const actionLabel = side === "buy" ? `Buy ${coinName}` : `Sell ${coinName}`;

  return (
    <Card className="flex-none w-full lg:w-80 xl:w-72">
      <CardHeader>
        <CardTitle>Trade</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Tabs
          value={side}
          onValueChange={(v) => setSide(v as "buy" | "sell")}
        >
          <TabsList className="w-full">
            <TabsTrigger value="buy" className="flex-1">
              Buy
            </TabsTrigger>
            <TabsTrigger value="sell" className="flex-1">
              Sell
            </TabsTrigger>
          </TabsList>
          <TabsContent value="buy" />
          <TabsContent value="sell" />
        </Tabs>

        <div className="flex flex-col gap-1.5">
          <Label>Coin</Label>
          <Select value={coin} onValueChange={(v) => v !== null && setCoin(v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select coin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bitcoin">Bitcoin / BTC</SelectItem>
              <SelectItem value="ethereum">Ethereum / ETH</SelectItem>
              <SelectItem value="avalanche">Avalanche / AVAX</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="btc-amount">{symbol}</Label>
          <Input
            id="btc-amount"
            type="number"
            placeholder={`Amount in ${symbol}`}
            value={btcAmount}
            onChange={(e) => setBtcAmount(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="usd-amount">USD</Label>
          <Input
            id="usd-amount"
            type="number"
            placeholder="Amount in USD"
            value={usdAmount}
            onChange={(e) => setUsdAmount(e.target.value)}
          />
        </div>

        <Button className="w-full">{actionLabel}</Button>
      </CardContent>
    </Card>
  );
}
