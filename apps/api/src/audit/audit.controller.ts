import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { AuditService } from './audit.service';
@ApiTags('audit') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('audit')
export class AuditController {
  constructor(private audit: AuditService) {}
  @Get() list(@CurrentUser() u: AuthUser, @Query('entityType') t?: string, @Query('entityId') id?: string) { return this.audit.list(u.organizationId, t, id); }
}
