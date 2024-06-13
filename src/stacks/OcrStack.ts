import { Duration, RemovalPolicy, Stack, StackProps, Tags } from 'aws-cdk-lib';
import { BlockPublicAccess, Bucket, StorageClass } from 'aws-cdk-lib/aws-s3';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';
import { EmailParser } from './EmailParser/EmailParser';
import { ImageScanner } from './ImageScanner/ImageScanner';
import { IncomingEmail } from './IncomingEmail';

interface OcrStackProps extends StackProps {
  incomingEmailAddress: string;
}

export class OcrStack extends Stack {
  constructor(scope: Construct, id: string, props: OcrStackProps) {
    super(scope, id, props);


    const bucket = new Bucket(this, 'Bucket', {
      eventBridgeEnabled: true,
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: true,
      enforceSSL: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          enabled: true,
          transitions: [
            {
              storageClass: StorageClass.INFREQUENT_ACCESS,
              transitionAfter: Duration.days(30),
            },
          ],
        },
      ],
    });

    const notificationTopic = new Topic(this, 'NotificationTopic');
    notificationTopic.addSubscription(new EmailSubscription('matthew.bonig@gmail.com'));

    new IncomingEmail(this, 'IncomingEmail', { bucket, incomingEmailAddress: props.incomingEmailAddress });
    new EmailParser(this, 'EmailParser', { bucket, notificationTopic });
    new ImageScanner(this, 'ImageScanner', { bucket, notificationTopic });

    Tags.of(this).add('application', 'ocr');
  }
}
