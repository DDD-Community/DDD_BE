#!/bin/sh
# deploy.yml 의 GCP 키 게이트 회귀 테스트.
#
# 대상은 두 블록이다.
#   1) gid 충돌 게이트  — 키를 gid 10001 에 열기 전에 그 gid 를 쓰는 호스트 그룹이 없는지 확인
#   2) uid 분기 + 키 검사 — 배포할 이미지가 키를 실제로 읽고 파싱할 수 있는지 확인
#
# 두 블록 모두 워크플로 YAML 에서 그대로 추출해 실행한다. 로직을 복제하지 않으므로
# deploy.yml 이 바뀌면 이 테스트도 함께 따라간다.
# sudo / docker / getent 는 스텁으로 대체해 시나리오별 반환값을 주입한다.
#
# 실행: sh scripts/test-deploy-key-gate.sh
#
# 두 게이트 모두 한 번씩 뚫린 적이 있다. uid 분기는 "10001 이 아니면 통과" 로 뭉쳐
# 확인 실패와 예상 밖 uid 를 통과시켰고, gid 게이트는 getent 의 non-zero 를 전부
# "그룹 없음" 으로 처리해 조회 실패 시 검사가 우회됐다. 둘 다 여기서 고정한다.

set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKFLOW="$ROOT/.github/workflows/deploy.yml"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
FAILED=0

# YAML 인라인 스크립트에서 블록을 추출한다 ($1=시작 문자열, $2=종료 정규식, 12칸 들여쓰기 제거)
extract() {
  awk -v start="$1" -v stop="$2" '
    index($0, start) { grab = 1 }
    grab { line = $0; sub(/^ {12}/, "", line); print line }
    grab && $0 ~ stop { exit }
  ' "$WORKFLOW" > "$3"
  if [ ! -s "$3" ]; then
    echo "FAIL: deploy.yml 에서 블록을 추출하지 못했습니다 (start=$1). 구조가 바뀌었는지 확인하세요."
    exit 1
  fi
}

# 블록의 끝은 12칸 들여쓰기의 닫는 구문이다(내부 중첩은 14칸 이상이라 걸리지 않는다)
extract 'GETENT_RC=0' '^ {12}sudo chmod 640 gcp-key[.]json$' "$TMP/gid.sh"
extract 'IMAGE_UID="$(sudo docker run' '^ {12}fi$' "$TMP/uid.sh"

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

# --- gid 충돌 게이트 --------------------------------------------------------
# $1=getent 종료코드(0 발견 / 2 없음 / 그 외 조회실패), $2=chgrp 종료코드
run_gid() {
  cat > "$TMP/run.sh" <<STUB
set -eu
getent() { [ "$1" = "0" ] && echo "appgroup:x:10001:deployer"; return $1; }
chgrp()  { return $2; }
chmod()  { return 0; }
sudo()   { "\$@"; }
STUB
  cat "$TMP/gid.sh" >> "$TMP/run.sh"
  # set -e 가 켜져 있어 non-zero 종료를 직접 받으면 호출부가 죽는다. if 로 감싸 종료코드를 캡처한다.
  if out="$(sh "$TMP/run.sh" 2>&1)"; then rc=0; else rc=$?; fi
  printf '%s\nrc=%s\n' "$out" "$rc"
}

echo "deploy.yml gid 충돌 게이트"
assert "그룹 없음(rc=2) → 진행"          0 ""                     "$(run_gid 2 0)"
assert "그룹 존재(rc=0) → 배포 중단"      1 "이미 사용하는 그룹"     "$(run_gid 0 0)"
assert "조회 실패(rc=1) → 배포 중단"      1 "확인하지 못했습니다"    "$(run_gid 1 0)"
assert "getent 미설치(rc=127) → 배포 중단" 1 "확인하지 못했습니다"   "$(run_gid 127 0)"
assert "chgrp 실패 → 배포 중단"           1 "그룹을 변경하지 못했"   "$(run_gid 2 1)"

# --- uid 분기 + 키 검사 -----------------------------------------------------
# $1=이미지 uid("" 면 확인 실패), $2=키 검사 종료코드
run_uid() {
  cat > "$TMP/run.sh" <<STUB
set -eu
APP_IMAGE=stub-image
sudo() { "\$@"; }
docker() {
  case "\$*" in
    *"id -u"*)  [ -n "$1" ] || return 1; echo "$1" ;;
    *node*)     return $2 ;;
    *)          return 0 ;;
  esac
}
ls() { :; }
STUB
  cat "$TMP/uid.sh" >> "$TMP/run.sh"
  if out="$(sh "$TMP/run.sh" 2>&1)"; then rc=0; else rc=$?; fi
  printf '%s\nrc=%s\n' "$out" "$rc"
}

echo "deploy.yml uid 분기 + 키 검사"
assert "uid 10001 + 키 정상 → 통과"        0 "GCP 키 사용 가능 확인" "$(run_uid 10001 0)"
assert "uid 10001 + 키 불가 → 배포 중단"    1 "ERROR"                "$(run_uid 10001 1)"
assert "uid 100(롤백) → 경고 후 진행"       0 "::warning::"          "$(run_uid 100 1)"
assert "예상 밖 uid → 배포 중단"            1 "예상 밖의 값"          "$(run_uid 10002 0)"
assert "uid 확인 실패 → 배포 중단"          1 "확인불가"              "$(run_uid "" 0)"

[ "$FAILED" = 0 ] && echo "모두 통과" || { echo "실패 있음"; exit 1; }
