import { ApiProperty } from '@nestjs/swagger';

export class VersionResponseDto {
  @ApiProperty({
    description: '실행 중인 빌드의 커밋 SHA. 이미지에 각인된 값을 그대로 반환한다.',
    example: 'ab0974367cfcc5295df479bf59336a14a497a4b0',
  })
  version: string;
}
