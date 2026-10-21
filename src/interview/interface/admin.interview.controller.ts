import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiExtraModels, ApiTags } from '@nestjs/swagger';

import { ApplicationService } from '../../application/usecase/application.service';
import { Roles } from '../../common/decorator/roles.decorator';
import { RolesGuard } from '../../common/guard/roles.guard';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { UserRole } from '../../user/domain/user.role';
import { InterviewService } from '../application/interview.service';
import { InterviewMeetingService } from '../application/interview-meeting.service';
import { AdminInterviewSwagger } from './admin.interview.swagger';
import {
  InterviewerCandidateResponseDto,
  InterviewReservationResponseDto,
  InterviewSlotResponseDto,
} from './dto/interview.response.dto';
import { CreateInterviewReservationRequestDto } from './dto/interview-reservation.request.dto';
import {
  CreateInterviewSlotRequestDto,
  InterviewSlotListQueryDto,
  UpdateInterviewSlotRequestDto,
} from './dto/interview-slot.request.dto';

@ApiTags('Admin - Interview')
@ApiExtraModels(
  InterviewSlotResponseDto,
  InterviewReservationResponseDto,
  InterviewerCandidateResponseDto,
)
@Controller({ path: 'admin/interview-slots', version: '1' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.계정관리, UserRole.운영자)
export class AdminInterviewController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly applicationService: ApplicationService,
    private readonly interviewMeetingService: InterviewMeetingService,
  ) {}

  @ApiDoc({
    summary: '면접 슬롯 생성',
    description: '새로운 면접 슬롯을 생성합니다.',
    operationId: 'interview_createSlot',
    auth: true,
    responses: [
      AdminInterviewSwagger.createSlot.success,
      AdminInterviewSwagger.createSlot.unauthorized,
    ],
  })
  @Post()
  async createSlot(@Body() body: CreateInterviewSlotRequestDto) {
    const slot = await this.interviewService.createSlotWithMeeting({
      input: {
        cohortId: body.cohortId,
        cohortPartId: body.cohortPartId,
        startAt: body.startAt,
        endAt: body.endAt,
        capacity: body.capacity ?? 1,
        location: body.location,
        description: body.description,
        interviewerUserIds: body.interviewerUserIds,
      },
    });
    const summaries = await this.interviewService.findSlotConnectionSummaries({ slots: [slot] });
    return ApiResponse.ok(InterviewSlotResponseDto.from(slot, summaries));
  }

  @ApiDoc({
    summary: '면접 슬롯 목록 조회',
    description: '기수/파트 필터로 슬롯을 조회합니다.',
    operationId: 'interview_listSlots',
    auth: true,
    responses: [
      AdminInterviewSwagger.listSlots.success,
      AdminInterviewSwagger.listSlots.unauthorized,
    ],
  })
  @Get()
  async findSlots(@Query() query: InterviewSlotListQueryDto) {
    const slots = await this.interviewService.findSlots({
      cohortId: query.cohortId,
      cohortPartId: query.cohortPartId,
    });
    const summaries = await this.interviewService.findSlotConnectionSummaries({ slots });
    return ApiResponse.ok(slots.map((slot) => InterviewSlotResponseDto.from(slot, summaries)));
  }

  @ApiDoc({
    summary: '면접관 후보 조회',
    operationId: 'interview_listInterviewerCandidates',
    auth: true,
    responses: [
      AdminInterviewSwagger.interviewerCandidates.success,
      AdminInterviewSwagger.interviewerCandidates.unauthorized,
    ],
  })
  @Get('interviewer-candidates')
  async findInterviewerCandidates() {
    const candidates = await this.interviewService.findInterviewerCandidates();
    return ApiResponse.ok(candidates);
  }

  @ApiDoc({
    summary: '면접 슬롯 상세 조회',
    operationId: 'interview_getSlot',
    auth: true,
    responses: [
      AdminInterviewSwagger.getSlot.success,
      AdminInterviewSwagger.getSlot.unauthorized,
      AdminInterviewSwagger.getSlot.notFound,
    ],
  })
  @Get(':id')
  async findSlotById(@Param('id', ParseIntPipe) id: number) {
    const slot = await this.interviewService.findSlotById({ id });
    const summaries = await this.interviewService.findSlotConnectionSummaries({ slots: [slot] });
    return ApiResponse.ok(InterviewSlotResponseDto.from(slot, summaries));
  }

  @ApiDoc({
    summary: '면접 슬롯 회의 수동 동기화',
    operationId: 'interview_syncSlotMeeting',
    auth: true,
    responses: [
      AdminInterviewSwagger.syncMeeting.success,
      AdminInterviewSwagger.syncMeeting.unauthorized,
      AdminInterviewSwagger.syncMeeting.notFound,
    ],
  })
  @Post(':id/meeting/sync')
  async syncSlotMeeting(@Param('id', ParseIntPipe) id: number) {
    await this.interviewService.findSlotById({ id });
    await this.interviewMeetingService.syncSlotMeeting({ slotId: id });
    const slot = await this.interviewService.findSlotById({ id });
    const summaries = await this.interviewService.findSlotConnectionSummaries({ slots: [slot] });
    return ApiResponse.ok(InterviewSlotResponseDto.from(slot, summaries));
  }

  @ApiDoc({
    summary: '면접 슬롯 수정',
    operationId: 'interview_updateSlot',
    auth: true,
    responses: [
      AdminInterviewSwagger.updateSlot.success,
      AdminInterviewSwagger.updateSlot.unauthorized,
      AdminInterviewSwagger.updateSlot.notFound,
    ],
  })
  @Patch(':id')
  async updateSlot(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateInterviewSlotRequestDto,
  ) {
    const slot = await this.interviewService.updateSlotWithMeeting({
      id,
      patch: {
        startAt: body.startAt,
        endAt: body.endAt,
        capacity: body.capacity,
        location: body.location,
        description: body.description,
        interviewerUserIds: body.interviewerUserIds,
      },
    });
    const summaries = await this.interviewService.findSlotConnectionSummaries({ slots: [slot] });
    return ApiResponse.ok(InterviewSlotResponseDto.from(slot, summaries));
  }

  @ApiDoc({
    summary: '면접 슬롯 삭제',
    operationId: 'interview_deleteSlot',
    auth: true,
    responses: [
      AdminInterviewSwagger.deleteSlot.noContent,
      AdminInterviewSwagger.deleteSlot.unauthorized,
      AdminInterviewSwagger.deleteSlot.notFound,
    ],
  })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSlot(@Param('id', ParseIntPipe) id: number) {
    await this.interviewService.deleteSlotWithMeeting({ id });
  }

  @ApiDoc({
    summary: '면접 예약 생성',
    description: '지원자를 특정 슬롯에 배정하고 구글 캘린더 이벤트를 생성합니다.',
    operationId: 'interview_createReservation',
    auth: true,
    responses: [
      AdminInterviewSwagger.createReservation.success,
      AdminInterviewSwagger.createReservation.unauthorized,
      AdminInterviewSwagger.createReservation.notFound,
    ],
  })
  @Post(':slotId/reservations')
  async createReservation(
    @Param('slotId', ParseIntPipe) slotId: number,
    @Body() body: CreateInterviewReservationRequestDto,
  ) {
    const form = await this.applicationService.findFormById({ id: body.applicationFormId });
    const reservation = await this.interviewService.createReservation({
      input: {
        slotId,
        applicationFormId: body.applicationFormId,
        applicantName: form.applicantName,
        applicantEmail: form.user.email,
      },
    });
    return ApiResponse.ok(InterviewReservationResponseDto.from(reservation));
  }

  @ApiDoc({
    summary: '면접 예약 취소',
    description: '면접 예약을 취소하고 연동된 구글 캘린더 이벤트를 삭제합니다.',
    operationId: 'interview_cancelReservation',
    auth: true,
    responses: [
      AdminInterviewSwagger.cancelReservation.noContent,
      AdminInterviewSwagger.cancelReservation.unauthorized,
      AdminInterviewSwagger.cancelReservation.notFound,
    ],
  })
  @Delete('reservations/:reservationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelReservation(@Param('reservationId', ParseIntPipe) reservationId: number) {
    await this.interviewService.cancelReservation({ id: reservationId });
  }
}
