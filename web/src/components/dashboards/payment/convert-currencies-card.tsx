"use client";

import { useState } from "react";
import { ArrowDownUp, Bell } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF"];

export function ConvertCurrenciesCard() {
  const [fromAmount, setFromAmount] = useState("1000");
  const [toAmount, setToAmount] = useState("920.45");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Convert Currencies</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* From row */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">From</Label>
          <div className="flex gap-2">
            <Input
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              className="flex-1 tabular-nums"
              placeholder="Amount"
              type="number"
            />
            <Select defaultValue="USD">
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Swap icon */}
        <div className="flex items-center justify-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-muted">
            <ArrowDownUp className="size-4 text-muted-foreground" />
          </div>
        </div>

        {/* To row */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">To</Label>
          <div className="flex gap-2">
            <Input
              value={toAmount}
              onChange={(e) => setToAmount(e.target.value)}
              className="flex-1 tabular-nums"
              placeholder="Amount"
              type="number"
            />
            <Select defaultValue="EUR">
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Rate Alerts button */}
        <Button variant="outline" className="w-full gap-2">
          <Bell className="size-4" />
          Rate Alerts
        </Button>
      </CardContent>
    </Card>
  );
}
