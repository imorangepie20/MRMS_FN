"use client";

import { Briefcase, Users, MessageSquare, GitBranch, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { activityItems, projects, connections } from "./data";

// ─── Activity Feed ─────────────────────────────────────────────────────────

const activityIcon: Record<string, React.ReactNode> = {
  post: <MessageSquare className="size-3.5" />,
  comment: <MessageSquare className="size-3.5" />,
  like: <Heart className="size-3.5" />,
  project: <GitBranch className="size-3.5" />,
  follow: <Users className="size-3.5" />,
};

const activityColor: Record<string, string> = {
  post: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  comment: "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400",
  like: "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
  project: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  follow: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
};

function ActivityFeed() {
  return (
    <div className="flex flex-col gap-4">
      {activityItems.map((item) => (
        <div key={item.id} className="flex gap-3">
          <span
            className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${activityColor[item.type]}`}
          >
            {activityIcon[item.type]}
          </span>
          <div className="flex flex-col gap-0.5">
            <p className="text-sm leading-snug text-foreground">{item.text}</p>
            <span className="text-xs text-muted-foreground">{item.time}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Project Status Badge ──────────────────────────────────────────────────

function ProjectStatusBadge({ status }: { status: string }) {
  if (status === "active")
    return (
      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-transparent capitalize text-[10px] h-4">
        Active
      </Badge>
    );
  if (status === "completed")
    return (
      <Badge variant="secondary" className="capitalize text-[10px] h-4">
        Completed
      </Badge>
    );
  return (
    <Badge variant="outline" className="capitalize text-[10px] h-4">
      Archived
    </Badge>
  );
}

// ─── Projects Grid ─────────────────────────────────────────────────────────

function ProjectsGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {projects.map((project) => (
        <Card key={project.id} className="transition-shadow hover:shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-sm font-semibold leading-snug">
                {project.name}
              </CardTitle>
              <ProjectStatusBadge status={project.status} />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-0">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {project.description}
            </p>
            <div className="flex flex-wrap gap-1">
              {project.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px] h-4 px-1.5">
                  {tag}
                </Badge>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="size-3" />
                {project.collaborators} collaborators
              </span>
              <span>Updated {project.updatedAt}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Connections List ──────────────────────────────────────────────────────

function ConnectionsList() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {connections.map((connection) => (
        <div
          key={connection.id}
          className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 transition-colors hover:bg-muted/40"
        >
          <Avatar className="size-10 shrink-0">
            <AvatarFallback
              className={`${connection.color} text-white text-xs font-semibold`}
            >
              {connection.initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{connection.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {connection.headline}
            </span>
          </div>
          <Button variant="outline" size="xs" className="ml-auto shrink-0">
            Follow
          </Button>
        </div>
      ))}
    </div>
  );
}

// ─── Profile V1 Tabs ──────────────────────────────────────────────────────

export function ProfileV1Tabs() {
  return (
    <Tabs defaultValue="activity">
      <TabsList variant="line" className="border-b border-border w-full justify-start rounded-none px-0 mb-4">
        <TabsTrigger value="activity" className="gap-1.5">
          <Briefcase className="size-3.5" />
          Activity
        </TabsTrigger>
        <TabsTrigger value="projects" className="gap-1.5">
          <GitBranch className="size-3.5" />
          Projects
        </TabsTrigger>
        <TabsTrigger value="connections" className="gap-1.5">
          <Users className="size-3.5" />
          Connections
        </TabsTrigger>
      </TabsList>

      <TabsContent value="activity">
        <ActivityFeed />
      </TabsContent>

      <TabsContent value="projects">
        <ProjectsGrid />
      </TabsContent>

      <TabsContent value="connections">
        <ConnectionsList />
      </TabsContent>
    </Tabs>
  );
}
