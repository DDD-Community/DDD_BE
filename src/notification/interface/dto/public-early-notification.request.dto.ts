import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsInt, IsPositive, MaxLength } from 'class-validator';

export class SubscribeEarlyNotificationRequestDto {
  @ApiProperty({ description: '기수 ID', example: 1 })
  @IsInt()
  @IsPositive()
  cohortId: number;

  @ApiProperty({ description: '이메일 주소', example: 'user@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;
}
