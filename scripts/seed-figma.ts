/**
 * scripts/seed-figma.ts
 *
 * Purpose:
 *   - Upload Figma-sourced thumbnails (from tmp/figma-thumbs/) to GCS
 *   - Emit a runnable SQL seed at scripts/seed-figma.sql
 *
 * Strategy:
 *   - Additive only. Does NOT modify or delete existing rows.
 *   - Adds 3 dummy display cohorts (9기/11기/12기) with status=CLOSED.
 *   - The generated SQL aborts inside its transaction if any of the seed
 *     names (cohort / project / blog title) already exist in prod.
 *
 * Idempotency:
 *   - If scripts/seed-figma.manifest.json already exists, the script reuses
 *     those URLs and skips GCS upload. Delete the manifest to force re-upload.
 *
 * Flags:
 *   --dry-run     Skip GCS upload; emit SQL with placeholder URLs. No manifest written.
 *   --force       Re-upload to GCS even when a manifest is present.
 *
 * Data caveats (verified, not inferred):
 *   - Member roster: only FESTIBEE has one in Figma (5 members).
 *   - Blog posts: 1 of 4 Figma cards has a verified externalUrl
 *     (https://dynamic-ddd.tistory.com/5). The other 3 are skipped.
 *
 * Usage:
 *   yarn ts-node --transpile-only scripts/seed-figma.ts
 *   yarn ts-node --transpile-only scripts/seed-figma.ts --dry-run
 */

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { Storage } from '@google-cloud/storage';

type Platform = 'IOS' | 'AOS' | 'WEB';

type ProjectSeed = {
  fileName: string;
  name: string;
  description: string;
  platforms: Platform[];
  cohortName: '9기' | '11기' | '12기';
  members?: { name: string; part: string }[];
};

type BlogSeed = {
  fileName: string;
  title: string;
  excerpt: string;
  externalUrl: string;
};

type CohortSeed = {
  name: string;
  recruitStartAt: string;
  recruitEndAt: string;
  status: 'CLOSED';
};

const COHORTS: CohortSeed[] = [
  { name: '9기', recruitStartAt: '2023-01-01', recruitEndAt: '2023-06-30', status: 'CLOSED' },
  { name: '11기', recruitStartAt: '2024-01-01', recruitEndAt: '2024-06-30', status: 'CLOSED' },
  { name: '12기', recruitStartAt: '2024-07-01', recruitEndAt: '2024-12-31', status: 'CLOSED' },
];

const PROJECTS: ProjectSeed[] = [
  {
    fileName: 'project-festibee.png',
    name: 'FESTIBEE (페스티비)',
    description:
      '언제 열리는지, 누가 나오는지, 무슨 곡을 부르는지, 티켓은 언제 오픈하는지...\n궁금한 모든 걸 한 번에 확인할 수 있는 곳 👉 페스티비 🐝',
    platforms: ['IOS'],
    cohortName: '12기',
    members: [
      { name: '최현희', part: 'PM' },
      { name: '이윤경', part: 'DESIGN' },
      { name: '이무성', part: 'WEB' },
      { name: '정원석', part: 'WEB' },
      { name: '이준석', part: 'SERVER' },
    ],
  },
  {
    fileName: 'project-growit.png',
    name: 'GROWIT (그로잇)',
    description:
      '작심삼일? 이제 그만! 목표 달성과 회고를 AI 멘토와 함께 게임처럼 즐기며 꾸준히 성장하세요! ✨',
    platforms: ['WEB'],
    cohortName: '12기',
  },
  {
    fileName: 'project-moyorak.png',
    name: 'MOYORAK (모여락)',
    description:
      '"오늘 점심 뭐 먹지?" 직장인의 점심 스트레스 이제 그만! 점심메뉴 선정 스트레스',
    platforms: ['IOS'],
    cohortName: '12기',
  },
  {
    fileName: 'project-mkung.png',
    name: '엠쿵',
    description: 'MBTI 기반으로 취향과 성향이 맞는 사람을 연결하는 커뮤니티앱입니다.',
    platforms: ['IOS'],
    cohortName: '11기',
  },
  {
    fileName: 'project-polabo.png',
    name: 'POLABO',
    description:
      '폴라보는 폴라로이드로 함께한 추억과 일상을 특별하게 만드는 사진 중심 참여형 SNS 서비스입니다',
    platforms: ['IOS'],
    cohortName: '11기',
  },
  {
    fileName: 'project-mozip.png',
    name: 'MOZIP',
    description:
      'MOZIP은 IT 직군에게 필요한 공모전 • 해커톤 • IT동아리 관련 공고를 한눈에 확인할 수 있는 앱 서비스입니다.',
    platforms: ['IOS'],
    cohortName: '11기',
  },
  {
    fileName: 'project-pregen.png',
    name: 'Pregen',
    description: "'스와이프'가 아닌 '이해'로 연결되는 새로운 인터랙션 경험",
    platforms: ['IOS'],
    cohortName: '12기',
  },
  {
    fileName: 'project-myeongeon.png',
    name: '명언제과점',
    description:
      '당신의 하루에 맞는 문장을 구워드립니다, 상황과 감정에 맞는 명언을 추천해주는 큐레이션 앱',
    platforms: ['IOS'],
    cohortName: '9기',
  },
  {
    fileName: 'project-fridgelink.png',
    name: 'Fridge Link',
    description: '식자재를 관리하고, 지인들과 나눔하는, 냉장고 관리 서비스!',
    platforms: ['IOS'],
    cohortName: '12기',
  },
];

const BLOG_POSTS: BlogSeed[] = [
  {
    fileName: 'blog-pixel-to-space.png',
    title: '픽셀을 넘어 공간으로: AI 시대, 디자이너가 XR에 주목해야 하는 이유',
    excerpt:
      "오늘은 요즘 디자이너들 사이에서 가장 뜨거운 화두인 'AI', 그리고 그 너머의 'Next Generation'에 대해 이야기해 보려 합니다.",
    externalUrl: 'https://dynamic-ddd.tistory.com/5',
  },
];

const GCS_PATH = {
  PROJECT_THUMBNAIL: 'projects/thumbnails',
  BLOG_THUMBNAIL: 'blogs/thumbnails',
} as const;

const PLATFORM_ENUM_TYPE = 'projects_platforms_enum';
const COHORT_STATUS_ENUM_TYPE = 'cohorts_status_enum';

function sqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function sqlStringList(items: string[]): string {
  return items.map(sqlString).join(', ');
}

async function uploadToGcs(args: {
  storage: Storage;
  bucketName: string;
  localPath: string;
  gcsPath: string;
}): Promise<string> {
  const { storage, bucketName, localPath, gcsPath } = args;
  const extension = path.extname(localPath);
  const destination = `${gcsPath}/${randomUUID()}${extension}`;

  await storage.bucket(bucketName).upload(localPath, {
    destination,
    contentType: 'image/png',
    resumable: false,
  });

  return `https://storage.googleapis.com/${bucketName}/${destination}`;
}

function buildSql(args: {
  projectThumbUrls: Record<string, string>;
  blogThumbUrls: Record<string, string>;
  generatedAt: string;
}): string {
  const { projectThumbUrls, blogThumbUrls, generatedAt } = args;
  const lines: string[] = [];

  const cohortNames = COHORTS.map((c) => c.name);
  const projectNames = PROJECTS.map((p) => p.name);
  const blogTitles = BLOG_POSTS.map((b) => b.title);

  lines.push('-- =====================================================================');
  lines.push('-- Generated by scripts/seed-figma.ts');
  lines.push(`-- Generated at: ${generatedAt}`);
  lines.push(
    '-- Source     : Figma "2026 Web site_dev" (https://www.figma.com/design/dFy4bUmxNmS6WJ6QgwBa4I/)',
  );
  lines.push('-- Strategy   : additive only. Aborts on any name collision.');
  lines.push(
    '-- How to run : open in DataGrip on prod connection, execute the whole file, inspect, COMMIT.',
  );
  lines.push('-- =====================================================================');
  lines.push('');
  lines.push('BEGIN;');
  lines.push("SET LOCAL statement_timeout = '60s';");
  lines.push('');

  lines.push('-- Pre-flight guard: abort if any seed name already exists.');
  lines.push('DO $$');
  lines.push('DECLARE');
  lines.push('  v_cohorts_existing  INT;');
  lines.push('  v_projects_existing INT;');
  lines.push('  v_blogs_existing    INT;');
  lines.push('BEGIN');
  lines.push('  SELECT count(*) INTO v_cohorts_existing');
  lines.push('    FROM cohorts');
  lines.push(`   WHERE name IN (${sqlStringList(cohortNames)})`);
  lines.push('     AND "deletedAt" IS NULL;');
  lines.push('');
  lines.push('  SELECT count(*) INTO v_projects_existing');
  lines.push('    FROM projects');
  lines.push(`   WHERE name IN (${sqlStringList(projectNames)})`);
  lines.push('     AND "deletedAt" IS NULL;');
  lines.push('');
  lines.push('  SELECT count(*) INTO v_blogs_existing');
  lines.push('    FROM blog_posts');
  lines.push(`   WHERE title IN (${sqlStringList(blogTitles)})`);
  lines.push('     AND "deletedAt" IS NULL;');
  lines.push('');
  lines.push('  IF v_cohorts_existing > 0 THEN');
  lines.push(
    "    RAISE EXCEPTION 'seed aborted: % cohorts already exist with seed names', v_cohorts_existing;",
  );
  lines.push('  END IF;');
  lines.push('');
  lines.push('  IF v_projects_existing > 0 THEN');
  lines.push(
    "    RAISE EXCEPTION 'seed aborted: % projects already exist with seed names', v_projects_existing;",
  );
  lines.push('  END IF;');
  lines.push('');
  lines.push('  IF v_blogs_existing > 0 THEN');
  lines.push(
    "    RAISE EXCEPTION 'seed aborted: % blog_posts already exist with seed titles', v_blogs_existing;",
  );
  lines.push('  END IF;');
  lines.push('END $$;');
  lines.push('');

  lines.push('-- 1. Dummy display cohorts (status=CLOSED; recruit dates are placeholders).');
  lines.push(
    'INSERT INTO cohorts (name, "recruitStartAt", "recruitEndAt", status) VALUES',
  );
  lines.push(
    COHORTS.map(
      (c) =>
        `  (${sqlString(c.name)}, '${c.recruitStartAt}'::timestamp, '${c.recruitEndAt}'::timestamp, '${c.status}'::${COHORT_STATUS_ENUM_TYPE})`,
    ).join(',\n') + ';',
  );
  lines.push('');

  lines.push('-- 2. Projects (cohortId resolved via name; LATERAL ensures one cohort per row).');
  lines.push('INSERT INTO projects ("cohortId", platforms, name, description, "thumbnailUrl")');
  const projectSelects = PROJECTS.map((p) => {
    const thumbUrl = projectThumbUrls[p.fileName];
    if (!thumbUrl) {
      throw new Error(`Missing uploaded URL for ${p.fileName}`);
    }
    const platsLiteral = `ARRAY[${p.platforms.map((v) => sqlString(v)).join(', ')}]::${PLATFORM_ENUM_TYPE}[]`;
    return [
      'SELECT',
      `  c.id, ${platsLiteral}, ${sqlString(p.name)}, ${sqlString(p.description)}, ${sqlString(thumbUrl)}`,
      `FROM cohorts c WHERE c.name = ${sqlString(p.cohortName)} AND c."deletedAt" IS NULL`,
    ].join('\n');
  });
  lines.push(projectSelects.join('\nUNION ALL\n') + ';');
  lines.push('');

  const projectsWithMembers = PROJECTS.filter((p) => p.members && p.members.length > 0);
  if (projectsWithMembers.length > 0) {
    lines.push(
      `-- 3. Project members (Figma supplied roster for: ${projectsWithMembers
        .map((p) => p.name)
        .join(', ')}).`,
    );
    for (const project of projectsWithMembers) {
      const members = project.members ?? [];
      lines.push('WITH target AS (');
      lines.push(
        `  SELECT id FROM projects WHERE name = ${sqlString(project.name)} AND "deletedAt" IS NULL ORDER BY id DESC LIMIT 1`,
      );
      lines.push(')');
      lines.push('INSERT INTO project_members ("projectId", name, part)');
      lines.push('SELECT target.id, m.name, m.part FROM target CROSS JOIN (VALUES');
      lines.push(
        members
          .map((m) => `  (${sqlString(m.name)}, ${sqlString(m.part)})`)
          .join(',\n'),
      );
      lines.push(') AS m(name, part);');
      lines.push('');
    }
  }

  lines.push('-- 4. Blog posts (verified externalUrl only — Figma placeholders skipped).');
  lines.push(
    'INSERT INTO blog_posts (title, excerpt, thumbnail, "externalUrl") VALUES',
  );
  lines.push(
    BLOG_POSTS.map((b) => {
      const thumbUrl = blogThumbUrls[b.fileName];
      if (!thumbUrl) {
        throw new Error(`Missing uploaded URL for ${b.fileName}`);
      }
      return `  (${sqlString(b.title)}, ${sqlString(b.excerpt)}, ${sqlString(thumbUrl)}, ${sqlString(b.externalUrl)})`;
    }).join(',\n') + ';',
  );
  lines.push('');

  lines.push('-- 5. Post-insert assertions (each must return TRUE).');
  lines.push(
    `DO $$ BEGIN IF (SELECT count(*) FROM cohorts WHERE name IN (${sqlStringList(cohortNames)}) AND status = 'CLOSED' AND "deletedAt" IS NULL) <> ${COHORTS.length}`,
  );
  lines.push(
    `  THEN RAISE EXCEPTION 'assertion failed: expected ${COHORTS.length} CLOSED cohorts'; END IF; END $$;`,
  );
  lines.push(
    `DO $$ BEGIN IF (SELECT count(*) FROM projects WHERE name IN (${sqlStringList(projectNames)}) AND "deletedAt" IS NULL) <> ${PROJECTS.length}`,
  );
  lines.push(
    `  THEN RAISE EXCEPTION 'assertion failed: expected ${PROJECTS.length} projects'; END IF; END $$;`,
  );
  const totalMembers = PROJECTS.reduce((s, p) => s + (p.members?.length ?? 0), 0);
  lines.push(
    `DO $$ BEGIN IF (SELECT count(*) FROM project_members m JOIN projects p ON p.id = m."projectId" WHERE p.name IN (${sqlStringList(projectNames)})) <> ${totalMembers}`,
  );
  lines.push(
    `  THEN RAISE EXCEPTION 'assertion failed: expected ${totalMembers} project_members'; END IF; END $$;`,
  );
  lines.push(
    `DO $$ BEGIN IF (SELECT count(*) FROM blog_posts WHERE title IN (${sqlStringList(blogTitles)}) AND "deletedAt" IS NULL) <> ${BLOG_POSTS.length}`,
  );
  lines.push(
    `  THEN RAISE EXCEPTION 'assertion failed: expected ${BLOG_POSTS.length} blog_posts'; END IF; END $$;`,
  );
  lines.push('');

  lines.push('-- Inspect before COMMIT:');
  lines.push(
    `-- SELECT id, name, status FROM cohorts WHERE name IN (${sqlStringList(cohortNames)});`,
  );
  lines.push(
    '-- SELECT p.id, p.name, c.name AS cohort, p.platforms, p."thumbnailUrl" FROM projects p JOIN cohorts c ON c.id = p."cohortId" ORDER BY p.id DESC LIMIT 12;',
  );
  lines.push(
    "-- SELECT m.name, m.part FROM project_members m JOIN projects p ON p.id = m.\"projectId\" WHERE p.name LIKE 'FESTIBEE%';",
  );
  lines.push('-- SELECT id, title, "externalUrl" FROM blog_posts ORDER BY id DESC LIMIT 5;');
  lines.push('');
  lines.push('COMMIT;');
  lines.push('');

  return lines.join('\n');
}

function placeholderUrls(): { project: Record<string, string>; blog: Record<string, string> } {
  return {
    project: Object.fromEntries(
      PROJECTS.map((p) => [
        p.fileName,
        `https://storage.googleapis.com/PLACEHOLDER/projects/thumbnails/${p.fileName}`,
      ]),
    ),
    blog: Object.fromEntries(
      BLOG_POSTS.map((b) => [
        b.fileName,
        `https://storage.googleapis.com/PLACEHOLDER/blogs/thumbnails/${b.fileName}`,
      ]),
    ),
  };
}

async function uploadAllToGcs(args: {
  storage: Storage;
  bucketName: string;
  thumbsDir: string;
}): Promise<{ project: Record<string, string>; blog: Record<string, string> }> {
  const { storage, bucketName, thumbsDir } = args;

  const project: Record<string, string> = {};
  console.log('[upload] projects ->');
  for (const p of PROJECTS) {
    const url = await uploadToGcs({
      storage,
      bucketName,
      localPath: path.join(thumbsDir, p.fileName),
      gcsPath: GCS_PATH.PROJECT_THUMBNAIL,
    });
    project[p.fileName] = url;
    console.log(`  ${p.fileName.padEnd(28)} -> ${url}`);
  }

  const blog: Record<string, string> = {};
  console.log('[upload] blog posts ->');
  for (const b of BLOG_POSTS) {
    const url = await uploadToGcs({
      storage,
      bucketName,
      localPath: path.join(thumbsDir, b.fileName),
      gcsPath: GCS_PATH.BLOG_THUMBNAIL,
    });
    blog[b.fileName] = url;
    console.log(`  ${b.fileName.padEnd(28)} -> ${url}`);
  }

  return { project, blog };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const force = args.has('--force');

  const thumbsDir = path.resolve(__dirname, '..', 'tmp', 'figma-thumbs');
  if (!fs.existsSync(thumbsDir)) {
    throw new Error(`Thumbnail directory missing: ${thumbsDir}`);
  }
  for (const seed of [...PROJECTS, ...BLOG_POSTS]) {
    const local = path.join(thumbsDir, seed.fileName);
    if (!fs.existsSync(local)) {
      throw new Error(`Thumbnail file not found: ${local}`);
    }
  }
  console.log(`[ok] Verified ${PROJECTS.length + BLOG_POSTS.length} thumbnails exist locally.`);

  const manifestPath = path.resolve(__dirname, 'seed-figma.manifest.json');
  const sqlPath = path.resolve(__dirname, 'seed-figma.sql');

  let projectThumbUrls: Record<string, string>;
  let blogThumbUrls: Record<string, string>;
  let urlSource: string;

  if (dryRun) {
    const ph = placeholderUrls();
    projectThumbUrls = ph.project;
    blogThumbUrls = ph.blog;
    urlSource = 'dry-run placeholder URLs';
  } else if (fs.existsSync(manifestPath) && !force) {
    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      projectThumbUrls?: Record<string, string>;
      blogThumbUrls?: Record<string, string>;
    };
    if (!m.projectThumbUrls || !m.blogThumbUrls) {
      throw new Error(`Manifest at ${manifestPath} is malformed.`);
    }
    for (const p of PROJECTS) {
      if (!m.projectThumbUrls[p.fileName]) {
        throw new Error(`Manifest missing project URL for ${p.fileName}. Delete the manifest or run with --force.`);
      }
    }
    for (const b of BLOG_POSTS) {
      if (!m.blogThumbUrls[b.fileName]) {
        throw new Error(`Manifest missing blog URL for ${b.fileName}. Delete the manifest or run with --force.`);
      }
    }
    projectThumbUrls = m.projectThumbUrls;
    blogThumbUrls = m.blogThumbUrls;
    urlSource = `existing manifest (${manifestPath})`;
    console.log(`[ok] Reusing URLs from ${manifestPath} (skip GCS upload). Use --force to re-upload.`);
  } else {
    const provider = process.env.STORAGE_PROVIDER;
    const projectId = process.env.GCS_PROJECT_ID;
    const bucketName = process.env.GCS_BUCKET_NAME;
    const keyFilename = process.env.GCS_KEY_FILE_PATH;

    if (provider !== 'gcs' || !projectId || !bucketName) {
      throw new Error(
        'GCS not configured. Set STORAGE_PROVIDER=gcs and GCS_PROJECT_ID / GCS_BUCKET_NAME in .env, or run with --dry-run.',
      );
    }
    const storage = new Storage({
      projectId,
      ...(keyFilename ? { keyFilename } : {}),
    });
    // Note: matches production gcs.client.ts behavior — skip bucket.exists()
    // (requires storage.buckets.get, which object-write-only service accounts lack).
    // We rely on the upload itself to fail loudly if the bucket / permissions are wrong.
    console.log(`[ok] Targeting GCS bucket: ${bucketName}`);

    const uploaded = await uploadAllToGcs({ storage, bucketName, thumbsDir });
    projectThumbUrls = uploaded.project;
    blogThumbUrls = uploaded.blog;
    urlSource = `fresh GCS upload to ${bucketName}`;

    fs.writeFileSync(
      manifestPath,
      JSON.stringify(
        { generatedAt: new Date().toISOString(), bucketName, projectThumbUrls, blogThumbUrls },
        null,
        2,
      ),
      'utf8',
    );
    console.log(`[ok] Manifest written to ${manifestPath}`);
  }

  const generatedAt = new Date().toISOString();
  const sql = buildSql({ projectThumbUrls, blogThumbUrls, generatedAt });
  fs.writeFileSync(sqlPath, sql, 'utf8');

  console.log('');
  console.log(`[done] SQL  : ${sqlPath}`);
  console.log(`[done] URLs : ${urlSource}`);
  if (dryRun) {
    console.log('[dry-run] No GCS upload performed. Re-run without --dry-run to upload.');
  }
  console.log(
    '[next] Open the SQL in DataGrip on the prod connection, run it, inspect, then COMMIT.',
  );
}

main().catch((e) => {
  console.error('[error]', e);
  process.exit(1);
});
