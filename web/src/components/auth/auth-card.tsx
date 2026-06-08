import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface AuthCardProps {
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

export function AuthCard({
  title,
  description,
  children,
  footer,
  className,
}: AuthCardProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Brand mark */}
      <div className="flex justify-center">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg select-none">
          A
        </div>
      </div>

      <Card>
        <CardHeader className="text-center pb-0">
          <CardTitle className="text-xl font-semibold">{title}</CardTitle>
          {description && (
            <CardDescription className="mt-1">{description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="pt-4">{children}</CardContent>
        {footer && (
          <CardFooter className="justify-center text-sm">
            {footer}
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
