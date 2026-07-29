import { DocsShell } from "~/components/docs/docs-shell";

/**
 * Public. The walkthrough reads no user data and no database, so it renders
 * without a session — which is what lets the auth screens link to it.
 */
export default function DocsPage() {
  return <DocsShell />;
}
