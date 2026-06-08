"use client"

import { useState } from "react"
import Link from "next/link"

import { AuthCard } from "@/components/auth/auth-card"
import { SocialButtons } from "@/components/auth/social-buttons"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

export default function RegisterPage() {
  const [agreed, setAgreed] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
  }

  return (
    <AuthCard
      title="Create an account"
      footer={
        <span className="text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline font-medium">
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" type="text" placeholder="John Doe" autoComplete="name" />
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="m@example.com" autoComplete="email" />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" />
        </div>

        {/* Terms */}
        <div className="flex items-start gap-2">
          <Checkbox
            id="terms"
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(!!checked)}
            className="mt-0.5"
          />
          <Label htmlFor="terms" className="font-normal cursor-pointer leading-snug">
            I agree to the{" "}
            <Link href="#" className="underline underline-offset-4 hover:text-foreground">
              Terms
            </Link>{" "}
            &amp;{" "}
            <Link href="#" className="underline underline-offset-4 hover:text-foreground">
              Privacy
            </Link>
          </Label>
        </div>

        <Button type="submit" className="w-full mt-1">
          Create account
        </Button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-1">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground shrink-0">Or continue with</span>
          <Separator className="flex-1" />
        </div>

        <SocialButtons />
      </form>
    </AuthCard>
  )
}
