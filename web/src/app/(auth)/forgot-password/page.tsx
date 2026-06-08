import Link from "next/link"

import { AuthCard } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot password"
      description="Enter your email and we'll send you a reset link."
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
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="m@example.com"
            autoComplete="email"
          />
        </div>
        <Button type="submit" className="w-full mt-1">
          Send reset link
        </Button>
      </form>
    </AuthCard>
  )
}
