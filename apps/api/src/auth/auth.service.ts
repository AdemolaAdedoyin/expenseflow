import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { compare } from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto';

const DEFAULT_REFRESH_TOKEN_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueSession(user);
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const currentSession = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !currentSession ||
      currentSession.revokedAt ||
      currentSession.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    const nextRefreshToken = this.createRefreshToken();
    const nextTokenHash = this.hashToken(nextRefreshToken);
    const nextExpiresAt = this.getRefreshExpiry();
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.session.updateMany({
        where: {
          id: currentSession.id,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          lastUsedAt: now,
        },
      });

      if (revoked.count !== 1) {
        throw new UnauthorizedException('Session has already been rotated');
      }

      await tx.session.create({
        data: {
          userId: currentSession.userId,
          tokenHash: nextTokenHash,
          expiresAt: nextExpiresAt,
        },
      });
    });

    return {
      accessToken: await this.signAccessToken(currentSession.user),
      refreshToken: nextRefreshToken,
      refreshExpiresAt: nextExpiresAt,
      user: this.toPublicUser(currentSession.user),
    };
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) {
      return;
    }

    await this.prisma.session.updateMany({
      where: {
        tokenHash: this.hashToken(refreshToken),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async logoutAll(userId: string) {
    await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  private async issueSession(user: User) {
    const refreshToken = this.createRefreshToken();
    const refreshExpiresAt = this.getRefreshExpiry();

    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      accessToken: await this.signAccessToken(user),
      refreshToken,
      refreshExpiresAt,
      user: this.toPublicUser(user),
    };
  }

  private signAccessToken(user: User) {
    return this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
    });
  }

  private toPublicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organizationId: user.organizationId,
    };
  }

  private createRefreshToken() {
    return randomBytes(48).toString('base64url');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private getRefreshExpiry() {
    const configuredDays = this.config.get<number>(
      'REFRESH_TOKEN_TTL_DAYS',
      DEFAULT_REFRESH_TOKEN_DAYS,
    );

    return new Date(Date.now() + configuredDays * 24 * 60 * 60 * 1000);
  }
}
