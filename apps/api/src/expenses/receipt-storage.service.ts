import { createHash, createHmac, randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const UPLOAD_TTL_SECONDS = 5 * 60;
const DOWNLOAD_TTL_SECONDS = 5 * 60;

const contentTypeExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

type S3Config = {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

export type ReceiptUploadTarget = {
  objectKey: string;
  uploadUrl: string;
  fields: Record<string, string>;
  expiresInSeconds: number;
};

@Injectable()
export class ReceiptStorageService {
  constructor(private readonly config: ConfigService) {}

  createUploadTarget(
    organizationId: string,
    expenseId: string,
    contentType: string,
  ): ReceiptUploadTarget {
    const extension = contentTypeExtensions[contentType];
    if (!extension) {
      throw new BadRequestException('Receipts must be JPEG, PNG, or PDF files');
    }

    const s3 = this.getS3Config();
    const objectKey = `organizations/${organizationId}/expenses/${expenseId}/receipts/${randomUUID()}.${extension}`;
    const now = new Date();
    const amzDate = this.amzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = `${dateStamp}/${s3.region}/s3/aws4_request`;
    const credential = `${s3.accessKeyId}/${credentialScope}`;
    const expiration = new Date(now.getTime() + UPLOAD_TTL_SECONDS * 1000).toISOString();

    const conditions: Array<Record<string, string> | [string, number, number]> = [
      { bucket: s3.bucket },
      { key: objectKey },
      { 'Content-Type': contentType },
      { 'x-amz-algorithm': 'AWS4-HMAC-SHA256' },
      { 'x-amz-credential': credential },
      { 'x-amz-date': amzDate },
      ['content-length-range', 1, MAX_RECEIPT_BYTES],
    ];

    if (s3.sessionToken) {
      conditions.push({ 'x-amz-security-token': s3.sessionToken });
    }

    const policy = Buffer.from(JSON.stringify({ expiration, conditions })).toString('base64');
    const signingKey = this.getSigningKey(s3.secretAccessKey, dateStamp, s3.region);
    const signature = createHmac('sha256', signingKey).update(policy).digest('hex');

    const fields: Record<string, string> = {
      key: objectKey,
      'Content-Type': contentType,
      'x-amz-algorithm': 'AWS4-HMAC-SHA256',
      'x-amz-credential': credential,
      'x-amz-date': amzDate,
      Policy: policy,
      'x-amz-signature': signature,
    };

    if (s3.sessionToken) {
      fields['x-amz-security-token'] = s3.sessionToken;
    }

    return {
      objectKey,
      uploadUrl: `https://${this.host(s3)}/`,
      fields,
      expiresInSeconds: UPLOAD_TTL_SECONDS,
    };
  }

  createDownloadUrl(objectKey: string) {
    const s3 = this.getS3Config();
    const now = new Date();
    const amzDate = this.amzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = `${dateStamp}/${s3.region}/s3/aws4_request`;

    const query: Record<string, string> = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${s3.accessKeyId}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(DOWNLOAD_TTL_SECONDS),
      'X-Amz-SignedHeaders': 'host',
    };

    if (s3.sessionToken) {
      query['X-Amz-Security-Token'] = s3.sessionToken;
    }

    const canonicalQuery = Object.entries(query)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${this.encode(key)}=${this.encode(value)}`)
      .join('&');
    const canonicalUri = `/${this.encodePath(objectKey)}`;
    const canonicalRequest = [
      'GET',
      canonicalUri,
      canonicalQuery,
      `host:${this.host(s3)}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');
    const signingKey = this.getSigningKey(s3.secretAccessKey, dateStamp, s3.region);
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    return {
      downloadUrl: `https://${this.host(s3)}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`,
      expiresInSeconds: DOWNLOAD_TTL_SECONDS,
    };
  }

  assertObjectBelongsToExpense(organizationId: string, expenseId: string, objectKey: string) {
    const expectedPrefix = `organizations/${organizationId}/expenses/${expenseId}/receipts/`;
    if (!objectKey.startsWith(expectedPrefix)) {
      throw new BadRequestException('Receipt object does not belong to this expense');
    }
  }

  toStorageUri(objectKey: string) {
    return `s3://${this.getS3Config().bucket}/${objectKey}`;
  }

  objectKeyFromStorageUri(storageUri: string) {
    const s3 = this.getS3Config();
    const prefix = `s3://${s3.bucket}/`;

    if (!storageUri.startsWith(prefix)) {
      throw new BadRequestException('Receipt storage location is invalid');
    }

    return storageUri.slice(prefix.length);
  }

  private getS3Config(): S3Config {
    const bucket = this.config.get<string>('S3_RECEIPTS_BUCKET');
    const region = this.config.get<string>('AWS_REGION');
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    const sessionToken = this.config.get<string>('AWS_SESSION_TOKEN');

    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
      throw new ServiceUnavailableException('Receipt storage is not configured');
    }

    return { bucket, region, accessKeyId, secretAccessKey, sessionToken };
  }

  private host(config: S3Config) {
    return `${config.bucket}.s3.${config.region}.amazonaws.com`;
  }

  private encode(value: string) {
    return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
  }

  private encodePath(value: string) {
    return value.split('/').map((part) => this.encode(part)).join('/');
  }

  private amzDate(date: Date) {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  }

  private getSigningKey(secretAccessKey: string, dateStamp: string, region: string) {
    const dateKey = createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest();
    const regionKey = createHmac('sha256', dateKey).update(region).digest();
    const serviceKey = createHmac('sha256', regionKey).update('s3').digest();
    return createHmac('sha256', serviceKey).update('aws4_request').digest();
  }
}
