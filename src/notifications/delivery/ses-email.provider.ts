import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { EmailMessage, EmailProvider } from './delivery.types';

@Injectable()
export class SesEmailProvider implements EmailProvider {
  private readonly client: SESClient;

  constructor(private readonly config: ConfigService) {
    const region = this.config.get<string>('aws.region', 'us-east-1');
    const accessKeyId = this.config.get<string>('aws.accessKeyId');
    const secretAccessKey = this.config.get<string>('aws.secretAccessKey');
    this.client = new SESClient({
      region,
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
  }

  async send(message: EmailMessage): Promise<void> {
    const source = this.config.getOrThrow<string>('email.from');
    try {
      await this.client.send(
        new SendEmailCommand({
          Source: source,
          Destination: { ToAddresses: [message.to] },
          Message: {
            Subject: { Data: message.subject, Charset: 'UTF-8' },
            Body: {
              Text: { Data: message.text, Charset: 'UTF-8' },
              Html: { Data: message.html, Charset: 'UTF-8' },
            },
          },
        }),
      );
    } catch {
      throw new ServiceUnavailableException('Email delivery is unavailable');
    }
  }
}
