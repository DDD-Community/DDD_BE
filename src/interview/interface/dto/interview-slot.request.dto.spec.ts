import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';

import {
  CreateInterviewSlotRequestDto,
  UpdateInterviewSlotRequestDto,
} from './interview-slot.request.dto';

const runValidation = async ({
  metatype,
  value,
}: {
  metatype: unknown;
  value: unknown;
}): Promise<{ errors: string[]; transformed: unknown }> => {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
    exceptionFactory: (errors) =>
      new BadRequestException(errors.flatMap((error) => Object.values(error.constraints ?? {}))),
  });

  const metadata = { type: 'body', metatype } as ArgumentMetadata;

  try {
    const transformed = await pipe.transform(value, metadata);
    return { errors: [], transformed };
  } catch (error) {
    const response = (error as BadRequestException).getResponse() as { message?: string[] };
    return { errors: response.message ?? [], transformed: undefined };
  }
};

const validBase = {
  cohortId: 1,
  cohortPartId: 1,
  startAt: '2026-05-01T14:00:00+09:00',
  endAt: '2026-05-01T14:30:00+09:00',
};

describe('CreateInterviewSlotRequestDto - location', () => {
  it('장소가 없으면 거부한다', async () => {
    const { errors } = await runValidation({
      metatype: CreateInterviewSlotRequestDto,
      value: { ...validBase },
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('빈 문자열을 거부한다', async () => {
    const { errors } = await runValidation({
      metatype: CreateInterviewSlotRequestDto,
      value: { ...validBase, location: '' },
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it.each(['   ', '\t', '\n', ' \t\n '])(
    '공백만 있는 값(%j)도 거부한다 — 스페이스 한 칸으로 필수 검증을 우회할 수 없어야 한다',
    async (location) => {
      const { errors } = await runValidation({
        metatype: CreateInterviewSlotRequestDto,
        value: { ...validBase, location },
      });

      expect(errors.length).toBeGreaterThan(0);
    },
  );

  it('앞뒤 공백은 잘라내고 통과시킨다', async () => {
    const { errors, transformed } = await runValidation({
      metatype: CreateInterviewSlotRequestDto,
      value: { ...validBase, location: '  https://meet.google.com/abc-defg-hij  ' },
    });

    expect(errors).toEqual([]);
    expect((transformed as CreateInterviewSlotRequestDto).location).toBe(
      'https://meet.google.com/abc-defg-hij',
    );
  });
});

describe('UpdateInterviewSlotRequestDto - location', () => {
  it('생략하면 통과한다 (부분 수정)', async () => {
    const { errors } = await runValidation({
      metatype: UpdateInterviewSlotRequestDto,
      value: { capacity: 2 },
    });

    expect(errors).toEqual([]);
  });

  it.each(['', '   ', '\t'])('값을 보냈는데 비어 있으면(%j) 거부한다', async (location) => {
    const { errors } = await runValidation({
      metatype: UpdateInterviewSlotRequestDto,
      value: { location },
    });

    expect(errors.length).toBeGreaterThan(0);
  });
});
