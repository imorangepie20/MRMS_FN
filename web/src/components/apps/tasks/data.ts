import {
  Circle,
  Timer,
  CheckCircle2,
  CircleOff,
  HelpCircle,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  type LucideIcon,
} from "lucide-react";

export type TaskLabel = "Documentation" | "Bug" | "Feature";
export type TaskStatus = "todo" | "in progress" | "backlog" | "done" | "canceled";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  label: TaskLabel;
  status: TaskStatus;
  priority: TaskPriority;
}

export interface StatusOption {
  value: TaskStatus;
  label: string;
  icon: LucideIcon;
}

export interface PriorityOption {
  value: TaskPriority;
  label: string;
  icon: LucideIcon;
}

export const statusOptions: StatusOption[] = [
  { value: "todo", label: "Todo", icon: Circle },
  { value: "in progress", label: "In Progress", icon: Timer },
  { value: "backlog", label: "Backlog", icon: HelpCircle },
  { value: "done", label: "Done", icon: CheckCircle2 },
  { value: "canceled", label: "Canceled", icon: CircleOff },
];

export const priorityOptions: PriorityOption[] = [
  { value: "high", label: "High", icon: ArrowUp },
  { value: "medium", label: "Medium", icon: ArrowRight },
  { value: "low", label: "Low", icon: ArrowDown },
];

export const tasks: Task[] = [
  {
    id: "TASK-8782",
    title: "You can't compress the program without quantifying the open-source SSD pixel!",
    label: "Documentation",
    status: "in progress",
    priority: "medium",
  },
  {
    id: "TASK-7878",
    title: "Try to calculate the EXE feed, maybe it will index the multi-byte pixel!",
    label: "Documentation",
    status: "backlog",
    priority: "medium",
  },
  {
    id: "TASK-7839",
    title: "We need to bypass the neural TCP card!",
    label: "Bug",
    status: "todo",
    priority: "high",
  },
  {
    id: "TASK-5562",
    title: "The SAS interface is down, bypass the open-source pixel so we can back up the PNG bandwidth!",
    label: "Feature",
    status: "backlog",
    priority: "medium",
  },
  {
    id: "TASK-8686",
    title: "I'll parse the wireless SSL protocol, that should driver the API panel!",
    label: "Feature",
    status: "canceled",
    priority: "medium",
  },
  {
    id: "TASK-1280",
    title: "Use the digital TLS panel, then you can transmit the haptic system!",
    label: "Bug",
    status: "done",
    priority: "high",
  },
  {
    id: "TASK-7262",
    title: "The UTF8 application is down, parse the neural bandwidth so we can back up the PNG firewall!",
    label: "Feature",
    status: "done",
    priority: "high",
  },
  {
    id: "TASK-1138",
    title: "Generating the driver won't do anything, we need to quantify the 1080p SMTP bandwidth!",
    label: "Feature",
    status: "in progress",
    priority: "medium",
  },
  {
    id: "TASK-7184",
    title: "We need to program the back-end THX pixel!",
    label: "Feature",
    status: "todo",
    priority: "low",
  },
  {
    id: "TASK-5160",
    title: "Calculating the bus won't do anything, we need to navigate the back-end JSON protocol!",
    label: "Documentation",
    status: "in progress",
    priority: "high",
  },
  {
    id: "TASK-5408",
    title: "I'll compress the wireless JPEGS protocol, that should transmit the SQL pixel!",
    label: "Documentation",
    status: "todo",
    priority: "high",
  },
  {
    id: "TASK-8907",
    title: "Try to generate the XSS driver, maybe it will reboot the neural firewall!",
    label: "Bug",
    status: "done",
    priority: "high",
  },
  {
    id: "TASK-9205",
    title: "I'll hack the online ADP pixel, that should transmit the digital driver!",
    label: "Feature",
    status: "todo",
    priority: "low",
  },
  {
    id: "TASK-9534",
    title: "We need to parse the mobile SQL port!",
    label: "Documentation",
    status: "backlog",
    priority: "medium",
  },
  {
    id: "TASK-1245",
    title: "Try to override the CSS interface, maybe it will bypass the 1080p sensor!",
    label: "Feature",
    status: "todo",
    priority: "high",
  },
  {
    id: "TASK-3180",
    title: "If we index the card, we can get to the JSON matrix through the neural TCP transmitter!",
    label: "Documentation",
    status: "done",
    priority: "medium",
  },
  {
    id: "TASK-4226",
    title: "I'll reboot the 1080p driver, that should navigate the SQL firewall!",
    label: "Feature",
    status: "canceled",
    priority: "low",
  },
  {
    id: "TASK-3347",
    title: "We need to generate the back-end SMS protocol!",
    label: "Feature",
    status: "todo",
    priority: "low",
  },
  {
    id: "TASK-1985",
    title: "Parsing the monitor won't do anything, we need to transmit the SSL port!",
    label: "Documentation",
    status: "canceled",
    priority: "medium",
  },
  {
    id: "TASK-4362",
    title: "Try to calculate the ADP card, maybe it will connect the mobile bandwidth!",
    label: "Bug",
    status: "backlog",
    priority: "high",
  },
  {
    id: "TASK-6614",
    title: "Try to hack the OAuth bandwidth, maybe it will index the online array!",
    label: "Feature",
    status: "todo",
    priority: "medium",
  },
  {
    id: "TASK-6806",
    title: "We need to bypass the back-end CSS sensor!",
    label: "Bug",
    status: "done",
    priority: "medium",
  },
  {
    id: "TASK-4740",
    title: "I'll reboot the SMS firewall, that should calculate the virtual SQL monitor!",
    label: "Bug",
    status: "in progress",
    priority: "low",
  },
  {
    id: "TASK-5987",
    title: "If we generate the protocol, we can get to the PNG array through the virtual SMS firewall!",
    label: "Feature",
    status: "done",
    priority: "high",
  },
  {
    id: "TASK-3674",
    title: "We need to calculate the 1080p SSL port!",
    label: "Feature",
    status: "canceled",
    priority: "medium",
  },
  {
    id: "TASK-2507",
    title: "Navigating the firewall won't do anything, we need to connect the SQL pixel!",
    label: "Feature",
    status: "todo",
    priority: "low",
  },
  {
    id: "TASK-9481",
    title: "I'll transmit the wireless SSL port, that should compress the virtual API matrix!",
    label: "Documentation",
    status: "backlog",
    priority: "high",
  },
  {
    id: "TASK-1148",
    title: "We need to calculate the back-end THX bandwidth!",
    label: "Documentation",
    status: "done",
    priority: "low",
  },
  {
    id: "TASK-4920",
    title: "Try to bypass the ADP application, maybe it will override the wireless array!",
    label: "Feature",
    status: "in progress",
    priority: "medium",
  },
  {
    id: "TASK-3962",
    title: "Try to copy the PNG sensor, maybe it will calculate the virtual JSON bus!",
    label: "Feature",
    status: "canceled",
    priority: "low",
  },
  {
    id: "TASK-5227",
    title: "The SSL protocol is down, copy the neural system so we can back up the SMS port!",
    label: "Feature",
    status: "todo",
    priority: "medium",
  },
  {
    id: "TASK-5506",
    title: "Parsing the pixel won't do anything, we need to hack the wireless JPEGS protocol!",
    label: "Feature",
    status: "done",
    priority: "low",
  },
  {
    id: "TASK-7557",
    title: "We need to program the online SSL card!",
    label: "Bug",
    status: "in progress",
    priority: "high",
  },
  {
    id: "TASK-4098",
    title: "Try to override the SAS application, maybe it will parse the virtual RSS driver!",
    label: "Feature",
    status: "todo",
    priority: "high",
  },
  {
    id: "TASK-5620",
    title: "I'll navigate the virtual SQL port, that should connect the JSON interface!",
    label: "Bug",
    status: "backlog",
    priority: "medium",
  },
  {
    id: "TASK-4782",
    title: "We need to compress the back-end HDD bus!",
    label: "Documentation",
    status: "done",
    priority: "high",
  },
  {
    id: "TASK-2532",
    title: "If we input the card, we can get to the SMS array through the wireless SAS transmitter!",
    label: "Bug",
    status: "todo",
    priority: "low",
  },
  {
    id: "TASK-1132",
    title: "I'll bypass the primary SSL firewall, that should index the virtual SMS port!",
    label: "Feature",
    status: "done",
    priority: "medium",
  },
  {
    id: "TASK-9312",
    title: "We need to navigate the multi-byte RSS system!",
    label: "Bug",
    status: "canceled",
    priority: "high",
  },
  {
    id: "TASK-5765",
    title: "Try to calculate the PNG card, maybe it will transmit the back-end SSL matrix!",
    label: "Documentation",
    status: "in progress",
    priority: "low",
  },
  {
    id: "TASK-4928",
    title: "The SQL interface is down, navigate the optical firewall so we can back up the1080p monitor!",
    label: "Bug",
    status: "done",
    priority: "medium",
  },
  {
    id: "TASK-2068",
    title: "I'll override the multi-byte HTTP matrix, that should index the open-source SQL driver!",
    label: "Feature",
    status: "backlog",
    priority: "medium",
  },
  {
    id: "TASK-9477",
    title: "We need to parse the multi-byte EXE bus!",
    label: "Feature",
    status: "todo",
    priority: "high",
  },
  {
    id: "TASK-3148",
    title: "If we quantify the sensor, we can get to the HDD interface through the wireless SMS monitor!",
    label: "Feature",
    status: "done",
    priority: "medium",
  },
  {
    id: "TASK-8803",
    title: "Try to reboot the ADP protocol, maybe it will generate the virtual SQL transmitter!",
    label: "Bug",
    status: "canceled",
    priority: "low",
  },
  {
    id: "TASK-7853",
    title: "Compressing the capacitor won't do anything, we need to bypass the back-end HDD protocol!",
    label: "Bug",
    status: "backlog",
    priority: "low",
  },
  {
    id: "TASK-1793",
    title: "If we compress the firewall, we can get to the SSL port through the digital HDD pixel!",
    label: "Feature",
    status: "todo",
    priority: "medium",
  },
  {
    id: "TASK-9521",
    title: "We need to generate the back-end SMS sensor!",
    label: "Documentation",
    status: "canceled",
    priority: "high",
  },
  {
    id: "TASK-2761",
    title: "I'll hack the haptic SQL transmitter, that should navigate the digital JSON bus!",
    label: "Documentation",
    status: "in progress",
    priority: "high",
  },
  {
    id: "TASK-3510",
    title: "Try to back up the SMS matrix, maybe it will override the neural RSS pixel!",
    label: "Bug",
    status: "backlog",
    priority: "low",
  },
  {
    id: "TASK-7086",
    title: "We need to index the wireless API capacitor!",
    label: "Feature",
    status: "todo",
    priority: "medium",
  },
];
