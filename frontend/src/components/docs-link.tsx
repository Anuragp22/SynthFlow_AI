import Link from "next/link";
import { BookOpen } from "lucide-react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

/**
 * Entry point into the architecture walkthrough.
 *
 * Rendered on the auth screens and in the app header. `/docs` is deliberately
 * public — it describes the system, touches no user data, and is the one page
 * that should be reachable before signing in.
 */
export function DocsLink({
  className,
  variant = "outline",
}: {
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  return (
    <Button asChild variant={variant} size="sm" className={cn(className)}>
      <Link href="/docs">
        <BookOpen />
        Documentation
      </Link>
    </Button>
  );
}
