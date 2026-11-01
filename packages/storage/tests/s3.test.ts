import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, expect, it } from "vite-plus/test";

import { createS3Storage, storageFromEnv } from "../src/index.ts";

/** Minimal path-style S3 endpoint: PUT, GET and DELETE of objects in memory. */
const objects = new Map<string, { body: Buffer; contentType?: string; contentEncoding?: string }>();
const requests: { method?: string; url?: string; authorization?: string }[] = [];
let server: Server;
let endpoint: string;

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

beforeAll(async () => {
  server = createServer(async (req, res) => {
    requests.push({ method: req.method, url: req.url, authorization: req.headers.authorization });
    const key = decodeURIComponent(new URL(req.url!, "http://s3.test").pathname);
    if (req.method === "PUT") {
      objects.set(key, {
        body: await readBody(req),
        contentType: req.headers["content-type"],
        contentEncoding: req.headers["content-encoding"],
      });
      res.writeHead(200, { etag: '"etag"' }).end();
    } else if (req.method === "GET") {
      const object = objects.get(key);
      if (!object) {
        res
          .writeHead(404, { "content-type": "application/xml" })
          .end("<Error><Code>NoSuchKey</Code><Message>missing</Message></Error>");
        return;
      }
      res.writeHead(200, {
        "content-type": object.contentType ?? "application/octet-stream",
        ...(object.contentEncoding ? { "content-encoding": object.contentEncoding } : {}),
      });
      res.end(object.body);
    } else if (req.method === "DELETE") {
      objects.delete(key);
      res.writeHead(204).end();
    } else {
      res.writeHead(405).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

it("stores, reads and deletes objects with signed requests", async () => {
  const storage = createS3Storage({
    bucket: "felina-photos",
    region: "auto",
    endpoint,
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
    forcePathStyle: true,
    prefix: "test/",
  });

  const body = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  await storage.put({ key: "cats/abc/photo.jpg", body, contentType: "image/jpeg" });
  expect(objects.get("/felina-photos/test/cats/abc/photo.jpg")).toMatchObject({
    body: Buffer.from(body),
    contentType: "image/jpeg",
  });
  expect(requests.at(-1)?.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=test-key\//);

  const stored = await storage.get("cats/abc/photo.jpg");
  expect(stored?.contentType).toBe("image/jpeg");
  expect(Buffer.from(stored!.body)).toEqual(Buffer.from(body));
  expect(await storage.get("cats/abc/missing.jpg")).toBeNull();

  await storage.delete("cats/abc/photo.jpg");
  expect(objects.has("/felina-photos/test/cats/abc/photo.jpg")).toBe(false);
});

it("rejects path-like keys", async () => {
  const storage = createS3Storage({ bucket: "b", region: "auto", endpoint, forcePathStyle: true });
  await expect(storage.get("../etc/passwd")).rejects.toThrow(/Invalid storage key/);
});

it("keeps files on disk when no bucket is configured", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "felina-storage-"));
  const storage = storageFromEnv({ LOCAL_STORAGE_DIR: dir });
  expect(storage.driver).toBe("local");
  await storage.put({
    key: "cats/x/1.png",
    body: new Uint8Array([1, 2]),
    contentType: "image/png",
  });
  expect(await storage.get("cats/x/1.png")).toEqual({
    body: new Uint8Array([1, 2]),
    contentType: "image/png",
  });
  await storage.delete("cats/x/1.png");
  expect(await storage.get("cats/x/1.png")).toBeNull();
  await rm(dir, { recursive: true, force: true });
});

it("uses S3 when S3_BUCKET is set", () => {
  expect(
    storageFromEnv({ S3_BUCKET: "b", S3_ENDPOINT: endpoint, S3_FORCE_PATH_STYLE: "true" }).driver,
  ).toBe("s3");
  expect(() => storageFromEnv({ S3_BUCKET: "b", S3_ENDPOINT: "not a url" })).toThrow(
    /Invalid storage configuration/,
  );
});
