import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class CreateInterviewBookingRequestDto {
  @ApiProperty({ description: '예약할 면접 슬롯 ID', example: 7 })
  @IsNumber()
  slotId: number;
}
