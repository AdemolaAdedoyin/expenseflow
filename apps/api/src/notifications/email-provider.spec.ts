import { ConfigService } from '@nestjs/config';
import {
  ConsoleEmailProvider,
  EmailProviderService,
  SesEmailProvider,
} from './email-provider';

describe('EmailProviderService', () => {
  const message = {
    to: 'manager@demo.com',
    subject: 'Expense approval requested',
    text: 'A new expense is awaiting approval.',
  };

  it('uses the console provider by default', async () => {
    const config = { get: jest.fn().mockReturnValue('console') } as unknown as ConfigService;
    const consoleProvider = {
      send: jest.fn().mockResolvedValue({ delivered: true, provider: 'console' }),
    } as unknown as ConsoleEmailProvider;
    const sesProvider = {
      send: jest.fn(),
    } as unknown as SesEmailProvider;

    const service = new EmailProviderService(config, consoleProvider, sesProvider);
    const result = await service.send(message);

    expect(consoleProvider.send).toHaveBeenCalledWith(message);
    expect(sesProvider.send).not.toHaveBeenCalled();
    expect(result.provider).toBe('console');
  });

  it('uses SES when EMAIL_PROVIDER is ses', async () => {
    const config = { get: jest.fn().mockReturnValue('ses') } as unknown as ConfigService;
    const consoleProvider = {
      send: jest.fn(),
    } as unknown as ConsoleEmailProvider;
    const sesProvider = {
      send: jest.fn().mockResolvedValue({
        delivered: true,
        provider: 'ses',
        messageId: 'message-123',
      }),
    } as unknown as SesEmailProvider;

    const service = new EmailProviderService(config, consoleProvider, sesProvider);
    const result = await service.send(message);

    expect(sesProvider.send).toHaveBeenCalledWith(message);
    expect(consoleProvider.send).not.toHaveBeenCalled();
    expect(result).toEqual({
      delivered: true,
      provider: 'ses',
      messageId: 'message-123',
    });
  });
});
