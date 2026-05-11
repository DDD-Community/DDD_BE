import { Controller, Get, HttpStatus, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiExtraModels, ApiTags } from '@nestjs/swagger';

import type { JwtUser } from '../../auth/application/auth.type';
import { AuthUser } from '../../common/decorator/auth-user.decorator';
import { AppException } from '../../common/exception/app.exception';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { UserService } from '../application/user.service';
import { MeResponseDto } from './dto/me.response.dto';
import { UserSwagger } from './user.swagger';

@ApiTags('Users')
@ApiExtraModels(MeResponseDto)
@Controller({ path: 'users', version: '1' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiDoc({
    summary: '내 정보 조회',
    description: '현재 로그인한 사용자의 식별 정보와 활성 권한을 반환합니다.',
    operationId: 'users_me',
    auth: true,
    responses: [UserSwagger.me.success, UserSwagger.me.unauthorized],
  })
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async me(@AuthUser() jwtUser: JwtUser) {
    const user = await this.userService.findById({ id: jwtUser.id });
    if (!user) {
      throw new AppException('USER_NOT_FOUND', HttpStatus.UNAUTHORIZED);
    }
    return ApiResponse.ok(MeResponseDto.from(user));
  }
}
