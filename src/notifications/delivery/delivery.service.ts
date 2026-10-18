import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AfricasTalkingSmsProvider } from './africas-talking.provider';
import { ConsoleEmailProvider, ConsoleSmsProvider } from './console.providers';
import { EmailMessage } from './delivery.types';
import { SesEmailProvider } from './ses-email.provider';

@Injectable()
export class SmsService {
  constructor(
    private readonly config: ConfigService,
    private readonly consoleProvider: ConsoleSmsProvider,
    private readonly africasTalkingProvider: AfricasTalkingSmsProvider,
  ) {}

  send(to: string, message: string): Promise<void> {
    return this.provider().send(to, message);
  }

  private provider() {
    return this.config.get<string>('sms.provider') === 'africastalking'
      ? this.africasTalkingProvider
      : this.consoleProvider;
  }
}

@Injectable()
export class EmailService {
  constructor(
    private readonly config: ConfigService,
    private readonly consoleProvider: ConsoleEmailProvider,
    private readonly sesProvider: SesEmailProvider,
  ) {}

  send(message: EmailMessage): Promise<void> {
    return this.provider().send(message);
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    return this.send({
      to,
      subject: 'Reset your Nikupangishe password',
      text: `Use this link to reset your Nikupangishe password: ${resetUrl}\n\nThis link expires in one hour.`,
      html: `<p>Use the link below to reset your Nikupangishe password:</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in one hour.</p>`,
    });
  }

  private provider() {
    return this.config.get<string>('email.provider') === 'ses'
      ? this.sesProvider
      : this.consoleProvider;
  }
}
