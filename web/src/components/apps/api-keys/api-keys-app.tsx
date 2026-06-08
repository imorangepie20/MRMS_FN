"use client";

import * as React from "react";
import { Copy, RefreshCw, Trash2, Plus, MoreHorizontal, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "@/components/dashboards/shared/kpi-card";
import { INITIAL_API_KEYS, STAT_CARDS, type ApiKey } from "./data";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const QUOTA_USED = 215;
const QUOTA_TOTAL = 2000;
const QUOTA_PERCENT = Math.round((QUOTA_USED / QUOTA_TOTAL) * 100);

const KEY_CHARS = "abcdef0123456789";

function buildKeySegment(seed: number, length: number): string {
  let result = "";
  let s = seed;
  for (let i = 0; i < length; i++) {
    result += KEY_CHARS[s % KEY_CHARS.length];
    s = (s * 31 + 17) % 65536;
  }
  return result;
}

function statusVariant(status: ApiKey["status"]) {
  if (status === "active") return "active";
  if (status === "expired") return "expired";
  return "inactive";
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ApiKey["status"] }) {
  if (status === "active") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-transparent capitalize">
        {status}
      </Badge>
    );
  }
  if (status === "expired") {
    return (
      <Badge variant="destructive" className="capitalize">
        {status}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="capitalize">
      {status}
    </Badge>
  );
}

// ─── Copy Key Button ──────────────────────────────────────────────────────────

function CopyKeyButton({ fullKey }: { fullKey: string }) {
  const [copied, setCopied] = React.useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(fullKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleCopy}
      title="Copy key"
      className="ml-1.5 shrink-0"
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-500" />
      ) : (
        <Copy className="size-3.5" />
      )}
      <span className="sr-only">{copied ? "Copied" : "Copy key"}</span>
    </Button>
  );
}

// ─── Create Key Dialog ────────────────────────────────────────────────────────

type CreateKeyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, maskedKey: string, fullKey: string) => void;
  nextIndex: number;
};

function CreateKeyDialog({ open, onOpenChange, onCreate, nextIndex }: CreateKeyDialogProps) {
  const [name, setName] = React.useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const prefix = buildKeySegment(nextIndex * 7 + 3, 8);
    const suffix = buildKeySegment(nextIndex * 13 + 9, 4);
    const fullKey = `${prefix}-generated-key-${suffix}`;
    const maskedKey = `${prefix}••••${suffix}`;
    onCreate(trimmed, maskedKey, fullKey);
    setName("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="key-name">Name</Label>
            <Input
              id="key-name"
              placeholder="e.g. Production Key"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Key</Label>
            <Input
              disabled
              value={name.trim() ? `${buildKeySegment(nextIndex * 7 + 3, 8)}••••${buildKeySegment(nextIndex * 13 + 9, 4)}` : ""}
              placeholder="Auto-generated on create"
              readOnly
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={!name.trim()}>
              Create Key
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export function ApiKeysApp() {
  const [keys, setKeys] = React.useState<ApiKey[]>(INITIAL_API_KEYS);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [keyCounter, setKeyCounter] = React.useState(100);

  function handleCreate(name: string, maskedKey: string, fullKey: string) {
    const newKey: ApiKey = {
      id: `key-new-${keyCounter}`,
      name,
      maskedKey,
      fullKey,
      created: "7 Jun 2026",
      updated: "7 Jun 2026",
      status: "active",
    };
    setKeys((prev) => [newKey, ...prev]);
    setKeyCounter((c) => c + 1);
  }

  function handleRevoke(id: string) {
    setKeys((prev) => prev.filter((k) => k.id !== id));
  }

  function handleRegenerate(id: string) {
    setKeys((prev) =>
      prev.map((k) => {
        if (k.id !== id) return k;
        const seed = keyCounter;
        const prefix = buildKeySegment(seed * 5 + 11, 8);
        const suffix = buildKeySegment(seed * 17 + 3, 4);
        return {
          ...k,
          maskedKey: `${prefix}••••${suffix}`,
          fullKey: `${prefix}-regen-key-${suffix}`,
          updated: "7 Jun 2026",
          status: "active",
        };
      })
    );
    setKeyCounter((c) => c + 1);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-heading text-2xl font-semibold">API Keys Management</h1>
          <Badge variant="secondary">Developer Plan</Badge>
          <Button variant="outline" size="sm">
            Upgrade Plan
          </Button>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus />
          Create API Key
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STAT_CARDS.map((card) => (
          <KpiCard
            key={card.label}
            label={card.label}
            value={card.value}
            delta={card.delta}
            trend={card.trend}
          />
        ))}
      </div>

      {/* Quota */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              You used{" "}
              <span className="font-medium text-foreground">{QUOTA_USED}</span>{" "}
              of{" "}
              <span className="font-medium text-foreground">{QUOTA_TOTAL}</span>{" "}
              of your API
            </p>
            <span className="text-xs text-muted-foreground tabular-nums">
              {QUOTA_PERCENT}%
            </span>
          </div>
          <Progress value={QUOTA_PERCENT} className="mt-3" />
        </CardContent>
      </Card>

      {/* API Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center font-mono text-xs">
                      <span>{key.maskedKey}</span>
                      <CopyKeyButton fullKey={key.fullKey} />
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{key.created}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{key.updated}</TableCell>
                  <TableCell>
                    <StatusBadge status={key.status} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" title="Actions" />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Open actions</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            navigator.clipboard.writeText(key.fullKey)
                          }
                        >
                          <Copy />
                          Copy
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRegenerate(key.id)}>
                          <RefreshCw />
                          Regenerate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => handleRevoke(key.id)}
                        >
                          <Trash2 />
                          Revoke
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Key Dialog */}
      <CreateKeyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreate={handleCreate}
        nextIndex={keyCounter}
      />
    </div>
  );
}
