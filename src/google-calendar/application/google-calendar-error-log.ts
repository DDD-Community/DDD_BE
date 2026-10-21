/**
 * 연결 실패를 서버 로그에 남길 때 쓰는 요약. 형식이 정해진 식별자만 싣는다.
 *
 * 오류 메시지·설명문·응답 본문·요청 설정은 싣지 않는다. 내용을 통제할 수 없어
 * OAuth code 나 토큰이 섞여 들어와도 걸러낼 방법이 없기 때문이다.
 */

/** 영문·숫자·밑줄·점·하이픈만으로 된 짧은 식별자만 통과시킨다 (예: invalid_grant, 23505, UQ_abc) */
const IDENTIFIER_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/;

const asIdentifier = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return typeof value === 'string' && IDENTIFIER_PATTERN.test(value) ? value : null;
};

const describe = (fields: Array<[string, unknown]>): string =>
  fields
    .map(([key, value]) => [key, asIdentifier(value)] as const)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');

/** Google 호출 실패: 오류 종류·HTTP 상태·Google 공개 오류 코드(예: redirect_uri_mismatch)만 */
export const describeGoogleError = (error: unknown): string => {
  if (typeof error !== 'object' || error === null) {
    return 'name=non_object_error';
  }
  const record = error as {
    name?: unknown;
    status?: unknown;
    response?: { status?: unknown; data?: { error?: unknown } };
  };
  return (
    describe([
      ['name', record.name],
      ['status', record.response?.status ?? record.status],
      ['google_error', record.response?.data?.error],
    ]) || 'name=unknown'
  );
};

/** 저장 등 예상 밖 예외: 오류 종류와 DB 오류 코드·제약 조건·테이블 이름만 */
export const describeUnexpectedError = (error: unknown): string => {
  if (typeof error !== 'object' || error === null) {
    return 'name=non_object_error';
  }
  const record = error as {
    name?: unknown;
    code?: unknown;
    driverError?: { code?: unknown; constraint?: unknown; table?: unknown };
  };
  return (
    describe([
      ['name', record.name],
      ['code', record.driverError?.code ?? record.code],
      ['constraint', record.driverError?.constraint],
      ['table', record.driverError?.table],
    ]) || 'name=unknown'
  );
};
