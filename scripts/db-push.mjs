/**
 * Apply supabase/migrations/*.sql in order, against SUPABASE_DB_URL.
 *
 * A stand-in for `supabase db push` — this machine has no Supabase CLI and no Docker,
 * so migrations are applied with a plain Postgres client instead. Each file runs
 * inside its own transaction, so a syntax error leaves the database on the last good
 * migration rather than half-applied.
 *
 * Usage:  npm run db:push
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "supabase", "migrations");

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error(
    "SUPABASE_DB_URL is not set.\n" +
      "Supabase Dashboard > Project Settings > Database > Connection string > URI\n" +
      "Put it in .env.local (it is gitignored).",
  );
  process.exit(1);
}

const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
if (files.length === 0) {
  console.error(`No .sql files in ${dir}`);
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log(`connected · applying ${files.length} migration(s)\n`);

for (const file of files) {
  const sql = readFileSync(join(dir, file), "utf8");
  process.stdout.write(`  ${file} ... `);
  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
    console.log("ok");
  } catch (error) {
    await client.query("rollback");
    console.log("FAILED");
    console.error(`\n${error.message}\n`);
    if (error.position) {
      const pos = Number(error.position);
      console.error("near:", sql.slice(Math.max(0, pos - 200), pos + 200));
    }
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log("\nall migrations applied.");
