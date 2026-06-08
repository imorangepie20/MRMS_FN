import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { balanceSummary } from "./data";

export function BalanceSummary() {
  return (
    <>
      {balanceSummary.map((item) => (
        <Card key={item.label}>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold tabular-nums">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
