"use client";

import { LayoutDashboard, Zap, GitBranch, Users, Heart, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { activityItems, projects, skills, profile } from "./data";

// ─── Overview Tab ─────────────────────────────────────────────────────────

function OverviewTab() {
  return (
    <div className="flex flex-col gap-5">
      {/* Bio */}
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {profile.bio}
          </p>
        </CardContent>
      </Card>

      {/* Skills with levels */}
      <Card>
        <CardHeader>
          <CardTitle>Skill Proficiency</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {skills.map((skill) => (
            <div key={skill.name} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{skill.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{skill.level}%</span>
              </div>
              <Progress value={skill.level} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Highlight stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Posts", value: profile.posts, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40" },
          { label: "Followers", value: profile.followers.toLocaleString(), color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/40" },
          { label: "Following", value: profile.following, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
          { label: "Projects", value: projects.length, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40" },
        ].map((item) => (
          <div
            key={item.label}
            className={`rounded-xl ${item.bg} p-4 flex flex-col gap-1`}
          >
            <span className={`text-2xl font-bold tabular-nums ${item.color}`}>
              {item.value}
            </span>
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Activity Tab ─────────────────────────────────────────────────────────

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

function ActivityTab() {
  return (
    <Card>
      <CardContent className="pt-4 flex flex-col gap-4">
        {activityItems.map((item, i) => (
          <div key={item.id}>
            <div className="flex gap-3">
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
            {i < activityItems.length - 1 && (
              <div className="ml-[13px] mt-3 h-3 w-px bg-border" />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Projects Tab ─────────────────────────────────────────────────────────

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

function ProjectsTab() {
  return (
    <div className="flex flex-col gap-3">
      {projects.map((project) => (
        <Card key={project.id} className="transition-shadow hover:shadow-md">
          <CardContent className="pt-4 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold">{project.name}</span>
              <ProjectStatusBadge status={project.status} />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {project.description}
            </p>
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                {project.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px] h-4 px-1.5">
                    {tag}
                  </Badge>
                ))}
              </div>
              <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                <Users className="size-3" />
                {project.collaborators}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">Updated {project.updatedAt}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Profile V2 Tabs ──────────────────────────────────────────────────────

export function ProfileV2Tabs() {
  return (
    <Tabs defaultValue="overview">
      <TabsList variant="line" className="border-b border-border w-full justify-start rounded-none px-0 mb-5">
        <TabsTrigger value="overview" className="gap-1.5">
          <LayoutDashboard className="size-3.5" />
          Overview
        </TabsTrigger>
        <TabsTrigger value="activity" className="gap-1.5">
          <Zap className="size-3.5" />
          Activity
        </TabsTrigger>
        <TabsTrigger value="projects" className="gap-1.5">
          <GitBranch className="size-3.5" />
          Projects
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <OverviewTab />
      </TabsContent>

      <TabsContent value="activity">
        <ActivityTab />
      </TabsContent>

      <TabsContent value="projects">
        <ProjectsTab />
      </TabsContent>
    </Tabs>
  );
}
