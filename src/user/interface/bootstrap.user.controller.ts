import { Body, Controller, Param, ParseIntPipe, Put, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';

import { BootstrapTokenGuard } from '../../common/guard/bootstrap-token.guard';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { UserService } from '../application/user.service';
import { AssignUserRolesRequestDto } from './dto/bootstrap-user.request.dto';
import { AssignUserRolesResponseDto } from './dto/bootstrap-user.response.dto';

@ApiTags('Bootstrap - User')
@Controller({ path: 'bootstrap/users', version: '1' })
@UseGuards(BootstrapTokenGuard)
@ApiHeader({
  name: 'X-Bootstrap-Token',
  description:
    '비-JWT 보안 스키마. 서버에 사전 설정된 ADMIN_BOOTSTRAP_TOKEN 값과 정확히 일치해야 하며, ADMIN_BOOTSTRAP_TOKEN_EXPIRES_AT가 지나면 거부됩니다. JWT 어드민 인증과는 별도이며 최초 운영자 시드 전용입니다.',
  required: true,
})
export class BootstrapUserController {
  constructor(private readonly userService: UserService) {}

  @ApiDoc({
    summary: '사용자 권한 부여 (부트스트랩 전용)',
    description:
      '부트스트랩 토큰을 사용해 특정 사용자의 권한 목록을 전체 교체합니다. 최초 운영자 시드용으로 사용하며, 시드 완료 후에는 ADMIN_BOOTSTRAP_TOKEN을 즉시 제거하거나 만료되도록 운영하세요.',
    operationId: 'bootstrap_assignUserRoles',
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
