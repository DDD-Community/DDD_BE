import { Body, Controller, Param, ParseIntPipe, Put, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';

import { BootstrapTokenGuard } from '../../common/guard/bootstrap-token.guard';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { UserService } from '../application/user.service';
import { AssignUserRolesRequestDto } from './dto/admin-user.request.dto';
import { AssignUserRolesResponseDto } from './dto/admin-user.response.dto';

@ApiTags('Admin - User')
@Controller({ path: 'admin/users', version: '1' })
@UseGuards(BootstrapTokenGuard)
@ApiHeader({
  name: 'X-Bootstrap-Token',
  description: '서버에 사전 설정된 ADMIN_BOOTSTRAP_TOKEN 값과 일치해야 합니다.',
  required: true,
})
export class AdminUserController {
  constructor(private readonly userService: UserService) {}

  @ApiDoc({
    summary: '사용자 권한 부여 (부트스트랩 전용)',
    description:
      '부트스트랩 토큰을 사용해 특정 사용자의 권한 목록을 전체 교체합니다. 최초 운영자 시드용으로 사용하며, 운영 환경에서는 토큰 노출에 각별히 유의하세요.',
    operationId: 'admin_assignUserRolesByBootstrap',
  })
  @Put(':userId/roles')
  async assignRoles(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: AssignUserRolesRequestDto,
  ) {
    const user = await this.userService.assignRoles({ userId, roles: body.roles });
    return ApiResponse.ok(AssignUserRolesResponseDto.from(user, body.roles));
  }
}
