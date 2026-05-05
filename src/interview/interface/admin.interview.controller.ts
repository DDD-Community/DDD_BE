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
import { ApiTags } from '@nestjs/swagger';

import { ApplicationService } from '../../application/usecase/application.service';
import { Roles } from '../../common/decorator/roles.decorator';
import { RolesGuard } from '../../common/guard/roles.guard';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { UserRole } from '../../user/domain/user.role';
import { InterviewService } from '../application/interview.service';
import {
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
@Controller({ path: 'admin/interview-slots', version: '1' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.계정관리, UserRole.운영자)
export class AdminInterviewController {
  constructor(
    private readonly interviewService: InterviewService,
    private readonly applicationService: ApplicationService,
  ) {}

  @ApiDoc({
    summary: '면접 슬롯 생성',
    description: '새로운 면접 슬롯을 생성합니다.',
    operationId: 'interview_createSlot',
    auth: true,
  })
  @Post()
  async createSlot(@Body() body: CreateInterviewSlotRequestDto) {
    const slot = await this.interviewService.createSlot({
      input: {
        cohortId: body.cohortId,
        cohortPartId: body.cohortPartId,
        startAt: body.startAt,
        endAt: body.endAt,
        capacity: body.capacity ?? 1,
        location: body.location,
        description: body.description,
      },
    });
    return ApiResponse.ok(InterviewSlotResponseDto.from(slot));
  }

  @ApiDoc({
    summary: '면접 슬롯 목록 조회',
    description: '기수/파트 필터로 슬롯을 조회합니다.',
    operationId: 'interview_listSlots',
    auth: true,
  })
  @Get()
  async findSlots(@Query() query: InterviewSlotListQueryDto) {
    const slots = await this.interviewService.findSlots({
      cohortId: query.cohortId,
      cohortPartId: query.cohortPartId,
    });
    return ApiResponse.ok(slots.map((slot) => InterviewSlotResponseDto.from(slot)));
  }

  @ApiDoc({
    summary: '면접 슬롯 상세 조회',
    operationId: 'interview_getSlot',
    auth: true,
  })
  @Get(':id')
  async findSlotById(@Param('id', ParseIntPipe) id: number) {
    const slot = await this.interviewService.findSlotById({ id });
    return ApiResponse.ok(InterviewSlotResponseDto.from(slot));
  }

  @ApiDoc({
    summary: '면접 슬롯 수정',
    operationId: 'interview_updateSlot',
    auth: true,
  })
  @Patch(':id')
  async updateSlot(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateInterviewSlotRequestDto,
  ) {
    await this.interviewService.updateSlot({
      id,
      patch: {
        startAt: body.startAt,
        endAt: body.endAt,
        capacity: body.capacity,
        location: body.location,
        description: body.description,
      },
    });
    return ApiResponse.ok(null, '면접 슬롯이 수정되었습니다.');
  }

  @ApiDoc({
    summary: '면접 슬롯 삭제',
    operationId: 'interview_deleteSlot',
    auth: true,
  })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSlot(@Param('id', ParseIntPipe) id: number) {
    await this.interviewService.deleteSlot({ id });
  }

  @ApiDoc({
    summary: '면접 예약 생성',
    description: '지원자를 특정 슬롯에 배정하고 구글 캘린더 이벤트를 생성합니다.',
    operationId: 'interview_createReservation',
    auth: true,
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
  })
  @Delete('reservations/:reservationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelReservation(@Param('reservationId', ParseIntPipe) reservationId: number) {
    await this.interviewService.cancelReservation({ id: reservationId });
  }
}
