"use client";

import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { reviewBreakdown, sampleReview } from "./data";

const MAX_REVIEWS = 4000;

export function CustomerReviewsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Reviews</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Rating summary */}
        <div className="flex items-end gap-3">
          <span className="text-5xl font-bold tabular-nums leading-none">4.5</span>
          <div className="mb-1 flex flex-col gap-1">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={
                    i <= 4
                      ? "size-4 fill-amber-400 text-amber-400"
                      : "size-4 fill-amber-400/40 text-amber-400/40"
                  }
                />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">out of 5</span>
          </div>
        </div>

        {/* Star breakdown */}
        <div className="flex flex-col gap-2">
          {reviewBreakdown.map(({ stars, count }) => (
            <div key={stars} className="flex items-center gap-3 text-sm">
              <span className="flex w-5 shrink-0 items-center gap-0.5 tabular-nums text-muted-foreground">
                {stars}
                <Star className="ml-0.5 size-3 fill-amber-400 text-amber-400" />
              </span>
              <div className="flex-1">
                <Progress value={(count / MAX_REVIEWS) * 100} max={100} />
              </div>
              <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
                {count.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        <Separator />

        {/* Sample review */}
        <div className="flex gap-3">
          <Avatar>
            <AvatarFallback>{sampleReview.initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{sampleReview.name}</p>
            <p className="text-sm text-muted-foreground">{sampleReview.text}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
