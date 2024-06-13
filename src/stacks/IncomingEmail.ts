import { IBucket } from 'aws-cdk-lib/aws-s3';
import { ReceiptRuleSet } from 'aws-cdk-lib/aws-ses';
import { S3 } from 'aws-cdk-lib/aws-ses-actions';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { EMAIL_DROP_PREFIX } from './EmailParser/EmailParser.Resource';

interface IncomingEmailProps {
  bucket: IBucket;
  incomingEmailAddress: string;
}

export class IncomingEmail extends Construct {
  topic: Topic;
  constructor(scope: Construct, id: string, props: IncomingEmailProps) {
    super(scope, id);
    const { bucket } = props;
    const topic = this.topic = new Topic(this, 'Topic', {});

    new ReceiptRuleSet(this, 'Resource', {
      receiptRuleSetName: 'OcrNotesProcessor',
      rules: [
        {
          recipients: [props.incomingEmailAddress],
          enabled: true,
          actions: [
            new S3({
              bucket,
              objectKeyPrefix: `${EMAIL_DROP_PREFIX}`,
              topic: topic,
            }),
          ],
        },
      ],
    });
  }
}
