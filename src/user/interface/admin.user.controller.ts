import { Body, Controller, Get, Param, ParseIntPipe, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';

import type { JwtUser } from '../../auth/application/auth.type';
import { AuthUser } from '../../common/decorator/auth-user.decorator';
import { Roles } from '../../common/decorator/roles.decorator';
import { RolesGuard } from '../../common/guard/roles.guard';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { UserService } from '../application/user.service';
import { UserRole } from '../domain/user.role';
import {
  AdminAssignUserRolesRequestDto,
  AdminUserCursorQueryDto,
} from './dto/admin-user.request.dto';
import { AdminUserResponseDto } from './dto/admin-user.response.dto';
import { AssignUserRolesResponseDto } from './dto/bootstrap-user.response.dto';

@ApiTags('Admin - User')
@Controller({ path: 'admin/users', version: '1' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.계정관리)
export class AdminUserController {
  constructor(private readonly userService: UserService) {}

  @ApiDoc({
    summary: '사용자 목록 조회',
    description: '활성 사용자를 이메일 부분 일치 검색과 커서 기반 페이지네이션으로 조회합니다.',
    operationId: 'user_getAdminList',
    auth: true,
  })
  @Get()
  async findAllUsers(@Query() query: AdminUserCursorQueryDto) {
    const { items, nextCursor, hasNext } = await this.userService.findUsersByCursor({
      email: query.email,
      cursor: query.cursor,
      limit: query.limit,
    });

    return ApiResponse.ok(
      items.map((user) => AdminUserResponseDto.from(user)),
      'success',
      { nextCursor, hasNext },
    );
  }

  @ApiDoc({
    summary: '사용자 권한 교체',
    description: '다른 사용자의 권한 목록을 전체 교체하고 호출자 ID를 감사 로그에 기록합니다.',
    operationId: 'user_assignAdminRoles',
    auth: true,
  })
  @Put(':userId/roles')
  async assignRoles(
    @Param('userId', ParseIntPipe) userId: number,
    @AuthUser() jwtUser: JwtUser,
    @Body() body: AdminAssignUserRolesRequestDto,
  ) {
    const user = await this.userService.assignRoles({
      userId,
      roles: body.roles,
      adminId: jwtUser.id,
    });
    return ApiResponse.ok(AssignUserRolesResponseDto.from(user, body.roles));
  }
}
