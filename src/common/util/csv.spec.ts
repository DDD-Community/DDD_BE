import { escapeCsvField } from './csv';

describe('CSV 필드 이스케이프', () => {
  it('기본 모드에서 기존 CSV 이스케이프 동작을 유지한다', () => {
    // Given
    // When
    const result = escapeCsvField('a,"b"');

    // Then
    expect(result).toBe('"a,""b"""');
  });

  it('수식처럼 해석될 수 있는 시작 문자를 작은따옴표로 보호한다', () => {
    // Given
    // When
    const escapedFields = [
      escapeCsvField('=1+1', true),
      escapeCsvField('-1', true),
      escapeCsvField('\tcmd', true),
    ];

    // Then
    expect(escapedFields).toEqual(["'=1+1", "'-1", "'\tcmd"]);
  });
});
