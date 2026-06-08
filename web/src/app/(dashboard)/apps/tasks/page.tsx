import { TasksTable } from "@/components/apps/tasks/tasks-table";

export default function TasksPage() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="text-muted-foreground">Here&apos;s a list of your tasks for this month!</p>
      </div>
      <TasksTable />
    </div>
  );
}
