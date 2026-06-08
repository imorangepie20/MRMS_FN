export type Message = {
  id: string
  text: string
  sender: "me" | "them"
  time: string // e.g. "10:02 AM"
}

export type Conversation = {
  id: string
  name: string
  initials: string
  online: boolean
  lastSeen: string // e.g. "Last seen 2 hours ago"
  lastMessage: string
  timestamp: string // display string e.g. "10 minutes"
  unread: number
  messages: Message[]
}

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-1",
    name: "Jacquenetta Slowgrave",
    initials: "JS",
    online: true,
    lastSeen: "Online",
    lastMessage: "Hey! Are you free for a quick call later today?",
    timestamp: "10 minutes",
    unread: 8,
    messages: [
      { id: "m1-1", text: "Hi there! How's the project coming along?", sender: "them", time: "9:45 AM" },
      { id: "m1-2", text: "It's going well, almost done with the initial design.", sender: "me", time: "9:47 AM" },
      { id: "m1-3", text: "That's great to hear! Looking forward to seeing it.", sender: "them", time: "9:50 AM" },
      { id: "m1-4", text: "Should be ready by end of week.", sender: "me", time: "9:52 AM" },
      { id: "m1-5", text: "Perfect timing. Can you share a preview when it's ready?", sender: "them", time: "9:55 AM" },
      { id: "m1-6", text: "Absolutely, I'll send you a link.", sender: "me", time: "9:57 AM" },
      { id: "m1-7", text: "Awesome, thanks!", sender: "them", time: "9:59 AM" },
      { id: "m1-8", text: "Hey! Are you free for a quick call later today?", sender: "them", time: "10:02 AM" },
    ],
  },
  {
    id: "conv-2",
    name: "Nickola Peever",
    initials: "NP",
    online: true,
    lastSeen: "Online",
    lastMessage: "Just sent you the updated files, check your email.",
    timestamp: "40 minutes",
    unread: 2,
    messages: [
      { id: "m2-1", text: "Morning! Did you get my message yesterday?", sender: "them", time: "8:30 AM" },
      { id: "m2-2", text: "Yes, sorry for the late reply — been slammed.", sender: "me", time: "8:35 AM" },
      { id: "m2-3", text: "No worries at all. I was asking about the budget doc.", sender: "them", time: "8:37 AM" },
      { id: "m2-4", text: "I reviewed it and left comments inline.", sender: "me", time: "8:45 AM" },
      { id: "m2-5", text: "Perfect. I'll incorporate the changes now.", sender: "them", time: "8:50 AM" },
      { id: "m2-6", text: "Just sent you the updated files, check your email.", sender: "them", time: "9:22 AM" },
    ],
  },
  {
    id: "conv-3",
    name: "Farand Hume",
    initials: "FH",
    online: false,
    lastSeen: "Last seen 3 hours ago",
    lastMessage: "Let me know when you're ready to review the draft.",
    timestamp: "Yesterday",
    unread: 5,
    messages: [
      { id: "m3-1", text: "Hey Farand, are you around?", sender: "me", time: "2:00 PM" },
      { id: "m3-2", text: "Hey! Just got back. What's up?", sender: "them", time: "2:10 PM" },
      { id: "m3-3", text: "I wanted to talk about the onboarding flow revision.", sender: "me", time: "2:11 PM" },
      { id: "m3-4", text: "Sure, I have thoughts on that. Want to jump on a call?", sender: "them", time: "2:13 PM" },
      { id: "m3-5", text: "Actually I'd prefer async — can you drop your notes in a doc?", sender: "me", time: "2:15 PM" },
      { id: "m3-6", text: "Will do, give me an hour.", sender: "them", time: "2:16 PM" },
      { id: "m3-7", text: "Done! Shared it with you just now.", sender: "them", time: "3:10 PM" },
      { id: "m3-8", text: "Looks good overall, a few minor points.", sender: "me", time: "3:25 PM" },
      { id: "m3-9", text: "Great, updated it already.", sender: "them", time: "3:40 PM" },
      { id: "m3-10", text: "Let me know when you're ready to review the draft.", sender: "them", time: "4:05 PM" },
    ],
  },
  {
    id: "conv-4",
    name: "Marcus Webb",
    initials: "MW",
    online: false,
    lastSeen: "Last seen yesterday",
    lastMessage: "Sounds like a plan, talk soon!",
    timestamp: "13 days",
    unread: 0,
    messages: [
      { id: "m4-1", text: "Hey Marcus, long time no chat!", sender: "me", time: "11:00 AM" },
      { id: "m4-2", text: "Hey! Yeah it's been a while. How are you?", sender: "them", time: "11:05 AM" },
      { id: "m4-3", text: "Doing well! Working on some new stuff.", sender: "me", time: "11:07 AM" },
      { id: "m4-4", text: "Nice, would love to hear about it sometime.", sender: "them", time: "11:10 AM" },
      { id: "m4-5", text: "Let's catch up over coffee soon.", sender: "me", time: "11:11 AM" },
      { id: "m4-6", text: "Sounds like a plan, talk soon!", sender: "them", time: "11:13 AM" },
    ],
  },
  {
    id: "conv-5",
    name: "Priya Nair",
    initials: "PN",
    online: true,
    lastSeen: "Online",
    lastMessage: "I'll push the fix by end of day.",
    timestamp: "Yesterday",
    unread: 0,
    messages: [
      { id: "m5-1", text: "Priya, the staging env is throwing a 500 on login.", sender: "me", time: "1:00 PM" },
      { id: "m5-2", text: "Ugh, saw it. Looks like a config issue.", sender: "them", time: "1:03 PM" },
      { id: "m5-3", text: "Any ETA on the fix?", sender: "me", time: "1:04 PM" },
      { id: "m5-4", text: "I'll push the fix by end of day.", sender: "them", time: "1:05 PM" },
    ],
  },
  {
    id: "conv-6",
    name: "Theo Ashford",
    initials: "TA",
    online: false,
    lastSeen: "Last seen 5 hours ago",
    lastMessage: "Thanks for the feedback, really helpful!",
    timestamp: "2 days",
    unread: 0,
    messages: [
      { id: "m6-1", text: "Theo, can you review my PR when you get a chance?", sender: "me", time: "10:00 AM" },
      { id: "m6-2", text: "On it now!", sender: "them", time: "10:20 AM" },
      { id: "m6-3", text: "Left a few comments. Overall looks solid though.", sender: "them", time: "10:35 AM" },
      { id: "m6-4", text: "Great, addressed all the comments.", sender: "me", time: "10:50 AM" },
      { id: "m6-5", text: "Thanks for the feedback, really helpful!", sender: "them", time: "11:00 AM" },
    ],
  },
]
