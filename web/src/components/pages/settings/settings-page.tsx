"use client";

import { useState } from "react";
import {
  User,
  Bell,
  CreditCard,
  Palette,
  Globe,
  Upload,
  AlertTriangle,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── Field Row helper ────────────────────────────────────────────────────────

function FieldRow({
  label,
  id,
  children,
  description,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

// ─── Toggle Row ──────────────────────────────────────────────────────────────

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id} className="cursor-pointer font-medium">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

// ─── Profile Tab ─────────────────────────────────────────────────────────────

function ProfileTab() {
  const [name, setName] = useState("Alex Johnson");
  const [username, setUsername] = useState("alexjohnson");
  const [email, setEmail] = useState("alex@example.com");
  const [bio, setBio] = useState(
    "Full-stack developer and open-source enthusiast. Building things that matter."
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          Manage your public profile information.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Avatar upload row */}
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            <AvatarFallback className="bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-xl font-bold">
              AJ
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1.5">
            <Button variant="outline" size="sm" className="w-fit gap-1.5">
              <Upload className="size-3.5" />
              Upload photo
            </Button>
            <p className="text-xs text-muted-foreground">
              JPG, GIF or PNG. Max 2 MB.
            </p>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldRow label="Full name" id="name">
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
          </FieldRow>

          <FieldRow label="Username" id="username">
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
            />
          </FieldRow>
        </div>

        <FieldRow
          label="Email"
          id="email"
          description="This is the email used for notifications and sign-in."
        >
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </FieldRow>

        <FieldRow
          label="Bio"
          id="bio"
          description="Brief description for your profile. Max 160 characters."
        >
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself"
            className="resize-none"
            rows={3}
          />
          <p className="text-xs text-muted-foreground text-right">
            {bio.length}/160
          </p>
        </FieldRow>
      </CardContent>
      <CardFooter className="justify-end">
        <Button size="sm">Save changes</Button>
      </CardFooter>
    </Card>
  );
}

// ─── Account Tab ─────────────────────────────────────────────────────────────

function AccountTab() {
  const [twoFactor, setTwoFactor] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Account Preferences</CardTitle>
          <CardDescription>
            Manage language, timezone and regional settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FieldRow label="Language" id="language">
            <Select defaultValue="en">
              <SelectTrigger id="language" className="w-full">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English (US)</SelectItem>
                <SelectItem value="en-gb">English (UK)</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="ja">日本語</SelectItem>
                <SelectItem value="zh">中文 (简体)</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow label="Timezone" id="timezone">
            <Select defaultValue="utc-8">
              <SelectTrigger id="timezone" className="w-full">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="utc-12">UTC−12:00</SelectItem>
                <SelectItem value="utc-8">UTC−08:00 (PT)</SelectItem>
                <SelectItem value="utc-5">UTC−05:00 (ET)</SelectItem>
                <SelectItem value="utc">UTC+00:00 (GMT)</SelectItem>
                <SelectItem value="utc+1">UTC+01:00 (CET)</SelectItem>
                <SelectItem value="utc+5.5">UTC+05:30 (IST)</SelectItem>
                <SelectItem value="utc+8">UTC+08:00 (CST)</SelectItem>
                <SelectItem value="utc+9">UTC+09:00 (JST)</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
        </CardContent>
        <CardFooter className="justify-end">
          <Button size="sm">Save changes</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>
            Manage your account security settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleRow
            id="two-factor"
            label="Two-factor authentication"
            description="Add an extra layer of security by requiring a code in addition to your password."
            checked={twoFactor}
            onCheckedChange={setTwoFactor}
          />
          {twoFactor && (
            <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground flex items-start gap-2">
              <Check className="size-4 shrink-0 text-primary mt-0.5" />
              Two-factor authentication is enabled on your account.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="size-4" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Permanent actions that cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div>
              <p className="text-sm font-medium">Delete account</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permanently delete your account and all associated data. This
                action cannot be undone.
              </p>
            </div>
            <Button variant="destructive" size="sm" className="shrink-0">
              Delete account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Appearance Tab ──────────────────────────────────────────────────────────

type Theme = "light" | "dark" | "system";

const themeOptions: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "☀️" },
  { value: "dark", label: "Dark", icon: "🌙" },
  { value: "system", label: "System", icon: "💻" },
];

const accentColors = [
  { label: "Slate", value: "#64748b" },
  { label: "Violet", value: "#7c3aed" },
  { label: "Blue", value: "#2563eb" },
  { label: "Emerald", value: "#059669" },
  { label: "Amber", value: "#d97706" },
  { label: "Rose", value: "#e11d48" },
];

function AppearanceTab() {
  const [theme, setTheme] = useState<Theme>("system");
  const [accent, setAccent] = useState("#7c3aed");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Customise how the dashboard looks and feels.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* Theme */}
        <div className="flex flex-col gap-2">
          <Label>Theme</Label>
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  theme === opt.value
                    ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/30"
                    : "border-border bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <span className="text-2xl">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Font size */}
        <FieldRow label="Font size" id="font-size">
          <Select defaultValue="default">
            <SelectTrigger id="font-size" className="w-full sm:w-48">
              <SelectValue placeholder="Select font size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sm">Small (13px)</SelectItem>
              <SelectItem value="default">Default (14px)</SelectItem>
              <SelectItem value="md">Medium (15px)</SelectItem>
              <SelectItem value="lg">Large (16px)</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>

        <Separator />

        {/* Accent color */}
        <div className="flex flex-col gap-2">
          <Label>Accent color</Label>
          <div className="flex flex-wrap gap-2">
            {accentColors.map((color) => (
              <button
                key={color.value}
                type="button"
                title={color.label}
                onClick={() => setAccent(color.value)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full outline-none transition-transform focus-visible:ring-3 focus-visible:ring-ring/50 hover:scale-110",
                  accent === color.value && "ring-2 ring-offset-2 ring-offset-background scale-110"
                )}
                style={{
                  backgroundColor: color.value,
                  ...(accent === color.value ? { ringColor: color.value } : {}),
                }}
              >
                {accent === color.value && (
                  <Check className="size-3.5 text-white" />
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Changes will take effect after saving.
          </p>
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button size="sm">Save changes</Button>
      </CardFooter>
    </Card>
  );
}

// ─── Notifications Tab ───────────────────────────────────────────────────────

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

const defaultNotifications: NotificationSetting[] = [
  {
    id: "email",
    label: "Email notifications",
    description: "Receive email updates about your account activity.",
    enabled: true,
  },
  {
    id: "push",
    label: "Push notifications",
    description: "Get push notifications on your desktop and mobile devices.",
    enabled: true,
  },
  {
    id: "marketing",
    label: "Marketing emails",
    description: "Receive tips, product updates, and promotional offers.",
    enabled: false,
  },
  {
    id: "security",
    label: "Security alerts",
    description:
      "Get notified about new sign-ins, password changes, and suspicious activity.",
    enabled: true,
  },
  {
    id: "weekly",
    label: "Weekly digest",
    description:
      "A weekly summary of your activity and team updates.",
    enabled: false,
  },
];

function NotificationsTab() {
  const [settings, setSettings] = useState(defaultNotifications);

  function toggle(id: string) {
    setSettings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Control how and when you receive notifications.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col divide-y divide-border">
          {settings.map((setting) => (
            <ToggleRow
              key={setting.id}
              id={setting.id}
              label={setting.label}
              description={setting.description}
              checked={setting.enabled}
              onCheckedChange={() => toggle(setting.id)}
            />
          ))}
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button size="sm">Save changes</Button>
      </CardFooter>
    </Card>
  );
}

// ─── Billing Tab ─────────────────────────────────────────────────────────────

const billingHistory = [
  { date: "Jun 1, 2026", description: "Pro Plan — Monthly", amount: "$29.00", status: "Paid" },
  { date: "May 1, 2026", description: "Pro Plan — Monthly", amount: "$29.00", status: "Paid" },
  { date: "Apr 1, 2026", description: "Pro Plan — Monthly", amount: "$29.00", status: "Paid" },
  { date: "Mar 1, 2026", description: "Pro Plan — Monthly", amount: "$29.00", status: "Paid" },
];

function BillingTab() {
  return (
    <div className="flex flex-col gap-4">
      {/* Current plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>
            You are currently on the Pro plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-xl bg-muted/50 p-4 ring-1 ring-foreground/10">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">Pro Plan</span>
                <Badge variant="secondary">Active</Badge>
              </div>
              <span className="text-muted-foreground text-sm">
                $29.00 / month · Renews Jul 1, 2026
              </span>
            </div>
            <Button variant="outline" size="sm">
              Manage plan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payment method */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
          <CardDescription>Your default payment method.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <CreditCard className="size-5 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Visa ending in 4242</span>
                <span className="text-xs text-muted-foreground">
                  Expires 12 / 2027
                </span>
              </div>
            </div>
            <Button variant="ghost" size="sm">
              Update
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Billing history */}
      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>Your recent invoices and payments.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="pr-6">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {billingHistory.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="pl-6 text-muted-foreground">
                    {row.date}
                  </TableCell>
                  <TableCell>{row.description}</TableCell>
                  <TableCell className="tabular-nums">{row.amount}</TableCell>
                  <TableCell className="pr-6">
                    <Badge
                      variant="secondary"
                      className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-transparent text-[10px]"
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────

const tabs = [
  { value: "profile", label: "Profile", icon: User },
  { value: "account", label: "Account", icon: Globe },
  { value: "appearance", label: "Appearance", icon: Palette },
  { value: "notifications", label: "Notifications", icon: Bell },
  { value: "billing", label: "Billing", icon: CreditCard },
] as const;

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your account settings and preferences.
        </p>
      </div>

      <Tabs defaultValue="profile" orientation="horizontal">
        <TabsList
          variant="line"
          className="border-b border-border w-full justify-start rounded-none px-0 h-auto gap-0 overflow-x-auto"
        >
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="gap-1.5 px-3 py-2 shrink-0"
            >
              <tab.icon className="size-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="profile">
            <ProfileTab />
          </TabsContent>
          <TabsContent value="account">
            <AccountTab />
          </TabsContent>
          <TabsContent value="appearance">
            <AppearanceTab />
          </TabsContent>
          <TabsContent value="notifications">
            <NotificationsTab />
          </TabsContent>
          <TabsContent value="billing">
            <BillingTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
