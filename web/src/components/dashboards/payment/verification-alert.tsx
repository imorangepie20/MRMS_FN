import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function VerificationAlert() {
  return (
    <Card className="border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-500/40">
      <CardContent className="flex flex-col gap-4 pt-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
          <p className="text-sm text-foreground leading-snug">
            You have information to submit in verification center
          </p>
        </div>
        <Button variant="outline" size="sm" className="w-full border-amber-400/60 text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-950/40">
          Verify
        </Button>
      </CardContent>
    </Card>
  );
}
