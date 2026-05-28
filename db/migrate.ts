import "dotenv/config";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { Pool } from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(here, "migrations");

/**
 * Pre-drizzle this repo tracked migrations in a custom `schema_migrations`
 * table populated by `db/migrate.ts` with two raw-SQL files
 * (`0001_init.sql`, `0002_yjs.sql`). Drizzle uses `drizzle.__drizzle_migrations`
 * keyed by SHA-256 hash + `created_at` (the journal's `folderMillis`).
 *
 * On an existing DB those legacy migrations already created every table the
 * new baseline migration would create, so running drizzle's migrator without
 * priming would fail with "relation already exists". This bootstrap detects
 * the legacy table, seeds drizzle's journal with our baseline's hash so the
 * migrator skips it, then drops `schema_migrations`. Idempotent and a no-op
 * on fresh databases.
 */
async function bootstrapFromLegacy(pool: Pool) {
  const client = await pool.connect();
  try {
    const legacy = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'schema_migrations'
       ) AS exists`,
    );
    if (!legacy.rows[0]?.exists) return;

    const journal = JSON.parse(
      readFileSync(join(migrationsFolder, "meta/_journal.json"), "utf8"),
    ) as { entries: { tag: string; when: number }[] };
    const baseline = journal.entries[0];
    if (!baseline) return;

    const sqlFile = readFileSync(
      join(migrationsFolder, `${baseline.tag}.sql`),
      "utf8",
    );
    const hash = createHash("sha256").update(sqlFile).digest("hex");

    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);
    const already = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1) AS exists`,
      [hash],
    );
    if (!already.rows[0]?.exists) {
      await client.query(
        `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
        [hash, baseline.when],
      );
      console.log(
        `[migrate] seeded drizzle journal with baseline ${baseline.tag} (legacy schema_migrations detected)`,
      );
    }
    await client.query("DROP TABLE schema_migrations");
    await client.query("COMMIT");
    console.log("[migrate] dropped legacy schema_migrations table");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await bootstrapFromLegacy(pool);
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder });
    // Smoke check: confirm the migrator left a journal row.
    const j = await db.execute(
      sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`,
    );
    console.log(`[migrate] done — ${j.rows[0]?.n ?? 0} migration(s) on record`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
