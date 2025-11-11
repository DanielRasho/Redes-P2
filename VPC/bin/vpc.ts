import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { VpcStack } from "../lib/vpc-stack";
import { Ec2Stack, ec2Configurations } from "../lib/ec2-stack";
import { SNMPStack } from "../lib/snmp-stack";

const app = new cdk.App();

const env = {
	account: process.env.CDK_DEFAULT_ACCOUNT,
	region: process.env.CDK_DEFAULT_REGION,
};

const vpcStack = new VpcStack(app, "RayoUwUStack", {
	env,
});

const ec2Stack = new Ec2Stack(app, "RayoUwUEC2", {
	env,
	vpcId: vpcStack.vpcId,
	ec2Configs: ec2Configurations,
});

ec2Stack.addDependency(vpcStack);

const snmpStack = new SNMPStack(app, "RayoUwUSNMP", {
	env,
	vpcId: vpcStack.vpcId,
});
snmpStack.addDependency(vpcStack);

app.synth();
