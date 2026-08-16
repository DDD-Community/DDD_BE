import {
  buildAttachmentSubPath,
  collectAttachmentPaths,
  findForeignAttachmentPaths,
  isOwnedAttachmentPath,
  MAX_ANSWER_DEPTH,
  TooDeepAnswersError,
} from './application-attachment';

const DEEP_PATH = 'applications/attachments/12/deep.pdf';

describe('application-attachment', () => {
  describe('buildAttachmentSubPath', () => {
    it('사용자 ID를 하위 경로로 사용한다', () => {
      expect(buildAttachmentSubPath({ userId: 12 })).toBe('12');
    });
  });

  describe('isOwnedAttachmentPath', () => {
    it('본인 경로면 true 를 반환한다', () => {
      const path = 'applications/attachments/12/abc.pdf';

      expect(isOwnedAttachmentPath({ path, userId: 12 })).toBe(true);
    });

    it('타인 경로면 false 를 반환한다', () => {
      const path = 'applications/attachments/99/abc.pdf';

      expect(isOwnedAttachmentPath({ path, userId: 12 })).toBe(false);
    });

    it('userId 가 접두어로 겹치는 경로를 소유로 오인하지 않는다', () => {
      const path = 'applications/attachments/121/abc.pdf';

      expect(isOwnedAttachmentPath({ path, userId: 12 })).toBe(false);
    });

    it('첨부 prefix 밖의 경로는 소유로 보지 않는다', () => {
      const path = 'projects/pdfs/12/abc.pdf';

      expect(isOwnedAttachmentPath({ path, userId: 12 })).toBe(false);
    });

    it('상위 경로 탈출이 섞인 경로는 접두어가 맞아도 거부한다', () => {
      const path = 'applications/attachments/12/../99/victim.pdf';

      expect(isOwnedAttachmentPath({ path, userId: 12 })).toBe(false);
    });

    it('허용되지 않는 문자가 섞인 경로는 거부한다', () => {
      const path = 'applications/attachments/12/a b.pdf';

      expect(isOwnedAttachmentPath({ path, userId: 12 })).toBe(false);
    });
  });

  describe('collectAttachmentPaths', () => {
    it('answers 안의 첨부 경로를 모은다', () => {
      const answers = {
        q1: '텍스트 답변',
        q2: { path: 'applications/attachments/12/a.pdf', originalName: 'a.pdf', size: 100 },
      };

      expect(collectAttachmentPaths({ answers })).toEqual(['applications/attachments/12/a.pdf']);
    });

    it('배열과 중첩 객체 안의 첨부도 찾는다', () => {
      const answers = {
        q1: [{ path: 'applications/attachments/12/a.pdf' }],
        q2: { nested: { path: 'applications/attachments/12/b.pdf' } },
      };

      expect(collectAttachmentPaths({ answers }).sort()).toEqual([
        'applications/attachments/12/a.pdf',
        'applications/attachments/12/b.pdf',
      ]);
    });

    it('중복 경로는 한 번만 반환한다', () => {
      const answers = {
        q1: { path: 'applications/attachments/12/a.pdf' },
        q2: { path: 'applications/attachments/12/a.pdf' },
      };

      expect(collectAttachmentPaths({ answers })).toEqual(['applications/attachments/12/a.pdf']);
    });

    it('첨부 prefix 가 아닌 path 값은 무시한다', () => {
      const answers = { q1: { path: 'projects/pdfs/a.pdf' } };

      expect(collectAttachmentPaths({ answers })).toEqual([]);
    });

    it('첨부가 없으면 빈 배열을 반환한다', () => {
      expect(collectAttachmentPaths({ answers: { q1: '텍스트' } })).toEqual([]);
    });

    it('문자열로 들어온 첨부 경로도 찾는다', () => {
      const answers = { q1: 'applications/attachments/12/a.pdf' };

      expect(collectAttachmentPaths({ answers })).toEqual(['applications/attachments/12/a.pdf']);
    });

    it('배열 안의 문자열 첨부 경로도 찾는다', () => {
      const answers = { q1: ['applications/attachments/12/a.pdf'] };

      expect(collectAttachmentPaths({ answers })).toEqual(['applications/attachments/12/a.pdf']);
    });

    it('깊게 중첩된 첨부도 놓치지 않는다', () => {
      const answers = { a: { b: { c: { d: { e: { f: { path: DEEP_PATH } } } } } } };

      expect(collectAttachmentPaths({ answers })).toEqual([DEEP_PATH]);
    });

    it('탐색 한계를 넘는 answers 는 조용히 통과시키지 않고 예외를 던진다', () => {
      let nested: Record<string, unknown> = { path: DEEP_PATH };
      for (let depth = 0; depth <= MAX_ANSWER_DEPTH; depth += 1) {
        nested = { nested };
      }

      expect(() => collectAttachmentPaths({ answers: nested })).toThrow(TooDeepAnswersError);
    });
  });

  describe('findForeignAttachmentPaths', () => {
    it('타인 소유 첨부 경로만 골라낸다', () => {
      const answers = {
        q1: { path: 'applications/attachments/12/mine.pdf' },
        q2: { path: 'applications/attachments/99/stolen.pdf' },
      };

      expect(findForeignAttachmentPaths({ answers, userId: 12 })).toEqual([
        'applications/attachments/99/stolen.pdf',
      ]);
    });

    it('모두 본인 소유면 빈 배열을 반환한다', () => {
      const answers = { q1: { path: 'applications/attachments/12/mine.pdf' } };

      expect(findForeignAttachmentPaths({ answers, userId: 12 })).toEqual([]);
    });
  });
});
