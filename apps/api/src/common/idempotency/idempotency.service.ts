import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { IdempotencyStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type IdempotencyClaim =
  | { kind: 'claimed'; recordId: string }
  | { kind: 'replay'; responseStatus: number; responseBody: unknown };

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  hashRequest(input: { method: string; path: string; body: unknown }) {
    return createHash('sha256')
      .update(JSON.stringify(this.sortValue(input)))
      .digest('hex');
  }

  async claim(input: {
    organizationId: string;
    actorId: string;
    key: string;
    method: string;
    path: string;
    requestHash: string;
  }): Promise<IdempotencyClaim> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    try {
      const record = await this.prisma.idempotencyRecord.create({
        data: {
          ...input,
          expiresAt,
        },
      });

      return { kind: 'claimed', recordId: record.id };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
    }

    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        organizationId_actorId_key: {
          organizationId: input.organizationId,
          actorId: input.actorId,
          key: input.key,
        },
      },
    });

    if (!existing) {
      return this.claim(input);
    }

    if (existing.expiresAt <= new Date()) {
      await this.prisma.idempotencyRecord.deleteMany({
        where: { id: existing.id, expiresAt: { lte: new Date() } },
      });
      return this.claim(input);
    }

    if (
      existing.method !== input.method ||
      existing.path !== input.path ||
      existing.requestHash !== input.requestHash
    ) {
      throw new ConflictException('Idempotency key has already been used for a different request');
    }

    if (
      existing.status === IdempotencyStatus.COMPLETED &&
      existing.responseStatus !== null
    ) {
      return {
        kind: 'replay',
        responseStatus: existing.responseStatus,
        responseBody: existing.responseBody ? JSON.parse(existing.responseBody) : undefined,
      };
    }

    throw new ConflictException('A request with this idempotency key is already in progress');
  }

  async complete(recordId: string, responseStatus: number, responseBody: unknown) {
    await this.prisma.idempotencyRecord.update({
      where: { id: recordId },
      data: {
        status: IdempotencyStatus.COMPLETED,
        responseStatus,
        responseBody: responseBody === undefined ? null : JSON.stringify(responseBody),
      },
    });
  }

  async release(recordId: string) {
    await this.prisma.idempotencyRecord.deleteMany({
      where: { id: recordId, status: IdempotencyStatus.PENDING },
    });
  }

  private sortValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortValue(item));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, item]) => [key, this.sortValue(item)]),
      );
    }

    return value;
  }
}
