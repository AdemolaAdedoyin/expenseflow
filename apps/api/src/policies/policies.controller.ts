import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreatePolicyDto } from './dto';
import { PoliciesService } from './policies.service';

@ApiTags('policies') @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Controller('policies')
export class PoliciesController {
  constructor(private policies: PoliciesService) {}
  @Get() list(@CurrentUser() u: AuthUser) { return this.policies.list(u.organizationId); }
  @Post() @Roles(Role.ADMIN, Role.FINANCE) create(@CurrentUser() u: AuthUser, @Body() dto: CreatePolicyDto) { return this.policies.create(u.organizationId, dto); }
  @Delete(':id') @Roles(Role.ADMIN, Role.FINANCE) remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.policies.remove(u.organizationId, id); }
}
