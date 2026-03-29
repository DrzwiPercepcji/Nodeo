import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import type { Readable } from 'node:stream';
import { createReadStream } from 'node:fs';
import config from '../config.js';

const client = new S3Client({
  region: config.s3.region,
  credentials: {
    accessKeyId: config.s3.accessKey,
    secretAccessKey: config.s3.secretKey,
  },
  ...(config.s3.endpoint ? { endpoint: config.s3.endpoint, forcePathStyle: true } : {}),
});

const bucket = config.s3.bucket;

export async function uploadFile(key: string, filePath: string, contentType: string): Promise<void> {
  const stream = createReadStream(filePath);
  const upload = new Upload({
    client,
    params: { Bucket: bucket, Key: key, Body: stream, ContentType: contentType },
    partSize: 10 * 1024 * 1024,
    queueSize: 3,
  });
  await upload.done();
}

export async function uploadBuffer(key: string, data: Buffer, contentType: string): Promise<void> {
  const upload = new Upload({
    client,
    params: { Bucket: bucket, Key: key, Body: data, ContentType: contentType },
  });
  await upload.done();
}

export async function getObject(key: string, range?: string): Promise<{
  body: Readable;
  contentLength: number;
  contentRange?: string;
}> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ...(range ? { Range: range } : {}),
  });
  const response = await client.send(command);
  return {
    body: response.Body as Readable,
    contentLength: response.ContentLength ?? 0,
    contentRange: response.ContentRange ?? undefined,
  };
}

export async function headObject(key: string): Promise<{ contentLength: number }> {
  const response = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  return { contentLength: response.ContentLength ?? 0 };
}

export async function deleteObject(key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
