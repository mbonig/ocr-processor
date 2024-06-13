import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import * as sesClientModule from '@aws-sdk/client-ses';
import { AnalyzeDocumentCommand, TextractClient } from '@aws-sdk/client-textract';
import { SQSEvent } from 'aws-lambda';
import { EventBridgeEvent } from 'aws-lambda/trigger/eventbridge';
import nodemailer from 'nodemailer';

export const BUCKET = 'BUCKET_NAME';
const bucket = process.env[BUCKET]!;
const ses = new sesClientModule.SESClient({});
const transporter = nodemailer.createTransport({
  SES: { ses, aws: sesClientModule },
});

// @ts-ignore
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

const textractClient = new TextractClient({});
const s3Client = new S3Client({});

// @ts-ignore
async function processObjectKey(key: any) {
  const parts = key.split('/');
  const email = parts.find((x: string) => /[\s@]/.test(x));

  // get the filename by reading the last element in the parts array
  const [filename] = parts.slice(-1);

  const results = await textractClient.send(new AnalyzeDocumentCommand({
    Document: {
      S3Object: {
        Name: key,
        Bucket: bucket,
      },
    },
    FeatureTypes: ['LAYOUT'],
  }));
  const blockOfText = results.Blocks!
    .filter(x => x.BlockType === 'LINE')
    .map(x => x.Text)
    .join('\n');

  const originalImage = await s3Client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  }));
  const image = await originalImage.Body!.transformToString('base64');

  await sendEmailWithAttachments({
    from: 'notes@ocr.matthewbonig.com',
    to: email,
    filename,
    text: blockOfText,
    attachments: [{
      filename, content: image, encoding: 'base64',
    }],
  });
}

export const sendEmailWithAttachments = (
  {
    from,
    to,
    filename,
    text,
    attachments,
  }: any,
) => {

  return new Promise((resolve, reject) => {
    transporter.sendMail(
      {
        from,
        to,
        subject: `Results from the image ${filename}`,
        text: text,
        attachments: attachments,
      },
      (err, info) => {
        if (err) {
          reject(err);
        } else {
          resolve(info);
        }
      },
    );
  });
};

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
