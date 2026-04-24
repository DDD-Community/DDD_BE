import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class CreateInterviewReservationRequestDto {
  @ApiProperty({ description: '지원서 ID', example: 1 })
  @IsInt()
  applicationFormId: number;
}
