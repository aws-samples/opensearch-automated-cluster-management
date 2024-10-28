#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { OpensearchCdkProjectStack } from '../lib/opensearch-cdk-project-stack';
import { AwsSolutionsChecks } from 'cdk-nag';

const app = new cdk.App();
//cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }))
const openSearchStack = new OpensearchCdkProjectStack(app, 'OpensearchCdkProjectStack', {
})
;