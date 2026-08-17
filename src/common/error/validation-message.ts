import type { ValidationError } from 'class-validator';

// class-validator 는 제약이 깨지면 'applicantName should not be empty' 같은 영문을 만든다.
// 이 문구는 지원서 제출 실패처럼 지원자가 가장 자주 마주치는 화면에 그대로 노출된다.
// DTO 77 곳에 message 를 하나씩 다는 대신 제약 이름당 한 줄로 옮겨 둔다. DTO 가 늘어도 자동 적용된다.
// 키는 데코레이터 이름이 아니라 class-validator 의 제약 이름이다. @ValidateNested 가
// nestedValidation, @IsISO8601 이 isIso8601 처럼 어긋나는 것들이 있어 데코레이터 이름으로
// 유추하면 조용히 폴백 문구로 떨어진다.
const CONSTRAINT_MESSAGE: Record<string, string> = {
  isNotEmpty: '필수 항목입니다.',
  arrayNotEmpty: '항목을 하나 이상 선택해주세요.',
  arrayMinSize: '항목을 하나 이상 선택해주세요.',
  arrayUnique: '중복된 항목이 있습니다.',
  isString: '문자로 입력해주세요.',
  isNumber: '숫자로 입력해주세요.',
  isInt: '정수로 입력해주세요.',
  isPositive: '0 보다 큰 값을 입력해주세요.',
  isBoolean: '참 또는 거짓 값이어야 합니다.',
  isArray: '목록 형태여야 합니다.',
  isObject: '올바른 형식이 아닙니다.',
  isEnum: '선택할 수 없는 값입니다.',
  isIn: '선택할 수 없는 값입니다.',
  isEmail: '이메일 형식이 올바르지 않습니다.',
  isUrl: '주소 형식이 올바르지 않습니다.',
  isDate: '날짜 형식이 올바르지 않습니다.',
  isDateString: '날짜 형식이 올바르지 않습니다.',
  isIso8601: '날짜 형식이 올바르지 않습니다.',
  matches: '형식이 올바르지 않습니다.',
  min: '허용된 최솟값보다 작습니다.',
  max: '허용된 최댓값보다 큽니다.',
  minLength: '입력이 너무 짧습니다.',
  maxLength: '입력이 너무 깁니다.',
  isLength: '입력 길이가 올바르지 않습니다.',
  nestedValidation: '하위 항목이 올바르지 않습니다.',
};

const FALLBACK_MESSAGE = '입력값이 올바르지 않습니다.';

// DTO 데코레이터에 우리가 직접 적은 문구는 제약별 공통 문구보다 구체적이므로 살린다.
//
// '한글이 있으면 우리 문구' 로는 부족하다. CODE_RULES 가 도메인 상태어에 한글 enum 을 허용해서
// (ApplicationStatus.서류합격, UserRole.운영자) @IsEnum 의 기본 문구가
// 'status must be one of the following values: 서류합격, ...' 처럼 한글을 품고 나온다.
// 그래서 한글이 있고 + 영문 단어가 없어야 우리 문구로 본다.
//
// ponytail: 휴리스틱이다. 한국어 문구에 영문 약어를 섞으면('PDF 만 첨부할 수 있습니다')
// 공통 문구로 덮인다. 그런 문구가 필요해지면 데코레이터의 context 옵션으로
// 명시 마킹하는 방식으로 올린다.
const isOurMessage = (message: string): boolean =>
  /[가-힣]/.test(message) && !/[A-Za-z]{2,}/.test(message);

const resolveMessage = ({
  constraint,
  rawMessage,
}: {
  constraint: string;
  rawMessage: string;
}): string => {
  if (isOurMessage(rawMessage)) {
    return rawMessage;
  }

  return CONSTRAINT_MESSAGE[constraint] ?? FALLBACK_MESSAGE;
};

export const toKoreanValidationMessages = (errors: ValidationError[], parentPath = ''): string[] =>
  errors.flatMap((error) => {
    // forbidUnknownValues 로 걸린 에러는 property 가 없다. 그대로 두면 'undefined: ...' 가 나간다.
    const path = parentPath ? `${parentPath}.${error.property}` : (error.property ?? '');
    const own = Object.entries(error.constraints ?? {}).map(([constraint, rawMessage]) => {
      const message = resolveMessage({ constraint, rawMessage });

      return path ? `${path}: ${message}` : message;
    });

    return [...own, ...toKoreanValidationMessages(error.children ?? [], path)];
  });
