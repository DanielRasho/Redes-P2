import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
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

		// NOTE: LogStash configuration based upon:
		// https://github.com/aws-samples/amazon-cloudwatch-snmp-monitoring-with-logstash/blob/main/template.yml
		const snmpInstance1: Ec2InstanceConfig = {
			name: "r-snmp-instance-",
			instanceType: "t2.micro",
			subnetName: "r-datacenter",
			securityGroupName: "r-allow-everything",
			keyPairName: "Llaves globales",
			userData: (() => {
				let ud = ec2.UserData.forLinux({
					shebang: "#!/bin/bash -xe",
				});
				ud.addCommands(
					"yum update -y aws-cfn-bootstrap",
					`/opt/aws/bin/cfn-init -v --stack ${vpc.stack.stackName} --resource SNMPInstance1 --configsets InstallAndRun --region ${vpc.stack.region}`,
					`/opt/aws/bin/cfn-signal -e $? --stack ${vpc.stack.stackName} --resource SNMPInstance1 --region ${vpc.stack.region}`,
				);
				return ud;
			})(),
			cloudFormationInit: {
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
stack=${vpc.stack.stackId}
region=${vpc.stack.region}
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
path=Resources.SNMPInstance1.Metadata.AWS::CloudFormation::Init
action=../../opt/aws/bin/cfn-init --stack ${vpc.stack.stackName} --resource SNMPInstance1 --region ${vpc.stack.region}
runas=root`,
							),
							ec2.InitCommand.shellCommand(
								`'SECRET=$(aws secretsmanager get-secret-value  --region ${vpc.stack.region} --secret-id SNMPSecret --query SecretString --output text); SNMPUSER=$(echo $SECRET | jq .username | tr -d ''"'' ); SNMPPWD=$(echo $SECRET | jq .password | tr -d ''"''   ) ;net-snmp-config --create-snmpv3-user -ro -a MD5 -A $SNMPPWD $SNMPUSER >/dev/null'`,
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
			},
		};

		const snmpInstance2: Ec2InstanceConfig = { ...snmpInstance1 };

		const snmpMachines = deployMachines(this, vpc, [
			snmpInstance1,
			snmpInstance2,
		]);

		const logstashServer: Ec2InstanceConfig = {
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
stack=${vpc.stack.stackName}
region=${vpc.stack.region}
interval=1`,
								{
									mode: "000400",
									owner: "root",
									group: "root",
								},
							),
							ec2.InitFile.fromString(
								"/etc/cfn/hooks.d/cfn-auto-reloader.conf",
								`
[cfn-auto-reloader-hook]
triggers=post.update
path=Resources.SNMPInstance1.Metadata.AWS::CloudFormation::Init
action=../../opt/aws/bin/cfn-init --stack ${vpc.stack.stackName} --resource SNMPInstance1 --region ${vpc.stack.region}
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
								"sed -i -e ''s/111.111.111.111/${SNMPInstance1.PrivateIp}/g'' -e ''s/222.222.222.222/${SNMPInstance2.PrivateIp}/g'' snmp.conf'",
							),
						]),
					},
				}),
			},
		};
	}
}
