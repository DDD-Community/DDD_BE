import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { ProjectService } from '../application/project.service';
import { ProjectListQueryDto } from './dto/project.request.dto';
import { ProjectDetailResponseDto, ProjectListResponseDto } from './dto/project.response.dto';

@ApiTags('Project')
@Controller({ path: 'projects', version: '1' })
export class PublicProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @ApiDoc({
    summary: '프로젝트 목록 조회',
    description: '공개된 프로젝트 목록을 조회합니다. 플랫폼 필터를 지원합니다.',
    operationId: 'project_getPublicList',
  })
  @Get()
  async findAllProjects(@Query() query: ProjectListQueryDto) {
    const { items, nextCursor, hasNext } = await this.projectService.findProjectsByCursor({
      platform: query.platform,
      cursor: query.cursor,
      limit: query.limit,
    });

    return ApiResponse.ok(
      items.map((project) => ProjectListResponseDto.from(project)),
      'success',
      { nextCursor, hasNext },
    );
  }

  @ApiDoc({
    summary: '프로젝트 상세 조회',
    description: '프로젝트 상세 정보를 조회합니다. 참여자 이름+파트, PDF URL을 포함합니다.',
    operationId: 'project_getPublicById',
  })
  @Get(':id')
  async findProjectById(@Param('id', ParseIntPipe) id: number) {
    const project = await this.projectService.findProjectById({ id });
    return ApiResponse.ok(ProjectDetailResponseDto.from(project));
  }
}
