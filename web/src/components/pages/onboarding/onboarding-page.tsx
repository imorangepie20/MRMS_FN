"use client";

import { useState } from "react";
import { Check, ArrowRight, ArrowLeft, User, Building, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// ─── Types ───────────────────────────────────────────────────────────────────

type StepId = 1 | 2 | 3 | 4;

const STEPS: { id: StepId; label: string }[] = [
  { id: 1, label: "Welcome" },
  { id: 2, label: "Your Profile" },
  { id: 3, label: "Preferences" },
  { id: 4, label: "Done" },
];

// ─── Stepper ─────────────────────────────────────────────────────────────────

function Stepper({ current }: { current: StepId }) {
  return (
    <div className="space-y-3">
      <Progress value={((current - 1) / (STEPS.length - 1)) * 100} />
      <div className="flex justify-between">
        {STEPS.map(({ id, label }) => {
          const done = id < current;
          const active = id === current;
          return (
            <div key={id} className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted text-muted-foreground"
                )}
              >
                {done ? <Check className="size-3.5" /> : id}
              </div>
              <span
                className={cn(
                  "hidden text-xs sm:block",
                  active ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 1: Welcome ─────────────────────────────────────────────────────────

function StepWelcome() {
  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
        <User className="size-9 text-primary" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Welcome to the platform</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          We&apos;ll walk you through a quick setup so you can get the most out of
          your workspace. It only takes a minute.
        </p>
      </div>
      <div className="grid w-full max-w-sm grid-cols-3 gap-3 text-left">
        {[
          { icon: User, label: "Set up your profile" },
          { icon: Bell, label: "Choose notifications" },
          { icon: Building, label: "Pick your plan" },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-2 rounded-lg border bg-muted/40 p-3 text-center"
          >
            <Icon className="size-5 text-primary" />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: Your Profile ────────────────────────────────────────────────────

interface ProfileState {
  name: string;
  company: string;
  role: string;
  avatar: string;
}

const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

function StepProfile({
  profile,
  onChange,
}: {
  profile: ProfileState;
  onChange: (p: ProfileState) => void;
}) {
  const initials = profile.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3">
        <Avatar size="lg" className={cn("size-16", profile.avatar || AVATAR_COLORS[0])}>
          <AvatarFallback className="text-lg text-white">
            {initials || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex gap-1.5">
          {AVATAR_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange({ ...profile, avatar: color })}
              className={cn(
                "size-5 rounded-full border-2 transition-all",
                color,
                profile.avatar === color
                  ? "border-foreground scale-110"
                  : "border-transparent"
              )}
              aria-label={`Select ${color} avatar`}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="onboarding-name">Full name</Label>
          <Input
            id="onboarding-name"
            placeholder="Sofia Davis"
            value={profile.name}
            onChange={(e) => onChange({ ...profile, name: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="onboarding-company">Company</Label>
          <Input
            id="onboarding-company"
            placeholder="Acme Inc."
            value={profile.company}
            onChange={(e) => onChange({ ...profile, company: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="onboarding-role">Role</Label>
          <Select
            value={profile.role}
            onValueChange={(v) => v != null && onChange({ ...profile, role: v })}
          >
            <SelectTrigger id="onboarding-role" className="w-full">
              <SelectValue placeholder="Select your role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="engineer">Engineer</SelectItem>
              <SelectItem value="designer">Designer</SelectItem>
              <SelectItem value="product">Product Manager</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Preferences ─────────────────────────────────────────────────────

interface PrefsState {
  emailDigest: boolean;
  productUpdates: boolean;
  securityAlerts: boolean;
  plan: string;
}

function StepPreferences({
  prefs,
  onChange,
}: {
  prefs: PrefsState;
  onChange: (p: PrefsState) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-sm font-medium">Notifications</p>
        {(
          [
            { key: "emailDigest", label: "Weekly email digest", desc: "Get a summary of activity every Monday" },
            { key: "productUpdates", label: "Product updates", desc: "New features and improvements" },
            { key: "securityAlerts", label: "Security alerts", desc: "Immediately notify on suspicious activity" },
          ] as const
        ).map(({ key, label, desc }) => (
          <div key={key} className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              id={`pref-${key}`}
              checked={prefs[key]}
              onCheckedChange={(v) => onChange({ ...prefs, [key]: !!v })}
            />
            <div className="grid gap-0.5">
              <Label htmlFor={`pref-${key}`} className="cursor-pointer font-medium">
                {label}
              </Label>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="onboarding-plan">Plan</Label>
        <Select
          value={prefs.plan}
          onValueChange={(v) => v != null && onChange({ ...prefs, plan: v })}
        >
          <SelectTrigger id="onboarding-plan" className="w-full">
            <SelectValue placeholder="Choose a plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="free">Free — up to 3 projects</SelectItem>
            <SelectItem value="pro">Pro — $12/mo, unlimited projects</SelectItem>
            <SelectItem value="team">Team — $49/mo, collaboration tools</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// ─── Step 4: Done ─────────────────────────────────────────────────────────────

function StepDone() {
  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
        <Check className="size-9 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">You&apos;re all set!</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your workspace is ready. You can always update your profile and
          notification preferences in Settings.
        </p>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function OnboardingPage() {
  const [step, setStep] = useState<StepId>(1);
  const [profile, setProfile] = useState<ProfileState>({
    name: "",
    company: "",
    role: "",
    avatar: AVATAR_COLORS[0],
  });
  const [prefs, setPrefs] = useState<PrefsState>({
    emailDigest: true,
    productUpdates: false,
    securityAlerts: true,
    plan: "free",
  });

  const isLast = step === 4;
  const isFirst = step === 1;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="pb-2">
          <CardTitle>Get started</CardTitle>
          <CardDescription>Step {step} of {STEPS.length}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <Stepper current={step} />

          {step === 1 && <StepWelcome />}
          {step === 2 && (
            <StepProfile profile={profile} onChange={setProfile} />
          )}
          {step === 3 && (
            <StepPreferences prefs={prefs} onChange={setPrefs} />
          )}
          {step === 4 && <StepDone />}
        </CardContent>

        <CardFooter className="flex justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => setStep((s) => (s - 1) as StepId)}
            disabled={isFirst}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          {isLast ? (
            <Button onClick={() => (window.location.href = "/dashboard")}>
              Go to Dashboard
            </Button>
          ) : (
            <Button onClick={() => setStep((s) => (s + 1) as StepId)}>
              {step === 3 ? "Finish" : "Continue"}
              <ArrowRight className="size-4" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
