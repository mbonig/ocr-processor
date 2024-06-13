import { Readable } from 'node:stream';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { sdkStreamMixin } from '@smithy/util-stream';
import { SQSEvent } from 'aws-lambda';
import { EventBridgeEvent } from 'aws-lambda/trigger/eventbridge';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';

const testEvent: EventBridgeEvent<'Object Created', any> = {
  'version': '0',
  'id': '013fb9e4-dd92-da2d-3eba-ae38945bdaae',
  'detail-type': 'Object Created',
  'source': 'aws.s3',
  'account': '536309290949',
  'time': '2024-01-30T03:08:36Z',
  'region': 'us-east-1',
  'resources': [
    'arn:aws:s3:::mackenzienotesocr-bucket83908e77-yo9ugsw3lcjo',
  ],
  'detail': {
    'version': '0',
    'bucket': {
      name: 'mackenzienotesocr-bucket83908e77-yo9ugsw3lcjo',
    },
    'object': {
      key: 'raw/vt2b1r78ad2hgshojtl59sa213klh3oj1dpe1ng1',
      size: 1019378,
      etag: '0eabd398ab74e0baa274708d27c72b8d',
      sequencer: '0065B86834151B29C2',
    },
    'request-id': 'FEJEWT512WY0841J',
    'requester': 'ses.amazonaws.com',
    'source-ip-address': '10.0.35.28',
    'reason': 'PutObject',
  },
}
;

describe('MackenzieNotesOcrStack.EmailParser', () => {
  const s3ClientMock = mockClient(S3Client);
  beforeEach(() => {
    s3ClientMock.reset();
  });

  function setupS3Mock() {
    const stream = new Readable();
    stream.push('hello world');
    stream.push(null); // end of stream
    const sdkStream = sdkStreamMixin(stream);
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: sdkStream,
    });
  }


  it('submits job', async () => {
    // arrange
    setupS3Mock();

    // act
    const { handler } = await import('../../src/stacks/EmailParser/EmailParser.Resource');
    await handler(testEvent);

    // assert
    expect(s3ClientMock).toHaveReceivedCommand(GetObjectCommand);

  });

  it('can handle redrive', async () => {
    // arrange
    setupS3Mock();
    const redriveEvent = {
      version: '1.0',
      timestamp: '2024-06-11T03:08:30.710Z',
      requestContext: {
        requestId: '897c6980-6a5f-4650-85b1-4a6f229f502c',
        functionArn: 'arn:aws:lambda:us-east-1:536309290949:function:MackenzieNotesOcr-EmailParserFA9B67AD-lTjrLH2aGJrI:$LATEST',
        condition: 'RetriesExhausted',
        approximateInvokeCount: 3,
      },
      requestPayload: {
        'version': '0',
        'id': '03b67f4a-90dd-5076-40d5-7d7c14ede9af',
        'detail-type': 'Object Created',
        'source': 'aws.s3',
        'account': '536309290949',
        'time': '2024-06-11T03:05:22Z',
        'region': 'us-east-1',
        'resources': ['arn:aws:s3:::mackenzienotesocr-bucket83908e77-yo9ugsw3lcjo'],
        'detail': {
          'version': '0',
          'bucket': { name: 'mackenzienotesocr-bucket83908e77-yo9ugsw3lcjo' },
          'object': {
            'key': 'raw/4objtbiuo82k7s5eaid36u1e37s59nikkp7dpog1',
            'size': 4338,
            'etag': '1666755b5dd84e2eca70a5c893e31b55',
            'version-id': '8gUoE08gmojqw5b0OTVe04.dFIbGqKQt',
            'sequencer': '006667BEF28843278A',
          },
          'request-id': '8FVGMC2NSQ69S5YP',
          'requester': 'ses.amazonaws.com',
          'source-ip-address': '10.0.81.251',
          'reason': 'PutObject',
        },
      },
      responseContext: { statusCode: 200, executedVersion: '$LATEST', functionError: 'Unhandled' },
      responsePayload: {
        errorType: 'Error',
        errorMessage: 'Testing lambda destinations',
        trace: ['Error: Testing lambda destinations', '    at Runtime.handler (/var/task/index.js:69876:9)', '    at Runtime.handleOnceNonStreaming (file:///var/runtime/index.mjs:1173:29)'],
      },
    };

    // act
    const { handler } = await import('../../src/stacks/EmailParser/EmailParser.Resource');
    const sqsWrapper: SQSEvent = {
      Records: [{
        body: JSON.stringify(redriveEvent),
        messageId: '',
        receiptHandle: '',
        attributes: {
          ApproximateReceiveCount: '',
          SentTimestamp: '',
          SenderId: '',
          ApproximateFirstReceiveTimestamp: '',
        },
        messageAttributes: {},
        md5OfBody: '',
        eventSource: '',
        eventSourceARN: '',
        awsRegion: '',
      }],
    };
    await handler(sqsWrapper);

    // assert
    expect(s3ClientMock).toHaveReceivedCommand(GetObjectCommand);

  });
});
