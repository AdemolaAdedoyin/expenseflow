import { ConfigService } from '@nestjs/config';
import { ReceiptStorageService } from './receipt-storage.service';

const values: Record<string, string> = {
  S3_RECEIPTS_BUCKET: 'expenseflow-test-receipts',
  AWS_REGION: 'us-east-1',
  AWS_ACCESS_KEY_ID: 'test-access-key',
  AWS_SECRET_ACCESS_KEY: 'test-secret-key',
};

describe('ReceiptStorageService', () => {
  const config = {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
  const service = new ReceiptStorageService(config);

  it('creates a tenant-scoped pre-signed POST target', () => {
    const target = service.createUploadTarget('org-1', 'expense-1', 'application/pdf');

    expect(target.objectKey).toMatch(
      /^organizations\/org-1\/expenses\/expense-1\/receipts\/.+\.pdf$/,
    );
    expect(target.uploadUrl).toBe(
      'https://expenseflow-test-receipts.s3.us-east-1.amazonaws.com/',
    );
    expect(target.fields.key).toBe(target.objectKey);
    expect(target.fields.Policy).toBeTruthy();
    expect(target.fields['X-Amz-Signature']).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects unsupported receipt content types', () => {
    expect(() => service.createUploadTarget('org-1', 'expense-1', 'text/plain')).toThrow(
      'Receipts must be JPEG, PNG, or PDF files',
    );
  });

  it('prevents one expense from completing another expense receipt key', () => {
    expect(() =>
      service.assertObjectBelongsToExpense(
        'org-1',
        'expense-1',
        'organizations/org-1/expenses/expense-2/receipts/receipt.pdf',
      ),
    ).toThrow('Receipt object does not belong to this expense');
  });

  it('creates a short-lived signed download URL', () => {
    const result = service.createDownloadUrl(
      'organizations/org-1/expenses/expense-1/receipts/receipt.pdf',
    );

    expect(result.expiresInSeconds).toBe(300);
    expect(result.downloadUrl).toContain('X-Amz-Signature=');
    expect(result.downloadUrl).toContain('X-Amz-Expires=300');
  });
});
