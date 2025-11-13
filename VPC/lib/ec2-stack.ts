import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";

export interface Ec2InstanceConfig {
	name: string;
	instanceType: string;
	subnetName: string;
	securityGroupName: string;
	tags?: Record<string, string>;
	amiId?: string;
	keyPairName?: string; // Changed from keyName to keyPairName for clarity
	userData?: ec2.UserData;
	cloudFormationInit?: {
		init: ec2.CloudFormationInit;
		opt?: ec2.ApplyCloudFormationInitOptions;
	};
}

// Define your EC2 instances here
export const ec2Configurations: Ec2InstanceConfig[] = [
	{
		name: "r-vpn",
		instanceType: "t2.micro",
		subnetName: "r-dmz",
		securityGroupName: "r-allow-everything",
		amiId: "ami-05180d8e680bfb16d",
		keyPairName: "Llaves globales",
	},
	{
		name: "r-ldap",
		instanceType: "t2.micro",
		subnetName: "r-datacenter",
		securityGroupName: "r-allow-everything",
		amiId: "ami-0dc406729692adba6",
		keyPairName: "Llaves globales",
	},
	{
		name: "r-RRHH-web",
		instanceType: "t2.micro",
		subnetName: "r-datacenter",
		securityGroupName: "r-allow-everything",
		keyPairName: "Llaves globales",
	},
	{
		name: "r-ventas-1",
		instanceType: "t2.micro",
		subnetName: "r-ventas",
		securityGroupName: "r-allow-everything",
		amiId: "ami-09a531af1a86baf16",
		keyPairName: "Llaves globales",
	},
];

export interface Ec2StackProps extends cdk.StackProps {
	vpcId: string;
	ec2Configs: Ec2InstanceConfig[];
}

export function deployMachines(
	scope: Construct,
	vpc: cdk.aws_ec2.IVpc,
	configs: Ec2InstanceConfig[],
): cdk.aws_ec2.Instance[] {
	return configs.map((config, index) => {
		// Import the subnet by the exported value
		const subnet = ec2.Subnet.fromSubnetAttributes(
			scope,
			`Subnet-${config.name}-${index}`,
			{
				subnetId: cdk.Fn.importValue(`${config.subnetName}-SubnetId`),
				availabilityZone: cdk.Stack.of(scope).availabilityZones[0],
				routeTableId: cdk.Fn.importValue(`${config.subnetName}-RouteTableId`),
			},
		);

		// Import security group using fromSecurityGroupId
		const securityGroup = ec2.SecurityGroup.fromSecurityGroupId(
			scope,
			`SG-${config.name}-${index}`,
			cdk.Fn.importValue(`${config.securityGroupName}-Id`),
		);

		// Determine which AMI to use
		let machineImage: ec2.IMachineImage;
		if (config.amiId) {
			machineImage = ec2.MachineImage.genericLinux({
				[vpc.stack.region]: config.amiId,
			});
		} else {
			machineImage = ec2.MachineImage.latestAmazonLinux2023({
				cpuType: ec2.AmazonLinuxCpuType.X86_64,
			});
		}

		const keyPair = config.keyPairName
			? ec2.KeyPair.fromKeyPairName(
					scope,
					`KeyPair-${config.name}-${index}`,
					config.keyPairName,
				)
			: undefined;

		// Create the EC2 instance
		const instance = new ec2.Instance(scope, config.name, {
			instanceName: config.name,
			vpc,
			vpcSubnets: {
				subnets: [subnet],
			},
			securityGroup,
			instanceType: new ec2.InstanceType(config.instanceType),
			machineImage,
			keyPair,
			...(config.userData && {
				userData: config.userData,
			}),
		});

		if (config.tags) {
			for (const tagKey in config.tags) {
				cdk.Tags.of(instance).add(tagKey, config.tags[tagKey]);
			}
		}

		// Output instance information
		new cdk.CfnOutput(scope, `${config.name}-InstanceId`, {
			value: instance.instanceId,
			description: `Instance ID for ${config.name}`,
		});

		new cdk.CfnOutput(scope, `${config.name}-PrivateIp`, {
			value: instance.instancePrivateIp,
			description: `Private IP for ${config.name}`,
		});

		return instance;
	});
}

export class Ec2Stack extends cdk.Stack {
	constructor(scope: Construct, id: string, props: Ec2StackProps) {
		super(scope, id, props);

		// Import the existing VPC by ID using fromVpcAttributes (accepts tokens)
		const vpc = ec2.Vpc.fromVpcAttributes(this, "ImportedVpc", {
			vpcId: props.vpcId,
			availabilityZones: cdk.Stack.of(this).availabilityZones,
		});

		deployMachines(this, vpc, props.ec2Configs);
	}
}
