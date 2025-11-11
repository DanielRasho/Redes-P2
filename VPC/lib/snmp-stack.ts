import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { deployMachines, Ec2InstanceConfig } from "./ec2-stack";

export interface SNMPStackProps extends cdk.StackProps {
	vpcId: string;
}

export class SNMPStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props: SNMPStackProps) {
		super(scope, id, props);

		const vpc = ec2.Vpc.fromVpcAttributes(this, "ImportedVpc", {
			vpcId: props.vpcId,
			availabilityZones: cdk.Stack.of(this).availabilityZones,
		});

		const secret = new secrets.Secret(this, "r-snmp-secret", {
			secretName: "SNMPSecret",
			generateSecretString: {
				secretStringTemplate: JSON.stringify({ username: "readonlyuser" }),
				generateStringKey: "password",
			},
		});

		// NOTE: LogStash configuration based upon:
		// https://github.com/aws-samples/amazon-cloudwatch-snmp-monitoring-with-logstash/blob/main/template.yml
		const snmpInstance1: Ec2InstanceConfig = appendSNMPClientConfig(
			this.stackName,
			this.region,
			this.stackId,
			{
				name: "r-snmp-instance-1",
				instanceType: "t2.micro",
				subnetName: "r-datacenter",
				securityGroupName: "r-allow-everything",
				keyPairName: "Llaves globales",
			},
		);

		const snmpInstance2: Ec2InstanceConfig = appendSNMPClientConfig(
			this.stackName,
			this.region,
			this.stackId,
			{
				name: "r-snmp-instance-2",
				instanceType: "t2.micro",
				subnetName: "r-datacenter",
				securityGroupName: "r-allow-everything",
				keyPairName: "Llaves globales",
			},
		);

		const snmpMachines = deployMachines(this, vpc, [
			snmpInstance1,
			snmpInstance2,
		]);

		const logstashServer: Ec2InstanceConfig = appendSNMPServerConfig(
			this.stackName,
			this.region,
			this.stackId,
			snmpMachines,
			{
				name: "r-logstash-server",
				instanceType: "t2.micro",
				subnetName: "r-datacenter",
				securityGroupName: "r-allow-everything",
				keyPairName: "Llaves globales",
			},
		);

		deployMachines(this, vpc, [logstashServer]);
	}
}

export function appendSNMPServerConfig(
	stackName: string,
	region: string,
	stackId: string,
	machines: cdk.aws_ec2.Instance[],
	original: Ec2InstanceConfig,
): Ec2InstanceConfig {
	if (!original.userData) {
		original.userData = ec2.UserData.forLinux({ shebang: "#!/bin/bash -xe" });
	}
	original.userData.addCommands(
		"yum update -y aws-cfn-bootstrap",
		`/opt/aws/bin/cfn-init -v --stack ${stackName} --resource ${original.name} --configsets InstallAndRun --region ${region}`,
		`/opt/aws/bin/cfn-signal -e $? --stack ${stackName} --resource ${original.name} --region ${region}`,
	);

	if (original.cloudFormationInit) {
		throw new Error(
			`Cloud formation init is not empty when creating configuration for: ${original.name}`,
		);
	}

	original.cloudFormationInit = {
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
						`[main]
stack=${stackId}
region=${region}
interval=1`,
						{
							mode: "000400",
							owner: "root",
							group: "root",
						},
					),
					ec2.InitFile.fromString(
						"/etc/cfn/hooks.d/cfn-auto-reloader.conf",
						`[cfn-auto-reloader-hook]
triggers=post.update
path=Resources.${original.name}.Metadata.AWS::CloudFormation::Init
action=../../opt/aws/bin/cfn-init --stack ${stackName} --resource ${original.name} --region ${region}
runas=root`,
					),
					ec2.InitCommand.shellCommand("cp *.conf /etc/logstash/conf.d/", {
						cwd: "/tmp/repo/conf/",
					}),
					ec2.InitCommand.shellCommand(
						"cp pipelines.yml jvm.options logstash.yml /etc/logstash/",
						{
							cwd: "/tmp/repo/settings/",
						},
					),
					ec2.InitCommand.shellCommand(
						"echo y | bin/logstash-keystore --path.settings /etc/logstash create",
						{
							cwd: "/usr/share/logstash/",
						},
					),
					ec2.InitCommand.shellCommand(
						`sed -i -e ''s/111.111.111.111/${machines[0].instancePrivateIp}/g'' -e ''s/222.222.222.222/${machines[1].instancePrivateIp}/g'' snmp.conf'`,
						{
							cwd: "/etc/logstash/conf.d/",
						},
					),
					ec2.InitCommand.shellCommand(
						`sed -i ''s/REGION/${region}/g'' cloudwatch.conf`,
						{
							cwd: "/etc/logstash/conf.d/",
						},
					),
					ec2.InitCommand.shellCommand(
						`aws secretsmanager get-secret-value --region ${region} --secret-id SNMPSecret --query SecretString --output text | jq .username | tr -d ''"''   |  bin/logstash-keystore --path.settings /etc/logstash add SNMP_USER`,
						{
							cwd: "/usr/share/logstash/",
						},
					),
					ec2.InitCommand.shellCommand(
						`aws secretsmanager get-secret-value  --region ${region} --secret-id SNMPSecret --query SecretString --output text | jq .password | tr -d ''"''   |  bin/logstash-keystore --path.settings /etc/logstash add SNMP_PWD`,
						{
							cwd: "/usr/share/logstash/",
						},
					),
					ec2.InitService.enable("logstash", {
						enabled: true,
						ensureRunning: true,
					}),
					ec2.InitService.enable("cfn-hup", {
						enabled: true,
						ensureRunning: true,
					}),
				]),
			},
		}),
	};

	return original;
}

export function appendSNMPClientConfig(
	stackName: string,
	region: string,
	stackId: string,
	original: Ec2InstanceConfig,
): Ec2InstanceConfig {
	if (!original.userData) {
		original.userData = ec2.UserData.forLinux({ shebang: "#!/bin/bash -xe" });
	}

	original.userData.addCommands(
		"yum update -y aws-cfn-bootstrap",
		`/opt/aws/bin/cfn-init -v --stack ${stackName} --resource ${original.name} --configsets InstallAndRun --region ${region}`,
		`/opt/aws/bin/cfn-signal -e $? --stack ${stackName} --resource ${original.name} --region ${region}`,
	);

	if (original.cloudFormationInit) {
		throw new Error(
			`Cloud formation init is not empty when creating configuration for: ${original.name}`,
		);
	}

	original.cloudFormationInit = {
		init: ec2.CloudFormationInit.fromConfigSets({
			configSets: {
				InstallAndRun: ["Install"],
			},
			configs: {
				Install: new ec2.InitConfig([
					ec2.InitPackage.yum("net-snmp"),
					ec2.InitPackage.yum("net-snmp-utils"),
					ec2.InitPackage.yum("net-snmp-devel"),
					ec2.InitPackage.yum("jq"),
					ec2.InitFile.fromString(
						"/etc/cfn/cfn-hup.conf",
						`[main]
stack=${stackId}
region=${region}
interval=1`,
						{
							mode: "256",
							owner: "root",
							group: "root",
						},
					),
					ec2.InitFile.fromString(
						"/etc/cfn/hooks.d/cfn-auto-reloader.conf",
						`[cfn-auto-reloader-hook]
triggers=post.update
path=Resources.${original.name}.Metadata.AWS::CloudFormation::Init
action=../../opt/aws/bin/cfn-init --stack ${stackName} --resource ${original.name} --region ${region}
runas=root`,
					),
					ec2.InitCommand.shellCommand(
						`'SECRET=$(aws secretsmanager get-secret-value  --region ${region} --secret-id SNMPSecret --query SecretString --output text); SNMPUSER=$(echo $SECRET | jq .username | tr -d ''"'' ); SNMPPWD=$(echo $SECRET | jq .password | tr -d ''"''   ) ;net-snmp-config --create-snmpv3-user -ro -a MD5 -A $SNMPPWD $SNMPUSER >/dev/null'`,
					),
					ec2.InitService.enable("snmpd", {
						enabled: true,
						ensureRunning: true,
					}),
					ec2.InitService.enable("cfn-hup", {
						enabled: true,
						ensureRunning: true,
					}),
				]),
			},
		}),
	};

	return original;
}
