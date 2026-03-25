import { ApiProperty } from '@nestjs/swagger';

export class GoogleAuthCallbackResponseDto {
  /** 발급된 Access Token (JWT) */
  @ApiProperty({
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsInJvbGVzIjpbXX0.signature',
  })
  accessToken: string;
}

export class GoogleRefreshResponseDto {
  /** 새로 발급된 Access Token (JWT) */
  @ApiProperty({
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsInJvbGVzIjpbXX0.signature',
  })
  accessToken: string;
}
