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
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiExtraModels, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../common/decorator/roles.decorator';
import { RolesGuard } from '../../common/guard/roles.guard';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { UserRole } from '../../user/domain/user.role';
import { ProjectService } from '../application/project.service';
import { AdminProjectSwagger } from './admin.project.swagger';
import {
  CreateProjectRequestDto,
  UpdateProjectMembersRequestDto,
  UpdateProjectRequestDto,
} from './dto/project.request.dto';
import { AdminProjectListResponseDto, ProjectDetailResponseDto } from './dto/project.response.dto';

@ApiTags('Admin - Project')
@ApiExtraModels(ProjectDetailResponseDto, AdminProjectListResponseDto)
@Controller({ path: 'admin/projects', version: '1' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.계정관리, UserRole.운영자)
export class AdminProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @ApiDoc({
    summary: '프로젝트 생성',
    description: '새로운 프로젝트를 생성합니다.',
    operationId: 'project_createAdmin',
    auth: true,
    responses: [
      AdminProjectSwagger.createProject.success,
      AdminProjectSwagger.createProject.unauthorized,
    ],
  })
  @Post()
  async createProject(@Body() body: CreateProjectRequestDto) {
    const project = await this.projectService.createProject({ data: body });
    return ApiResponse.ok(ProjectDetailResponseDto.from(project));
  }

  @ApiDoc({
    summary: '프로젝트 전체 목록 조회',
    description: '모든 프로젝트를 조회합니다.',
    operationId: 'project_getAdminList',
    auth: true,
    responses: [
      AdminProjectSwagger.findAllProjects.success,
      AdminProjectSwagger.findAllProjects.unauthorized,
    ],
  })
  @Get()
  async findAllProjects() {
    const projects = await this.projectService.findAllProjects();
    return ApiResponse.ok(projects.map((project) => AdminProjectListResponseDto.from(project)));
  }

  @ApiDoc({
    summary: '프로젝트 상세 조회',
    description: '특정 프로젝트의 상세 정보를 조회합니다.',
    operationId: 'project_getAdminById',
    auth: true,
    responses: [
      AdminProjectSwagger.findProjectById.success,
      AdminProjectSwagger.findProjectById.unauthorized,
      AdminProjectSwagger.findProjectById.notFound,
    ],
  })
  @Get(':id')
  async findProjectById(@Param('id', ParseIntPipe) id: number) {
    const project = await this.projectService.findProjectById({ id });
    return ApiResponse.ok(ProjectDetailResponseDto.from(project));
  }

  @ApiDoc({
    summary: '프로젝트 수정',
    description: '프로젝트 정보를 수정합니다.',
    operationId: 'project_updateAdminById',
    auth: true,
    responses: [
      AdminProjectSwagger.updateProject.success,
      AdminProjectSwagger.updateProject.unauthorized,
      AdminProjectSwagger.updateProject.notFound,
    ],
  })
  @Patch(':id')
  async updateProject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateProjectRequestDto,
  ) {
    await this.projectService.updateProject({ id, data: body });
    return ApiResponse.ok(null, '프로젝트가 수정되었습니다.');
  }

  @ApiDoc({
    summary: '프로젝트 참여자 수정',
    description: '프로젝트 참여자 목록을 전체 교체합니다.',
    operationId: 'project_updateMembersAdmin',
    auth: true,
    responses: [
      AdminProjectSwagger.updateProjectMembers.success,
      AdminProjectSwagger.updateProjectMembers.unauthorized,
      AdminProjectSwagger.updateProjectMembers.notFound,
    ],
  })
  @Put(':id/members')
  async updateProjectMembers(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateProjectMembersRequestDto,
  ) {
    await this.projectService.updateProjectMembers({ id, members: body.members });
    return ApiResponse.ok(null, '프로젝트 참여자가 수정되었습니다.');
  }

  @ApiDoc({
    summary: '프로젝트 삭제',
    description: '프로젝트를 소프트 삭제합니다.',
    operationId: 'project_deleteAdminById',
    auth: true,
    responses: [
      AdminProjectSwagger.deleteProject.noContent,
      AdminProjectSwagger.deleteProject.unauthorized,
      AdminProjectSwagger.deleteProject.notFound,
    ],
  })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProject(@Param('id', ParseIntPipe) id: number) {
    await this.projectService.deleteProject({ id });
  }
}
