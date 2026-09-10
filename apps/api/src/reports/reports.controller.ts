import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
@ApiTags('reports') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('reports')
export class ReportsController {
  constructor(private reports: ReportsService) {}
  @Get('dashboard') dashboard(@CurrentUser() u: AuthUser) { return this.reports.dashboard(u.organizationId); }
}
