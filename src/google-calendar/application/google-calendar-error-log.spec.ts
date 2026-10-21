import { describeGoogleError, describeUnexpectedError } from './google-calendar-error-log';

describe('google-calendar-error-log', () => {
  describe('describeGoogleError', () => {
    it('오류 종류·상태·Google 공개 오류 코드만 남긴다', () => {
      const detail = describeGoogleError({
        name: 'GaxiosError',
        message: 'request failed code=SECRET_CODE',
        config: { data: 'code=SECRET_CODE&client_secret=SECRET_CLIENT' },
        response: {
          status: 400,
          data: { error: 'redirect_uri_mismatch', error_description: 'leak SECRET_CODE' },
        },
      });

      expect(detail).toBe('name=GaxiosError status=400 google_error=redirect_uri_mismatch');
      expect(detail).not.toContain('SECRET');
    });

    it('식별자 형식이 아닌 값은 버린다', () => {
      expect(
        describeGoogleError({
          name: 'x',
          response: { data: { error: 'token ya29.SECRET value' } },
        }),
      ).toBe('name=x');
    });

    it('객체가 아닌 오류는 내용을 싣지 않는다', () => {
      expect(describeGoogleError('code=SECRET_CODE')).toBe('name=non_object_error');
    });
  });

  describe('describeUnexpectedError', () => {
    it('DB 오류는 종류·코드·제약 조건·테이블만 남기고 메시지는 버린다', () => {
      const error = Object.assign(new Error('duplicate key (refreshToken)=(SECRET_TOKEN)'), {
        name: 'QueryFailedError',
        driverError: {
          code: '23505',
          constraint: 'UQ_20a15ff58f76fbfa3e626c852b5',
          table: 'google_calendar_connections',
          detail: 'Key (x)=(SECRET_TOKEN) already exists.',
        },
      });

      const detail = describeUnexpectedError(error);

      expect(detail).toBe(
        'name=QueryFailedError code=23505 constraint=UQ_20a15ff58f76fbfa3e626c852b5 table=google_calendar_connections',
      );
      expect(detail).not.toContain('SECRET');
    });

    it('일반 예외는 종류만 남긴다', () => {
      expect(describeUnexpectedError(new Error('SECRET_TOKEN leaked'))).toBe('name=Error');
    });
  });
});
