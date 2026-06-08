export type ApiKeyStatus = "active" | "inactive" | "expired";

export type ApiKey = {
  id: string;
  name: string;
  maskedKey: string;
  fullKey: string;
  created: string;
  updated: string;
  status: ApiKeyStatus;
};

export const INITIAL_API_KEYS: ApiKey[] = [
  {
    id: "key-1",
    name: "Production API Key",
    maskedKey: "9e6d336a••••af62",
    fullKey: "9e6d336a-prod-full-key-af62",
    created: "10 May 2024",
    updated: "10 May 2025",
    status: "active",
  },
  {
    id: "key-2",
    name: "Development API Key",
    maskedKey: "8a2d834b••••4c24",
    fullKey: "8a2d834b-dev-full-key-4c24",
    created: "15 Apr 2023",
    updated: "15 Apr 2024",
    status: "inactive",
  },
  {
    id: "key-3",
    name: "Development test",
    maskedKey: "4b6f472a••••f5b6",
    fullKey: "4b6f472a-dev-test-full-key-f5b6",
    created: "1 Mar 2023",
    updated: "1 Mar 2024",
    status: "active",
  },
  {
    id: "key-4",
    name: "Production test",
    maskedKey: "d4e3b829••••a42f",
    fullKey: "d4e3b829-prod-test-full-key-a42f",
    created: "12 Dec 2022",
    updated: "12 Dec 2023",
    status: "expired",
  },
  {
    id: "key-5",
    name: "Staging API Key",
    maskedKey: "7c8b945e••••4c5d",
    fullKey: "7c8b945e-staging-full-key-4c5d",
    created: "1 Jan 2024",
    updated: "1 Jan 2025",
    status: "active",
  },
  {
    id: "key-6",
    name: "Test Environment Key",
    maskedKey: "2f5e8d1c••••9e8f",
    fullKey: "2f5e8d1c-test-env-full-key-9e8f",
    created: "15 Mar 2024",
    updated: "15 Mar 2025",
    status: "active",
  },
];

export const STAT_CARDS = [
  {
    label: "Successful conversions",
    value: "24,521",
    delta: "+10.3% from last month",
    trend: "up" as const,
  },
  {
    label: "Failed conversions",
    value: "1,245",
    delta: "-0.3% from last month",
    trend: "down" as const,
  },
  {
    label: "API Calls",
    value: "98,432",
    delta: "+2.3% from last month",
    trend: "up" as const,
  },
];
