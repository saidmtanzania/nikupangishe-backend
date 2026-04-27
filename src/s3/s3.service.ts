import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as sharp from 'sharp';

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
   * Images are automatically resized to ≤800 px wide and compressed to 80 %
   * quality before upload (matching the Unsplash ?w=800&q=80 convention).
   * @param buffer   Raw file bytes
   * @param mimetype MIME type (e.g. image/jpeg)
   * @param folder   S3 key prefix (e.g. 'houses', 'avatars')
   * @param originalName Original filename (used for extension fallback)
   * @returns Public HTTPS URL of the uploaded object
   */
  async uploadFile(
    buffer: Buffer,
    mimetype: string,
    folder: string,
    originalName: string,
  ): Promise<string> {
    const {
      buffer: optimised,
      ext,
      contentType,
    } = await this.optimiseImage(buffer, mimetype, originalName);

    const key = `${folder}/${uuidv4()}${ext}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: optimised,
        ContentType: contentType,
      }),
    );

    const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    this.logger.log(`Uploaded to S3: ${url}`);
    return url;
  }

  /**
   * Optimise an image buffer before upload.
   * – Resize to max 800 px wide (preserves aspect ratio, never enlarges)
   * – Compress to 80 % quality
   * – WebP input → WebP output; everything else → JPEG
   */
  private async optimiseImage(
    buffer: Buffer,
    mimetype: string,
    originalName: string,
  ): Promise<{ buffer: Buffer; ext: string; contentType: string }> {
    try {
      const isWebP = mimetype === 'image/webp';
      let pipeline = (sharp as unknown as typeof sharp.default)(buffer).resize({
        width: 800,
        withoutEnlargement: true,
      });

      if (isWebP) {
        pipeline = pipeline.webp({ quality: 80 });
        return {
          buffer: await pipeline.toBuffer(),
          ext: '.webp',
          contentType: 'image/webp',
        };
      } else {
        pipeline = pipeline.jpeg({ quality: 80, mozjpeg: true });
        return {
          buffer: await pipeline.toBuffer(),
          ext: '.jpg',
          contentType: 'image/jpeg',
        };
      }
    } catch (err) {
      // If Sharp fails (e.g. non-image file), fall through with original bytes
      this.logger.warn(
        `Image optimisation failed, uploading original: ${String(err)}`,
      );
      return {
        buffer,
        ext: extname(originalName) || '.jpg',
        contentType: mimetype,
      };
    }
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
