import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await client.connect();

  const tables = ['cohorts', 'projects', 'project_members', 'blog_posts'] as const;

  console.log('=== COLUMN LAYOUT ===');
  for (const table of tables) {
    const { rows } = await client.query(
      `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position`,
      [table],
    );
    console.log(`\n[${table}]`);
    for (const r of rows) {
      console.log(
        `  ${r.column_name.padEnd(20)} ${r.data_type.padEnd(28)} null=${r.is_nullable.padEnd(3)} default=${r.column_default ?? '-'}`,
      );
    }
  }

  console.log('\n=== EXISTING ROWS REFERENCING cohort id=1 ===');
  for (const table of ['projects', 'project_members', 'cohort_parts']) {
    try {
      const { rows } = await client.query(
        table === 'cohort_parts'
          ? `SELECT COUNT(*)::int AS cnt FROM ${table} WHERE "cohortId" = 1`
          : table === 'projects'
            ? `SELECT COUNT(*)::int AS cnt FROM ${table} WHERE "cohortId" = 1`
            : `SELECT COUNT(*)::int AS cnt FROM ${table}`,
      );
      console.log(`  ${table.padEnd(20)} count=${rows[0].cnt}`);
    } catch (e) {
      console.log(`  ${table.padEnd(20)} ERR: ${(e as Error).message}`);
    }
  }

  console.log('\n=== UUID DEFAULTS (uuid columns) ===');
  const uuid = await client.query(
    `SELECT table_name, column_name, column_default
       FROM information_schema.columns
      WHERE table_schema='public' AND data_type='uuid'
      ORDER BY table_name, column_name`,
  );
  for (const r of uuid.rows) {
    console.log(`  ${r.table_name}.${r.column_name} default=${r.column_default ?? '-'}`);
  }

  console.log('\n=== INSTALLED EXTENSIONS ===');
  const ext = await client.query(
    `SELECT extname FROM pg_extension ORDER BY extname`,
  );
  console.log('  ' + ext.rows.map((r: { extname: string }) => r.extname).join(', '));

  console.log('\n=== CURRENT cohorts ROWS ===');
  const c = await client.query(
    `SELECT id, name, status, "recruitStartAt", "recruitEndAt" FROM cohorts ORDER BY id`,
  );
  console.log(JSON.stringify(c.rows, null, 2));

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
