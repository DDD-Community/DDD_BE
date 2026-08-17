import type { ValidationError } from 'class-validator';

// class-validator 는 제약이 깨지면 'applicantName should not be empty' 같은 영문을 만든다.
// 이 문구는 지원서 제출 실패처럼 지원자가 가장 자주 마주치는 화면에 그대로 노출된다.
// DTO 77 곳에 message 를 하나씩 다는 대신 제약 이름당 한 줄로 옮겨 둔다. DTO 가 늘어도 자동 적용된다.
const CONSTRAINT_MESSAGE: Record<string, string> = {
  isNotEmpty: '필수 항목입니다.',
  arrayNotEmpty: '항목을 하나 이상 선택해주세요.',
  isString: '문자로 입력해주세요.',
  isNumber: '숫자로 입력해주세요.',
  isInt: '정수로 입력해주세요.',
  isPositive: '0 보다 큰 값을 입력해주세요.',
  isBoolean: '참 또는 거짓 값이어야 합니다.',
  isArray: '목록 형태여야 합니다.',
  isObject: '올바른 형식이 아닙니다.',
  isEnum: '선택할 수 없는 값입니다.',
  isEmail: '이메일 형식이 올바르지 않습니다.',
  isUrl: '주소(URL) 형식이 올바르지 않습니다.',
  isDate: '날짜 형식이 올바르지 않습니다.',
  isDateString: '날짜 형식이 올바르지 않습니다.',
  matches: '형식이 올바르지 않습니다.',
  min: '허용된 최솟값보다 작습니다.',
  max: '허용된 최댓값보다 큽니다.',
  minLength: '입력이 너무 짧습니다.',
  maxLength: '입력이 너무 깁니다.',
};

const FALLBACK_MESSAGE = '입력값이 올바르지 않습니다.';

// DTO 데코레이터에 우리가 직접 적은 문구는 제약별 공통 문구보다 구체적이므로 살린다.
// class-validator 가 만드는 기본 문구는 항상 영문이라 한글 포함 여부로 갈라도 오판하지 않는다.
const hasHangul = (message: string): boolean => /[가-힣]/.test(message);

const resolveMessage = ({
  constraint,
  rawMessage,
}: {
  constraint: string;
  rawMessage: string;
}): string => {
  if (hasHangul(rawMessage)) {
    return rawMessage;
  }

  return CONSTRAINT_MESSAGE[constraint] ?? FALLBACK_MESSAGE;
};

export const toKoreanValidationMessages = (errors: ValidationError[], parentPath = ''): string[] =>
  errors.flatMap((error) => {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;
    const own = Object.entries(error.constraints ?? {}).map(
      ([constraint, rawMessage]) => `${path}: ${resolveMessage({ constraint, rawMessage })}`,
    );

    return [...own, ...toKoreanValidationMessages(error.children ?? [], path)];
  });
