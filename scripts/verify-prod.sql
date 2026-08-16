-- Run on prod_admin (ddd_admin) connection in DataGrip.
-- Read-only. No mutations.

SELECT
  (SELECT count(*) FROM cohorts)         AS cohorts_count,
  (SELECT count(*) FROM cohort_parts)    AS cohort_parts_count,
  (SELECT count(*) FROM projects)        AS projects_count,
  (SELECT count(*) FROM project_members) AS project_members_count,
  (SELECT count(*) FROM blog_posts)      AS blog_posts_count;

-- Cohorts (name + status + recruit window)
SELECT id, name, status, "recruitStartAt", "recruitEndAt", "deletedAt"
  FROM cohorts
 ORDER BY id;

-- Recent projects (if any)
SELECT id, name, "cohortId", platforms, "thumbnailUrl", "deletedAt"
  FROM projects
 ORDER BY id DESC
 LIMIT 20;

-- All blog posts (if any)
SELECT id, title, "externalUrl", thumbnail, "createdAt", "deletedAt"
  FROM blog_posts
 ORDER BY id DESC
 LIMIT 20;

-- Confirm enum types referenced by the seed SQL.
-- Expected: cohorts_status_enum has UPCOMING/RECRUITING/ACTIVE/CLOSED.
-- Expected: projects_platforms_enum has IOS/AOS/WEB.
SELECT 'projects.platforms element type' AS what,
       pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type
  FROM pg_attribute a
  JOIN pg_class c ON a.attrelid = c.oid
 WHERE c.relname = 'projects' AND a.attname = 'platforms';

SELECT 'cohorts_status_enum values' AS what,
       string_agg(enumlabel, ',' ORDER BY enumsortorder) AS values
  FROM pg_enum
 WHERE enumtypid = 'cohorts_status_enum'::regtype;

SELECT 'projects_platforms_enum values' AS what,
       string_agg(enumlabel, ',' ORDER BY enumsortorder) AS values
  FROM pg_enum
 WHERE enumtypid = 'projects_platforms_enum'::regtype;
