import { readdirSync, readFileSync } from "node:fs";
import postgres from "postgres";
import "./load-env.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {

function statements(file: string) {
  return file
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

await sql.unsafe(`create table if not exists schema_migrations (
  id text primary key,
  applied_at timestamptz not null default now()
)`);

const files = readdirSync("drizzle")
  .filter((file) => file.endsWith(".sql"))
  .sort();

for (const file of files) {
  const done = await sql`select 1 from schema_migrations where id = ${file}`;
  if (done.length) {
    console.log(`skip ${file}`);
    continue;
  }
  for (const statement of statements(readFileSync(`drizzle/${file}`, "utf8"))) {
    await sql.unsafe(statement);
  }
  await sql`insert into schema_migrations (id) values (${file})`;
  console.log(`applied ${file}`);
}

await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
