import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { Permission } from '../common/permissions/permissions';
import { OperationsService } from './operations.service';

@ApiTags('operations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permission.OPERATIONS_READ)
@Controller('operations')
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get('overview')
  overview() {
    return this.operations.overview();
  }
}
