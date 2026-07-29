/**
 * Code excerpts shown in the architecture walkthrough.
 *
 * Every snippet is copied from this repository and annotated with the file and
 * line it came from. They live here as plain strings so the diagram components
 * stay presentational and the excerpts can be checked against source.
 */
export const CODE = {
  reserve: `// functions.ts:152 — the whole credit invariant, in one statement
const { count } = await tx.user.updateMany({
  where: { id: userId, credits: { gt: 0 } },   // predicate ...
  data:  { credits: { decrement: 1 } },        // ... and mutation, one round trip
});
if (count === 0) return false;                 // lost the race / no balance

await tx.song.update({
  where: { id: songId },
  data:  { creditReserved: true },             // commits WITH the decrement
});`,

  naive: `// git show 7d6ff6d^ — what this replaced
const { userId, credits } = await step.run("check-credits", async () => {
  /* reads song.user.credits */
});

if (credits > 0) {                       // (1) decided from a MEMOISED read
  const response = await step.fetch(endpoint, ...);   // (2) minutes elapse
  await step.run("update-song-result", ...);

  return await step.run("deduct-credits", async () => {
    if (!response.ok) return;
    return await db.user.update({        // (3) no predicate -> can go negative
      where: { id: userId },
      data: { credits: { decrement: 1 } },
    });
  });
}`,

  refund: `// functions.ts:13 — idempotent by construction
return await db.$transaction(async (tx) => {
  const song = await tx.song.findUnique({
    where: { id: songId },
    select: { userId: true, creditReserved: true, creditRefunded: true },
  });

  if (!song || !song.creditReserved || song.creditRefunded) return false;

  await tx.user.update({ where: { id: song.userId },
                         data: { credits: { increment: 1 } } });
  await tx.song.update({ where: { id: songId },
                         data: { creditRefunded: true } });   // same txn
  return true;
});`,

  onFailure: `// functions.ts:41 — the terminal handler
onFailure: async ({ event }) => {
  const { songId } = (event?.data?.event?.data ?? {}) as { songId?: string };
  if (!songId) return;

  await refundCreditIfReserved(songId);

  await db.song.updateMany({                    // updateMany, not update:
    where: { id: songId, status: { not: "processed" } },   // a no-match must
    data:  { status: "failed" },                //  not throw inside onFailure
  });
},`,

  persist: `// functions.ts:223 — one statement, so there is no partial state
await db.song.update({
  where: { id: songId },
  data: {
    s3Key:          responseData.s3_key,
    thumbnailS3Key: responseData.cover_image_s3_key,
    status:         "processed",
    categories: responseData.categories.length > 0
      ? { connectOrCreate: responseData.categories.map((name) => ({
            where: { name }, create: { name } })) }
      : undefined,
  },
});`,

  container: `# main.py:53 — the unit of scaling is the CONTAINER, not the request
@app.cls(
    image=image,
    gpu="L40S",
    volumes={"/models": model_volume, "/.cache/huggingface": hf_volume},
    secrets=[music_gen_secrets],
    scaledown_window=10,      # idle 10s -> torn down
)
class MusicGenServer:
    @modal.enter()            # once per CONTAINER
    def load_model(self):
        self.music_model = ACEStepPipeline(checkpoint_dir="/models", ...)
        self.llm_model   = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2-7B-Instruct", ...)
        self.image_pipe  = AutoPipelineForText2Image.from_pretrained("stabilityai/sdxl-turbo", ...)`,

  dualWrite: `# main.py:194 — S3 writes happen INSIDE the container...
audio_s3_key = f"{uuid.uuid4()}.wav"
s3_client.upload_file(output_path, bucket_name, audio_s3_key)   # (A) committed
...
image_s3_key = f"{uuid.uuid4()}.png"
s3_client.upload_file(image_output_path, bucket_name, image_s3_key)
categories = self.generate_categories(description_for_categorization)
return GenerateMusicResponseS3(...)

// functions.ts:223 — ...and Postgres is written back in the ORCHESTRATOR
await db.song.update({ ... s3Key: responseData.s3_key ... })    # (B) may never run`,

  concurrency: `// functions.ts:37 — a fairness lever, not the correctness mechanism
concurrency: {
  limit: 1,
  key: "event.data.userId",
},`,

  presign: `// lib/s3.ts — a capability minter. Deliberately does NO authorisation.
import "server-only";

export async function getPresignedUrl(key: string) {
  const command = new GetObjectCommand({ Bucket: env.S3_BUCKET_NAME, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

// actions/generation.ts:70 — the CALLER establishes the right to that key
const song = await db.song.findUniqueOrThrow({
  where: {
    id: songId,
    OR: [{ userId: session.user.id }, { published: true }],
    s3Key: { not: null },
  },
  select: { s3Key: true },
});
return await getPresignedUrl(song.s3Key!);`,

  webhook: `// lib/auth.ts:44 — the only trusted path for credits IN
webhooks({
  secret: env.POLAR_WEBHOOK_SECRET,          // signature = the trust anchor
  onOrderPaid: async (order) => {
    const externalCustomerId = order.data.customer.externalId;
    if (!externalCustomerId) throw new Error("No external customer id found.");

    const creditsToAdd = creditsForProduct(order.data.productId);
    if (creditsToAdd === 0) return;          // unknown product -> grant nothing

    await db.user.update({                   // NOT keyed by order id
      where: { id: externalCustomerId },
      data:  { credits: { increment: creditsToAdd } },
    });
  },
}),`,

  statusSwitch: `// track-list.tsx:117 — note what is NOT here
switch (track.status) {
  case "failed":                 return /* red card */;
  case "no credits":             return /* upsell card */;
  case "queued":
  case "processing":             return /* spinner */;
  default:                       return /* PLAYABLE ROW */;
}
// "processed" has no case. It falls through default -- and so does
// every unrecognised status, including a typo or a future value.`,

  inference: `# main.py:184 — the actual call into ACE-Step
self.music_model(
    prompt=prompt,              # comma-separated tag line
    lyrics=final_lyrics,        # or the literal "[instrumental]"
    audio_duration=audio_duration,
    infer_step=infer_step,
    guidance_scale=guidance_scale,
    save_path=output_path,
    manual_seeds=str(seed),
)`,
} as const;
