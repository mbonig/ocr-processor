import { awscdk } from 'projen';

const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.123.0',
  defaultReleaseBranch: 'main',
  name: 'ocr-processor',
  projenrcTs: true,
  deps: [
    '@aws-sdk/client-s3',
    '@aws-sdk/client-ses',
    '@aws-sdk/client-textract',
    '@aws-sdk/credential-provider-node',
    '@types/aws-lambda',
    '@types/mailparser',
    '@types/nodemailer',
    'cdk-iam-floyd',
    'mailparser',
    'nodemailer',
  ],
  devDeps: [
    '@smithy/util-stream',
    'aws-sdk-client-mock',
    'aws-sdk-client-mock-jest',
  ],
});

project.addTask('test:upload', {
  exec: 'aws s3 rm s3://fourlittledogs-ocr/mackenzie/raw/test && aws s3 cp test/test-email s3://fourlittledogs-ocr/mackenzie/raw/test',
});

project.synth();
