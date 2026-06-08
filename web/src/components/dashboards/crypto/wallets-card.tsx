import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { wallets } from "./data";

export function WalletsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallets</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {wallets.map((wallet) => (
          <div key={wallet.id} className="flex items-center gap-3">
            <Avatar className="size-9 shrink-0">
              <AvatarFallback className={cn("text-white text-sm font-semibold", wallet.color)}>
                {wallet.fallback}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-1 items-center justify-between">
              <div>
                <p className="text-sm font-medium leading-none">{wallet.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{wallet.symbol}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium tabular-nums">{wallet.amount}</p>
                <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  {wallet.fiatValue}
                </p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
