"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { inngest } from "~/inngest/client";
import { auth } from "~/lib/auth";
import { db } from "~/server/db";
import { getPresignedUrl } from "~/lib/s3";

export interface GenerateRequest {
  prompt?: string;
  lyrics?: string;
  fullDescribedSong?: string;
  describedLyrics?: string;
  instrumental?: boolean;
}

export async function generateSong(generateRequest: GenerateRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/auth/sign-in");

  await queueSong(generateRequest, 7.5, session.user.id);

  revalidatePath("/create");
}

/**
 * Create the Song row and enqueue the generation job.
 *
 * Deliberately NOT exported. Every export of a "use server" module is compiled
 * into a public, unauthenticated POST endpoint whose arguments the caller
 * controls — so exporting this would let anyone queue generations against an
 * arbitrary `userId` and drain that account's credits. Keeping it module-local
 * means `generateSong` is the only way in, and `userId` is therefore always the
 * authenticated session's own id.
 *
 * Same class of mistake as the presigner that used to live in this file (commit
 * e858b46); the fix is likewise structural rather than an added check.
 */
async function queueSong(
  generateRequest: GenerateRequest,
  guidanceScale: number,
  userId: string,
) {
  let title = "Untitled";
  if (generateRequest.describedLyrics) title = generateRequest.describedLyrics;
  if (generateRequest.fullDescribedSong)
    title = generateRequest.fullDescribedSong;

  title = title.charAt(0).toUpperCase() + title.slice(1);

  const song = await db.song.create({
    data: {
      userId: userId,
      title: title,
      prompt: generateRequest.prompt,
      lyrics: generateRequest.lyrics,
      describedLyrics: generateRequest.describedLyrics,
      fullDescribedSong: generateRequest.fullDescribedSong,
      instrumental: generateRequest.instrumental,
      guidanceScale: guidanceScale,
      audioDuration: 180,
    },
  });

  await inngest.send({
    name: "generate-song-event",
    data: { songId: song.id, userId: song.userId },
  });
}

export async function getPlayUrl(songId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/auth/sign-in");

  const song = await db.song.findUniqueOrThrow({
    where: {
      id: songId,
      OR: [{ userId: session.user.id }, { published: true }],
      s3Key: {
        not: null,
      },
    },
    select: {
      s3Key: true,
    },
  });

  // Note: listen counting happens in `recordListen` on actual playback, not
  // here. Issuing a play URL is also done for download/share, which should not
  // count as a listen.
  return await getPresignedUrl(song.s3Key!);
}

/**
 * Record a listen when a track actually starts playing. Uses `updateMany` so an
 * unauthorized or non-existent song is a no-op rather than a thrown error.
 */
export async function recordListen(songId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return;

  await db.song.updateMany({
    where: {
      id: songId,
      OR: [{ userId: session.user.id }, { published: true }],
    },
    data: {
      listenCount: {
        increment: 1,
      },
    },
  });
}