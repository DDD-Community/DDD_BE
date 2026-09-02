import { toCohortAnnouncementInfo } from './cohort-announcement-info';

describe('toCohortAnnouncementInfo', () => {
  it('process 의 값을 읽어 채운다', () => {
    const info = toCohortAnnouncementInfo({
      name: '14기',
      process: {
        slotSelectionDeadline: '2026-09-18',
        interviewDurationMinutes: 30,
        interviewRescheduleDeadline: '2026-09-18',
        participationFee: 50000,
        bankAccount: '국민은행 / 123-456-789 / 홍길동',
        participationConfirmDeadline: '2026-09-28',
      },
    });

    expect(info).toEqual({
      name: '14기',
      slotSelectionDeadline: '2026-09-18',
      interviewDurationMinutes: 30,
      interviewRescheduleDeadline: '2026-09-18',
      participationFee: 50000,
      bankAccount: '국민은행 / 123-456-789 / 홍길동',
      participationConfirmDeadline: '2026-09-28',
    });
  });

  it('process 가 없으면 모두 null 이다', () => {
    const info = toCohortAnnouncementInfo({ name: '14기', process: null });

    expect(info.name).toBe('14기');
    expect(info.participationFee).toBeNull();
    expect(info.bankAccount).toBeNull();
  });

  it('숫자가 문자열로 들어와도 읽는다 (jsonb 는 형식을 강제하지 않는다)', () => {
    const info = toCohortAnnouncementInfo({
      name: null,
      process: { participationFee: '50,000', interviewDurationMinutes: '30' },
    });

    expect(info.participationFee).toBe(50000);
    expect(info.interviewDurationMinutes).toBe(30);
  });

  it.each([0, -1, 'abc', null, undefined, {}])(
    '숫자로 해석되지 않는 값(%p)은 null 로 둔다',
    (participationFee) => {
      const info = toCohortAnnouncementInfo({ name: null, process: { participationFee } });

      expect(info.participationFee).toBeNull();
    },
  );

  it.each(['', '   ', 42, null])('문자열이 아니거나 빈 값(%p)은 null 로 둔다', (bankAccount) => {
    const info = toCohortAnnouncementInfo({ name: null, process: { bankAccount } });

    expect(info.bankAccount).toBeNull();
  });

  it('앞뒤 공백은 잘라낸다', () => {
    const info = toCohortAnnouncementInfo({
      name: '  14기  ',
      process: { bankAccount: '  국민은행 / 123  ' },
    });

    expect(info.name).toBe('14기');
    expect(info.bankAccount).toBe('국민은행 / 123');
  });
});
