import {
  GreetingBanner,
  LearningPathCard,
  LeaderboardCard,
  SuccessRateCard,
  TotalStudentsCard,
  ProgressStatisticsCard,
  PopularCoursesCard,
} from "@/components/dashboards/academy/widgets";
import {
  ActivityBreakdownCard,
  CourseProgressCard,
} from "@/components/dashboards/academy/charts";

export default function AcademyPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Academy</h1>

      {/* Greeting Banner */}
      <GreetingBanner />

      {/* Learning Path + Leaderboard */}
      <div className="grid gap-4 lg:grid-cols-3">
        <LearningPathCard />
        <LeaderboardCard />
      </div>

      {/* Success Rate + Total Students + Progress Statistics */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SuccessRateCard />
        <TotalStudentsCard />
        <ProgressStatisticsCard />
      </div>

      {/* Activity Breakdown + Course Progress */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ActivityBreakdownCard />
        <CourseProgressCard />
      </div>

      {/* Popular Courses */}
      <PopularCoursesCard />
    </div>
  );
}
