/**
 * Test environment. Integration tests run ONLY against TEST_DATABASE_URL (a disposable
 * database that is wiped on every run); the development DATABASE_URL is never used.
 */
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else {
  // Unit tests don't touch the database, but env validation needs a value.
  process.env.DATABASE_URL = "postgresql://invalid.localhost/no-database-in-unit-tests";
}
process.env.EMAIL_PROVIDER = "console";
process.env.APP_URL = "http://localhost:3000";
process.env.BETTER_AUTH_SECRET = "test-only-secret-not-used-anywhere-else-0123456789";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
delete process.env.TRUSTED_ORIGINS;
delete process.env.S3_BUCKET;
