import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { recentActivities } from "./data";
import type { Activity } from "./data";

const typeConfig: Record<Activity["type"], { className: string }> = {
  Buy: {
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  Sell: {
    className:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  Send: {
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
};

export function RecentActivitiesCard() {
  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>Recent Activities</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-(--card-spacing)">Type</TableHead>
              <TableHead>Coin</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="pr-(--card-spacing) text-right">USD</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentActivities.map((act) => {
              const cfg = typeConfig[act.type];
              return (
                <TableRow key={act.id}>
                  <TableCell className="pl-(--card-spacing)">
                    <Badge
                      variant="outline"
                      className={cn("border-transparent", cfg.className)}
                    >
                      {act.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{act.coin}</TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {act.date}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-medium">
                    {act.btcAmount}
                  </TableCell>
                  <TableCell className="pr-(--card-spacing) text-right tabular-nums text-sm text-muted-foreground">
                    {act.usdAmount}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
