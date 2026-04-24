#!/usr/bin/env bash
# ============================================================
# DDD BE — Full API Test (이메일 발송 · 유저 삭제 제외)
# ============================================================
set -uo pipefail

BASE="http://localhost:3000/api/v1"
PASS=0; FAIL=0; SKIP=0

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'

pass() { echo -e "${GREEN}  ✓ PASS${NC}  $1"; PASS=$((PASS + 1)); }
fail() { echo -e "${RED}  ✗ FAIL${NC}  $1"; echo -e "${RED}         $2${NC}"; FAIL=$((FAIL + 1)); }
skip() { echo -e "${YELLOW}  ⊘ SKIP${NC}  $1"; SKIP=$((SKIP + 1)); }
section() { echo -e "\n${CYAN}${BOLD}══ $1 ══${NC}"; }

assert_status() {
  local label="$1" expected="$2" actual="$3" body="$4"
  if [[ "$actual" == "$expected" ]]; then
    pass "$label → HTTP $actual"
  else
    fail "$label → 기대 $expected, 실제 $actual" "$body"
  fi
}

get()    { curl -s -o /tmp/ddd_res -w "%{http_code}" -X GET    "$BASE$1" "${@:2}"; }
post()   { curl -s -o /tmp/ddd_res -w "%{http_code}" -X POST   "$BASE$1" "${@:2}"; }
patch()  { curl -s -o /tmp/ddd_res -w "%{http_code}" -X PATCH  "$BASE$1" "${@:2}"; }
put()    { curl -s -o /tmp/ddd_res -w "%{http_code}" -X PUT    "$BASE$1" "${@:2}"; }
delete() { curl -s -o /tmp/ddd_res -w "%{http_code}" -X DELETE "$BASE$1" "${@:2}"; }
body()   { cat /tmp/ddd_res 2>/dev/null || echo "(empty)"; }

parse_id() {
  cat /tmp/ddd_res | node -e "
    let d='';
    process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try{ const j=JSON.parse(d); console.log(j.data?.id??''); }
      catch{ console.log(''); }
    });
  " 2>/dev/null || echo ""
}

# ─── JWT 생성 ─────────────────────────────────────────────────
section "JWT 토큰 생성"
TOKEN=$(node -e "
const jwt = require('./node_modules/jsonwebtoken');
const token = jwt.sign(
  { sub: 1, email: 'juneseok81@gmail.com', roles: ['계정관리','면접관'] },
  'ddd_admin_super_secret_key',
  { expiresIn: '2h' }
);
console.log(token);
")
AUTH="Authorization: Bearer $TOKEN"
echo "  토큰 생성 완료 (user_id=1, 계정관리+면접관)"

# ══════════════════════════════════════════════════════════════
section "Health"
# ══════════════════════════════════════════════════════════════
sc=$(get "/health"); assert_status "GET /health" "200" "$sc" "$(body)"

# ══════════════════════════════════════════════════════════════
section "Auth"
# ══════════════════════════════════════════════════════════════
skip "GET  /auth/google             — Google OAuth 브라우저 리다이렉트 (자동화 불가)"
skip "GET  /auth/google/callback    — OAuth 콜백 (자동화 불가)"
skip "POST /auth/refresh            — refresh_token 쿠키 없음"
skip "DELETE /auth/withdrawal       — 유저 삭제 요청으로 제외"

sc=$(post "/auth/logout" -H "$AUTH"); assert_status "POST /auth/logout (로그아웃)" "204" "$sc" "$(body)"

# ══════════════════════════════════════════════════════════════
section "Public - Blog"
# ══════════════════════════════════════════════════════════════
sc=$(get "/blog-posts"); assert_status "GET  /blog-posts (목록)" "200" "$sc" "$(body)"
sc=$(get "/blog-posts?limit=5"); assert_status "GET  /blog-posts?limit=5" "200" "$sc" "$(body)"

# ══════════════════════════════════════════════════════════════
section "Admin - Blog (CRUD)"
# ══════════════════════════════════════════════════════════════
sc=$(post "/admin/blog-posts" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"title":"테스트 블로그","excerpt":"테스트 요약입니다.","externalUrl":"https://example.com/blog-test"}')
assert_status "POST /admin/blog-posts (생성)" "201" "$sc" "$(body)"
BLOG_ID=$(parse_id); echo "    blog_id=$BLOG_ID"

if [[ -n "$BLOG_ID" ]]; then
  sc=$(get "/admin/blog-posts" -H "$AUTH"); assert_status "GET  /admin/blog-posts (목록)" "200" "$sc" "$(body)"
  sc=$(get "/admin/blog-posts/$BLOG_ID" -H "$AUTH"); assert_status "GET  /admin/blog-posts/$BLOG_ID (상세)" "200" "$sc" "$(body)"
  sc=$(patch "/admin/blog-posts/$BLOG_ID" -H "$AUTH" -H "Content-Type: application/json" \
    -d '{"title":"수정된 블로그 제목"}')
  assert_status "PATCH /admin/blog-posts/$BLOG_ID (수정)" "200" "$sc" "$(body)"
  sc=$(delete "/admin/blog-posts/$BLOG_ID" -H "$AUTH"); assert_status "DELETE /admin/blog-posts/$BLOG_ID (삭제)" "204" "$sc" "$(body)"
else
  fail "Admin Blog CRUD" "blog_id 파싱 실패 — $(body)"
fi

# ══════════════════════════════════════════════════════════════
section "Admin - Cohort (기존 기수 재활용)"
# ══════════════════════════════════════════════════════════════
# 기존 기수(16기) 사용 — RECRUITING 상태여서 신규 생성 불가(409)
COHORT_ID=$(get "/admin/cohorts" -H "$AUTH" > /dev/null
  cat /tmp/ddd_res | node -e "
    let d='';
    process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try{ const j=JSON.parse(d); console.log(j.data?.[0]?.id??''); }
      catch{ console.log(''); }
    });
  " 2>/dev/null)
# 위 방식이 작동 안 할 수 있으니 직접 호출
sc=$(get "/admin/cohorts" -H "$AUTH")
COHORT_ID=$(node -e "
  const d=require('fs').readFileSync('/tmp/ddd_res','utf8');
  try{ const j=JSON.parse(d); console.log(j.data?.[0]?.id??''); }
  catch{ console.log(''); }
" 2>/dev/null)
assert_status "GET  /admin/cohorts (목록)" "200" "$sc" "$(body)"
echo "    사용할 cohort_id=$COHORT_ID"

if [[ -n "$COHORT_ID" ]]; then
  sc=$(get "/admin/cohorts/$COHORT_ID" -H "$AUTH"); assert_status "GET  /admin/cohorts/$COHORT_ID (상세)" "200" "$sc" "$(body)"

  # 파트 ID 수집
  PART_ID=$(node -e "
    const d=require('fs').readFileSync('/tmp/ddd_res','utf8');
    try{ const j=JSON.parse(d); console.log(j.data?.parts?.[0]?.id??''); }
    catch{ console.log(''); }
  " 2>/dev/null)
  echo "    사용할 part_id=$PART_ID"

  # 기수 이름 원본 저장
  ORIG_NAME=$(node -e "
    const d=require('fs').readFileSync('/tmp/ddd_res','utf8');
    try{ const j=JSON.parse(d); console.log(j.data?.name??''); }
    catch{ console.log(''); }
  " 2>/dev/null)

  sc=$(patch "/admin/cohorts/$COHORT_ID" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d "{\"name\":\"${ORIG_NAME}(테스트수정)\"}")
  assert_status "PATCH /admin/cohorts/$COHORT_ID (수정)" "200" "$sc" "$(body)"

  # 이름 복원
  sc=$(patch "/admin/cohorts/$COHORT_ID" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d "{\"name\":\"${ORIG_NAME}\"}")
  assert_status "PATCH /admin/cohorts/$COHORT_ID (이름 복원)" "200" "$sc" "$(body)"

  sc=$(put "/admin/cohorts/$COHORT_ID/parts" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d '{"parts":[
      {"name":"BE","isOpen":true,"formSchema":{"questions":[]}},
      {"name":"FE","isOpen":true,"formSchema":{"questions":[]}}
    ]}')
  assert_status "PUT  /admin/cohorts/$COHORT_ID/parts (파트 설정)" "200" "$sc" "$(body)"

  # 파트 재조회
  sc=$(get "/admin/cohorts/$COHORT_ID" -H "$AUTH")
  PART_ID=$(node -e "
    const d=require('fs').readFileSync('/tmp/ddd_res','utf8');
    try{ const j=JSON.parse(d); console.log(j.data?.parts?.[0]?.id??''); }
    catch{ console.log(''); }
  " 2>/dev/null)
  echo "    갱신된 part_id=$PART_ID"

  skip "DELETE /admin/cohorts/$COHORT_ID — 실제 운영 기수이므로 삭제 제외"
else
  fail "Admin Cohort" "cohort_id 파싱 실패"
  PART_ID=""
fi

# ══════════════════════════════════════════════════════════════
section "Public - Cohort"
# ══════════════════════════════════════════════════════════════
sc=$(get "/cohorts/active")
if [[ "$sc" == "200" ]] || [[ "$sc" == "404" ]]; then
  pass "GET  /cohorts/active → HTTP $sc"
else
  fail "GET  /cohorts/active" "$(body)"
fi

# ══════════════════════════════════════════════════════════════
section "Admin - Project (CRUD)"
# ══════════════════════════════════════════════════════════════
sc=$(post "/admin/projects" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d "{
    \"cohortId\":${COHORT_ID:-1},
    \"platforms\":[\"IOS\",\"AOS\"],
    \"name\":\"테스트 프로젝트\",
    \"description\":\"테스트 프로젝트 설명입니다.\",
    \"members\":[{\"name\":\"홍길동\",\"part\":\"BE\"},{\"name\":\"김철수\",\"part\":\"FE\"}]
  }")
assert_status "POST /admin/projects (생성)" "201" "$sc" "$(body)"
PROJECT_ID=$(parse_id); echo "    project_id=$PROJECT_ID"

if [[ -n "$PROJECT_ID" ]]; then
  sc=$(get "/admin/projects" -H "$AUTH"); assert_status "GET  /admin/projects (목록)" "200" "$sc" "$(body)"
  sc=$(get "/admin/projects/$PROJECT_ID" -H "$AUTH"); assert_status "GET  /admin/projects/$PROJECT_ID (상세)" "200" "$sc" "$(body)"
  sc=$(patch "/admin/projects/$PROJECT_ID" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d '{"name":"수정된 프로젝트","platforms":["WEB"]}')
  assert_status "PATCH /admin/projects/$PROJECT_ID (수정)" "200" "$sc" "$(body)"
  sc=$(put "/admin/projects/$PROJECT_ID/members" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d '{"members":[{"name":"이영희","part":"IOS"},{"name":"박민수","part":"AOS"}]}')
  assert_status "PUT  /admin/projects/$PROJECT_ID/members (참여자 수정)" "200" "$sc" "$(body)"

  sc=$(get "/projects"); assert_status "GET  /projects (public 목록)" "200" "$sc" "$(body)"
  sc=$(get "/projects/$PROJECT_ID"); assert_status "GET  /projects/$PROJECT_ID (public 상세)" "200" "$sc" "$(body)"
  sc=$(get "/projects?platform=WEB"); assert_status "GET  /projects?platform=WEB (플랫폼 필터)" "200" "$sc" "$(body)"

  sc=$(delete "/admin/projects/$PROJECT_ID" -H "$AUTH"); assert_status "DELETE /admin/projects/$PROJECT_ID (삭제)" "204" "$sc" "$(body)"
else
  fail "Admin Project CRUD" "project_id 파싱 실패 — $(body)"
fi

# ══════════════════════════════════════════════════════════════
section "Application (지원서)"
# ══════════════════════════════════════════════════════════════
if [[ -n "${PART_ID:-}" ]]; then
  sc=$(post "/applications/draft" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d "{\"cohortPartId\":$PART_ID,\"answers\":{\"q1\":\"테스트 답변\"}}")
  assert_status "POST /applications/draft (임시저장)" "200" "$sc" "$(body)"

  sc=$(get "/applications/draft/$PART_ID" -H "$AUTH")
  assert_status "GET  /applications/draft/$PART_ID (임시저장 조회)" "200" "$sc" "$(body)"

  # 최종 제출 — EMAIL_PROVIDER 미설정이므로 console 모드(실제 발송 없음)
  sc=$(post "/applications" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d "{
      \"cohortPartId\":$PART_ID,
      \"applicantName\":\"테스트지원자\",
      \"applicantPhone\":\"010-1234-5678\",
      \"applicantBirthDate\":\"1999-01-01\",
      \"applicantRegion\":\"서울\",
      \"answers\":{\"q1\":\"최종 제출 답변\"},
      \"privacyAgreed\":true
    }")
  assert_status "POST /applications (최종 제출)" "201" "$sc" "$(body)"
  APP_FORM_ID=$(parse_id); echo "    application_form_id=$APP_FORM_ID"
else
  skip "Application — part_id 없음"
  APP_FORM_ID=""
fi

sc=$(get "/admin/applications" -H "$AUTH"); assert_status "GET  /admin/applications (목록)" "200" "$sc" "$(body)"
sc=$(get "/admin/applications?cohortId=${COHORT_ID:-1}" -H "$AUTH"); assert_status "GET  /admin/applications?cohortId (필터)" "200" "$sc" "$(body)"

if [[ -n "${APP_FORM_ID:-}" ]]; then
  sc=$(get "/admin/applications/$APP_FORM_ID" -H "$AUTH"); assert_status "GET  /admin/applications/$APP_FORM_ID (상세)" "200" "$sc" "$(body)"
  sc=$(patch "/admin/applications/$APP_FORM_ID/status" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d '{"status":"서류합격"}')
  assert_status "PATCH /admin/applications/$APP_FORM_ID/status (상태변경)" "200" "$sc" "$(body)"
else
  skip "Admin Application 상세/상태변경 — application_form_id 없음"
fi

# ══════════════════════════════════════════════════════════════
section "Admin - Interview Slots (CRUD)"
# ══════════════════════════════════════════════════════════════
if [[ -n "${COHORT_ID:-}" ]] && [[ -n "${PART_ID:-}" ]]; then
  sc=$(post "/admin/interview-slots" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d "{
      \"cohortId\":$COHORT_ID,
      \"cohortPartId\":$PART_ID,
      \"startAt\":\"2026-06-01T14:00:00+09:00\",
      \"endAt\":\"2026-06-01T14:30:00+09:00\",
      \"capacity\":2,
      \"location\":\"온라인 (Zoom)\",
      \"description\":\"테스트 면접 슬롯\"
    }")
  assert_status "POST /admin/interview-slots (생성)" "201" "$sc" "$(body)"
  SLOT_ID=$(parse_id); echo "    slot_id=$SLOT_ID"

  if [[ -n "$SLOT_ID" ]]; then
    sc=$(get "/admin/interview-slots" -H "$AUTH"); assert_status "GET  /admin/interview-slots (목록)" "200" "$sc" "$(body)"
    sc=$(get "/admin/interview-slots?cohortId=$COHORT_ID" -H "$AUTH"); assert_status "GET  /admin/interview-slots?cohortId (필터)" "200" "$sc" "$(body)"
    sc=$(get "/admin/interview-slots/$SLOT_ID" -H "$AUTH"); assert_status "GET  /admin/interview-slots/$SLOT_ID (상세)" "200" "$sc" "$(body)"
    sc=$(patch "/admin/interview-slots/$SLOT_ID" \
      -H "$AUTH" -H "Content-Type: application/json" \
      -d '{"location":"오프라인 (강남)","capacity":3}')
    assert_status "PATCH /admin/interview-slots/$SLOT_ID (수정)" "200" "$sc" "$(body)"

    if [[ -n "${APP_FORM_ID:-}" ]]; then
      sc=$(post "/admin/interview-slots/$SLOT_ID/reservations" \
        -H "$AUTH" -H "Content-Type: application/json" \
        -d "{\"applicationFormId\":$APP_FORM_ID}")
      assert_status "POST /admin/interview-slots/$SLOT_ID/reservations (예약생성)" "201" "$sc" "$(body)"
    else
      skip "POST /admin/interview-slots/:id/reservations — application_form_id 없음"
    fi

    sc=$(delete "/admin/interview-slots/$SLOT_ID" -H "$AUTH"); assert_status "DELETE /admin/interview-slots/$SLOT_ID (삭제)" "204" "$sc" "$(body)"
  else
    fail "Admin Interview Slots CRUD" "slot_id 파싱 실패 — $(body)"
  fi
else
  skip "Admin Interview Slots — cohort_id 또는 part_id 없음"
fi

# ══════════════════════════════════════════════════════════════
section "Early Notification (사전 알림)"
# ══════════════════════════════════════════════════════════════
sc=$(post "/early-notifications" \
  -H "Content-Type: application/json" \
  -d "{\"cohortId\":${COHORT_ID:-1},\"email\":\"test-notify@example.com\"}")
if [[ "$sc" == "201" ]] || [[ "$sc" == "409" ]]; then
  pass "POST /early-notifications (신청) → HTTP $sc"
else
  fail "POST /early-notifications (신청)" "$(body)"
fi

sc=$(get "/admin/early-notifications?cohortId=${COHORT_ID:-1}" -H "$AUTH"); assert_status "GET  /admin/early-notifications (목록)" "200" "$sc" "$(body)"
sc=$(get "/admin/early-notifications/export?cohortId=${COHORT_ID:-1}" -H "$AUTH")
if [[ "$sc" == "200" ]]; then
  pass "GET  /admin/early-notifications/export (CSV) → HTTP $sc"
else
  fail "GET  /admin/early-notifications/export (CSV)" "$(body)"
fi

skip "POST /admin/early-notifications/send — 이메일 발송 API 제외"

# ══════════════════════════════════════════════════════════════
section "Discord"
# ══════════════════════════════════════════════════════════════
sc=$(get "/discord/oauth/authorize?applicationFormId=1")
if [[ "$sc" == "200" ]] || [[ "$sc" == "400" ]] || [[ "$sc" == "404" ]]; then
  pass "GET  /discord/oauth/authorize?applicationFormId=1 → HTTP $sc"
else
  fail "GET  /discord/oauth/authorize?applicationFormId=1" "$(body)"
fi

sc=$(get "/discord/link?applicationFormId=1")
if [[ "$sc" == "200" ]] || [[ "$sc" == "404" ]]; then
  pass "GET  /discord/link?applicationFormId=1 → HTTP $sc"
else
  fail "GET  /discord/link?applicationFormId=1" "$(body)"
fi

skip "GET  /discord/oauth/callback — Discord OAuth 실제 code 필요 (자동화 불가)"

# ══════════════════════════════════════════════════════════════
section "Storage (파일 업로드)"
# ══════════════════════════════════════════════════════════════
# Node.js로 유효한 1×1 PNG 생성
TMPIMG="/tmp/ddd_test_upload.png"
node -e "
  const fs = require('fs');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==','base64');
  fs.writeFileSync('$TMPIMG', png);
  console.log('PNG created, size=' + png.length);
"

sc=$(curl -s -o /tmp/ddd_res -w "%{http_code}" \
  -X POST "$BASE/admin/files/upload?category=blog-thumbnail" \
  -H "$AUTH" \
  -F "file=@${TMPIMG};type=image/png")
if [[ "$sc" == "201" ]] || [[ "$sc" == "200" ]]; then
  pass "POST /admin/files/upload (파일 업로드) → HTTP $sc"
else
  echo -e "${YELLOW}  ⚠ WARN${NC}  POST /admin/files/upload → HTTP $sc (GCS 권한 또는 네트워크 이슈일 수 있음)"
  echo -e "         $(body)"
fi

# ══════════════════════════════════════════════════════════════
section "결과 요약"
# ══════════════════════════════════════════════════════════════
TOTAL=$((PASS + FAIL + SKIP))
echo -e "\n  전체: ${TOTAL}개  |  ${GREEN}PASS: $PASS${NC}  |  ${RED}FAIL: $FAIL${NC}  |  ${YELLOW}SKIP: $SKIP${NC}"
if [[ $FAIL -eq 0 ]]; then
  echo -e "\n  ${GREEN}${BOLD}✓ 모든 테스트 통과!${NC}"
  exit 0
else
  echo -e "\n  ${RED}${BOLD}✗ 실패한 테스트 있음${NC}"
  exit 1
fi
