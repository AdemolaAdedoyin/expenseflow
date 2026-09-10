import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { ApprovalsService } from './approvals.service';
import { DecideApprovalDto } from './dto';
@ApiTags('approvals') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('approvals')
export class ApprovalsController {
  constructor(private approvals: ApprovalsService) {}
  @Get('inbox') inbox(@CurrentUser() u: AuthUser) { return this.approvals.inbox(u); }
  @Post(':id/decision') decide(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: DecideApprovalDto) { return this.approvals.decide(u, id, dto); }
}
