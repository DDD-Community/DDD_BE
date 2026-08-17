import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

import {
  ApplicationAdminFilterDto,
  SubmitApplicationRequestDto,
  UpdateApplicationStatusRequestDto,
} from '../../application/interface/dto/application.request.dto';
import { UpdateCohortPartsRequestDto } from '../../cohort/interface/dto/admin-cohort.request.dto';
import { UpdateProjectMembersRequestDto } from '../../project/interface/dto/project.request.dto';
import { AssignUserRolesRequestDto } from '../../user/interface/dto/bootstrap-user.request.dto';
import { toKoreanValidationMessages } from './validation-message';

const runValidation = async ({
  metatype,
  value,
}: {
  metatype: unknown;
  value: unknown;
}): Promise<string[]> => {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: (errors) => new BadRequestException(toKoreanValidationMessages(errors)),
  });

  try {
    await pipe.transform(value, {
      type: 'body',
      metatype: metatype as new () => unknown,
    });
  } catch (error) {
    if (error instanceof BadRequestException) {
      return (error.getResponse() as { message: string[] }).message;
    }
    throw error;
  }

  throw new Error(`검증이 통과했다. 실패해야 하는 케이스다: ${JSON.stringify(value)}`);
};

// 메시지는 '필드경로: 문구' 형태다. 필드명은 영문이 정상이므로 문구 쪽만 검사한다.
const descriptionOf = (message: string): string => {
  const separator = message.indexOf(': ');

  return separator === -1 ? message : message.slice(separator + 2);
};

describe('toKoreanValidationMessages', () => {
  // 한글 enum(ApplicationStatus.서류합격, UserRole.운영자)을 쓰는 DTO 를 반드시 포함한다.
  // class-validator 가 enum 값을 기본 문구에 끼워 넣어 'must be one of the following values:
  // 서류합격, ...' 처럼 한글 섞인 영문이 만들어지는데, 이게 판별을 통과해 노출된 적이 있다.
  it.each([
    ['SubmitApplicationRequestDto (필수 누락)', SubmitApplicationRequestDto, {}],
    [
      'UpdateApplicationStatusRequestDto (한글 enum)',
      UpdateApplicationStatusRequestDto,
      { status: 'not-a-status' },
    ],
    ['ApplicationAdminFilterDto (한글 enum)', ApplicationAdminFilterDto, { status: 'nope' }],
    [
      'AssignUserRolesRequestDto (한글 enum + 중복)',
      AssignUserRolesRequestDto,
      { roles: ['운영자', '운영자', 'nope'] },
    ],
    [
      'UpdateProjectMembersRequestDto (중첩 검증)',
      UpdateProjectMembersRequestDto,
      { members: [{}] },
    ],
    ['UpdateCohortPartsRequestDto (배열 최소 크기)', UpdateCohortPartsRequestDto, { parts: [] }],
  ])('%s 는 문구에 영문을 남기지 않는다', async (_label, metatype, value) => {
    // Given & When
    const messages = await runValidation({ metatype, value });

    // Then
    expect(messages.length).toBeGreaterThan(0);
    messages.forEach((message) => {
      expect(descriptionOf(message)).not.toMatch(/[A-Za-z]{2,}/);
    });
  });

  it('DTO 에 직접 적은 한국어 문구는 제약별 공통 문구로 덮지 않는다', async () => {
    // Given
    const invalidPhone = { applicantPhone: '01012' };

    // When
    const messages = await runValidation({
      metatype: SubmitApplicationRequestDto,
      value: invalidPhone,
    });

    // Then
    expect(messages).toContain('applicantPhone: 휴대폰 번호 형식이 올바르지 않습니다.');
  });

  it('한글이 섞인 프레임워크 기본 문구는 우리 문구로 오인하지 않는다', () => {
    // 한글 enum 값이 영문 템플릿에 치환된 형태다. 한글만 보고 판별하면 이 문구가 그대로 나간다.
    // Given
    const koreanEnumLeak = [
      {
        property: 'status',
        constraints: {
          isEnum: 'status must be one of the following values: 서류합격, 최종합격',
        },
      },
    ] as unknown as ValidationError[];

    // When
    const messages = toKoreanValidationMessages(koreanEnumLeak);

    // Then
    expect(messages).toEqual(['status: 선택할 수 없는 값입니다.']);
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

  it('property 가 없는 에러는 콜론만 남기지 않는다', () => {
    // forbidUnknownValues 로 걸리면 property 가 undefined 로 온다.
    // Given
    const withoutProperty = [
      { constraints: { unknownValue: 'an unknown value was passed to the validate function' } },
    ] as unknown as ValidationError[];

    // When
    const messages = toKoreanValidationMessages(withoutProperty);

    // Then
    expect(messages).toEqual(['입력값이 올바르지 않습니다.']);
  });
});
