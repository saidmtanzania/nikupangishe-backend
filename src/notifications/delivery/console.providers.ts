import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailMessage, EmailProvider, SmsProvider } from './delivery.types';

@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  constructor(private readonly config: ConfigService) {}

  send(to: string, message: string): Promise<void> {
    const expose = this.config.get<string>('EXPOSE_DEV_AUTH_CODES') === 'true';
    const suffix = expose ? ` message=${message}` : '';
    this.logger.log(
      `Development SMS queued for ${to.replace(/\d(?=\d{4})/g, '*')}.${suffix}`,
    );
    return Promise.resolve();
  }
}

@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  send(message: EmailMessage): Promise<void> {
    this.logger.log(
      `Development email queued for ${message.to}: ${message.subject}`,
    );
    return Promise.resolve();
  }
}
