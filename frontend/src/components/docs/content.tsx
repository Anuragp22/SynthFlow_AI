import type * as React from "react";

import {
  ArchitectureMech,
  BackpressureMech,
  BoundariesMech,
  CapabilityMech,
  ConstraintMech,
  ContractMech,
  CostMech,
  DataModelMech,
  DualWriteMech,
  DurableMech,
  EndpointsMech,
  IdempotentMech,
  LifecycleMech,
  RefactorMech,
  ReserveMech,
  ScaleMech,
  SequenceMech,
  TaxonomyMech,
  ToctouMech,
  WebhookMech,
} from "./mechanisms";

export interface Stage {
  id: string;
  label: string;
  title: string;
  /** One sentence, no jargon. The first thing a newcomer reads. */
  plain: string;
  sources: readonly string[];
  Mech: React.ComponentType;
  argument: readonly string[];
  limits: readonly string[];
  /**
   * Render the mechanism across the full width with no argument column. For
   * stages where the diagram *is* the content and prose beside it would only
   * compete with it.
   */
  full?: boolean;
}

export interface Act {
  id: string;
  numeral: string;
  title: string;
  summary: string;
  stages: readonly Stage[];
}

const ACT_FORCES: readonly Stage[] = [
  {
    id: "architecture",
    label: "Architecture",
    title: "The whole system",
    plain:
      "Four places code runs, three stores, and every file worth opening. Follow the highlighted line to see the order a song is actually made in.",
    sources: [
      "src/actions",
      "api/inngest/functions.ts",
      "backend/main.py",
      "lib/s3.ts",
      "prisma/schema.prisma",
    ],
    Mech: ArchitectureMech,
    // The diagram is the whole stage — no argument column beside it.
    full: true,
    argument: [],
    limits: [],
  },
  {
    id: "constraint",
    label: "Why it is asynchronous",
    title: "One physical fact generates the whole architecture",
    plain:
      "Making a song takes minutes, but a web page has to answer in seconds. Everything else in the design follows from that clash.",
    sources: ["backend/main.py:184", "backend/main.py:53"],
    Mech: ConstraintMech,
    argument: [
      "The system is built around one constraint: **ACE-Step inference takes minutes on a dedicated L40S, and an HTTP request cannot block that long.**",
      "This is a property of diffusion models, not a design preference. Given it, five things follow with no real alternative: the work must run outside the request; the job must survive the process that started it; the client must learn the outcome from stored state rather than a return value; failures must be handled server-side because nobody is connected when they happen; and the GPU time must be paid for up front and returned if the work dies.",
      "Everything else in the codebase is an implementation of one of those five consequences. Where the code looks over-engineered, it is usually paying for one of them.",
    ],
    limits: [
      "No timing or cost figures exist anywhere in the repo, so the bars show ratio and ordering only. No duration or dollar amount is invented.",
      "`audio_duration` is hardcoded to 180, so the expensive path has exactly one size and there is no cheaper mode to degrade to under load — see [[cost|where money goes]].",
    ],
  },
  {
    id: "sequence",
    label: "Request lifecycle",
    title: "One generation, end to end, on a time axis",
    plain:
      "A play-by-play of one song being made, showing exactly when the user stops waiting.",
    sources: [
      "actions/generation.ts:19",
      "functions.ts:68",
      "backend/main.py:220",
      "track-list-fetcher.tsx",
    ],
    Mech: SequenceMech,
    argument: [
      "Fourteen messages across six participants. The shape that matters is the shaded band: after message four the HTTP request has returned and **no client is connected** for the remainder of the work.",
      "Everything inside that band — the credit reservation, the GPU call, both S3 uploads, the final database write — happens with no caller to return an error to. That is why failure handling is a server-side state transition rather than an error response, and why the credit has to be reserved inside the band rather than at the moment the user clicks.",
      "The last four messages are a second, unrelated request. The finished state is not pushed; the user triggers a fresh read, which re-queries Postgres and signs a URL per song.",
    ],
    limits: [
      "The gap between message ten and message eleven is unbounded. A song can be finished for minutes or hours before anyone renders it.",
      "Messages twelve and thirteen run on every render, so the read path scales with library size rather than with how much has changed — see [[scale|what breaks next]].",
      "Nothing correlates the two halves. There is no job id surfaced to the client and no way to ask about one specific generation.",
    ],
  },
  {
    id: "data",
    label: "Data model",
    title: "Seven tables, and the three columns that carry the invariants",
    plain:
      "The seven database tables, and the three columns that decide whether anyone gets charged correctly.",
    sources: ["prisma/schema.prisma"],
    Mech: DataModelMech,
    argument: [
      "`Song` is the coordination point: it holds the request parameters, the lifecycle state, the S3 keys and the credit bookkeeping. Every other table is either identity (`User`, `Session`, `Account`) or a relation (`Like`, `Category`).",
      "Three columns carry the billing invariant — `credits` on User, and `creditReserved` and `creditRefunded` on Song. Putting the two flags on Song rather than User is deliberate: a refund is a fact about one generation, so the row that failed is the row that records it.",
      'The schema comment states the reasoning directly — the flags exist instead of inferring "a credit is reserved" from `status`, because status is also mutated on success and failure and so cannot safely gate money.',
      "`Category` is a unique-name table populated from LLM output through `connectOrCreate`, which makes model text part of the schema's key space.",
    ],
    limits: [
      "`status` is a String with no enum or check constraint, so the database accepts any value and the reader treats unknown ones as playable.",
      "Song has a single index, on `s3Key`, while the hot queries filter on `userId` and `published` and sort by `createdAt`.",
      "There is no ledger table. Only the current balance exists, so no credit movement can be audited after the fact.",
      "There is no mode discriminator — generation mode is [[contract|inferred from which nullable columns are set]].",
    ],
  },
  {
    id: "boundaries",
    label: "Where guarantees stop",
    title: "Where the guarantees stop being free",
    plain:
      "Four places where something you normally get for free stops being free.",
    sources: [
      "functions.ts:152",
      "backend/main.py:194",
      "lib/s3.ts",
      "functions.ts:37",
    ],
    Mech: BoundariesMech,
    argument: [
      "A boundary is a place where something previously free — atomicity, authentication, ordering, cheapness — stops holding. Most of the non-obvious code in the repo exists to buy one of them back.",
      'The `$transaction` blocks restore atomicity across the credit boundary. `import "server-only"` restores the trust boundary that `"use server"` removed. The concurrency key restores fairness across the cost boundary.',
      "The Postgres/S3 consistency boundary is the one nothing restores, and it is where the system's known defect lives.",
    ],
    limits: [
      "The consistency boundary is the one nothing restores: no outbox, no saga, no reconciliation job. What that costs is worked through in [[dualwrite|Postgres vs S3]].",
      "The trust boundary was crossed accidentally once already (commit e858b46), and [[endpoints|nothing structural prevents a recurrence]].",
    ],
  },
  {
    id: "contract",
    label: "What Create returns",
    title: "What the caller is promised at t = 0",
    plain:
      "Clicking Create gives you a row in a table, not a song. The status column is the only promise made.",
    sources: [
      "actions/generation.ts:19",
      "actions/generation.ts:43",
      "schema.prisma:36",
    ],
    Mech: ContractMech,
    argument: [
      "The server action authenticates, writes a row, emits an event and returns `void`. No id, no handle, no completion promise — the row's `status` field is the entire API from that point on.",
      "That makes `status` a public contract with five values, written by one file and consumed by another with no shared type between them.",
      "The generation mode is not stored. It is reconstructed later by testing which of four nullable columns are set, in a fixed branch order. The cost of that choice is that the table can represent combinations the product cannot produce, and the branch order silently decides which one wins.",
    ],
    limits: [
      'Rows are created before any credit check, so a user with no balance still accumulates Song rows that resolve to "no credits" later.',
      'In custom-lyrics mode neither `describedLyrics` nor `fullDescribedSong` is set, so the title logic never fires and every such song is titled "Untitled".',
      "There is no idempotency key on the enqueue, so two clicks create two songs and two jobs. An earlier version enqueued twice per click (fixed in 811fb7c) and nothing downstream flagged it.",
    ],
  },
];

const ACT_EXECUTION: readonly Stage[] = [
  {
    id: "durable",
    label: "Retries and replay",
    title: "The job is a replayable state machine, not a function call",
    plain:
      "The background job can be started over from the top, so anything it does twice must be harmless.",
    sources: ["functions.ts:61", "api/inngest/route.ts"],
    Mech: DurableMech,
    argument: [
      "This is the single most important execution fact in the system, and the one most often stated imprecisely. Each `step.run` result is persisted; on a retry the function body is **re-entered from the top**, and completed steps return their stored value instead of running again.",
      'So "runs exactly once" is true of a committed step and false of the function. Any side effect that is not inside a step, or that is not itself idempotent, can happen more than once.',
      "That is the whole justification for the flags on the Song row. `creditReserved` exists because `reserve-credit` can be re-entered; `creditRefunded` exists because the refund can be invoked from two different places, either of which may be replayed.",
      "`step.fetch` applies the same idea to the GPU call: the response becomes a durable step result, so a retry after a successful generation does not pay for a second one.",
    ],
    limits: [
      "No retries or timeouts are configured anywhere in this repo, so the number of GPU attempts a persistently failing song can trigger is not visible in the code.",
      "Step results are serialised and stored, so the entire Modal response body travels through that machinery on each attempt.",
      "The step boundaries are also the crash-consistency boundaries. Two adjacent steps — refund, then set-status — are not atomic with each other.",
    ],
  },
  {
    id: "lifecycle",
    label: "Song statuses",
    title: "Five states, one writer, and a reader that disagrees",
    plain:
      "A song moves through five named states, and only one of the moves between them is protected.",
    sources: [
      "functions.ts:186",
      "functions.ts:210",
      "functions.ts:223",
      "track-list.tsx:117",
    ],
    Mech: LifecycleMech,
    argument: [
      "Every transition is written by `functions.ts` and nowhere else, which is the right call — a single writer is what makes the lifecycle reviewable at all.",
      'Only one transition is guarded, and it is the important one. `processing → failed` uses `updateMany` with `status: { not: "processed" }` so a song that genuinely finished can never be demoted by a late failure handler. It is `updateMany` rather than `update` specifically because a non-matching `update` throws, and throwing inside `onFailure` means the failure handler itself fails.',
      'The reader is where it gets uncomfortable. `status` is a free-text `String` column; the consumer switches on it and has **no case for "processed"** — playable rows arrive via `default`. Any unrecognised value, including a typo or a future state, therefore renders as a playable track.',
    ],
    limits: [
      '"no credits" — with a space — is load-bearing across three files and one typo away from rendering as a playable row with no audio.',
      "There is no transition table or enum in code; the machine shown here is reconstructed by reading every write site.",
      'A crash between the refund and the status write leaves a refunded credit on a row still marked "processing" — the two are [[durable|adjacent steps, not one transaction]].',
    ],
  },
  {
    id: "backpressure",
    label: "Queueing under load",
    title: "Admission control, and what it costs the user",
    plain:
      "One song at a time per person: why that limit exists, and what it costs the user.",
    sources: ["functions.ts:37"],
    Mech: BackpressureMech,
    argument: [
      '`concurrency: { limit: 1, key: "event.data.userId" }` is admission control, not correctness. The key partitions the limit, so it is one in-flight run ~per user~ and other users are unaffected.',
      "Given that each run occupies a dedicated GPU for minutes, this is the main lever preventing one account from consuming the whole Modal pool. It is a fairness and cost mechanism.",
      'This is **not** what makes the credit safe. The commit message for the reservation states it directly: credits cannot be oversold "independent of the Inngest concurrency cap". Raising the limit leaves the money invariant intact; removing the conditional decrement breaks it at any limit.',
    ],
    limits: [
      "A cap of exactly 1 is a constant in the function definition. There is no per-plan or per-user override, so paying more cannot buy parallelism.",
      "Queued runs hold their reserved credit for the entire wait, so a backed-up queue looks to the user like a spent balance with nothing to show for it.",
      "Head-of-line blocking is total: one slow song blocks every later song for that user, including ones that would have been fast.",
    ],
  },
  {
    id: "taxonomy",
    label: "Ways it breaks",
    title: "Two handlers, one invariant, three blast radii",
    plain: "Three ways a song can fail, and how much damage each one does.",
    sources: ["functions.ts:205", "functions.ts:41"],
    Mech: TaxonomyMech,
    argument: [
      "Failures here split cleanly into two classes with different code paths. An **expected** failure is a value — `response.ok === false` — handled inline: refund, mark failed, return normally. A **terminal** failure is the run dying, handled by `onFailure` after retries are exhausted.",
      "Both funnel into the same idempotent `refundCreditIfReserved`, so the guarantee does not depend on which handler fires, or on only one of them firing.",
      "The third case is the one that is not really handled. If the run is marked failed ~after~ `update-song-result` committed, the two guards disagree: the status guard correctly refuses to demote the song, while the refund guard — which keys on different columns and has no idea the song succeeded — returns the credit anyway.",
    ],
    limits: [
      "The refund guard keys on creditReserved/creditRefunded; the status guard keys on status. Because they read different columns they can reach opposite conclusions about the same run, yielding a playable song that cost nothing.",
      '"Generation failed" is the entire diagnostic the user receives. The real error never reaches the row and lives only in the orchestrator\'s run history.',
      "A failure after the S3 upload is correctly refunded but leaves the uploaded objects behind.",
    ],
  },
];

const ACT_CORRECTNESS: readonly Stage[] = [
  {
    id: "toctou",
    label: "The credit race",
    title: "What a plain credits -= 1 actually did",
    plain:
      "The old code could charge two songs against one credit, or leave a balance below zero.",
    sources: ["git show 7d6ff6d^"],
    Mech: ToctouMech,
    argument: [
      "The previous implementation read the balance inside a step, tested `credits > 0` in JavaScript, ran generation for minutes, and only then issued an **unconditional** decrement.",
      "Three independent defects in one shape. The check-to-use window was minutes wide, so two runs could both pass a test made against the same balance. The write carried no predicate, so it could drive the balance negative. And because `credits` came from a memoised step result, a retry re-used the value read on the ~first~ attempt — the check was stale even with respect to itself.",
      "There is a fourth, subtler problem: charging after success means a failed generation cost the user nothing but cost the operator a full GPU run. The leak ran in both directions.",
    ],
    limits: [
      "This is a reconstruction from the old code's shape, not a captured incident — the repo has no reproduction test for it.",
      "There is still no automated test asserting the invariant today. The correctness argument rests entirely on reading the transactions, which is why they are written to be readable.",
    ],
  },
  {
    id: "reserve",
    label: "Reserve and refund",
    title: "Reserve before the work, compensate if it dies",
    plain:
      "Take the credit first, give it back if the work dies. The order is the whole point.",
    sources: ["functions.ts:152", "functions.ts:174"],
    Mech: ReserveMech,
    argument: [
      "The fix is a two-phase protocol borrowed from the reservation pattern: **acquire the resource before doing the work, and compensate if the work does not complete.**",
      "Phase one is a single conditional `updateMany` — predicate and mutation in one statement — so the database performs the compare-and-decrement atomically. It either matches a row or it does not; there is no read-then-write window for a second run to interleave into. The `creditReserved` flag commits in the same transaction, which is what makes the step safely replayable.",
      "There is deliberately **no settle phase on success**. The reservation simply stands. Fewer writes means fewer windows, and the flag already records everything the compensation path needs to know.",
      "The ordering is the correctness argument: if the credit were taken after generation, this would be the old code again.",
    ],
    limits: [
      "The user's balance drops the moment the job is admitted, so a [[backpressure|queued generation]] looks like money already spent.",
      "Cost is a flat 1 credit while [[cost|the underlying GPU cost is not]].",
      'If reservation fails the run sets "no credits" and returns, so the row is terminal and the user must resubmit rather than the job waiting for a top-up.',
    ],
  },
  {
    id: "idempotent",
    label: "Safe to retry",
    title: "Replay-proof by construction, not by defence",
    plain:
      "Refunding twice is impossible by construction, not by being careful.",
    sources: ["functions.ts:13"],
    Mech: IdempotentMech,
    argument: [
      "`refundCreditIfReserved` reads the song, bails unless `creditReserved && !creditRefunded`, then performs two writes in one `$transaction`: increment the balance, and set the flag.",
      'The property that matters is ~where~ the flag is written. Because it commits in the same transaction as the money, there is no ordering in which a second caller observes "still refundable" after the first has committed. A retried `refund-credit` step, a replayed `onFailure`, or both firing for the same run all collapse to exactly one refund.',
      "This is the difference between defensive idempotency — checking a flag you wrote earlier and hoping the gap was small — and structural idempotency, where the predicate and the flag are the same transaction and the gap does not exist.",
    ],
    limits: [
      "The guarantee is per-song. Nothing reconciles the ledger globally — there is [[data|no ledger table]], only a current balance.",
      "Correctness here comes from the conditional update and the single-transaction flag, not from an explicit isolation level; Prisma's default applies.",
    ],
  },
  {
    id: "dualwrite",
    label: "Postgres vs S3",
    title: "Two stores, one truth, no shared transaction",
    plain:
      "The audio file and the database row are saved by two different programs, so one can succeed while the other fails.",
    sources: ["backend/main.py:194", "backend/main.py:207", "functions.ts:223"],
    Mech: DualWriteMech,
    argument: [
      "This is the textbook dual-write problem and the system's most interesting unsolved edge. The bytes are written to S3 **inside the Modal container**; the row that references them is written to Postgres **by the orchestrator**, later, in a different process. No transaction spans the two.",
      "The upload is therefore already committed and irreversible by the time anything can fail. If the request subsequently errors — including in `generate_categories`, which runs ~after~ both uploads — the user is correctly refunded and the song correctly marked failed, and the objects stay in the bucket with nothing pointing at them.",
      "The `update-song-result` step is written as a single statement precisely to avoid making this worse: keys, status and category links commit together, so there is no state where a song is processed but uncategorised. That closes the Postgres-internal window; it cannot close the cross-store one.",
      "The system's implicit policy is to **fail toward losing bytes rather than losing money**. That is a defensible choice — storage is cheap and the ledger is what users notice — but it is a choice, and it is unstated anywhere in the code.",
    ],
    limits: [
      "Orphaned objects accumulate with no lifecycle policy, no sweeper and no reconciliation job. Nothing in the repo will ever delete them.",
      "Keys are bare uuid4 filenames at the bucket root, so an orphan carries no trace of which user or song produced it.",
      "The inverse failure is not possible today only because the DB write happens last. Reordering those two writes without an outbox would trade orphaned bytes for rows pointing at objects that do not exist.",
    ],
  },
  {
    id: "webhook",
    label: "Payment webhooks",
    title: "The one replay path with no idempotency",
    plain:
      "Buying credits is the one path where the same message arriving twice grants the credits twice.",
    sources: ["lib/auth.ts:44", "lib/products.ts"],
    Mech: WebhookMech,
    argument: [
      "Credits are never granted by a click handler. `Upgrade` opens a Polar checkout, and the balance changes only when Polar calls back with `onOrderPaid`, verified against `POLAR_WEBHOOK_SECRET`. The signature is the trust anchor, and it is the correct design.",
      "The handler resolves credits from `CREDIT_PRODUCTS` by product id, and an unknown id yields zero and is logged and skipped rather than defaulting — a paid order for a product the code does not recognise should not grant an arbitrary amount.",
      "The reservation path carries an explicit flag because delivery may be replayed. This one performs a bare `increment` that is **not keyed by order id**, and webhook providers redeliver on timeout by contract.",
      "At-least-once delivery is only safe where the operation is idempotent. Here it is not, so redelivery grants the credits twice.",
    ],
    limits: [
      "A redelivered webhook grants the credits again. Nothing dedupes on order id.",
      "A missing externalId throws, which the provider sees as failure and retries — so a genuinely orphaned order retries indefinitely.",
      "There is no refund or chargeback handling; credits granted are never reclaimed.",
    ],
  },
];

const ACT_TRUST: readonly Stage[] = [
  {
    id: "endpoints",
    label: "Attack surface",
    title: 'Every export of a "use server" file is a public endpoint',
    plain:
      "Anything exported from a certain kind of file becomes a public URL, whether you meant it to or not.",
    sources: ["commit e858b46", "lib/s3.ts", "actions/generation.ts"],
    Mech: EndpointsMech,
    argument: [
      'The mistake is invisible at the call site. A helper sitting in a `"use server"` module is not a helper: the framework compiles every export into a callable POST endpoint whose arguments the client controls.',
      "`getPresignedUrl` used to live in the actions file. That made it an **unauthenticated oracle that would sign any key in the bucket**, because the one thing it does is turn an arbitrary string into a URL with credentials attached.",
      'The fix is structural rather than a check: move it into a module marked `import "server-only"`, so reachability from the client becomes a build error instead of something a reviewer has to notice. The signer stays deliberately dumb, and its doc comment states that authorisation is the caller\'s job.',
    ],
    limits: [
      "Nothing prevents a recurrence. The protection is a convention plus one import; a future helper added to the actions file re-opens the same class of hole.",
      "The signer trusts its argument completely by design, so its safety is entirely a property of its two call sites. That coupling is documented only in a comment.",
    ],
  },
  {
    id: "capability",
    label: "Signed URLs",
    title: "A presigned URL is a bearer capability, not an ACL",
    plain:
      "The link that plays your song is a temporary password that works for anyone holding it.",
    sources: [
      "lib/s3.ts",
      "actions/generation.ts:63",
      "actions/generation.ts:93",
    ],
    Mech: CapabilityMech,
    argument: [
      "A presigned URL is a **bearer capability**. It grants GET on exactly one key for 3600 seconds, proves nothing about who holds it, and cannot be revoked.",
      "The authorisation is not in the signer — it is in the query that resolves the key: owner **or** published, and `s3Key` non-null. Expressing the security predicate in the same statement that fetches the data is the right pattern, because there is no window in which the two can disagree.",
      "The listen counter shows the same care applied elsewhere: issuing a URL is also how download and share work, so counting a listen at issue time would be wrong. It is counted inside the resolved `play()` promise instead.",
    ],
    limits: [
      "One hour is a long TTL for something that behaves like a share link, and unpublishing a song does not invalidate URLs already issued for it.",
      "The Download action opens the signed URL in a new tab, so a credentialed URL lands in browser history.",
      "Thumbnails are signed for every song on every render, which is [[scale|the first thing that saturates]].",
    ],
  },
];

const ACT_SCALE: readonly Stage[] = [
  {
    id: "cost",
    label: "Where money goes",
    title: "Where the money actually goes",
    plain:
      "Almost all the money is GPU time, and a cold start makes one song cost far more than the next.",
    sources: [
      "backend/main.py:53",
      "backend/main.py:88",
      "actions/generation.ts:26",
    ],
    Mech: CostMech,
    argument: [
      "Everything left of Modal costs fractions of a cent. The entire cost model is GPU seconds, and the two variables are whether the container was warm and how many models the request drives.",
      "`@modal.enter()` runs once per container, not per request, and loads **three** models — ACE-Step from a volume, Qwen2-7B-Instruct, and SDXL-Turbo for cover art. That is what makes one container able to do the whole job, and it is also what makes a cold start expensive.",
      "`scaledown_window=10` then decides how often you pay it: ten idle seconds and the container is gone. At low traffic almost every request is a cold start, which inverts the usual intuition that cold starts are the exception.",
      "The volumes exist for exactly this reason — without them every cold container would re-download multi-gigabyte weights instead of reading them from an attached filesystem.",
    ],
    limits: [
      "Pricing is flat at 1 credit while cost is not: mode changes the number of LLM calls, and cold start adds three model loads before any inference begins.",
      "`audio_duration` is fixed at 180 in queueSong, so the most expensive dimension is not adjustable even when a shorter clip would do.",
      "requirements.txt pins transformers==4.50.0 but torch, boto3 and pydantic are unpinned, and ACE-Step is installed from a git clone of main with no pinned commit — so the image is not reproducible across rebuilds.",
    ],
  },
  {
    id: "scale",
    label: "What breaks next",
    title: "The first thing to saturate at 10× and 100×",
    plain:
      "At 100x traffic the GPU is not what breaks first — a loop that runs on every page render is.",
    sources: [
      "track-list-fetcher.tsx",
      "app/(main)/page.tsx",
      "schema.prisma:63",
    ],
    Mech: ScaleMech,
    argument: [
      "The GPU is **not** the first thing to break. Modal scales horizontally, and the per-user cap already bounds demand per account.",
      "The first real wall is presigning. `TrackListFetcher` signs a thumbnail URL for every song the user owns on every render, and the home feed does the same for up to 100 published songs per page load. That is O(songs) cryptographic work and object-store round trips on a page render, and it grows with library size rather than with traffic.",
      "The second is the queue. `limit: 1` per user is comfortable when users make a few songs and painful when they make many — and because a queued job holds its reserved credit for the whole wait, the queue converts directly into balances that look spent.",
      "The first bottleneck is a page-render loop, not the GPU. Fixing it means caching or deferring the signing, not buying more capacity.",
    ],
    limits: [
      "These tiers are reasoning about code shape. Nothing here is measured; the repo has no load tests.",
      'The home feed\'s "trending" is the last 100 published songs filtered to the last two days and sliced to 10 — recency, not popularity, despite the label.',
    ],
  },
  {
    id: "refactor",
    label: "Next moves",
    title: "What to change first, and why in that order",
    plain:
      "The six changes worth making, ordered by how much risk each removes.",
    sources: ["synthesis of the preceding stages"],
    Mech: RefactorMech,
    argument: [
      "Each item below is a defect established earlier in this document, paired with the change that closes it.",
      "The ordering is by risk removed per unit of work, not by difficulty or by how interesting the problem is. The webhook idempotency key is first because it is the only unprotected replay path touching money and it costs one table and one unique constraint.",
      "Three known limitations are deliberately absent: the concurrency limit, the flat credit price, and the manual Refresh. All three are defensible at the product's current stage, and none of them can corrupt data or lose money.",
    ],
    limits: [
      "None of these has been implemented or benchmarked, so the effort estimates are judgement rather than measurement.",
      "Ordering assumes the current scale. At 100× the presign loop would move to the top of the list.",
    ],
  },
];

export const ACTS: readonly Act[] = [
  {
    id: "forces",
    numeral: "1",
    title: "How it's built",
    summary: "The parts of the system, and why they are arranged this way.",
    stages: ACT_FORCES,
  },
  {
    id: "exec",
    numeral: "2",
    title: "When things fail",
    summary:
      "What happens to a half-finished song when a machine crashes mid-job.",
    stages: ACT_EXECUTION,
  },
  {
    id: "correct",
    numeral: "3",
    title: "Not losing money",
    summary:
      "How the system avoids charging you twice, or giving away free songs.",
    stages: ACT_CORRECTNESS,
  },
  {
    id: "trust",
    numeral: "4",
    title: "Who can do what",
    summary: "Which code the public can reach, and what a shared link grants.",
    stages: ACT_TRUST,
  },
  {
    id: "scale",
    numeral: "5",
    title: "What it costs",
    summary: "Where the money goes, and what breaks first if usage grows.",
    stages: ACT_SCALE,
  },
];

export const TOTAL_STAGES = ACTS.reduce((n, a) => n + a.stages.length, 0);

export const GLOSSARY: readonly [string, string][] = [
  [
    "at-least-once delivery",
    "A guarantee that work will run, possibly more than once. Cheap to build and the default for durable job runners. Exactly-once is not generally achievable, so the usual answer is at-least-once plus idempotent operations.",
  ],
  [
    "idempotent",
    "An operation you can perform repeatedly with the same end state. The property that makes at-least-once delivery safe.",
  ],
  [
    "durable step",
    "A unit of a background job whose result is persisted, so a retry replays the stored value rather than executing it again.",
  ],
  [
    "compare-and-swap",
    "Testing a condition and mutating in one indivisible operation. Here it is a single UPDATE carrying both a predicate and a change, which is why no other run can interleave.",
  ],
  [
    "TOCTOU",
    "Time-of-check to time-of-use: the gap between verifying a condition and acting on it, during which the condition can stop being true.",
  ],
  [
    "race condition",
    "Two operations interleaving so as to produce a result neither would alone — classically, both reading a value before either writes it back.",
  ],
  [
    "transaction",
    "A group of writes that all commit or all roll back, so no reader observes a half-applied state.",
  ],
  [
    "dual write",
    "Writing to two stores that share no transaction. Any failure between them leaves the two disagreeing, with no automatic repair.",
  ],
  [
    "outbox pattern",
    "The usual fix for dual writes: record the intent in the same transaction as the data, then have a separate process perform the external effect and mark it done.",
  ],
  [
    "compensating action",
    "An operation that undoes an earlier committed one when a later step fails, because a rollback is no longer possible. The credit refund is one.",
  ],
  [
    "reservation pattern",
    "Acquiring a scarce resource before doing the work, then compensating if the work fails — as opposed to charging afterwards.",
  ],
  [
    "blast radius",
    "How much is damaged when a particular failure occurs. Used to rank failures by consequence rather than by likelihood.",
  ],
  [
    "backpressure",
    "Deliberately limiting admitted work so a system degrades predictably instead of collapsing.",
  ],
  [
    "head-of-line blocking",
    "When one slow item at the front of a queue delays everything behind it, regardless of how fast those would have been.",
  ],
  [
    "capability / bearer token",
    "A credential that grants access by possession alone, proving nothing about who holds it. A presigned URL is one.",
  ],
  [
    "presigned URL",
    "A URL with an embedded signature granting time-limited access to one object, without the holder having any credentials.",
  ],
  [
    "trust boundary",
    "The line where data stops being under your control and must be re-validated. Every public endpoint is one.",
  ],
  [
    "server action",
    'A Next.js function in a "use server" file callable from the client. Every export is a public endpoint — which is why the S3 signer was moved out of one.',
  ],
  [
    "cold start",
    "A request arriving when no container is running, so it pays for boot and model loading before doing any work.",
  ],
  [
    "amortisation",
    "Spreading a one-off cost across the requests that follow it. A warm container amortises its model loading; a container that scales down after 10s mostly cannot.",
  ],
  [
    "diffusion / denoising steps",
    "A generative method that starts from noise and refines it toward something matching the conditioning. infer_step sets how many passes.",
  ],
  [
    "guidance scale",
    "How strongly generation is pulled toward the prompt. Too low drifts off-brief; too high over-constrains.",
  ],
  [
    "seed",
    "The number fixing the random starting point. Same seed and inputs reproduce the same output; −1 means choose randomly, so nothing is reproducible.",
  ],
  [
    "webhook",
    "An HTTP callback a third party makes into your app when something happens on their side — here, when an order is paid.",
  ],
];
