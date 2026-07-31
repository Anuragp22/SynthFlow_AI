// A Server Component, not a server action. It must NOT carry "use server":
// that directive turns every export of a module into a public POST endpoint,
// which is not what a component wants to be.
import { headers } from "next/headers";
import { auth } from "~/lib/auth";
import { db } from "~/server/db";

export async function Credits() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { credits: true },
  });

  return (
    <>
      <p className="font-semibold">{user.credits}</p>
      <p className="text-muted-foreground">Credits</p>
    </>
  );
}