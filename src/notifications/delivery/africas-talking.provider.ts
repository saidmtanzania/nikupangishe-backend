import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsProvider } from './delivery.types';

@Injectable()
export class AfricasTalkingSmsProvider implements SmsProvider {
  constructor(private readonly config: ConfigService) {}

  async send(to: string, message: string): Promise<void> {
    const username = this.config.getOrThrow<string>('sms.atUsername');
    const apiKey = this.config.getOrThrow<string>('sms.atApiKey');
    const senderId = this.config.get<string>('sms.senderId');
    const body = new URLSearchParams({ username, to, message });
    if (senderId) body.set('from', senderId);

    let response: Response;
    try {
      response = await fetch(
        'https://api.africastalking.com/version1/messaging',
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            apiKey,
          },
          body,
        },
      );
    } catch {
      throw new ServiceUnavailableException('SMS delivery is unavailable');
    }

    if (!response.ok) {
      throw new ServiceUnavailableException('SMS delivery failed');
    }
  }
}
