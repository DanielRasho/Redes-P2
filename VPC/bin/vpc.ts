import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { VpcStack } from "../lib/vpc-stack";
import { Ec2Stack, ec2Configurations } from "../lib/ec2-stack";

const app = new cdk.App();

const env = {
	account: process.env.CDK_DEFAULT_ACCOUNT,
	region: process.env.CDK_DEFAULT_REGION,
};

const vpcStack = new VpcStack(app, "RayoUwUStack", {
	env,
});

// NOTE: LogStash configuration based upon:
// https://github.com/aws-samples/amazon-cloudwatch-snmp-monitoring-with-logstash/blob/main/template.yml
ec2Configurations.push({
	name: "r-logstash-server",
	instanceType: "t2.micro",
	subnetName: "r-datacenter",
	securityGroupName: "r-allow-everything",
	keyPairName: "Llaves globales",
	cloudFormationInit: {
		init: ec2.CloudFormationInit.fromConfigSets({
			configSets: {
				InstallAndRun: ["Prepare", "Install"],
			},
			configs: {
				Prepare: new ec2.InitConfig([
					ec2.InitCommand.argvCommand([
						"rpm",
						"--import",
						"https://artifacts.elastic.co/GPG-KEY-elasticsearch",
					]),
					// https://github.com/DanielRasho/Redes-P2
					ec2.InitSource.fromGitHub("/tmp/repo", "DanielRasho", "Redes-P2"),
					ec2.InitFile.fromString(
						"/etc/yum.repos.d/logstash.repo",
						`[logstash-7.x]
name=Elastic repository for 7.x packages
baseurl=https://artifacts.elastic.co/packages/7.x/yum
gpgcheck=1
gpgkey=https://artifacts.elastic.co/GPG-KEY-elasticsearch
enabled=1
autorefresh=1
type=rpm-md`,
						{
							mode: "000600",
							owner: "ec2-user",
							group: "ec2-user",
						},
					),
				]),
				Install: new ec2.InitConfig([
					ec2.InitPackage.yum("jq"),
					ec2.InitPackage.yum("git"),
					ec2.InitPackage.yum("logstash"),
					ec2.InitFile.fromString(
						"/etc/cfn/cfn-hup.conf",
						`
[main]
stack=${vpcStack.stackId}
region=${vpcStack.region}
interval=1`,
						{
							mode: "000400",
							owner: "root",
							group: "root",
						},
					),
					// TODO: Add other config...
				]),
			},
		}),
	},
});

const ec2Stack = new Ec2Stack(app, "RayoUwUEC2", {
	env,
	vpcId: vpcStack.vpcId,
	ec2Configs: ec2Configurations,
});

ec2Stack.addDependency(vpcStack);

app.synth();
