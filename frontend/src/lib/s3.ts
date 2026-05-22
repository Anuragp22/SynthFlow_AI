import "server-only";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "~/env";

// Reused across requests instead of being re-created on every call.
const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY_ID,
  },
});

/**
 * Signs an S3 object key for temporary read access.
 *
 * This is an internal server helper, NOT a server action — callers are
 * responsible for authorizing access to `key` before signing it.
 */
export async function getPresignedUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: 3600,
  });
}
