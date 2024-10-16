# OpenSearch Index resource management

Managing OpenSearch index resources manually can be a daunting task, fraught with potential errors and inefficiencies. Automating these processes can streamline operations, improve consistency, and enhance collaboration across teams.

This AWS sample demonstrates an automated way for managing OpenSearch Index.

**Important**: 
1. This templates deploys various AWS services and there are costs associated with these services. Please refer the [AWS Pricing page](https://aws.amazon.com/pricing/) for details regarding pricing. You are responsible for any AWS costs incurred. No warranty is implied in this example.
2. The scripts used in transformation are only for the purpose of demo. You are responsible to create scripts for you own transformation requirements.



## Pre-requisites

* You should already have an AWS Acccount.The IAM user that you will use for running this sample must have sufficient permissions to make necessary AWS service calls and manage AWS resources. If you dont not an AWS account please [Create an AWS account](https://portal.aws.amazon.com/gp/aws/developer/registration/index.html) 
* You should have Jenkins installed on your build server. [Jenkins Installion](https://www.jenkins.io/doc/book/installing/)

* **AWS CDK**: Install the latest version of AWS CDK. You can follow the official documentation for installation: [Getting started with the AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html)





## Instructions

1. **Set up a CDK project:** First, Create a new CDK project or use an existing one. We will use CDK with TypeScript and follow below steps.

    ```
    mkdir opensearch-cdk-project
    cd opensearch-cdk-project
    cdk init app --language typescript
    ```

2. **Install the required packages:** In your CDK project. Open a terminal, navigate to your CDK project folder, and run the following command
    ```
    npm install @aws-cdk/aws-opensearchservice
    ```
3. If you're using CDK v2, update your *bin/opensearch-cdk-project.ts* file to look like this:
    ```
    #!/usr/bin/env node
    import 'source-map-support/register';
    import * as cdk from 'aws-cdk-lib';
    import { OpensearchCdkProjectStack } from '../lib/opensearch-cdk-project-stack';

    const app = new cdk.App();
    new OpensearchCdkProjectStack(app, 'OpensearchCdkProjectStack');
    ```

4. Open the main stack file (usually *lib/opensearch-cdk-project-stack.ts*) and import the required modules:
    ```
    import * as cdk from 'aws-cdk-lib';
    import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
    import * as ec2 from 'aws-cdk-lib/aws-ec2';
    import { Construct } from 'constructs';
    ```


5. **Define the OpenSearch cluster:** Inside the stack class, add the code to create the OpenSearch cluster. Here's an example:
    ``` 
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
    ```
    This code creates an OpenSearch domain with the following configuration:
    - Uses OpenSearch version 2.11
    - Deploys in a VPC with 2 Availability Zones
    - Uses 2 data nodes of type r6g.large.search
    - Configures 10GB GP2 EBS volumes for each node
    - Enables node-to-node encryption and encryption at rest
    - Enforces HTTPS
    - Sets up fine-grained access control with an admin user.



6. **Deploy the stack:** Once you've defined the OpenSearch cluster in your CDK code, you can deploy the stack using the AWS CDK CLI. Run the following commands:
    ```
    cdk synth
    cdk deploy
    ```
    The cdk synth command synthesizes the CloudFormation template from your CDK code, and the cdk deploy command deploys the stack to your AWS account.

    After the deployment is complete, the CDK will output the endpoint for your OpenSearch cluster. You can use this endpoint to interact with the cluster using the OpenSearch APIs or tools like Kibana.

**Note :** Creating an OpenSearch cluster on AWS may incur costs based on your usage and configuration. Be sure to review the AWS pricing for OpenSearch before deploying your cluster.


## Managing OpenSearch Index Resources using Evolution

Evolution executes versioned migration scripts reliably and persists the execution state in an internal Opensearch index. Successful executed migration scripts will not be executed again!

1. First add the latest version of Evolution as a dependency in your maven pom.xml:
    ```
        <dependency>
            <groupId>com.senacor.elasticsearch.evolution</groupId>
            <artifactId>elasticsearch-evolution-core</artifactId>
            <version>0.6.0</version>
        </dependency>
    ```

2. Include AWS SDKs
    ```
        <dependency>
            <groupId>software.amazon.awssdk</groupId>
            <artifactId>auth</artifactId>
            <version>2.17.243</version>
        </dependency>
        <dependency>
            <groupId>software.amazon.awssdk</groupId>
            <artifactId>core</artifactId>
            <version>2.17.243</version>
        </dependency>
    ```

3. Create Evolution bean and AWS Intercepter which implements HttpRequestInterceptor. You need to create your own OpenSearch Client to manage automatic creation of index, mappings, templates, and aliases. The default ElasticSearch Client that comes bundled in as part of the maven dependency cannot be leveraged to make PUT calls to OpenSearch cluster and hence , you need to bypass the default Rest Client instance.

    Below is a sample REST Client implementation
    ```
    private RestClient getElasticsearchEvolutionRestClient() {
            return RestClient.builder(getHttpHost())
                    .setRequestConfigCallback(rccb -> rccb.setConnectionRequestTimeout(awsOpenSearchMigratorConfig.getConnectionRequestTimeoutMs())
                            .setConnectTimeout(awsOpenSearchMigratorConfig.getConnectionTimeoutMs())
                            .setSocketTimeout(awsOpenSearchMigratorConfig.getSocketTimeoutMs()))
                    .setFailureListener(new LoggingFailureListener())
                    .setHttpClientConfigCallback(hacb -> hacb.addInterceptorLast(getAwsRequestSigningInterceptor())
                            .setMaxConnTotal(awsOpenSearchMigratorConfig.getTotalMaxConnections())
                            .setMaxConnPerRoute(awsOpenSearchMigratorConfig.getMaxConnectionsPerRoute()))
                    .build();
    }
    ```
4. A Elasticsearch-Evolutions migration script represents just a rest call. Here is an Example:
    ```
    PUT template/my_template
    Content-Type: application/json

    {
    "index_patterns": [
        "my_index*"
    ],
    "order": 1,
    "version": 1,
    "settings": {
        "number_of_shards": 1
    },
    "mappings": {
        "properties": {
        "version": {
        "type": "keyword",
        "ignore_above": 20,
        "similarity": "boolean"
        },
        "locked": {
        "type": "boolean"
        }
        }
    }
    }
    ```
    The first line defines the HTTP method PUT and the relative path to the Elasticsearch/Opensearch endpoint _template/my_template to create a new mapping template, followed by a HTTP Header Content-Type: application/json. After a blank line the HTTP body is defined.

    The pattern is strongly oriented in ordinary HTTP requests and consist of 4 parts:

    - *The HTTP method (required):* Supported HTTP methods are GET, HEAD, POST, PUT, DELETE, OPTIONS and PATCH. The First non-comment line must always start with a HTTP method.
    - *The path to the Opensearch endpoint to call (required):* The path is separated by a blank from the HTTP method. You can provide any query parameters like in a ordinary browser like this /my_index_1/_doc/1?refresh=true&op_type=create
    - *HTTP Header(s) (optional):* All non-comment lines after the HTTP method line will be interpreted as HTTP headers. Header name and content are separated by :.
    - *HTTP Body (optional):* The HTTP Body is separated by a blank line and can contain any content you want to sent to Opensearch.

    Evolution supports line-comments in its migration scripts. Every line starting with # or // will be interpreted as a comment-line. Comment-lines are not send to Elasticsearch/Opensearch, they will be filtered by Elasticsearch-Evolution.

5. Migration script file name ex: *V1.0__my-description.http*
The filename has to follow a pattern:

    - Starts with esMigrationPrefix which is by default V and is configurable.
    - followed by a version, which have to be numeric and can be structured by separating the version parts with .
    - followed by the versionDescriptionSeparator: __
    - followed by a description which can be any text your filesystem supports
    - end with esMigrationSuffixes which is by default .http and is configurable and case-insensitive.

    Elasticsearch-Evolution uses the version for ordering your scripts and enforces strict ordered execution of your scripts, by default. Out-of-Order execution is supported, but disabled by default. Elasticsearch-Evolution interprets the version parts as Integers, so each version part must be between 1 (inclusive) and 2,147,483,647 (inclusive).

    Here is an example which indicates the ordering: 1.0.1 < 1.1 < 1.2.1 < (2.0.0 == 2). In this example version 1.0.1 is the smallest version and is executed first, after that version 1.1, 1.2.1 and in the end 2. 2 is the same as 2.0 or 2.0.0 - so trailing zeros will be trimmed.


## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
