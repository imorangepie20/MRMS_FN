"use client";

import { useState } from "react";
import { CreditCard, Wallet, Apple } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const METHODS = [
  { id: "card", label: "Card", icon: CreditCard },
  { id: "paypal", label: "Paypal", icon: Wallet },
  { id: "apple", label: "Apple", icon: Apple },
];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const YEARS = ["2026","2027","2028","2029","2030"];

export function PaymentMethodCard() {
  const [method, setMethod] = useState("card");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Method</CardTitle>
        <CardDescription>Add a new payment method to your account.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-3">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-md border-2 bg-popover p-4 text-sm hover:bg-accent hover:text-accent-foreground",
                method === m.id ? "border-primary" : "border-muted"
              )}
            >
              <m.icon className="size-5" />
              {m.label}
            </button>
          ))}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pm-name">Name on card</Label>
          <Input id="pm-name" placeholder="First Last" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pm-city">City</Label>
          <Input id="pm-city" placeholder="City" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pm-number">Card number</Label>
          <Input id="pm-number" placeholder="1234 5678 9012 3456" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="grid gap-2">
            <Label>Expires</Label>
            <Select>
              <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
              <SelectContent>{MONTHS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Year</Label>
            <Select>
              <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
              <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pm-cvc">CVC</Label>
            <Input id="pm-cvc" placeholder="CVC" />
          </div>
        </div>
        <Button className="w-full">Continue</Button>
      </CardContent>
    </Card>
  );
}
