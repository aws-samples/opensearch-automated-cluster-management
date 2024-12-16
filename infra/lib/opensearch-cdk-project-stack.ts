import * as cdk from "aws-cdk-lib";
import * as opensearch from "aws-cdk-lib/aws-opensearchservice";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as iam from "aws-cdk-lib/aws-iam";
import { Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import { NagSuppressions } from "cdk-nag";


export class OpensearchCdkProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // NETWORKING

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

    // Create a security group for the CodeBuild project
    const codeBuildSecurityGroup = new ec2.SecurityGroup(
      this,
      "CodeBuildSecurityGroup",
      { vpc, allowAllOutbound: true }
    );

    // Give access to Lambda Security Group and CodeBuild Security Group to access OpenSearch security group
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
    domainSecurityGroup.addIngressRule(
      codeBuildSecurityGroup,
      ec2.Port.tcp(443),
      "Allow CodeBuild access to OpenSearch domain"
    );
    domainSecurityGroup.addIngressRule(
      codeBuildSecurityGroup,
      ec2.Port.tcp(80),
      "Allow CodeBuild access to OpenSearch domain"
    );

    // SECURITY

    // Policy to get permissions to create and list network interface in the vpc
    const vpcNetworkAccessPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "ec2:DescribeNetworkInterfaces",
        "ec2:CreateNetworkInterface",
        "ec2:DeleteNetworkInterface",
        "ec2:DescribeInstances",
        "ec2:AttachNetworkInterface",
      ],
      resources: ["*"],
    });

    // IAM role for the Lambda function to interact with the OpenSearch cluster
    const codeBuildRole = new iam.Role(this, "CodeBuildRole", {
      assumedBy: new iam.ServicePrincipal("codebuild.amazonaws.com"),
    });

    // Basic permissions policy for a Lambda function
    const lambdaBasicPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
      ],
      resources: ["*"],
    });

    // IAM role for the Lambda function to interact with the OpenSearch cluster
    const lambdaRole = new iam.Role(this, "LambdaOpenSearchRole", {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal("lambda.amazonaws.com"),
        new iam.ArnPrincipal(codeBuildRole.roleArn)
      )
    });
    lambdaRole.grantAssumeRole(codeBuildRole);
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

    // RESOURCES

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
    domain.grantReadWrite(lambdaRole);

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

    // Create the Lambda Function for Evolution scripts
    const openSearchMigrationLambdaFunction = new lambda.Function(
      this,
      "OpenSearchMigrationFunction",
      {
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
    
    NagSuppressions.addResourceSuppressions(openSearchMigrationLambdaFunction, [
      {
        id: "AwsSolutions-L1",
        reason: "Java 17 runtime is an acceptable version in 2024.",
      },
    ]);

    // Create an S3 bucket to host Terraform files, and deploy onto it the content of the terraform folder
    const terraformFilesBucket = new s3.Bucket(this, "TerraformS3Bucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });
    terraformFilesBucket.grantRead(codeBuildRole);

    new s3deploy.BucketDeployment(this, 'DeployTerraformFiles', {
      sources: [s3deploy.Source.asset('../terraform')],
      destinationBucket: terraformFilesBucket,
    });

    // Create a CodeBuild project with the required packages to run Terraform commands
    const codeBuildProject = new cdk.aws_codebuild.Project(
      this,
      "TerraformCodeBuildProject",
      {
        projectName: "TerraformCodeBuildProject",
        environment: {
          buildImage: cdk.aws_codebuild.LinuxBuildImage.STANDARD_7_0,
          computeType: cdk.aws_codebuild.ComputeType.SMALL,
        },
        vpc: vpc,
        securityGroups: [codeBuildSecurityGroup],
        role: codeBuildRole,
        environmentVariables: {
          TF_VAR_OpenSearchDomainEndpoint: {
            type: cdk.aws_codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: domain.domainEndpoint,
          },
          TF_VAR_IAMRoleARN: {
            type: cdk.aws_codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: lambdaRole.roleArn,
          },
          TERRAFORM_S3_BUCKET: {
            type: cdk.aws_codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            value: terraformFilesBucket.bucketName,
          }
        },
        buildSpec: cdk.aws_codebuild.BuildSpec.fromObject({
          version: "0.2",
          phases: {
            install: {
              commands: [
                "curl -s -qL -o terraform.zip https://releases.hashicorp.com/terraform/1.10.0/terraform_1.10.0_linux_amd64.zip",
                "unzip -o terraform.zip",
                "mv terraform /bin",
                "rm terraform.zip"
              ],
            },
            build: {
              commands: [
                "cd ${CODEBUILD_SRC_DIR}/${CODE_SRC_DIR}",
                "aws s3 cp s3://${TERRAFORM_S3_BUCKET}/opensearch_index.tf .",
                "terraform init",
                "terraform apply -auto-approve",
              ],
            },
          },
        }), 
      }
    );

    // Create a Lambda layer from the created folder
    const openSearchPythonLambdaLayer = new lambda.LayerVersion(this, 'OpenSearchPythonLambdaLayer', {
      code: lambda.Code.fromAsset("../lambda_layer/layer_content.zip"),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
    });

    // Create a Lambda function that uses the layer
    const openSearchQueryLambda = new lambda.Function(this, 'OpenSearchQueryLambda', {
      code: lambda.Code.fromAsset("lambdas/opensearch_query"),
      runtime: lambda.Runtime.PYTHON_3_12,
      layers: [openSearchPythonLambdaLayer],
      handler: "opensearch_query.lambda_handler",
      role: lambdaRole,
      memorySize: 256,
      vpc,
      securityGroups: [lambdaSecurityGroup],
      environment: {
        OPENSEARCH_DOMAIN_ENDPOINT: domain.domainEndpoint,
      },
      timeout: Duration.seconds(60)
    });

  }
}

