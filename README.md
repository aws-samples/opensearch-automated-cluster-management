# Automated solution for Amazon OpenSearch cluster management operations

This repository contains both the CDK files and the sample Lambda function Java code required to run through the blog post example.

## Usage

### Pre-requisites

- Latest versions of Node, NPM, AWS CLI, Java and Maven installed.
- AWS account with the required role, permissions and credentials to deploy the stack.

### Simple deployment
```bash
git clone <github url>
cd <git repo>
cd app/openSearchMigration
mvn package
cd ../../infra
npm install
npx cdk bootstrap
aws iam create-service-linked-role --aws-service-name es.amazonaws.com
npx cdk deploy --require-approval never
```

Please refer to the post for more detailed instructions.

