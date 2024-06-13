import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Code, CodeConfig } from 'aws-cdk-lib/aws-lambda';
import { OcrStack } from '../src/stacks/OcrStack';


let fromAssetMock: jest.SpyInstance;

beforeAll(() => {
  fromAssetMock = jest.spyOn(Code, 'fromAsset').mockReturnValue({
    isInline: false,
    bind: (): CodeConfig => {
      return {
        s3Location: {
          bucketName: 'my-bucket',
          objectKey: 'my-key',
        },
      };
    },
    bindToResource: () => {
      return;
    },
  } as any);
});

afterAll(() => {
  fromAssetMock?.mockRestore();
});

test('Snapshot', () => {
  const app = new App();
  const stack = new OcrStack(app, 'test');

  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
});
