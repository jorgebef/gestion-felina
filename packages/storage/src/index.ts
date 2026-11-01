/**
 * S3-compatible object storage (AWS S3, Cloudflare R2, MinIO, Backblaze B2…).
 * Configured with S3_* variables; when S3_BUCKET is unset, storage is disabled and
 * `storageFromEnv()` returns null so callers can skip archiving.
 */
import { gunzipSync, gzipSync } from "node:zlib";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { z } from "zod";

export interface PutObjectInput {
  key: string;
  body: string | Uint8Array;
  contentType: string;
  metadata?: Record<string, string>;
  /** Store gzip-compressed (`Content-Encoding: gzip`); `getText` decompresses it. */
  compress?: boolean;
}

export interface ObjectStorage {
  readonly bucket: string;
  put(input: PutObjectInput): Promise<void>;
  /** Object body as text, or null when the key does not exist. */
  getText(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
}

export interface S3StorageConfig {
  bucket: string;
  region: string;
  /** Custom endpoint for non-AWS providers, e.g. https://<account>.r2.cloudflarestorage.com */
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  /** Path-style URLs (`endpoint/bucket/key`), required by MinIO and most self-hosted servers. */
  forcePathStyle?: boolean;
  /** Prepended to every key, e.g. `production/`. */
  prefix?: string;
}

export function createS3Storage(config: S3StorageConfig): ObjectStorage {
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials:
      config.accessKeyId && config.secretAccessKey
        ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
        : undefined,
  });
  const prefix = config.prefix ?? "";
  return {
    bucket: config.bucket,
    async put({ key, body, contentType, metadata, compress }) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: prefix + key,
          Body: compress ? gzipSync(body) : body,
          ContentType: contentType,
          ContentEncoding: compress ? "gzip" : undefined,
          Metadata: metadata,
        }),
      );
    },
    async getText(key) {
      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket: config.bucket, Key: prefix + key }),
        );
        if (!result.Body) return null;
        const bytes = await result.Body.transformToByteArray();
        const raw = result.ContentEncoding === "gzip" ? gunzipSync(bytes) : Buffer.from(bytes);
        return raw.toString("utf-8");
      } catch (error) {
        if (error instanceof NoSuchKey) return null;
        throw error;
      }
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: prefix + key }));
    },
  };
}

const optional = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : undefined));

const envSchema = z.object({
  S3_BUCKET: optional,
  S3_REGION: z.string().trim().min(1).default("auto"),
  S3_ENDPOINT: z
    .url()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  S3_ACCESS_KEY_ID: optional,
  S3_SECRET_ACCESS_KEY: optional,
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false", ""])
    .optional()
    .transform((v) => v === "true"),
  S3_PREFIX: optional,
});

/** Storage configured from S3_* variables, or null when S3_BUCKET is not set. */
export function storageFromEnv(env: NodeJS.ProcessEnv = process.env): ObjectStorage | null {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid S3 configuration: ${z.prettifyError(parsed.error)}`);
  }
  const vars = parsed.data;
  if (!vars.S3_BUCKET) return null;
  return createS3Storage({
    bucket: vars.S3_BUCKET,
    region: vars.S3_REGION,
    endpoint: vars.S3_ENDPOINT,
    accessKeyId: vars.S3_ACCESS_KEY_ID,
    secretAccessKey: vars.S3_SECRET_ACCESS_KEY,
    forcePathStyle: vars.S3_FORCE_PATH_STYLE,
    prefix: vars.S3_PREFIX,
  });
}
