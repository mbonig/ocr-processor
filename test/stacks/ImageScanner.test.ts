import { Readable } from 'node:stream';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { SendRawEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { AnalyzeDocumentCommand, TextractClient } from '@aws-sdk/client-textract';
import { sdkStreamMixin } from '@smithy/util-stream';
import { EventBridgeEvent } from 'aws-lambda/trigger/eventbridge';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';

const testEvent: EventBridgeEvent<'Object Created', any> = {
  'version': '0',
  'id': '017e1324-1ea9-53d7-5bcf-d396cceec3f8',
  'detail-type': 'Object Created',
  'source': 'aws.s3',
  'account': '536309290949',
  'time': '2024-01-30T03:27:35Z',
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
      key: 'images/matthew.bonig@gmail.com/Xnapper-2024-01-23-12.25.19.png',
      size: 478956,
      etag: '0b1dee357010c10ac22ab879db9c948a',
      sequencer: '0065B86CA78D879B25',
    },
    'request-id': '11RWR2YD435YX8PW',
    'requester': '536309290949',
    'source-ip-address': '54.146.18.92',
    'reason': 'PutObject',
  },
};

describe('ImageScanner', () => {
  const s3ClientMock = mockClient(S3Client);
  const textractMock = mockClient(TextractClient);
  const sesMock = mockClient(SESClient);

  beforeEach(() => {
    s3ClientMock.reset();
    textractMock.reset();
    sesMock.reset();
  });

  function setupTextractMock() {
    textractMock.on(AnalyzeDocumentCommand).resolves({
      Blocks: [],
    });
  }

  function setupS3Mock() {
    const stream = new Readable();
    stream.push('hello world');
    stream.push(null); // end of stream
    const sdkStream = sdkStreamMixin(stream);
    s3ClientMock.on(GetObjectCommand).resolves({
      Body: sdkStream,
    });
  }

  function setupSESMock() {
    sesMock.on(SendRawEmailCommand).resolves({});
  }

  it('submits job', async () => {

    // arrange
    setupTextractMock();
    setupS3Mock();
    setupSESMock();

    // act
    const { handler } = await import('../../src/stacks/ImageScanner/ImageScanner.Resource');
    await handler(testEvent);

    // assert
    expect(textractMock).toHaveReceivedCommand(AnalyzeDocumentCommand);
    expect(s3ClientMock).toHaveReceivedCommand(GetObjectCommand);
    expect(sesMock).toHaveReceivedCommand(SendRawEmailCommand);
  });
});
