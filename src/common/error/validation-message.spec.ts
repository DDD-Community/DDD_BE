import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

import { SubmitApplicationRequestDto } from '../../application/interface/dto/application.request.dto';
import { toKoreanValidationMessages } from './validation-message';

const runValidation = async (value: unknown): Promise<string[]> => {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: (errors) => new BadRequestException(toKoreanValidationMessages(errors)),
  });

  const error = await pipe
    .transform(value, { type: 'body', metatype: SubmitApplicationRequestDto })
    .then(() => null)
    .catch((thrown: unknown) => thrown);

  const response = (error as BadRequestException).getResponse() as { message: string[] };

  return response.message;
};

describe('toKoreanValidationMessages', () => {
  it('실제 지원서 제출 DTO 가 비어 있을 때 영문 문구가 하나도 남지 않는다', async () => {
    // 지원자가 가장 자주 실패하는 화면이다. 예전에는 'applicantName should not be empty' 가 그대로 갔다.
    // Given & When
    const messages = await runValidation({});

    // Then
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.join(' ')).not.toMatch(/must be|should not|Validation failed/);
    messages.forEach((message) => {
      expect(message).toMatch(/[가-힣]/);
    });
  });

  it('DTO 에 직접 적은 한국어 문구는 제약별 공통 문구로 덮지 않는다', async () => {
    // Given
    const invalidPhone = { applicantPhone: '01012' };

    // When
    const messages = await runValidation(invalidPhone);

    // Then
    expect(messages).toContain('applicantPhone: 휴대폰 번호 형식이 올바르지 않습니다.');
  });

  it('중첩 객체는 경로를 점으로 이어 어느 항목인지 알려준다', () => {
    // Given
    const nested = [
      {
        property: 'answers',
        children: [
          { property: 'motivation', constraints: { isNotEmpty: 'motivation should not be empty' } },
        ],
      },
    ] as ValidationError[];

    // When
    const messages = toKoreanValidationMessages(nested);

    // Then
    expect(messages).toEqual(['answers.motivation: 필수 항목입니다.']);
  });

  it('매핑에 없는 제약은 공통 문구로 내려간다', () => {
    // Given
    const unknownConstraint = [
      { property: 'someField', constraints: { isSomethingNew: 'someField is invalid' } },
    ] as unknown as ValidationError[];

    // When
    const messages = toKoreanValidationMessages(unknownConstraint);

    // Then
    expect(messages).toEqual(['someField: 입력값이 올바르지 않습니다.']);
  });
});
