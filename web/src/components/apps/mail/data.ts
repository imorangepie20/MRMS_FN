export type MailFolder =
  | "inbox"
  | "drafts"
  | "sent"
  | "junk"
  | "trash"
  | "archive"

export type MailLabel = "work" | "important" | "personal" | "budget"

export type Mail = {
  id: string
  from: string
  fromEmail: string
  subject: string
  preview: string
  body: string
  date: string
  /** relative display like "about 1 hour ago" */
  relativeTime: string
  labels: MailLabel[]
  read: boolean
  folder: MailFolder
}

export const FOLDERS: { id: MailFolder; label: string; count: number | null }[] = [
  { id: "inbox", label: "Inbox", count: 128 },
  { id: "drafts", label: "Drafts", count: 9 },
  { id: "sent", label: "Sent", count: null },
  { id: "junk", label: "Junk", count: 23 },
  { id: "trash", label: "Trash", count: null },
  { id: "archive", label: "Archive", count: null },
]

export type MailCategory = {
  id: string
  label: string
  count: number
}

export const CATEGORIES: MailCategory[] = [
  { id: "social", label: "Social", count: 972 },
  { id: "updates", label: "Updates", count: 342 },
  { id: "forums", label: "Forums", count: 128 },
  { id: "shopping", label: "Shopping", count: 8 },
  { id: "promotions", label: "Promotions", count: 21 },
]

export const LABEL_COLORS: Record<MailLabel, string> = {
  work: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  important: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  personal: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  budget: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
}

export const INITIAL_MAILS: Mail[] = [
  {
    id: "mail-1",
    from: "William Smith",
    fromEmail: "william.smith@example.com",
    subject: "Meeting Tomorrow",
    preview: "Hi, let's have a meeting tomorrow to discuss the project. I've been reviewing the latest progress and have some feedback to share.",
    body: `Hi there,

I hope you're doing well. I wanted to reach out to schedule a meeting for tomorrow to discuss the current state of the project.

I've been reviewing our latest progress and I have some important feedback to share with the team. I believe we need to align on a few key decisions before we move forward.

Please let me know if you're available at 10 AM or if there's a better time that works for you.

Looking forward to our discussion.

Best,
William Smith`,
    date: "2026-06-07T09:00:00",
    relativeTime: "about 1 hour ago",
    labels: ["work", "important"],
    read: false,
    folder: "inbox",
  },
  {
    id: "mail-2",
    from: "Alice Smith",
    fromEmail: "alice.smith@example.com",
    subject: "Re: Project Update",
    preview: "Thanks for the update! The new features look great. I especially liked the revised UI mockups you sent over. Can we schedule a review?",
    body: `Hey!

Thanks for sending over the project update. The new features look absolutely great — I especially liked the revised UI mockups you included. The color palette change was a smart move.

I had a quick question about the timeline. Do you think we can still hit the original deadline, or should we plan for a one-week extension?

Can we schedule a brief review call later this week? Thursday or Friday works best for me.

Let me know!

Cheers,
Alice`,
    date: "2026-06-07T08:30:00",
    relativeTime: "about 2 hours ago",
    labels: ["work"],
    read: false,
    folder: "inbox",
  },
  {
    id: "mail-3",
    from: "Emily Davis",
    fromEmail: "emily.davis@example.com",
    subject: "Budget Allocation",
    preview: "I've reviewed the budget proposal and have some concerns about the Q3 allocations. The marketing spend seems too high relative to projections.",
    body: `Hello,

I've had a chance to review the latest budget proposal in detail and I wanted to share some concerns before we finalize everything.

Specifically, the Q3 marketing spend allocation seems disproportionately high relative to our current revenue projections. I'd suggest we reduce it by around 15% and reallocate that to product development.

Additionally, the travel budget for Q4 may need to be revisited given recent changes to the conference schedule.

I've attached a revised spreadsheet with my suggested changes. Please take a look and let me know your thoughts.

Best regards,
Emily Davis`,
    date: "2026-06-06T17:45:00",
    relativeTime: "yesterday",
    labels: ["budget", "work"],
    read: true,
    folder: "inbox",
  },
  {
    id: "mail-4",
    from: "Michael Wilson",
    fromEmail: "michael.wilson@example.com",
    subject: "Important Notice",
    preview: "Please be advised that the system will undergo scheduled maintenance this weekend. All services will be unavailable from Saturday 11 PM to Sunday 3 AM.",
    body: `Dear Team,

Please be advised that our systems will undergo scheduled maintenance this coming weekend.

All services will be unavailable from Saturday at 11:00 PM EST through Sunday at approximately 3:00 AM EST. This includes the main application, API endpoints, and the admin dashboard.

During this window, the engineering team will be:
- Upgrading the database to the latest version
- Applying critical security patches
- Migrating to the new infrastructure

Please plan accordingly and ensure no critical tasks are dependent on system availability during this window. If you have any concerns, please reach out before Friday EOD.

Thank you for your understanding,
Michael Wilson
Head of Engineering`,
    date: "2026-06-06T14:00:00",
    relativeTime: "yesterday",
    labels: ["important"],
    read: false,
    folder: "inbox",
  },
  {
    id: "mail-5",
    from: "Sarah Johnson",
    fromEmail: "sarah.johnson@example.com",
    subject: "Team Lunch Next Friday",
    preview: "Hey everyone! I'm organizing a team lunch next Friday at the Italian place downtown. Let me know if you can make it by Wednesday so I can make a reservation.",
    body: `Hey everyone!

I'm organizing a team lunch for next Friday, June 14th, at the Italian place downtown (Trattoria Roma on 5th Ave). We had a great time there last quarter and I thought it'd be nice to do it again!

Please let me know by Wednesday if you can make it so I can call ahead and make a reservation. We're looking at around 12:30 PM.

Also, if anyone has dietary restrictions I should be aware of, please give me a heads up.

Hope to see you all there!

Sarah`,
    date: "2026-06-06T11:20:00",
    relativeTime: "yesterday",
    labels: ["personal"],
    read: true,
    folder: "inbox",
  },
  {
    id: "mail-6",
    from: "David Kim",
    fromEmail: "david.kim@example.com",
    subject: "Code Review Request",
    preview: "Hi, I've submitted a pull request for the authentication module. Could you take a look when you get a chance? I've addressed all the previous comments.",
    body: `Hi,

I've just submitted a pull request for the authentication module refactor — PR #247. I've addressed all the feedback from the previous review and also added comprehensive test coverage.

Key changes in this PR:
- Replaced JWT refresh logic with a more secure approach
- Added rate limiting to the login endpoint
- Improved error messages for better UX
- 94% test coverage on new code

The PR is ready for review whenever you get a chance. No rush, but it would be great to get it merged before the end of the sprint.

Thanks!
David Kim`,
    date: "2026-06-05T16:10:00",
    relativeTime: "2 days ago",
    labels: ["work"],
    read: true,
    folder: "inbox",
  },
  {
    id: "mail-7",
    from: "Jennifer Lee",
    fromEmail: "jennifer.lee@example.com",
    subject: "Q2 Report Feedback",
    preview: "I've reviewed the Q2 report and overall it looks solid. A few minor points to address: the executive summary needs more concrete metrics and the charts on page 8 need clearer labels.",
    body: `Hello,

I've reviewed the Q2 report you shared and overall I think it looks solid. Great job pulling all the data together.

A couple of minor points I'd like to see addressed before we send it to the board:

1. The executive summary could use more concrete metrics. Instead of "significant growth," let's quantify it (e.g., "27% YoY revenue growth").

2. The charts on page 8 need clearer axis labels. It's hard to read the scale at a glance.

3. On page 12, there's a typo in the third paragraph — "recieve" should be "receive."

Other than that, I think we're in great shape. Can you make these tweaks by Thursday?

Best,
Jennifer`,
    date: "2026-06-05T10:45:00",
    relativeTime: "2 days ago",
    labels: ["work"],
    read: false,
    folder: "inbox",
  },
  {
    id: "mail-8",
    from: "Robert Chen",
    fromEmail: "robert.chen@example.com",
    subject: "Partnership Opportunity",
    preview: "I represent TechCorp and we're interested in exploring a partnership. We believe our platforms are highly complementary and there could be significant value for both sides.",
    body: `Dear Sir/Madam,

My name is Robert Chen and I'm the Head of Business Development at TechCorp. I hope this message finds you well.

I'm reaching out because we've been following your company's growth with great interest and believe there's a compelling partnership opportunity between our organizations. Our platforms are highly complementary, and we've seen similar collaborations generate significant value for both parties.

Specifically, I'd like to discuss:
- Integration opportunities between our products
- Co-marketing initiatives for Q3/Q4
- Joint go-to-market strategy for enterprise clients

Would you be available for a 30-minute introductory call this week or next? I'm flexible on timing.

Looking forward to hearing from you.

Best regards,
Robert Chen
Head of Business Development, TechCorp`,
    date: "2026-06-04T09:30:00",
    relativeTime: "3 days ago",
    labels: ["important", "work"],
    read: true,
    folder: "inbox",
  },
  {
    id: "mail-9",
    from: "Lisa Thompson",
    fromEmail: "lisa.thompson@example.com",
    subject: "Conference Registration",
    preview: "Just a reminder that early bird registration for TechSummit 2026 closes this Friday. I've already registered — the lineup looks amazing this year!",
    body: `Hey!

Quick reminder that early bird registration for TechSummit 2026 closes this Friday at 5 PM. The early bird discount is $200 off the standard price, so it's worth acting on.

I've already registered and I'm really excited — the speaker lineup looks incredible this year. Some highlights:
- Keynote by the CEO of OpenAI
- Deep-dive workshop on AI-assisted development
- Panel on the future of distributed systems

If you're planning to go, now's the time! The link to register is on the TechSummit website.

Let me know if you want to coordinate travel arrangements.

Lisa`,
    date: "2026-06-04T08:00:00",
    relativeTime: "3 days ago",
    labels: ["personal"],
    read: true,
    folder: "inbox",
  },
  {
    id: "mail-10",
    from: "James Martinez",
    fromEmail: "james.martinez@example.com",
    subject: "Invoice #1042 Due",
    preview: "This is a reminder that invoice #1042 for $3,450.00 is due on June 15, 2026. Please ensure payment is processed by the due date to avoid late fees.",
    body: `Dear Customer,

This is a friendly reminder that Invoice #1042 for $3,450.00 is due on June 15, 2026.

Invoice Details:
- Invoice Number: #1042
- Amount Due: $3,450.00
- Due Date: June 15, 2026
- Payment Terms: Net 30

Accepted payment methods: Bank transfer, credit card, or ACH.

If you have already processed this payment, please disregard this notice. If you have any questions about this invoice or need to discuss payment arrangements, please don't hesitate to reach out.

Thank you for your business.

Sincerely,
James Martinez
Accounts Receivable`,
    date: "2026-06-03T13:00:00",
    relativeTime: "4 days ago",
    labels: ["budget"],
    read: false,
    folder: "inbox",
  },
]
