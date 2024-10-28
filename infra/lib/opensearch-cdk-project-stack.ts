import * as cdk from "aws-cdk-lib";
import * as opensearch from "aws-cdk-lib/aws-opensearchservice";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { NagSuppressions } from "cdk-nag";

export class OpensearchCdkProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC
    const vpc = new ec2.Vpc(this, "OpenSearchVPC", {
      maxAzs: 3,
    });
    NagSuppressions.addResourceSuppressions(vpc, [
      {
        id: "AwsSolutions-VPC7",
        reason: "VPC Flow Logs are not critical for a small proof of concept.",
      },
    ]);

    // Policy to get permissions to create and list network interface in the vpc
    const vpcNetworkAccessPolicy = new cdk.aws_iam.PolicyStatement({
      effect: cdk.aws_iam.Effect.ALLOW,
      actions: [
        "ec2:DescribeNetworkInterfaces",
        "ec2:CreateNetworkInterface",
        "ec2:DeleteNetworkInterface",
        "ec2:DescribeInstances",
        "ec2:AttachNetworkInterface",
      ],
      resources: ["*"],
    });

    // Basic permissions policy for a Lambda function
    const lambdaBasicPolicy = new cdk.aws_iam.PolicyStatement({
      effect: cdk.aws_iam.Effect.ALLOW,
      actions: [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
      ],
      resources: ["*"],
    });

    // IAM role for the Lambda function to interact with the OpenSearch cluster
    const lambdaRole = new cdk.aws_iam.Role(this, "LambdaOpenSearchRole", {
      assumedBy: new cdk.aws_iam.ServicePrincipal("lambda.amazonaws.com"),
    });
    lambdaRole.addToPolicy(vpcNetworkAccessPolicy);
    lambdaRole.addToPolicy(lambdaBasicPolicy);
    NagSuppressions.addResourceSuppressions(
      lambdaRole,
      [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "Acceptable practice to use wildcards for CloudWatch logs and metrics for Lambda",
          appliesTo: ["Resource::*"],
        },
      ],
      true
    );
    NagSuppressions.addResourceSuppressions(
      lambdaRole,
      [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "Acceptable practice to use wildcards for an OpenSource domain sub-resources",
          appliesTo: ["Resource::<OpenSearchDomain85D65221.Arn>/*"],
        },
      ],
      true
    );

    // Create a security group for the Lambda function
    const lambdaSecurityGroup = new ec2.SecurityGroup(
      this,
      "LambdaSecurityGroup",
      { vpc, allowAllOutbound: false }
    );

    // Create a security group for the Open Search domain
    const domainSecurityGroup = new ec2.SecurityGroup(
      this,
      "OpenSearchSecurityGroup",
      { vpc, allowAllOutbound: false }
    );

    // Create the OpenSearch domain
    const domain = new opensearch.Domain(this, "OpenSearchDomain", {
      version: opensearch.EngineVersion.OPENSEARCH_2_15,
      enableVersionUpgrade: true,
      vpc,
      vpcSubnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
      securityGroups: [domainSecurityGroup],
      zoneAwareness: {
        availabilityZoneCount: 2,
      },
      capacity: {
        dataNodes: 2,
        dataNodeInstanceType: "r7g.large.search",
        multiAzWithStandbyEnabled: false,
      },
      ebs: {
        volumeSize: 10,
        volumeType: ec2.EbsDeviceVolumeType.GP3,
      },
      nodeToNodeEncryption: true,
      encryptionAtRest: {
        enabled: true,
      },
      enforceHttps: true,
      fineGrainedAccessControl: {
        masterUserArn: lambdaRole.roleArn,
      },
      accessPolicies: [
        new cdk.aws_iam.PolicyStatement({
          effect: cdk.aws_iam.Effect.ALLOW,
          principals: [lambdaRole],
          actions: ["es:*"],
          resources: ["*"],
        }),
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    NagSuppressions.addResourceSuppressions(domain, [
      {
        id: "AwsSolutions-OS3",
        reason:
          "OpenSearch domain can only be accessed from the Lambda security group. IP allow-listing is not required.",
      },
    ]);
    NagSuppressions.addResourceSuppressions(domain, [
      {
        id: "AwsSolutions-OS4",
        reason:
          "Dedicated master nodes are not critical for a small proof of concept",
      },
    ]);
    NagSuppressions.addResourceSuppressions(domain, [
      {
        id: "AwsSolutions-OS9",
        reason:
          "SEARCH_SLOW_LOGS and INDEX_SLOW_LOGS are not critical for a small proof of concept",
      },
    ]);
    domain.grantReadWrite(lambdaRole);

    // Create the Lambda Function
    const lambdaFunction = new lambda.Function(
      this,
      "OpenSearchMigrationFunction",
      {
        functionName: "openSearchMigration",
        runtime: cdk.aws_lambda.Runtime.JAVA_17,
        handler: "example.Handler::handleRequest",
        code: cdk.aws_lambda.Code.fromAsset(
          "../app/openSearchMigration/target/openSearchMigration-1.0-SNAPSHOT.jar"
        ),
        role: lambdaRole,
        timeout: cdk.Duration.seconds(60),
        memorySize: 256,
        vpc,
        securityGroups: [lambdaSecurityGroup],
        environment: {
          OPENSEARCH_DOMAIN_ENDPOINT: `https://${domain.domainEndpoint}`,
        },
      }
    );
    NagSuppressions.addResourceSuppressions(lambdaFunction, [
      {
        id: "AwsSolutions-L1",
        reason: "Java 17 runtime is an acceptable version in 2024.",
      },
    ]);

    // Give access to Lambda Security Group to access OpenSearch security group
    lambdaSecurityGroup.addEgressRule(
      ec2.Peer.securityGroupId(domainSecurityGroup.securityGroupId),
      ec2.Port.tcp(80),
      "Allow Lambda access to OpenSearch domain"
    );
    lambdaSecurityGroup.addEgressRule(
      ec2.Peer.securityGroupId(domainSecurityGroup.securityGroupId),
      ec2.Port.tcp(443),
      "Allow Lambda access to OpenSearch domain"
    );
    domainSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(443),
      "Allow Lambda access to OpenSearch domain"
    );
    domainSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(80),
      "Allow Lambda access to OpenSearch domain"
    );
  }
}
