-- =====================================================================
-- 기수-프로젝트 소속 교정
-- 작성일 : 2026-09-22
-- 대상   : 운영 DB (DataGrip prod_admin 커넥션)
-- 실행법 : 파일 전체 실행 -> 5번 리포트 확인 -> 손으로 COMMIT 또는 ROLLBACK.
--          이 파일은 스스로 커밋하지 않는다.
--
-- 근거   : 2026-09-22 공개 API(GET /api/v1/projects?limit=100) 로 조회한
--          운영 실데이터 23건 기준. 프로젝트 id 와 이름을 함께 못박아
--          대상이 하나라도 어긋나면 아무것도 바꾸지 않고 중단한다.
--
-- 바뀌는 것 : 프로젝트 11건의 "cohortId" 뿐. 이름/설명/썸네일/멤버는 손대지 않는다.
--             10기가 없으면 새로 만든다 (있으면 그대로 둔다).
-- =====================================================================

BEGIN;
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------
-- 1. 10기 확보 - 없을 때만 만든다. 이미 있으면 어떤 컬럼도 건드리지 않는다.
--    (모집일은 실제 일정을 확인하지 못해 반기 단위 placeholder 를 넣는다.
--     과거 기수의 모집일은 공개 화면에 노출되지 않는다.)
-- ---------------------------------------------------------------------
INSERT INTO cohorts (name, "recruitStartAt", "recruitEndAt", status)
SELECT '10기', '2023-07-01'::timestamp, '2023-12-31'::timestamp, 'CLOSED'::cohorts_status_enum
 WHERE NOT EXISTS (
   SELECT 1 FROM cohorts WHERE name = '10기' AND "deletedAt" IS NULL
 );

-- ---------------------------------------------------------------------
-- 2. 목표 상태 - 운영 실데이터 23건 전부. (id, 현재 등록된 이름, 있어야 할 기수)
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _target (
  project_id   int  NOT NULL,
  project_name text NOT NULL,
  cohort_name  text NOT NULL
) ON COMMIT DROP;

INSERT INTO _target (project_id, project_name, cohort_name) VALUES
  ( 7, '프리젠 (Pregen)'              , '10기'),
  ( 9, '프리지링크 (FridgeLink)'        , '10기'),
  (23, '와글와글 (Waggle Waggle)'      , '10기'),
  (24, '오피스 (OPEACE)'              , '10기'),
  (25, '맛나 (Manna)'                , '10기'),
  ( 4, '엠쿵'                        , '11기'),
  ( 5, '폴라보 (POLABO)'              , '11기'),
  ( 6, '모집 (MOZIP)'                , '11기'),
  (20, '포이즌 (Poizon)'              , '11기'),
  (21, '신입키트'                      , '11기'),
  (22, '자세공작소 (AlignLab)'          , '11기'),
  ( 1, '페스티비 (FESTIBEE)'           , '12기'),
  ( 2, '그로잇 (GROWIT)'              , '12기'),
  ( 3, '모여락 (MOYORAK)'             , '12기'),
  (17, '키플리 (Keeply)'              , '12기'),
  (18, '오늘의 이동'                    , '12기'),
  (19, '아맞당'                       , '12기'),
  (11, '식구 (Sikgu)'                , '13기'),
  (12, '퀴켓 (Quiket)'               , '13기'),
  (13, '픽플로우 (PICKFLOW)'           , '13기'),
  (14, '반가워 (BANGAWO)'             , '13기'),
  (15, '오구오구'                      , '13기'),
  (16, '디톡스메이트'                    , '13기');

-- ---------------------------------------------------------------------
-- 3. 사전 검증 - 하나라도 어긋나면 전체 중단
-- ---------------------------------------------------------------------

-- 3-1. id 가 없거나 이름이 달라진 경우 (그 사이 누가 고쳤다는 뜻)
DO $$
DECLARE v_bad text;
BEGIN
  SELECT string_agg(format('id=%s 기대=%L 실제=%L', t.project_id, t.project_name,
                           coalesce(p.name, '(없음)')), E'\n')
    INTO v_bad
    FROM _target t
    LEFT JOIN projects p ON p.id = t.project_id AND p."deletedAt" IS NULL
   WHERE p.id IS NULL OR p.name <> t.project_name;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION E'중단: 대상 프로젝트가 조회 시점과 다르다.\n%', v_bad;
  END IF;
END $$;

-- 3-2. 필요한 기수가 모두 있는지
DO $$
DECLARE v_missing text;
BEGIN
  SELECT string_agg(DISTINCT t.cohort_name, ', ')
    INTO v_missing
    FROM _target t
   WHERE NOT EXISTS (
     SELECT 1 FROM cohorts c WHERE c.name = t.cohort_name AND c."deletedAt" IS NULL
   );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '중단: 기수가 없다 -> %', v_missing;
  END IF;
END $$;

-- 3-3. 같은 이름의 기수가 둘 이상이면 어느 쪽인지 알 수 없으므로 중단
DO $$
DECLARE v_dup text;
BEGIN
  SELECT string_agg(format('%s (%s건)', name, cnt), ', ')
    INTO v_dup
    FROM (
      SELECT c.name, count(*) AS cnt
        FROM cohorts c
       WHERE c."deletedAt" IS NULL
         AND c.name IN (SELECT DISTINCT cohort_name FROM _target)
       GROUP BY c.name HAVING count(*) > 1
    ) d;

  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION '중단: 이름이 겹치는 기수가 있다 -> %', v_dup;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 4. 소속 교정 - 실제로 다른 것만 UPDATE
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _changed ON COMMIT DROP AS
SELECT p.id           AS project_id,
       p.name         AS project_name,
       old_c.name     AS old_cohort,
       t.cohort_name  AS new_cohort,
       new_c.id       AS new_cohort_id
  FROM _target t
  JOIN projects p   ON p.id = t.project_id AND p."deletedAt" IS NULL
  JOIN cohorts old_c ON old_c.id = p."cohortId"
  JOIN cohorts new_c ON new_c.name = t.cohort_name AND new_c."deletedAt" IS NULL
 WHERE p."cohortId" <> new_c.id;

UPDATE projects p
   SET "cohortId"  = c.new_cohort_id,
       "updatedAt" = now()
  FROM _changed c
 WHERE p.id = c.project_id;

-- ---------------------------------------------------------------------
-- 5. 리포트 - COMMIT 전에 확인할 것
-- ---------------------------------------------------------------------

-- 5-1. 이번에 옮겨진 프로젝트 (11건 예상)
SELECT '5-1 옮겨짐' AS report, project_id, project_name, old_cohort, new_cohort
  FROM _changed
 ORDER BY new_cohort, project_id;

-- 5-2. 교정 후 기수별 팀 목록 (10기 5 / 11기 6 / 12기 6 / 13기 6 이어야 한다)
SELECT '5-2 최종 배치' AS report, c.name AS cohort, p.id, p.name
  FROM projects p
  JOIN cohorts c ON c.id = p."cohortId"
 WHERE p."deletedAt" IS NULL
 ORDER BY c.name, p.id;

-- 5-3. 기수별 팀 수
SELECT '5-3 기수별 집계' AS report, c.id, c.name, c.status,
       count(p.id) FILTER (WHERE p."deletedAt" IS NULL) AS projects
  FROM cohorts c
  LEFT JOIN projects p ON p."cohortId" = c.id
 WHERE c."deletedAt" IS NULL
 GROUP BY c.id, c.name, c.status
 ORDER BY c.id;

-- =====================================================================
-- 확인이 끝나면 손으로 실행할 것:  COMMIT;   (되돌리려면 ROLLBACK;)
-- =====================================================================
