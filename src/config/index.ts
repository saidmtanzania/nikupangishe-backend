import { registerAs } from '@nestjs/config';

const isProduction = () => process.env.NODE_ENV === 'production';

function getSecret(name: string, developmentValue: string): string {
  const value = process.env[name];
  if (value) return value;

  if (isProduction()) {
    throw new Error(`${name} must be configured in production`);
  }

  return developmentValue;
}

function getList(name: string, fallback: string[]): string[] {
  const value = process.env[name];
  if (!value) return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function validateEnvironment(config: Record<string, unknown>) {
  if (config.NODE_ENV === 'production') {
    const required = [
      'DB_HOST',
      'DB_USERNAME',
      'DB_PASSWORD',
      'DB_NAME',
      'REDIS_HOST',
      'REDIS_PASSWORD',
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'CORS_ORIGINS',
      'AWS_S3_BUCKET',
      'SMS_PROVIDER',
      'EMAIL_PROVIDER',
      'SES_FROM_EMAIL',
    ];
    const missing = required.filter((name) => !config[name]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required production environment variables: ${missing.join(', ')}`,
      );
    }

    if (config.SMS_PROVIDER !== 'africastalking') {
      throw new Error('SMS_PROVIDER must be africastalking in production');
    }
    if (config.EMAIL_PROVIDER !== 'ses') {
      throw new Error('EMAIL_PROVIDER must be ses in production');
    }
    const smsMissing = ['AT_USERNAME', 'AT_API_KEY', 'SMS_SENDER_ID'].filter(
      (name) => !config[name],
    );
    if (smsMissing.length > 0) {
      throw new Error(
        `Missing Africa's Talking environment variables: ${smsMissing.join(', ')}`,
      );
    }
    const weakSecrets = ['JWT_SECRET', 'JWT_REFRESH_SECRET'].filter(
      (name) => String(config[name]).length < 32,
    );
    if (weakSecrets.length > 0) {
      throw new Error(
        `Production JWT secrets must be at least 32 characters: ${weakSecrets.join(', ')}`,
      );
    }
  }

  return config;
}

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT ?? '3000', 10) || 3000,
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  corsOrigins: getList('CORS_ORIGINS', ['http://localhost:3001']),
}));

export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  name: process.env.DB_NAME || 'nikupangishe',
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  ssl: process.env.DB_SSL === 'true',
}));

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  ttl: parseInt(process.env.REDIS_TTL ?? '3600', 10) || 3600,
}));

export const jwtConfig = registerAs('jwt', () => ({
  secret: getSecret('JWT_SECRET', 'development-access-secret-change-me'),
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  refreshSecret: getSecret(
    'JWT_REFRESH_SECRET',
    'development-refresh-secret-change-me',
  ),
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
}));

export const uploadConfig = registerAs('upload', () => ({
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  maxFileSize:
    parseInt(process.env.MAX_FILE_SIZE ?? '10485760', 10) || 10485760,
  allowedTypes: process.env.ALLOWED_IMAGE_TYPES?.split(',') || [
    'image/jpeg',
    'image/png',
    'image/webp',
  ],
}));

export const throttleConfig = registerAs('throttle', () => ({
  ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10) || 60,
  limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10) || 100,
}));

export const awsConfig = registerAs('aws', () => ({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  bucket: process.env.AWS_S3_BUCKET || '',
}));

export const smsConfig = registerAs('sms', () => ({
  provider: process.env.SMS_PROVIDER || 'console',
  atUsername: process.env.AT_USERNAME || '',
  atApiKey: process.env.AT_API_KEY || '',
  senderId: process.env.SMS_SENDER_ID || '',
}));

export const emailConfig = registerAs('email', () => ({
  provider: process.env.EMAIL_PROVIDER || 'console',
  from: process.env.SES_FROM_EMAIL || '',
  webAppUrl: process.env.WEB_APP_URL || 'http://localhost:3001',
}));
