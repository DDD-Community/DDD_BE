import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { ApplicationService } from '../../application/usecase/application.service';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import type { InterviewBookingTokenPayload } from '../application/interview-booking-token.service';
import { InterviewService } from '../application/interview.service';
import { CreateInterviewBookingRequestDto } from './dto/interview-booking.request.dto';
import {
  BookingContextResponseDto,
  BookingReservationResponseDto,
  BookingSlotResponseDto,
} from './dto/interview-booking.response.dto';
import { BookingToken, InterviewBookingGuard } from './interview-booking.guard';

@ApiTags('Interview Booking')
@ApiBearerAuth()
@Controller({ path: 'interview-bookings', version: '1' })
@UseGuards(InterviewBookingGuard)
export class PublicInterviewBookingController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly applicationService: ApplicationService,
  ) {}

  @ApiDoc({
    summary: '면접 예약 컨텍스트 조회',
    description: '예약 토큰을 검증하고 지원자 이름·직군·기존 예약 정보를 반환합니다.',
    operationId: 'interviewBooking_getContext',
  })
  @Get('context')
  async getContext(@BookingToken() token: InterviewBookingTokenPayload) {
    const reservation = await this.interviewService.findActiveReservationByApplicationFormId({
      applicationFormId: token.applicationFormId,
    });
    return ApiResponse.ok(
      BookingContextResponseDto.from({
        applicantName: token.applicantName,
        partName: token.partName,
        reservation,
      }),
    );
  }

  @ApiDoc({
    summary: '예약 가능한 면접 슬롯 목록',
    description:
      '토큰에 담긴 직군의 시작 전 슬롯을 잔여석과 함께 반환합니다. 잔여석 0 은 마감 표시용으로 포함됩니다.',
    operationId: 'interviewBooking_listSlots',
  })
  @Get('slots')
  async listSlots(@BookingToken() token: InterviewBookingTokenPayload) {
    const slots = await this.interviewService.findOpenSlotsForBooking({
      cohortPartId: token.cohortPartId,
    });
    return ApiResponse.ok(slots.map((entry) => BookingSlotResponseDto.from(entry)));
  }

  @ApiDoc({
    summary: '면접 슬롯 예약',
    description:
      '슬롯을 예약합니다. 정원 마감 시 INTERVIEW_SLOT_FULL(409), 기존 예약 존재 시 INTERVIEW_RESERVATION_EXISTS(409) 를 반환합니다. 예약 후 지원자 변경은 불가합니다.',
    operationId: 'interviewBooking_createReservation',
  })
  @Post('reservations')
  @HttpCode(HttpStatus.CREATED)
  async createReservation(
    @BookingToken() token: InterviewBookingTokenPayload,
    @Body() body: CreateInterviewBookingRequestDto,
  ) {
    const form = await this.applicationService.findFormById({ id: token.applicationFormId });
    const reservation = await this.interviewService.createReservationByApplicant({
      input: {
        slotId: body.slotId,
        applicationFormId: token.applicationFormId,
        cohortPartId: token.cohortPartId,
        applicantName: form.applicantName,
        applicantEmail: form.user.email,
      },
    });
    return ApiResponse.ok(
      BookingReservationResponseDto.from(reservation),
      '면접 예약이 완료되었습니다.',
    );
  }
}
