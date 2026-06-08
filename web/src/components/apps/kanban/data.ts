export type Priority = "High" | "Medium" | "Low"

export type Card = {
  id: string
  title: string
  description: string
  taskId: string
  priority: Priority
  progress: number
  assignees: number
  comments: number
  attachments: number
}

export type Column = {
  id: string
  title: string
  cards: Card[]
}

export const initialColumns: Column[] = [
  {
    id: "backlog",
    title: "Backlog",
    cards: [
      {
        id: "card-1",
        title: "Integrate Stripe payment gateway",
        description: "Set up Stripe SDK, handle webhooks, and test checkout flow end-to-end.",
        taskId: "EJDS",
        priority: "High",
        progress: 10,
        assignees: 2,
        comments: 4,
        attachments: 1,
      },
      {
        id: "card-2",
        title: "Compile competitor landing pages",
        description: "Research and document top 10 competitor landing pages with screenshots.",
        taskId: "LBSR",
        priority: "Low",
        progress: 0,
        assignees: 1,
        comments: 2,
        attachments: 3,
      },
      {
        id: "card-3",
        title: "Design onboarding flow",
        description: "Create wireframes and prototype for a 3-step user onboarding experience.",
        taskId: "MWJL",
        priority: "Medium",
        progress: 5,
        assignees: 3,
        comments: 6,
        attachments: 2,
      },
      {
        id: "card-4",
        title: "Write API documentation",
        description: "Document all REST endpoints using OpenAPI 3.0 spec with code examples.",
        taskId: "QTKV",
        priority: "Low",
        progress: 40,
        assignees: 1,
        comments: 1,
        attachments: 0,
      },
    ],
  },
  {
    id: "in-progress",
    title: "In Progress",
    cards: [
      {
        id: "card-5",
        title: "Build dashboard analytics view",
        description: "Implement charts and KPI cards using real-time data from the analytics API.",
        taskId: "RPNC",
        priority: "High",
        progress: 55,
        assignees: 2,
        comments: 8,
        attachments: 2,
      },
      {
        id: "card-6",
        title: "Migrate database to PostgreSQL",
        description: "Move existing SQLite schema to Postgres and update all ORM queries.",
        taskId: "HZWF",
        priority: "High",
        progress: 35,
        assignees: 2,
        comments: 5,
        attachments: 1,
      },
      {
        id: "card-7",
        title: "Implement dark mode toggle",
        description: "Add theme switching with system preference detection and local storage persistence.",
        taskId: "GXPD",
        priority: "Medium",
        progress: 70,
        assignees: 1,
        comments: 3,
        attachments: 0,
      },
    ],
  },
  {
    id: "done",
    title: "Done",
    cards: [
      {
        id: "card-8",
        title: "Set up CI/CD pipeline",
        description: "Configure GitHub Actions for automated testing and deployment to staging.",
        taskId: "ACFY",
        priority: "Medium",
        progress: 100,
        assignees: 2,
        comments: 7,
        attachments: 4,
      },
      {
        id: "card-9",
        title: "Create email notification templates",
        description: "Design and code responsive HTML email templates for transactional messages.",
        taskId: "VBTM",
        priority: "Low",
        progress: 100,
        assignees: 1,
        comments: 2,
        attachments: 1,
      },
    ],
  },
]
