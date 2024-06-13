import { Duration } from 'aws-cdk-lib';
import { ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { SqsDestination } from 'aws-cdk-lib/aws-lambda-destinations';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { ITopic } from 'aws-cdk-lib/aws-sns';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Ses, Textract } from 'cdk-iam-floyd';
import { Construct } from 'constructs';
import { BUCKET } from './ImageScanner.Resource';
import { IMAGE_DROP_PREFIX } from '../EmailParser/EmailParser.Resource';

export class ImageScanner extends Construct {
  constructor(scope: Construct, id: string, props: {
    notificationTopic: ITopic;
    bucket: IBucket;
  }) {
    super(scope, id);

    const timeoutDuration = Duration.minutes(1);
    const deadLetterQueue = new Queue(this, 'DeadLetterQueue', {
      visibilityTimeout: timeoutDuration,
    });
    const imageScanner = new NodejsFunction(this, 'Resource', {
      timeout: timeoutDuration,
      memorySize: 256,
      environment: {
        [BUCKET]: props.bucket.bucketName,
      },
      onFailure: new SqsDestination(deadLetterQueue),
    });

    deadLetterQueue.grantConsumeMessages(imageScanner);
    imageScanner.metricErrors({})
      .createAlarm(this, 'EmailParserErrorAlarm', {
        alarmName: 'ImageScannerErrorAlarm',
        alarmDescription: 'Image Scanner Error Alarm',
        actionsEnabled: true,
        threshold: 1,
        comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        evaluationPeriods: 1,
        treatMissingData: TreatMissingData.NOT_BREACHING,
      })
      .addAlarmAction(new SnsAction(props.notificationTopic));

    props.bucket.grantRead(imageScanner, `${IMAGE_DROP_PREFIX}/*`);

    imageScanner.addToRolePolicy(new Textract().allow().toAnalyzeDocument().onAllResources());
    imageScanner.addToRolePolicy(new Ses().allow().toSendRawEmail());

    new Rule(this, 'ScanImageRule', {
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: {
            name: [props.bucket.bucketName],
          },
          object: {
            key: [{
              prefix: IMAGE_DROP_PREFIX,
            }],
          },
        },
      },
      targets: [new LambdaFunction(imageScanner)],
    });
  }

}
