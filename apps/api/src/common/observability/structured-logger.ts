import { Injectable, LoggerService } from '@nestjs/common';
import { RequestContextService } from './request-context';

@Injectable()
export class StructuredLogger implements LoggerService {
  constructor(private readonly context: RequestContextService) {}

  log(message: unknown, context?: string) {
    this.write('info', message, context);
  }

  error(message: unknown, trace?: string, context?: string) {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string) {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string) {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string) {
    this.write('verbose', message, context);
  }

  private write(level: string, message: unknown, source?: string, stack?: string) {
    const traceContext = this.context.get();
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'expenseflow-api',
      message: normalizeMessage(message),
      ...(source ? { source } : {}),
      ...(traceContext ?? {}),
      ...(stack ? { stack } : {}),
    };

    const output = JSON.stringify(entry);
    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }
}

function normalizeMessage(message: unknown) {
  if (message instanceof Error) {
    return message.message;
  }

  if (typeof message === 'string') {
    return message;
  }

  try {
    return JSON.stringify(message);
  } catch {
    return String(message);
  }
}
