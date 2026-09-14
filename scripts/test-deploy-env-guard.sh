#!/bin/sh
# deploy.yml 의 .env.production 검증 블록 회귀 테스트.
#
# 배포 스크립트는 .env 를 매번 처음부터 통째로 새로 쓴다. 그래서 기록부에서 한 줄이
# 빠지면 서버의 이전 값도 함께 사라지는데, 값이 없어도 앱은 정상 부팅한다.
# APPLY_URL 이 그런 값이다 - 빠지면 지원 시작 안내 메일의 '지원하기' 버튼만 조용히
# 사라지고 발송 로그는 성공으로 남는다. 검증 블록이 그 조용한 실패를 막는 자리이므로,
# 블록이 실제로 막는지를 여기서 고정한다.
#
# 블록은 워크플로 YAML 에서 그대로 추출해 실행한다. 로직을 복제하지 않으므로
# deploy.yml 이 바뀌면 이 테스트도 함께 따라간다(test-deploy-key-gate.sh 와 같은 방식).
#
# 실행: sh scripts/test-deploy-env-guard.sh

set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKFLOW="$ROOT/.github/workflows/deploy.yml"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
FAILED=0

# 12칸 들여쓰기를 벗겨 블록을 꺼낸다. Windows 체크아웃의 CRLF 는 sh 에서 `\r` 로 남아
# 명령을 깨뜨리므로 함께 지운다.
awk '
  index($0, "[5/8] 설정 파일 검증") { grab = 1 }
  grab { line = $0; sub(/^ {12}/, "", line); print line }
  grab && $0 ~ /^ {12}mv "\$ENV_TMP" \.env\.production$/ { exit }
' "$WORKFLOW" | tr -d '\r' > "$TMP/validate.sh"

if ! grep -q '^mv "\$ENV_TMP" \.env\.production$' "$TMP/validate.sh"; then
  echo "FAIL: deploy.yml 에서 검증 블록을 추출하지 못했습니다. 블록 구조가 바뀌었는지 확인하세요."
  exit 1
fi

APPLY_URL_LINE='APPLY_URL=https://dddstudy.kr/recruit/apply'

# 검증을 통과해야 하는 최소 .env. 각 테스트는 여기서 한 줄만 비튼다.
write_env() {
  {
    echo 'APP_IMAGE=ghcr.io/ddd-community/ddd-be:abc1234'
    echo 'DB_SYNCHRONIZE=false'
    [ -n "${OVERRIDE_APPLY:-}" ] && printf '%s\n' "$OVERRIDE_APPLY" || echo "$APPLY_URL_LINE"
    [ -n "${EXTRA_LINE:-}" ] && printf '%s\n' "$EXTRA_LINE" || true
    echo 'ENV_WRITE_COMPLETE=1'
  } > "$1"
}

# 블록은 $ENV_TMP 한 곳만 읽고 쓴다. df 는 실패 경로의 진단 출력이라 조용히 막는다.
run_validate() {
  ( cd "$TMP" && ENV_TMP=env.tmp sh -c 'df() { :; }; . ./validate.sh; echo "rc=$?"' 2>&1 ) || echo "rc=$?"
}

check() {
  name="$1"; expected_rc="$2"
  actual_rc="$(printf '%s' "$3" | sed -n 's/^rc=//p' | tail -1)"
  if [ "$actual_rc" = "$expected_rc" ]; then
    echo "  PASS  $name"
  else
    echo "  FAIL  $name (기대 rc=$expected_rc, 실제 rc=${actual_rc:-없음})"
    printf '%s\n' "$3" | sed 's/^/        /'
    FAILED=1
  fi
}

# 케이스마다 mv 결과가 남으므로 매번 지운다.
reset() { rm -f "$TMP/env.tmp" "$TMP/.env.production"; }

echo "--- .env.production 검증 블록 ---"

reset; OVERRIDE_APPLY='' EXTRA_LINE='' ; write_env "$TMP/env.tmp"
check "정상 .env 는 통과한다" 0 "$(run_validate)"

reset; OVERRIDE_APPLY='#' EXTRA_LINE='' ; write_env "$TMP/env.tmp"
sed -i.bak '/^#$/d' "$TMP/env.tmp"
check "APPLY_URL 이 빠지면 배포를 막는다" 1 "$(run_validate)"

reset; OVERRIDE_APPLY='' EXTRA_LINE="$APPLY_URL_LINE" ; write_env "$TMP/env.tmp"
check "APPLY_URL 이 두 번 기록되면 배포를 막는다" 1 "$(run_validate)"

reset; OVERRIDE_APPLY='APPLY_URL=https://ddd-fe-web.vercel.app/recruit/apply' EXTRA_LINE='' ; write_env "$TMP/env.tmp"
check "APPLY_URL 값이 도메인 전환 전 주소면 배포를 막는다" 1 "$(run_validate)"

reset; OVERRIDE_APPLY='APPLY_URL=' EXTRA_LINE='' ; write_env "$TMP/env.tmp"
check "APPLY_URL 값이 비면 배포를 막는다" 1 "$(run_validate)"

# 아래 둘은 이번 변경 이전부터 있던 가드다. 같은 블록이라 함께 고정한다.
reset; OVERRIDE_APPLY='' EXTRA_LINE='' ; write_env "$TMP/env.tmp"
sed -i.bak 's/^ENV_WRITE_COMPLETE=1$//' "$TMP/env.tmp"
check "센티널이 없으면 배포를 막는다" 1 "$(run_validate)"

reset; OVERRIDE_APPLY='' EXTRA_LINE='' ; write_env "$TMP/env.tmp"
sed -i.bak 's/^DB_SYNCHRONIZE=false$/DB_SYNCHRONIZE=true/' "$TMP/env.tmp"
check "DB_SYNCHRONIZE 가 false 가 아니면 배포를 막는다" 1 "$(run_validate)"

if [ "$FAILED" -ne 0 ]; then
  echo "검증 블록 회귀 테스트 실패"
  exit 1
fi
echo "검증 블록 회귀 테스트 통과"
