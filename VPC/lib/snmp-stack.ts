import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { deployMachines, Ec2InstanceConfig } from "./ec2-stack";

const UbuntuAMIId = "ami-0bb1986d42f3ea965";

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

		const snmpInstance1: Ec2InstanceConfig = appendSNMPClientConfig({
			name: "r-snmp-instance-1",
			instanceType: "t2.micro",
			subnetName: "r-datacenter",
			securityGroupName: "r-allow-everything",
			keyPairName: "Llaves globales",
		});

		const snmpInstance2: Ec2InstanceConfig = appendSNMPClientConfig({
			name: "r-snmp-instance-2",
			instanceType: "t2.micro",
			subnetName: "r-datacenter",
			securityGroupName: "r-allow-everything",
			keyPairName: "Llaves globales",
		});

		const snmpServer: Ec2InstanceConfig = appendSNMPServerConfig({
			amiId: UbuntuAMIId,
			name: "r-snmp-server",
			instanceType: "t2.micro",
			subnetName: "r-ti",
			securityGroupName: "r-allow-everything",
			keyPairName: "Llaves globales",
		});

		deployMachines(this, vpc, [snmpServer, snmpInstance1, snmpInstance2]);
	}
}

export function appendSNMPServerConfig(
	original: Ec2InstanceConfig,
): Ec2InstanceConfig {
	if (!original.userData) {
		original.userData = ec2.UserData.forLinux({ shebang: "#!/bin/bash -xe" });
	}
	original.userData.addCommands("");

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
					// Install prometheus
					ec2.InitPackage.apt("wget"),
					ec2.InitCommand.shellCommand(
						"wget -O snmp_exporter.tar.gz https://github.com/prometheus/snmp_exporter/releases/download/v0.29.0/snmp_exporter-0.29.0.linux-amd64.tar.gz",
					),
					ec2.InitCommand.shellCommand(
						"tar -xvzf snmp_exporter.tar.gz -C snmp",
					),
					// Install grafana
					ec2.InitCommand.shellCommand("sudo mkdir -p /etc/apt/keyrings/"),
					ec2.InitCommand.shellCommand(
						"wget -q -O - https://apt.grafana.com/gpg.key | gpg --dearmor | sudo tee /etc/apt/keyrings/grafana.gpg > /dev/null",
					),
					ec2.InitCommand.shellCommand(
						'echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" | sudo tee -a /etc/apt/sources.list.d/grafana.list',
					),
					ec2.InitCommand.shellCommand("sudo apt-get update"),
				]),
				Install: new ec2.InitConfig([
					ec2.InitPackage.apt("apt-transport-https"),
					ec2.InitPackage.apt("software-properties-common"),
					ec2.InitPackage.apt("grafana"),
					ec2.InitService.enable("grafana - server", {
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
	original: Ec2InstanceConfig,
): Ec2InstanceConfig {
	const cidrRange = "10.66.0.0/24";
	if (!original.userData) {
		original.userData = ec2.UserData.forLinux({ shebang: "#!/bin/bash -xe" });
	}

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
					ec2.InitPackage.yum("jq"),
					ec2.InitFile.fromString(
						"/etc/snmp/snmpd.conf",
						`rocommunity ruwu ${cidrRange}
syslocation My-Mom
syscontact admin@example.com
`,
						{
							mode: "256",
							owner: "root",
							group: "root",
						},
					),
					ec2.InitService.enable("snmpd", {
						enabled: true,
						ensureRunning: true,
					}),
				]),
			},
		}),
	};

	return original;
}
