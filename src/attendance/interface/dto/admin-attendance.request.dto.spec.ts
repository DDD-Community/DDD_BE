import { ValidationPipe } from '@nestjs/common';

import { UpsertAttendanceVoteRequestDto } from './admin-attendance.request.dto';

describe('UpsertAttendanceVoteRequestDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });

  it('화이트리스트 변환 후 중첩 템플릿을 그대로 보존한다', async () => {
    const template = { title: '투표', custom: { nested: ['value'] } };
    const result = await pipe.transform(
      { title: '  제목  ', teamVoteTemplate: template, feedbackTemplate: null },
      { type: 'body', metatype: UpsertAttendanceVoteRequestDto },
    );
    expect(result).toEqual({ title: '제목', teamVoteTemplate: template, feedbackTemplate: null });
  });

  it.each(['   ', 'x'.repeat(101)])('잘못된 제목 %s을 거부한다', async (title) => {
    await expect(
      pipe.transform({ title }, { type: 'body', metatype: UpsertAttendanceVoteRequestDto }),
    ).rejects.toThrow();
  });
});
