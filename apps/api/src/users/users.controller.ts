import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
@ApiTags('users') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}
  @Get() list(@CurrentUser() u: AuthUser) { return this.users.list(u.organizationId); }
}
