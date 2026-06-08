"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { teamMembers, type TeamRole } from "@/lib/data";

const ROLES: TeamRole[] = ["Owner", "Member", "Viewer", "Developer", "Billing"];

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function TeamMembersCard() {
  const [roles, setRoles] = useState<Record<string, TeamRole>>(
    Object.fromEntries(teamMembers.map((m) => [m.email, m.role]))
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Members</CardTitle>
        <CardDescription>Invite your team members to collaborate.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {teamMembers.map((m) => (
          <div key={m.email} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="size-9">
                <AvatarFallback>{initials(m.name)}</AvatarFallback>
              </Avatar>
              <div className="text-sm">
                <p className="font-medium leading-none">{m.name}</p>
                <p className="text-muted-foreground">{m.email}</p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm" className="gap-1">
                    {roles[m.email]}{" "}
                    <ChevronDown className="size-4 text-muted-foreground" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                {ROLES.map((r) => (
                  <DropdownMenuItem
                    key={r}
                    onClick={() => setRoles((s) => ({ ...s, [m.email]: r }))}
                  >
                    {r}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
