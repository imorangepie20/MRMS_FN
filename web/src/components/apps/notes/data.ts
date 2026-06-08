export type Category =
  | "Family"
  | "Tasks"
  | "Personal"
  | "Meetings"
  | "Shopping"
  | "Planning"
  | "Travel"

export interface Note {
  id: string
  title: string
  preview: string
  body: string
  categories: Category[]
  date: string
  starred: boolean
  archived: boolean
}

export const CATEGORIES: Category[] = [
  "Family",
  "Tasks",
  "Personal",
  "Meetings",
  "Shopping",
  "Planning",
  "Travel",
]

export const CATEGORY_COLORS: Record<Category, string> = {
  Family: "bg-rose-400",
  Tasks: "bg-blue-400",
  Personal: "bg-violet-400",
  Meetings: "bg-amber-400",
  Shopping: "bg-green-400",
  Planning: "bg-orange-400",
  Travel: "bg-cyan-400",
}

export const CATEGORY_BADGE_CLASSES: Record<Category, string> = {
  Family: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  Tasks: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  Personal: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  Meetings: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  Shopping: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  Planning: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  Travel: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
}

export const INITIAL_NOTES: Note[] = [
  {
    id: "1",
    title: "Mountain Sunset Photography",
    preview: "Golden hour tips and camera settings for capturing perfect mountain sunsets.",
    body: `Golden hour tips and camera settings for capturing perfect mountain sunsets.

## Camera Settings
- Aperture: f/8–f/11 for maximum sharpness
- ISO: Start at 100, increase only if needed
- Shutter speed: 1/125s or faster to freeze clouds

## Composition Tips
Use the rule of thirds — place the horizon on the lower third when the sky is dramatic. Include a foreground element like rocks or wildflowers to add depth.

## Post-Processing
Boost the oranges and reds slightly in Lightroom. Reduce highlights to recover blown-out areas near the sun. Add a subtle graduated filter to darken the sky.

Next shoot: Bear Lake trailhead, arrive 2 hours before sunset.`,
    categories: ["Family", "Personal"],
    date: "2025-12-14",
    starred: true,
    archived: false,
  },
  {
    id: "2",
    title: "Weekly Grocery List",
    preview: "Fruits, vegetables, dairy, and pantry staples for the week ahead.",
    body: `## Produce
- Apples (6)
- Baby spinach (2 bags)
- Broccoli
- Cherry tomatoes
- Avocados (4)
- Lemons (3)

## Dairy & Eggs
- Greek yogurt (plain)
- Cheddar cheese block
- Eggs (1 dozen)
- Unsalted butter

## Pantry
- Olive oil (extra virgin)
- Brown rice (2 lbs)
- Canned chickpeas (4 cans)
- Pasta (linguine and penne)
- Marinara sauce

## Frozen
- Edamame
- Mixed berries for smoothies

Budget target: $120`,
    categories: ["Personal", "Shopping"],
    date: "2025-12-10",
    starred: false,
    archived: false,
  },
  {
    id: "3",
    title: "Project Milestones",
    preview: "Q1 delivery targets, sprint planning, and key stakeholder checkpoints.",
    body: `## Q1 2026 Milestones

### Sprint 1 (Jan 6 – Jan 17)
- [ ] Finalize design system tokens
- [ ] Component library: 20 base components
- [ ] CI/CD pipeline setup

### Sprint 2 (Jan 20 – Jan 31)
- [ ] Dashboard views (analytics, users, settings)
- [ ] Auth flow (login, 2FA, password reset)
- [ ] API integration layer

### Sprint 3 (Feb 3 – Feb 14)
- [ ] User testing round 1
- [ ] Accessibility audit
- [ ] Performance benchmarks

### Stakeholder Review
February 18 — demo to leadership. Prepare deck + live demo environment.

### Final Delivery
March 28 — production release. All critical bugs resolved, docs complete.`,
    categories: ["Tasks"],
    date: "2025-12-08",
    starred: true,
    archived: false,
  },
  {
    id: "4",
    title: "Home Renovation Tasks",
    preview: "Kitchen remodel checklist, contractor contacts, and material budget breakdown.",
    body: `## Phase 1: Kitchen (Jan–Feb)
1. Remove old cabinets — hire demo crew
2. Electrical rough-in (sub-panel upgrade)
3. Plumbing — move sink to island
4. Drywall + skim coat
5. Cabinet installation (IKEA SEKTION)
6. Countertop templating + install (quartz)
7. Backsplash tile
8. Appliance delivery + install

## Budget Estimate
| Item | Cost |
|------|------|
| Cabinets | $4,200 |
| Countertops | $3,800 |
| Labor | $6,500 |
| Appliances | $5,200 |
| Misc | $900 |
| **Total** | **$20,600** |

## Contractor Contacts
- Demo: Mike's Demolition — 555-0182
- Electrician: Rodriguez Electric — 555-0247
- Plumber: Clear Flow — 555-0391`,
    categories: ["Planning"],
    date: "2025-12-05",
    starred: false,
    archived: false,
  },
  {
    id: "5",
    title: "Trip to Kyoto",
    preview: "Itinerary, accommodation bookings, and must-see temples for spring cherry blossom season.",
    body: `## Trip Overview
Dates: March 22 – April 2, 2026
Purpose: Cherry blossom season (Sakura)

## Itinerary

**Day 1–2: Arrival & Gion District**
- Flight arrives Osaka KIX 14:30
- Train to Kyoto (Haruka Express)
- Evening stroll in Gion

**Day 3–4: Higashiyama**
- Kiyomizudera Temple (arrive before 8am to beat crowds)
- Ninen-zaka and Sannen-zaka stone steps
- Kodai-ji Temple at dusk (illumination)

**Day 5–6: Arashiyama**
- Bamboo Grove (early morning)
- Tenryu-ji gardens
- Boat ride on Hozu River

**Day 7–8: Fushimi & Nishiki**
- Fushimi Inari Shrine (full hike — 4 hrs)
- Nishiki Market for food tour

## Accommodation
- Kyo Yamashiro-ya ryokan — confirmed, ref #KY2026-0322
- Check-in: 15:00, Check-out: 11:00

## Budget: ~$3,200 per person`,
    categories: ["Travel", "Planning"],
    date: "2025-12-01",
    starred: true,
    archived: false,
  },
  {
    id: "6",
    title: "Team Sync Notes",
    preview: "Action items and decisions from the weekly engineering all-hands meeting.",
    body: `## Weekly Engineering All-Hands
Date: December 3, 2025 | 10:00 AM

**Attendees:** Alex, Beth, Carlos, Dana, Eli, Fiona

---

## Agenda Items

### 1. Sprint Retrospective
- Velocity was 42 pts (target 45) — slightly below due to unexpected auth bug
- Positive: deployment pipeline improvements saved ~3 hrs/week
- Action: Carlos to document the new deploy flow in Notion

### 2. Architecture Decision: State Management
- Decided to adopt Zustand over Redux for new features
- Existing Redux store to remain until end of Q1
- Action: Beth to create migration guide by Dec 15

### 3. On-Call Rotation Update
- New rotation starts Jan 1
- 1-week shifts, primary + secondary coverage
- PagerDuty setup: Eli to configure by Dec 20

### 4. Q1 Hiring
- 2 senior FE engineer roles approved
- Job reqs going out this week
- Referrals welcome — $2,000 bonus per successful hire

## Next Meeting
December 10, 2025 — same time`,
    categories: ["Meetings"],
    date: "2025-11-28",
    starred: false,
    archived: false,
  },
  {
    id: "7",
    title: "Family Reunion Planning",
    preview: "Summer gathering logistics, venue options, and activity ideas for 25+ family members.",
    body: `## Family Reunion 2026
Target Date: July 4th weekend
Expected Attendance: ~28 people

## Venue Options
1. **Pine Creek Campground** — $480/night, sleeps 30, full kitchen
   - Pros: secluded, lake access, fire pits
   - Cons: 3-hour drive from most family

2. **Grandma's property** — free, familiar, sentimental
   - Pros: free, kids know the space
   - Cons: limited sleeping (12 indoor beds max)

3. **Lakeside Pavilion** — $1,200 flat fee
   - Pros: catering allowed, parking, covered area
   - Cons: need separate lodging nearby

## Activities
- Saturday morning: 5k fun run / walk
- Saturday afternoon: lawn games (cornhole tournament, volleyball)
- Saturday evening: cookout + bonfire, talent show
- Sunday: brunch + family photo session

## Food Assignments (TBD)
Potluck style — coordinate via group chat

## RSVP Deadline: June 1, 2026`,
    categories: ["Family", "Planning"],
    date: "2025-11-20",
    starred: false,
    archived: false,
  },
  {
    id: "8",
    title: "Personal Goals 2026",
    preview: "Fitness, career, learning, and wellness intentions for the new year.",
    body: `## 2026 Intentions

### Fitness & Health
- Run a half marathon (sign up by February)
- Strength train 3x/week consistently
- Cook at home 5 nights/week
- No phone after 9pm (sleep quality)

### Career
- Lead one cross-functional project end-to-end
- Publish 3 technical blog posts
- Attend one industry conference (budget: $1,500)
- Mentor a junior engineer

### Learning
- Complete the Rust programming course (ongoing)
- Read 18 books — mix of fiction and non-fiction
- Learn basic conversational Japanese (for Kyoto trip)

### Relationships
- Monthly dinner with close friends (schedule in advance)
- Call parents every Sunday
- Plan family reunion (see separate note)

### Finance
- Max out 401(k) contributions
- Build 6-month emergency fund
- Pay off remaining student loan balance

### Review Cadence
Monthly check-in on the last Sunday of each month. Annual review: December 28.`,
    categories: ["Personal"],
    date: "2025-11-15",
    starred: false,
    archived: false,
  },
]
