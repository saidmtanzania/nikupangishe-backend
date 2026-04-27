import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(private readonly config: ConfigService) {
    this.region = this.config.get<string>('aws.region', 'us-east-1');
    this.bucket = this.config.get<string>('aws.bucket', '');

    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.config.get<string>('aws.accessKeyId', ''),
        secretAccessKey: this.config.get<string>('aws.secretAccessKey', ''),
      },
    });
  }

  /**
   * Upload a file buffer to S3.
   * @param buffer   Raw file bytes
   * @param mimetype MIME type (e.g. image/jpeg)
   * @param folder   S3 key prefix (e.g. 'houses', 'avatars')
   * @param originalName Original filename (used for extension)
   * @returns Public HTTPS URL of the uploaded object
   */
  async uploadFile(
    buffer: Buffer,
    mimetype: string,
    folder: string,
    originalName: string,
  ): Promise<string> {
    const ext = extname(originalName);
    const key = `${folder}/${uuidv4()}${ext}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype
      }),
    );

    const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    this.logger.log(`Uploaded to S3: ${url}`);
    return url;
  }

  /**
   * Delete an object from S3 by its full URL or key.
   * @param keyOrUrl S3 object key (e.g. 'houses/abc.jpg') or full URL
   */
  async deleteFile(keyOrUrl: string): Promise<void> {
    // If a full URL is passed, extract the key
    const key = keyOrUrl.startsWith('http')
      ? new URL(keyOrUrl).pathname.replace(/^\//, '')
      : keyOrUrl;

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    this.logger.log(`Deleted from S3: ${key}`);
  }
}
