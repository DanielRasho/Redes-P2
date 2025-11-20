import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";

export interface SubnetConfig {
	name: string;
	cidr: string;
}

export interface NaclRuleConfig {
	ruleNumber: number;
	protocol: number; // -1 for all, 6 for TCP, 17 for UDP
	cidrBlock: string;
	egress: boolean;
	ruleAction: "allow" | "deny";
	portRange?: {
		from: number;
		to: number;
	};
	icmp?: ec2.CfnNetworkAclEntry.IcmpProperty;
}

export interface SubnetNaclConfig {
	subnetName: string;
	rules: NaclRuleConfig[];
}

const ICMP_TYPES = {
	all: -1,
	ssh: 22,
};
const PROTOCOLS = {
	all: -1,
	tcp: 6,
	udp: 17,
};

function aclAllProcsAndIps(
	access: "allow" | "deny",
	cidrs: string[],
	startAt: number = 10,
): NaclRuleConfig[] {
	return cidrs.flatMap((cid, idx) => {
		const ruleNumber = idx * 10 + startAt;
		return [
			{
				ruleNumber,
				protocol: PROTOCOLS.all,
				cidrBlock: cid,
				egress: false,
				ruleAction: access,
			},
			{
				ruleNumber,
				protocol: PROTOCOLS.all,
				cidrBlock: cid,
				egress: true,
				ruleAction: access,
			},
		];
	});
}

const ALLOW_SSH_RULES: NaclRuleConfig[] = [
	{
		ruleNumber: 5,
		icmp: {
			code: -1,
			type: ICMP_TYPES.ssh,
		},
		protocol: PROTOCOLS.tcp,
		portRange: {
			from: 22,
			to: 22,
		},
		cidrBlock: "0.0.0.0/0",
		egress: false,
		ruleAction: "allow",
	},
	{
		ruleNumber: 5,
		icmp: {
			code: -1,
			type: ICMP_TYPES.ssh,
		},
		protocol: PROTOCOLS.tcp,
		portRange: {
			from: 1024,
			to: 65535,
		},
		cidrBlock: "0.0.0.0/0",
		egress: true,
		ruleAction: "allow",
	},
];

const ALLOW_VPN: NaclRuleConfig[] = [
	{
		ruleNumber: 6,
		icmp: {
			code: -1,
			type: ICMP_TYPES.all,
		},
		protocol: PROTOCOLS.udp,
		portRange: {
			from: 1194,
			to: 1194,
		},
		cidrBlock: "0.0.0.0/0",
		egress: false,
		ruleAction: "allow",
	},
	{
		ruleNumber: 7,
		icmp: {
			code: -1,
			type: ICMP_TYPES.all,
		},
		protocol: PROTOCOLS.tcp,
		portRange: {
			from: 443,
			to: 443,
		},
		cidrBlock: "0.0.0.0/0",
		egress: false,
		ruleAction: "allow",
	},
	{
		ruleNumber: 8,
		icmp: {
			code: -1,
			type: ICMP_TYPES.all,
		},
		protocol: PROTOCOLS.tcp,
		portRange: {
			from: 943,
			to: 943,
		},
		cidrBlock: "0.0.0.0/0",
		egress: false,
		ruleAction: "allow",
	},
	{
		ruleNumber: 9,
		icmp: {
			code: -1,
			type: ICMP_TYPES.all,
		},
		protocol: PROTOCOLS.udp,
		portRange: {
			from: 943,
			to: 943,
		},
		cidrBlock: "0.0.0.0/0",
		egress: true,
		ruleAction: "allow",
	},
	{
		ruleNumber: 10,
		icmp: {
			code: -1,
			type: ICMP_TYPES.all,
		},
		protocol: PROTOCOLS.tcp,
		portRange: {
			from: 81,
			to: 81,
		},
		cidrBlock: "0.0.0.0/0",
		egress: false,
		ruleAction: "allow",
	},
];

const ALLOW_EVERYTHING: NaclRuleConfig[] = [
	{
		ruleNumber: 11,
		icmp: {
			code: -1,
			type: ICMP_TYPES.all,
		},
		protocol: PROTOCOLS.all,
		cidrBlock: "0.0.0.0/0",
		egress: false,
		ruleAction: "allow",
	},
	{
		ruleNumber: 12,
		icmp: {
			code: -1,
			type: ICMP_TYPES.all,
		},
		protocol: PROTOCOLS.all,
		cidrBlock: "0.0.0.0/0",
		egress: true,
		ruleAction: "allow",
	},
];

const DENY_EVERYTHING_RULES: NaclRuleConfig[] = [
	{
		ruleNumber: 999,
		protocol: PROTOCOLS.all,
		cidrBlock: "0.0.0.0/0",
		egress: false,
		ruleAction: "deny",
	},
	{
		ruleNumber: 999,
		protocol: PROTOCOLS.all,
		cidrBlock: "0.0.0.0/0",
		egress: true,
		ruleAction: "deny",
	},
];

// Define all NACL rules per subnet here
export const subnetNaclRules: SubnetNaclConfig[] = [
	{
		subnetName: "r-rrhh",
		rules: [
			...ALLOW_SSH_RULES,
			...aclAllProcsAndIps("allow", [
				"10.66.0.32/27",
				"10.66.0.64/28",
				"10.66.0.96/28",
			]),
			// ...ALLOW_EVERYTHING,
			...DENY_EVERYTHING_RULES,
		],
	},
	{
		subnetName: "r-visitas",
		rules: [
			...ALLOW_SSH_RULES,
			...aclAllProcsAndIps("allow", ["10.66.0.80/28", "10.66.0.32/27"]),
			// ...ALLOW_EVERYTHING,
			...DENY_EVERYTHING_RULES,
		],
	},
	{
		subnetName: "r-datacenter",
		rules: [
			// ...ALLOW_EVERYTHING,
			...ALLOW_SSH_RULES,
			...aclAllProcsAndIps("deny", ["10.66.0.80/28"]),
			...aclAllProcsAndIps("allow", ["10.66.0.0/24"], 20),
			// ...ALLOW_EVERYTHING,
			...DENY_EVERYTHING_RULES,
		],
	},
	{
		subnetName: "r-ti",
		rules: [
			...ALLOW_SSH_RULES,
			...aclAllProcsAndIps("allow", ["10.66.0.0/24"]),
			// ...ALLOW_EVERYTHING,
			...DENY_EVERYTHING_RULES,
		],
	},
	{
		subnetName: "r-ventas",
		rules: [
			...ALLOW_SSH_RULES,
			...aclAllProcsAndIps("allow", [
				"10.66.0.32/27",
				"10.66.0.64/28",
				"10.66.0.0/27",
			]),
			// ...ALLOW_EVERYTHING,
			...DENY_EVERYTHING_RULES,
		],
	},
	{
		subnetName: "r-dmz",
		rules: [
			...ALLOW_SSH_RULES,
			...ALLOW_VPN,
			...aclAllProcsAndIps("allow", ["10.66.0.0/24"], 30),
			// ...ALLOW_EVERYTHING,
			...DENY_EVERYTHING_RULES,
		],
	},
];

export function createNetworkAcls(
	scope: Construct,
	vpc: ec2.Vpc,
	subnets: { [key: string]: ec2.CfnSubnet },
	naclConfigs: SubnetNaclConfig[],
): { [key: string]: ec2.CfnNetworkAcl } {
	const networkAcls: { [key: string]: ec2.CfnNetworkAcl } = {};

	naclConfigs.forEach((config) => {
		const subnetName = config.subnetName;

		// Create Network ACL for each subnet
		const networkAcl = new ec2.CfnNetworkAcl(scope, `NAcl-${subnetName}`, {
			vpcId: vpc.vpcId,
			tags: [{ key: "Name", value: `${subnetName}-nacl` }],
		});
		networkAcls[subnetName] = networkAcl;

		// Associate Network ACL with Subnet
		new ec2.CfnSubnetNetworkAclAssociation(
			scope,
			`NAclAssociation-${subnetName}`,
			{
				subnetId: subnets[subnetName].ref,
				networkAclId: networkAcl.ref,
			},
		);

		// Create all rules from configuration
		config.rules.forEach((rule, index) => {
			const direction = rule.egress ? "Outbound" : "Inbound";
			const ruleName = `Nacl${direction}Rule-${subnetName}-${index}`;

			// Conditionally construct the props object with portRange if needed
			const entryProps: ec2.CfnNetworkAclEntryProps = {
				networkAclId: networkAcl.ref,
				ruleNumber: rule.ruleNumber,
				protocol: rule.protocol,
				cidrBlock: rule.cidrBlock,
				egress: rule.egress,
				ruleAction: rule.ruleAction,
				...(rule.icmp && {
					icmp: {
						type: rule.icmp.type,
						code: rule.icmp.code,
					},
				}),
				...(rule.portRange && {
					portRange: {
						from: rule.portRange.from,
						to: rule.portRange.to,
					},
				}),
			};

			new ec2.CfnNetworkAclEntry(scope, ruleName, entryProps);
		});
	});

	return networkAcls;
}
