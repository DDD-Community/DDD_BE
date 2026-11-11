import { HttpStatus } from '@nestjs/common';

import { AppException } from './app.exception';

describe('AppException', () => {
  it('기본 오류 문구를 사용한다', () => {
    const error = new AppException('ATTENDANCE_BAD_REQUEST', HttpStatus.BAD_REQUEST);
    expect(error.message).toBe('출석 관리 서버에 잘못된 요청을 보냈습니다.');
  });

  it('전달된 오류 문구를 사용한다', () => {
    const error = new AppException('ATTENDANCE_BAD_REQUEST', HttpStatus.BAD_REQUEST, '상세 사유');
    expect(error.message).toBe('상세 사유');
  });
});
