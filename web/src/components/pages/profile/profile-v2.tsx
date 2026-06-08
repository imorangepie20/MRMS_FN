import {
  MapPin,
  Mail,
  Link2,
  Calendar,
  MoreHorizontal,
  Phone,
  Users,
  MessageSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ProfileV2Tabs } from "./profile-v2-tabs";
import { profile, skillTags, connections } from "./data";

// ─── Sidebar profile card ─────────────────────────────────────────────────

function ProfileSidebarCard() {
  return (
    <div className="flex flex-col gap-4">
      {/* Identity card */}
      <Card className="overflow-visible">
        {/* Gradient stripe header */}
        <div className="h-20 bg-gradient-to-r from-rose-400 via-fuchsia-500 to-violet-600 rounded-t-xl" />
        <CardContent className="-mt-10 flex flex-col items-center text-center gap-3 pb-5">
          <div className="ring-4 ring-background rounded-full">
            <Avatar className="size-20">
              <AvatarFallback
                className={`bg-gradient-to-br ${profile.avatarColor} text-white text-xl font-bold`}
              >
                {profile.avatar}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-lg font-semibold">{profile.name}</h2>
            <p className="text-sm text-muted-foreground">{profile.headline}</p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 w-full">
            <Button className="flex-1" size="sm">
              <MessageSquare className="size-3.5" />
              Message
            </Button>
            <Button variant="outline" size="sm" className="flex-1">
              <Users className="size-3.5" />
              Follow
            </Button>
            <Button variant="outline" size="icon-sm">
              <MoreHorizontal className="size-4" />
              <span className="sr-only">More</span>
            </Button>
          </div>

          <Separator />

          {/* Stats row */}
          <div className="grid grid-cols-3 w-full">
            {[
              { label: "Posts", value: profile.posts },
              { label: "Followers", value: profile.followers.toLocaleString() },
              { label: "Following", value: profile.following },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-0.5">
                <span className="text-base font-bold tabular-nums">{s.value}</span>
                <span className="text-[10px] text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contact info */}
      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2.5">
          {[
            { icon: Mail, text: profile.email },
            { icon: Phone, text: profile.phone },
            { icon: MapPin, text: profile.location },
            { icon: Link2, text: profile.website },
            { icon: Calendar, text: `Joined ${profile.joined}` },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2.5 text-xs text-muted-foreground">
              <Icon className="size-3.5 shrink-0" />
              <span className="truncate">{text}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Skills tags */}
      <Card>
        <CardHeader>
          <CardTitle>Skills</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {skillTags.map((skill) => (
              <Badge key={skill} variant="secondary" className="text-[10px] h-4 px-1.5">
                {skill}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top connections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Connections</span>
            <span className="text-xs font-normal text-muted-foreground">
              {connections.length} total
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {connections.slice(0, 5).map((conn) => (
            <div key={conn.id} className="flex items-center gap-2.5">
              <Avatar className="size-7 shrink-0">
                <AvatarFallback
                  className={`${conn.color} text-white text-[10px] font-semibold`}
                >
                  {conn.initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-medium">{conn.name}</span>
                <span className="truncate text-[10px] text-muted-foreground">
                  {conn.headline}
                </span>
              </div>
            </div>
          ))}
          {connections.length > 5 && (
            <Button variant="ghost" size="xs" className="w-full text-muted-foreground">
              View all {connections.length} connections
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Profile V2 ────────────────────────────────────────────────────────────

export function ProfileV2() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
      {/* Left sidebar */}
      <div className="flex flex-col gap-4">
        <ProfileSidebarCard />
      </div>

      {/* Right main column */}
      <div>
        {/* Page heading */}
        <div className="mb-5">
          <h1 className="font-heading text-xl font-semibold">{profile.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {profile.headline} &middot; {profile.location}
          </p>
        </div>

        <ProfileV2Tabs />
      </div>
    </div>
  );
}
