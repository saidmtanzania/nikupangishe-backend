export interface SmsProvider {
  send(to: string, message: string): Promise<void>;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}
