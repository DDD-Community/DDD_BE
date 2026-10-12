import { escapeCsvField } from './csv';

describe('escapeCsvField', () => {
  it('기본 모드에서는 기존 CSV 이스케이프 동작을 유지한다', () => {
    expect(escapeCsvField('a,"b"')).toBe('"a,""b"""');
  });

  it('수식처럼 해석될 수 있는 시작 문자를 작은따옴표로 보호한다', () => {
    expect(escapeCsvField('=1+1', true)).toBe("'=1+1");
    expect(escapeCsvField('-1', true)).toBe("'-1");
    expect(escapeCsvField('\tcmd', true)).toBe("'\tcmd");
  });
});
