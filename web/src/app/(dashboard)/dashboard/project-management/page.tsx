import { ProjectManagementKpis } from "@/components/dashboards/project-management/kpis";
import {
  ProjectsOverviewCard,
  AchievementByYearCard,
} from "@/components/dashboards/project-management/charts";
import {
  ProfessionalsCard,
  HighlightsCard,
  RemindersCard,
  RecentProjectsCard,
} from "@/components/dashboards/project-management/widgets";

export default function ProjectManagementPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Project Management
      </h1>

      {/* KPI Row */}
      <ProjectManagementKpis />

      {/* Projects Overview */}
      <ProjectsOverviewCard />

      {/* Professionals + Highlights + Reminders */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ProfessionalsCard />
        <HighlightsCard />
        <RemindersCard />
      </div>

      {/* Achievement by Year */}
      <AchievementByYearCard />

      {/* Recent Projects */}
      <RecentProjectsCard />
    </div>
  );
}
