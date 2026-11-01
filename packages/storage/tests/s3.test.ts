import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

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
    bucket: "licita-raw",
    region: "auto",
    endpoint,
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
    forcePathStyle: true,
    prefix: "test/",
  });

  const body = "<feed>contratación pública</feed>";
  await storage.put({ key: "raw/page.atom", body, contentType: "application/atom+xml" });
  expect(objects.get("/licita-raw/test/raw/page.atom")).toMatchObject({
    body: Buffer.from(body),
    contentType: "application/atom+xml",
  });
  expect(requests.at(-1)?.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=test-key\//);

  expect(await storage.getText("raw/page.atom")).toBe(body);
  expect(await storage.getText("raw/missing.atom")).toBeNull();

  await storage.delete("raw/page.atom");
  expect(objects.has("/licita-raw/test/raw/page.atom")).toBe(false);
});

it("compresses objects on request and reads them back transparently", async () => {
  const storage = createS3Storage({
    bucket: "licita-raw",
    region: "auto",
    endpoint,
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
    forcePathStyle: true,
  });
  const body = "<entry>licitación</entry>".repeat(1000);
  await storage.put({
    key: "raw/big.atom",
    body,
    contentType: "application/atom+xml",
    compress: true,
  });
  const stored = objects.get("/licita-raw/raw/big.atom")!;
  expect(stored.contentEncoding).toBe("gzip");
  expect(stored.body.length).toBeLessThan(Buffer.byteLength(body) / 10);
  expect(await storage.getText("raw/big.atom")).toBe(body);
});

it("is disabled until S3_BUCKET is set", () => {
  expect(storageFromEnv({})).toBeNull();
  expect(
    storageFromEnv({ S3_BUCKET: "b", S3_ENDPOINT: endpoint, S3_FORCE_PATH_STYLE: "true" })?.bucket,
  ).toBe("b");
  expect(() => storageFromEnv({ S3_BUCKET: "b", S3_ENDPOINT: "not a url" })).toThrow(
    /Invalid S3 configuration/,
  );
});
