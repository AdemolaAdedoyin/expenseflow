import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'crypto';

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export type EmailDeliveryResult = {
  delivered: boolean;
  provider: 'console' | 'ses';
  messageId?: string;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailDeliveryResult>;
}

@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    this.logger.log(`${message.to} :: ${message.subject} :: ${message.text}`);
    return { delivered: true, provider: 'console' };
  }
}

@Injectable()
export class SesEmailProvider implements EmailProvider {
  constructor(private readonly config: ConfigService) {}

  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    const region = this.config.getOrThrow<string>('AWS_REGION');
    const accessKeyId = this.config.getOrThrow<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.getOrThrow<string>('AWS_SECRET_ACCESS_KEY');
    const sessionToken = this.config.get<string>('AWS_SESSION_TOKEN');
    const from = this.config.getOrThrow<string>('SES_FROM_EMAIL');

    const host = `email.${region}.amazonaws.com`;
    const url = `https://${host}/v2/email/outbound-emails`;
    const body = JSON.stringify({
      FromEmailAddress: from,
      Destination: { ToAddresses: [message.to] },
      Content: {
        Simple: {
          Subject: { Data: message.subject, Charset: 'UTF-8' },
          Body: { Text: { Data: message.text, Charset: 'UTF-8' } },
        },
      },
    });

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = this.sha256(body);
    const signedHeaders = sessionToken
      ? 'content-type;host;x-amz-content-sha256;x-amz-date;x-amz-security-token'
      : 'content-type;host;x-amz-content-sha256;x-amz-date';

    const canonicalHeaders = [
      'content-type:application/json',
      `host:${host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`,
      ...(sessionToken ? [`x-amz-security-token:${sessionToken}`] : []),
    ].join('\n') + '\n';

    const canonicalRequest = [
      'POST',
      '/v2/email/outbound-emails',
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${region}/ses/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      this.sha256(canonicalRequest),
    ].join('\n');

    const signingKey = this.getSignatureKey(secretAccessKey, dateStamp, region, 'ses');
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    const authorization =
      `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        host,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        ...(sessionToken ? { 'x-amz-security-token': sessionToken } : {}),
        authorization,
      },
      body,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`SES delivery failed (${response.status}): ${errorBody}`);
    }

    const result = (await response.json()) as { MessageId?: string };
    return { delivered: true, provider: 'ses', messageId: result.MessageId };
  }

  private sha256(value: string) {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }

  private hmac(key: Buffer | string, value: string) {
    return createHmac('sha256', key).update(value, 'utf8').digest();
  }

  private getSignatureKey(secret: string, date: string, region: string, service: string) {
    const dateKey = this.hmac(`AWS4${secret}`, date);
    const regionKey = this.hmac(dateKey, region);
    const serviceKey = this.hmac(regionKey, service);
    return this.hmac(serviceKey, 'aws4_request');
  }
}

@Injectable()
export class EmailProviderService implements EmailProvider {
  constructor(
    private readonly config: ConfigService,
    private readonly consoleProvider: ConsoleEmailProvider,
    private readonly sesProvider: SesEmailProvider,
  ) {}

  send(message: EmailMessage) {
    const provider = this.config.get<string>('EMAIL_PROVIDER', 'console').toLowerCase();
    return provider === 'ses'
      ? this.sesProvider.send(message)
      : this.consoleProvider.send(message);
  }
}
