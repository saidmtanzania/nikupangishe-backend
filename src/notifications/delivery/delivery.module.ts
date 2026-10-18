import { Module } from '@nestjs/common';
import { AfricasTalkingSmsProvider } from './africas-talking.provider';
import { ConsoleEmailProvider, ConsoleSmsProvider } from './console.providers';
import { EmailService, SmsService } from './delivery.service';
import { SesEmailProvider } from './ses-email.provider';

@Module({
  providers: [
    AfricasTalkingSmsProvider,
    ConsoleEmailProvider,
    ConsoleSmsProvider,
    EmailService,
    SesEmailProvider,
    SmsService,
  ],
  exports: [EmailService, SmsService],
})
export class DeliveryModule {}
