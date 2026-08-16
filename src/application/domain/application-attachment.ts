/**
 * 지원서 첨부파일(포트폴리오 PDF) 경로 규칙.
 *
 * 첨부는 `applications/attachments/{userId}/{uuid}.pdf` 로 저장한다.
 * 경로에 소유자를 박아두면 열람 권한 검증이 문자열 비교로 끝나고,
 * answers 안에 남의 첨부 경로를 섞어 넣는 것도 같은 규칙으로 막을 수 있다.
 */
export const ATTACHMENT_PATH_PREFIX = 'applications/attachments';

/**
 * answers 탐색 깊이 상한.
 *
 * 순환 참조는 answers 가 JSON 파싱 결과라 발생할 수 없으므로, 이 상한의 목적은
 * 스택 오버플로를 노린 과도한 중첩을 막는 것뿐이다. 프런트가 쓸 법한 중첩
 * (섹션 > 질문 배열 > 답변 > 파일 배열)을 여유 있게 담도록 넉넉히 잡는다.
 */
export const MAX_ANSWER_DEPTH = 12;

/** 탐색 상한을 넘은 answers. 저장 시점에 거부해야 파기 시 미탐이 생기지 않는다. */
export class TooDeepAnswersError extends Error {
  constructor() {
    super(`answers 중첩이 허용 깊이(${MAX_ANSWER_DEPTH})를 초과했습니다.`);
    this.name = 'TooDeepAnswersError';
  }
}

export type ApplicationAttachment = {
  path: string;
  originalName: string;
  size: number;
};

export const buildAttachmentSubPath = ({ userId }: { userId: number }): string => String(userId);

/** 스토리지 경로에 허용하는 문자. traversal·인코딩 우회를 여기서 끊는다. */
const SAFE_ATTACHMENT_PATH_PATTERN = /^[a-zA-Z0-9._\-/]+$/;

const hasSafePathShape = ({ path }: { path: string }): boolean => {
  if (!path || path.length > 1024 || !SAFE_ATTACHMENT_PATH_PATTERN.test(path)) {
    return false;
  }
  return !path.split('/').some((segment) => segment === '' || segment === '.' || segment === '..');
};

export const isAttachmentPath = ({ path }: { path: string }): boolean =>
  hasSafePathShape({ path }) && path.startsWith(`${ATTACHMENT_PATH_PREFIX}/`);

/**
 * 경로 형식까지 여기서 함께 검증한다.
 * `applications/attachments/12/../99/x.pdf` 는 접두어만 보면 통과하므로,
 * 형식 검사를 storage 쪽 하류 가드에 미루면 이 게이트를 쓰는 새 호출자가
 * 생기는 순간 그대로 취약점이 된다.
 */
export const isOwnedAttachmentPath = ({
  path,
  userId,
}: {
  path: string;
  userId: number;
}): boolean =>
  hasSafePathShape({ path }) && path.startsWith(`${ATTACHMENT_PATH_PREFIX}/${userId}/`);

/**
 * answers JSON 안에 들어있는 첨부 경로를 모두 모은다.
 *
 * 질문 스키마가 자유 형식(jsonb)이라 첨부가 어느 위치·어느 키·어느 모양으로
 * 오는지 고정할 수 없다. 그래서 특정 키(`path`)나 특정 깊이를 가정하지 않고
 * **모든 문자열 값**을 검사한다. 여기서 놓친 경로는 소유권 검증도 통과하고
 * 180일 파기에서도 누락되므로, 미탐은 곧 개인정보 잔존이다.
 *
 * 깊이 상한을 넘으면 조용히 무시하지 않고 던진다(fail-closed). 저장 시점에
 * 거부되므로 DB에 들어간 answers 는 항상 이 함수로 완전히 훑을 수 있다.
 *
 * @throws {TooDeepAnswersError} 중첩이 MAX_ANSWER_DEPTH 를 초과한 경우
 */
export const collectAttachmentPaths = ({ answers }: { answers: unknown }): string[] => {
  const paths = new Set<string>();

  const visit = (value: unknown, depth: number): void => {
    if (typeof value === 'string') {
      if (isAttachmentPath({ path: value })) {
        paths.add(value);
      }
      return;
    }

    if (value === null || typeof value !== 'object') {
      return;
    }

    if (depth >= MAX_ANSWER_DEPTH) {
      throw new TooDeepAnswersError();
    }

    // 배열도 Object.values 로 함께 순회된다.
    for (const child of Object.values(value as Record<string, unknown>)) {
      visit(child, depth + 1);
    }
  };

  visit(answers, 0);
  return [...paths];
};

/** answers 안의 첨부 중 해당 사용자 소유가 아닌 경로를 돌려준다. */
export const findForeignAttachmentPaths = ({
  answers,
  userId,
}: {
  answers: unknown;
  userId: number;
}): string[] =>
  collectAttachmentPaths({ answers }).filter((path) => !isOwnedAttachmentPath({ path, userId }));
