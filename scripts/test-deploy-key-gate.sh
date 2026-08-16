#!/bin/sh
# deploy.yml 의 GCP 키 게이트(uid 분기 + 키 검사) 회귀 테스트.
#
# 워크플로 YAML 에서 해당 블록을 그대로 추출해 실행한다. 로직을 복제하지 않으므로
# deploy.yml 이 바뀌면 이 테스트도 함께 따라간다.
# sudo / docker 는 스텁으로 대체해 시나리오별 반환값을 주입한다.
#
# 실행: sh scripts/test-deploy-key-gate.sh
#
# 이 분기는 한 번 뭉뚱그렸다가 실제로 뚫린 적이 있다(uid 확인 실패와 예상 밖 uid 가
# 검사 없이 통과). 세 갈래 판정이 유지되는지 기계적으로 확인한다.

set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKFLOW="$ROOT/.github/workflows/deploy.yml"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# YAML 인라인 스크립트에서 게이트 블록만 추출 (IMAGE_UID= 로 시작, 대응하는 fi 까지)
awk '
  /IMAGE_UID="\$\(sudo docker run/ { grab = 1 }
  grab { sub(/^ {12}/, ""); print }
  grab && /^fi$/ { exit }
' "$WORKFLOW" > "$TMP/gate.sh"

if ! grep -q 'IMAGE_UID' "$TMP/gate.sh"; then
  echo "FAIL: deploy.yml 에서 게이트 블록을 추출하지 못했습니다. 블록 구조가 바뀌었는지 확인하세요."
  exit 1
fi

# 시나리오 실행: $1=이미지 uid("" 면 확인 실패), $2=키 검사 종료코드
run_case() {
  fake_uid="$1"
  key_rc="$2"
  cat > "$TMP/run.sh" <<STUB
set -eu
APP_IMAGE=stub-image
sudo() { "\$@"; }
docker() {
  case "\$*" in
    *"id -u"*)  [ -n "$fake_uid" ] || return 1; echo "$fake_uid" ;;
    *node*)     return $key_rc ;;
    *)          return 0 ;;
  esac
}
ls() { :; }
STUB
  cat "$TMP/gate.sh" >> "$TMP/run.sh"
  sh "$TMP/run.sh" 2>&1
  echo "rc=$?"
}

assert() {
  name="$1"; expected_rc="$2"; expected_text="$3"; out="$4"
  actual_rc="$(printf '%s' "$out" | sed -n 's/^rc=//p' | tail -1)"
  if [ "$actual_rc" = "$expected_rc" ] && printf '%s' "$out" | grep -q "$expected_text"; then
    echo "  PASS  $name"
  else
    echo "  FAIL  $name (기대 rc=$expected_rc/'$expected_text', 실제 rc=$actual_rc)"
    printf '%s\n' "$out" | sed 's/^/        /'
    FAILED=1
  fi
}

FAILED=0
echo "deploy.yml GCP 키 게이트"

assert "uid 10001 + 키 정상 → 통과" 0 "GCP 키 사용 가능 확인" "$(run_case 10001 0 || true)"
assert "uid 10001 + 키 불가 → 배포 중단" 1 "ERROR" "$(run_case 10001 1 || true)"
assert "uid 100(구 이미지 롤백) → 경고 후 진행" 0 "::warning::" "$(run_case 100 1 || true)"
assert "예상 밖 uid → 배포 중단" 1 "예상 밖의 값" "$(run_case 10002 0 || true)"
assert "uid 확인 실패 → 배포 중단" 1 "확인불가" "$(run_case "" 0 || true)"

[ "$FAILED" = 0 ] && echo "모두 통과" || { echo "실패 있음"; exit 1; }
