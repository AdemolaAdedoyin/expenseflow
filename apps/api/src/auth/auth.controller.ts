import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private prisma: PrismaService) {}

  @Post('login') login(@Body() dto: LoginDto) { return this.auth.login(dto); }

  @Get('me') @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  async me(@CurrentUser() user: AuthUser) {
    return this.prisma.user.findFirstOrThrow({
      where: { id: user.sub, organizationId: user.organizationId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, department: true, organization: { select: { id: true, name: true, slug: true } } },
    });
  }
}
