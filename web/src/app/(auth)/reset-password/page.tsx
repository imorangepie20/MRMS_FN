import Link from "next/link"

import { AuthCard } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Reset password"
      footer={
        <span className="text-muted-foreground">
          Back to{" "}
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline font-medium">
            login
          </Link>
        </span>
      }
    >
      <form action="#" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" className="w-full mt-1">
          Reset password
        </Button>
      </form>
    </AuthCard>
  )
}
