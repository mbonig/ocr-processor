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
import { Construct } from 'constructs';
import { EMAIL_DROP_PREFIX, IMAGE_DROP_PREFIX } from './EmailParser.Resource';


export class EmailParser extends Construct {
  constructor(scope: Construct, id: string, props: {
    notificationTopic: ITopic;
    bucket: IBucket;
  }) {
    super(scope, id);

    const timeoutDuration = Duration.minutes(1);
    const deadLetterQueue = new Queue(this, 'DeadLetterQueue', {
      visibilityTimeout: timeoutDuration,
    });
    const emailParser = new NodejsFunction(this, 'Resource', {
      memorySize: 256,
      timeout: timeoutDuration,
      environment: {
        BUCKET: props.bucket.bucketName,
      },
      onFailure: new SqsDestination(deadLetterQueue),
    });

    deadLetterQueue.grantConsumeMessages(emailParser);

    emailParser.metricErrors({})
      .createAlarm(this, 'EmailParserErrorAlarm', {
        alarmName: 'EmailParserErrorAlarm',
        alarmDescription: 'Email Parser Error Alarm',
        actionsEnabled: true,
        threshold: 1,
        comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        evaluationPeriods: 1,
        treatMissingData: TreatMissingData.NOT_BREACHING,
      })
      .addAlarmAction(new SnsAction(props.notificationTopic));

    props.bucket.grantRead(emailParser, `${EMAIL_DROP_PREFIX}/*`);
    props.bucket.grantWrite(emailParser, `${IMAGE_DROP_PREFIX}/*`);
    new Rule(this, 'ParseRawEmailRule', {
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: {
            name: [props.bucket.bucketName],
          },
          object: {
            key: [{
              prefix: EMAIL_DROP_PREFIX,
            }],
          },
        },
      },
      targets: [new LambdaFunction(emailParser)],
    });
  }

}
