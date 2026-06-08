"use client"

import { useRef, useState } from "react"
import Link from "next/link"

import { AuthCard } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const CODE_LENGTH = 6

export default function VerifyPage() {
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""))
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(CODE_LENGTH).fill(null))

  function handleChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1)
    const next = [...code]
    next[index] = digit
    setCode(next)
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH)
    const next = [...code]
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i]
    }
    setCode(next)
    const focusIdx = Math.min(pasted.length, CODE_LENGTH - 1)
    inputRefs.current[focusIdx]?.focus()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
  }

  return (
    <AuthCard
      title="Verify your email"
      description="We sent a 6-digit code to your email."
      footer={
        <span className="text-muted-foreground">
          Back to{" "}
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline font-medium">
            login
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* 6-digit code inputs */}
        <div className="flex items-center justify-center gap-2">
          {code.map((digit, i) => (
            <Input
              key={i}
              ref={(el) => { inputRefs.current[i] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              className={cn(
                "size-10 p-0 text-center text-base font-medium tracking-widest",
              )}
              aria-label={`Digit ${i + 1}`}
            />
          ))}
        </div>

        <Button type="submit" className="w-full">
          Verify
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Didn&apos;t get a code?{" "}
          <button
            type="button"
            className="text-foreground underline-offset-4 hover:underline font-medium"
            onClick={() => {}}
          >
            Resend
          </button>
        </p>
      </form>
    </AuthCard>
  )
}
