import {
  MapPin,
  Mail,
  Link2,
  Calendar,
  MoreHorizontal,
  Phone,
  Globe,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ProfileV1Tabs } from "./profile-v1-tabs";
import { profile, skillTags } from "./data";

// ─── Stat Tile ─────────────────────────────────────────────────────────────

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-5 py-2">
      <span className="text-xl font-bold tabular-nums text-foreground">
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── Profile V1 ────────────────────────────────────────────────────────────

export function ProfileV1() {
  return (
    <div className="flex flex-col gap-0">
      {/* Cover Banner */}
      <div className="relative h-40 sm:h-48 rounded-t-xl overflow-hidden bg-gradient-to-br from-violet-500 via-indigo-600 to-blue-700">
        {/* decorative dots */}
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      {/* Profile header card */}
      <div className="rounded-b-xl bg-card ring-1 ring-foreground/10">
        {/* Avatar overlapping banner */}
        <div className="px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-10 sm:-mt-12 pb-4">
            {/* Avatar + identity */}
            <div className="flex items-end gap-4">
              <div className="ring-4 ring-background rounded-full shrink-0">
                <Avatar className="size-20 sm:size-24">
                  <AvatarFallback
                    className={`bg-gradient-to-br ${profile.avatarColor} text-white text-2xl font-bold`}
                  >
                    {profile.avatar}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="mb-1 flex flex-col gap-0.5">
                <h1 className="font-heading text-xl font-semibold leading-tight">
                  {profile.name}
                </h1>
                <p className="text-sm text-muted-foreground">{profile.headline}</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pb-1">
              <Button size="sm">Edit Profile</Button>
              <Button variant="outline" size="sm">
                Message
              </Button>
              <Button variant="outline" size="icon-sm">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">More options</span>
              </Button>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pb-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5 shrink-0" />
              {profile.location}
            </span>
            <span className="flex items-center gap-1">
              <Globe className="size-3.5 shrink-0" />
              {profile.website}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5 shrink-0" />
              Joined {profile.joined}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="border-t border-border flex divide-x divide-border">
          <StatTile label="Posts" value={profile.posts} />
          <StatTile label="Followers" value={profile.followers} />
          <StatTile label="Following" value={profile.following} />
        </div>
      </div>

      {/* Body */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* Left sidebar */}
        <div className="flex flex-col gap-4">
          {/* About card */}
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {profile.bio}
              </p>
            </CardContent>
          </Card>

          {/* Skills card */}
          <Card>
            <CardHeader>
              <CardTitle>Skills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {skillTags.map((skill) => (
                  <Badge key={skill} variant="secondary" className="text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Contact card */}
          <Card>
            <CardHeader>
              <CardTitle>Contact &amp; Info</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5 text-sm">
                <Mail className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-muted-foreground">{profile.email}</span>
              </div>
              <Separator />
              <div className="flex items-center gap-2.5 text-sm">
                <Phone className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{profile.phone}</span>
              </div>
              <Separator />
              <div className="flex items-center gap-2.5 text-sm">
                <MapPin className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{profile.location}</span>
              </div>
              <Separator />
              <div className="flex items-center gap-2.5 text-sm">
                <Link2 className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{profile.website}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right main content */}
        <Card>
          <CardContent className="pt-4">
            <ProfileV1Tabs />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
