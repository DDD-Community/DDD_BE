import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class FindAdminGeneralEarlyNotificationsQueryDto {
  @ApiPropertyOptional({ description: '미승격 대상만 조회', example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) {
      return true;
    }

    if (value === 'false' || value === false) {
      return false;
    }

    return value as boolean;
  })
  @IsBoolean()
  onlyUnpromoted?: boolean;
}
