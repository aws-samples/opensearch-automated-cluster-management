import * as cdk from 'aws-cdk-lib';
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
//import * as cdk from 'aws-cdk-lib';
//import { OpensearchCdkProjectStack } from '../lib/opensearch-cdk-project-stack';

// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class OpensearchCdkProjectStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC
    const vpc = new ec2.Vpc(this, 'OpenSearchVPC', {
      maxAzs: 4
    });

    // Create the OpenSearch domain
    const domain = new opensearch.Domain(this, 'OpenSearchDomain', {
      version: opensearch.EngineVersion.OPENSEARCH_2_11,
      enableVersionUpgrade: true,
      
      vpc,
      vpcSubnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
      
      zoneAwareness: {
        availabilityZoneCount: 2
      },
      
      capacity: {
        dataNodes: 2,
        dataNodeInstanceType: 'r6g.large.search',
        multiAzWithStandbyEnabled: false
        
      },
      ebs: {
        volumeSize: 10,
        volumeType: ec2.EbsDeviceVolumeType.GP2
      },
      nodeToNodeEncryption: true,
      encryptionAtRest: {
        enabled: true
      },
      enforceHttps: true,
      fineGrainedAccessControl: {
        masterUserName: 'admin'
      }
    });

    // Output the domain endpoint
    new cdk.CfnOutput(this, 'DomainEndpoint', {
      value: domain.domainEndpoint,
      description: 'OpenSearch Domain Endpoint'
    });
  }
}

