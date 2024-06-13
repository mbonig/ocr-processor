import { App } from 'aws-cdk-lib';
import { OcrStack } from './stacks/OcrStack';

const incomingEmailAddress = process.env.INCOMING_EMAIL_ADDRESS;
if (!incomingEmailAddress) {
  throw new Error('INCOMING_EMAIL_ADDRESS environment variable is required');
}


const app = new App();

new OcrStack(app, 'MackenzieNotesOcr', {
  env: {
    account: '536309290949',
    region: 'us-east-1',
  },
  incomingEmailAddress,
});

app.synth();
