import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OidcService } from './oidc.service';

const REFRESH_COOKIE_NAME = 'expenseflow_refresh';
const OIDC_FLOW_COOKIE_NAME = 'expenseflow_oidc_flow';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly oidc: OidcService,
  ) {}

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(dto);
    this.setRefreshCookie(
      response,
      result.refreshToken,
      result.refreshExpiresAt,
    );

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Get('sso/config')
  ssoConfig() {
    return { enabled: this.oidc.enabled() };
  }

  @Get('sso/start')
  async startSso(@Res() response: Response) {
    const request = await this.oidc.createAuthorizationRequest();
    response.cookie(OIDC_FLOW_COOKIE_NAME, request.flowCookie, {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/api/auth/sso',
    });
    return response.redirect(request.authorizationUrl);
  }

  @Get('sso/callback')
  async completeSso(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    if (!code || !state) {
      throw new UnauthorizedException('SSO callback is missing code or state');
    }

    const flowCookie = this.getCookie(request, OIDC_FLOW_COOKIE_NAME);
    if (!flowCookie) {
      throw new UnauthorizedException('SSO flow cookie is missing');
    }

    const identity = await this.oidc.exchangeCallback(code, state, flowCookie);
    const result = await this.auth.loginWithOidcEmail(identity.email);
    this.setRefreshCookie(response, result.refreshToken, result.refreshExpiresAt);
    response.clearCookie(OIDC_FLOW_COOKIE_NAME, {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: 'lax',
      path: '/api/auth/sso',
    });

    // The API never places an access or refresh token in the redirect URL. The frontend
    // lands on a callback route and obtains a short-lived access token through the normal
    // refresh-cookie flow, keeping credentials out of browser history and referrer logs.
    const webOrigin = this.config.get<string>('WEB_ORIGIN', 'http://localhost:5173');
    return response.redirect(`${webOrigin.replace(/\/$/, '')}/sso/callback`);
  }

  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = this.getRefreshToken(request);
    const result = await this.auth.refresh(refreshToken);

    this.setRefreshCookie(
      response,
      result.refreshToken,
      result.refreshExpiresAt,
    );

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(this.getRefreshToken(request, false));
    this.clearRefreshCookie(response);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logoutAll(user.sub);
    this.clearRefreshCookie(response);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async me(@CurrentUser() user: AuthUser) {
    return this.prisma.user.findFirstOrThrow({
      where: {
        id: user.sub,
        organizationId: user.organizationId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        department: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  private getRefreshToken(request: Request, required = true) {
    const token = this.getCookie(request, REFRESH_COOKIE_NAME);

    if (!token && required) {
      throw new UnauthorizedException('Refresh token cookie is missing');
    }

    return token as string;
  }

  private getCookie(request: Request, name: string) {
    const cookieHeader = request.headers.cookie ?? '';
    const cookie = cookieHeader
      .split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${name}=`));

    return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : undefined;
  }

  private setRefreshCookie(
    response: Response,
    token: string,
    expires: Date,
  ) {
    response.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: 'lax',
      expires,
      path: '/api/auth',
    });
  }

  private clearRefreshCookie(response: Response) {
    response.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: 'lax',
      path: '/api/auth',
    });
  }

  private isProduction() {
    return this.config.get('NODE_ENV') === 'production';
  }
}
