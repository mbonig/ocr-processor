import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { SQSEvent } from 'aws-lambda';
import { EventBridgeEvent } from 'aws-lambda/trigger/eventbridge';
import { simpleParser } from 'mailparser';

const bucket = process.env.BUCKET ?? 'fourlittledogs-ocr';
const s3Client = new S3Client({});

export const EMAIL_DROP_PREFIX = 'raw';
export const IMAGE_DROP_PREFIX = 'images';

interface RedriveEvent {
  version: string;
  timestamp: string;
  requestContext: {
    requestId: string;
    functionArn: string;
    condition: string;
    approximateInvokeCount: number;
  };
  requestPayload: {
    version: string;
    id: string;
    'detail-type': string;
    source: string;
    account: string;
    time: string;
    region: string;
    resources: string[];
    detail: {
      version: string;
      bucket: {
        name: string;
      };
      object: {
        key: string;
        size: number;
        etag: string;
        'version-id': string;
        sequencer: string;
      };
      'request-id': string;
      requester: string;
      'source-ip-address': string;
      reason: string;
    };
  };
  responseContext: {
    statusCode: number;
    executedVersion: string;
    functionError: string;
  };
  responsePayload: {
    errorType: string;
    errorMessage: string;
    trace: string[];
  };
}

async function processObjectKey(key: string) {
  const rawEmail = await s3Client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  }));

  const body = await rawEmail.Body!.transformToString();
  const email = await simpleParser(body);
  const { attachments, from } = email;

  for (const attachment of attachments) {
    // take the attachment and write it to s3
    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: `${IMAGE_DROP_PREFIX}/${from?.value[0].address}/${attachment.filename}`,
      Body: attachment.content,
      ContentType: attachment.contentType,
    }));
  }
}

export const handler = async (event: EventBridgeEvent<'Object Created', any> | SQSEvent): Promise<any> => {
  console.log(JSON.stringify(event, null, 2));

  if ('Records' in event) {
    // this is a redrive event in an sqs wrapper...
    for (const record of event.Records) {
      const { detail: { object: { key: key } } } = (JSON.parse(record.body) as RedriveEvent).requestPayload;
      await processObjectKey(key);
    }
  } else {
    const { detail: { object: { key: key } } } = event;
    await processObjectKey(key);

  }
};
