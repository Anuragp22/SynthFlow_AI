import { db } from "~/server/db";
import { inngest } from "~/inngest/client";
import { env } from "~/env";

export const generateSong = inngest.createFunction(
  {
    id: "generate-song",
    concurrency: {
      limit: 1,
      key: "event.data.userId",
    },
    onFailure: async ({ event }) => {
      const { songId } = (event?.data?.event?.data ?? {}) as {
        songId?: string;
      };
      if (!songId) return;

      // If the run died after a credit was reserved (status reached
      // "processing") but before it finished, refund so the user is not
      // charged for a generation they never received.
      const song = await db.song.findUnique({
        where: { id: songId },
        select: { status: true, userId: true },
      });

      if (song?.status === "processing") {
        await db.user.update({
          where: { id: song.userId },
          data: { credits: { increment: 1 } },
        });
      }

      await db.song.update({
        where: { id: songId },
        data: { status: "failed" },
      });
    },
  },
  { event: "generate-song-event" },
  async ({ event, step }) => {
    const { songId } = event.data as {
      songId: string;
      userId: string;
    };

    // 1. Resolve the generation request and pick the matching Modal endpoint.
    const { userId, endpoint, body } = await step.run(
      "prepare-request",
      async () => {
        const song = await db.song.findUniqueOrThrow({
          where: { id: songId },
          select: {
            user: { select: { id: true } },
            prompt: true,
            lyrics: true,
            fullDescribedSong: true,
            describedLyrics: true,
            instrumental: true,
            guidanceScale: true,
            inferStep: true,
            audioDuration: true,
            seed: true,
          },
        });

        type RequestBody = {
          guidance_scale?: number;
          infer_step?: number;
          audio_duration?: number;
          seed?: number;
          full_described_song?: string;
          prompt?: string;
          lyrics?: string;
          described_lyrics?: string;
          instrumental?: boolean;
        };

        let endpoint = "";
        let body: RequestBody = {};

        const commonParams = {
          guidance_scale: song.guidanceScale ?? undefined,
          infer_step: song.inferStep ?? undefined,
          audio_duration: song.audioDuration ?? undefined,
          seed: song.seed ?? undefined,
          instrumental: song.instrumental ?? undefined,
        };

        // Description of a song
        if (song.fullDescribedSong) {
          endpoint = env.GENERATE_FROM_DESCRIPTION;
          body = {
            full_described_song: song.fullDescribedSong,
            ...commonParams,
          };
        }
        // Custom mode: lyrics + prompt
        else if (song.lyrics && song.prompt) {
          endpoint = env.GENERATE_WITH_LYRICS;
          body = {
            lyrics: song.lyrics,
            prompt: song.prompt,
            ...commonParams,
          };
        }
        // Custom mode: prompt + described lyrics
        else if (song.describedLyrics && song.prompt) {
          endpoint = env.GENERATE_FROM_DESCRIBED_LYRICS;
          body = {
            described_lyrics: song.describedLyrics,
            prompt: song.prompt,
            ...commonParams,
          };
        }

        if (!endpoint) {
          throw new Error(
            `Song ${songId} has no valid generation input combination`,
          );
        }

        return { userId: song.user.id, endpoint, body };
      },
    );

    // 2. Reserve one credit with an atomic compare-and-decrement: a single
    //    conditional UPDATE that only decrements when the balance is positive,
    //    so it cannot oversell credits regardless of concurrent runs.
    const creditReserved = await step.run("reserve-credit", async () => {
      const { count } = await db.user.updateMany({
        where: { id: userId, credits: { gt: 0 } },
        data: { credits: { decrement: 1 } },
      });
      return count > 0;
    });

    if (!creditReserved) {
      await step.run("set-status-no-credits", async () => {
        return await db.song.update({
          where: { id: songId },
          data: { status: "no credits" },
        });
      });
      return;
    }

    // 3. Run generation. From here the song is "processing"; if the run dies
    //    before finishing, onFailure refunds the reserved credit.
    await step.run("set-status-processing", async () => {
      return await db.song.update({
        where: { id: songId },
        data: { status: "processing" },
      });
    });

    const response = await step.fetch(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        "Modal-Key": env.MODAL_KEY,
        "Modal-Secret": env.MODAL_SECRET,
      },
    });

    // 4a. Generation failed: refund the reserved credit and mark the song.
    if (!response.ok) {
      await step.run("refund-credit", async () => {
        return await db.user.update({
          where: { id: userId },
          data: { credits: { increment: 1 } },
        });
      });

      await step.run("set-status-failed", async () => {
        return await db.song.update({
          where: { id: songId },
          data: { status: "failed" },
        });
      });

      return;
    }

    // 4b. Generation succeeded: persist the audio, cover art, and categories.
    await step.run("update-song-result", async () => {
      const responseData = (await response.json()) as {
        s3_key: string;
        cover_image_s3_key: string;
        categories: string[];
      };

      await db.song.update({
        where: { id: songId },
        data: {
          s3Key: responseData.s3_key,
          thumbnailS3Key: responseData.cover_image_s3_key,
          status: "processed",
        },
      });

      if (responseData.categories.length > 0) {
        await db.song.update({
          where: { id: songId },
          data: {
            categories: {
              connectOrCreate: responseData.categories.map((categoryName) => ({
                where: { name: categoryName },
                create: { name: categoryName },
              })),
            },
          },
        });
      }
    });
  },
);
