import { sql } from "drizzle-orm";

import { getDb } from "./client.ts";

export type TenantTx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/**
 * Runs `work` in a transaction as the restricted `app_user` role with `app.user_id`
 * set to the signed-in user, so every statement is filtered by the RLS policies in
 * migrations/0004_rls.sql. Both settings are transaction-local (`SET LOCAL`),
 * which keeps them safe with pooled connections.
 */
export function withTenant<T>(userId: string, work: (tx: TenantTx) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`set local role app_user`);
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    return work(tx);
  });
}

type Awaited_<T> = { [K in keyof T]: Awaited<T[K]> };

/**
 * Awaits lazily-executed query builders one after another. A transaction owns a single
 * connection, so `Promise.all` would only queue them (and pg warns about it).
 */
export async function inSequence<T extends readonly PromiseLike<unknown>[]>(
  queries: [...T],
): Promise<Awaited_<T>> {
  const results: unknown[] = [];
  for (const query of queries) results.push(await query);
  return results as Awaited_<T>;
}
