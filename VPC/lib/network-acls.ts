import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";

export interface SubnetConfig {
	name: string;
	cidr: string;
	aclRulePriority: number;
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
		return [
			{
				ruleNumber: idx * 10 + startAt,
				protocol: PROTOCOLS.all,
				cidrBlock: cid,
				egress: false,
				ruleAction: access,
			},
			{
				ruleNumber: (idx + 1) * 10,
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
			from: 22,
			to: 22,
		},
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
				"10.0.0.32/27",
				"10.0.0.64/28",
				"10.0.0.96/28",
			]),
			...DENY_EVERYTHING_RULES,
		],
	},
	{
		subnetName: "r-visitas",
		rules: [
			...ALLOW_SSH_RULES,
			...aclAllProcsAndIps("allow", ["10.0.0.80/28", "10.0.0.32/27"]),
			...DENY_EVERYTHING_RULES,
		],
	},
	{
		subnetName: "r-datacenter",
		rules: [
			...ALLOW_SSH_RULES,
			...aclAllProcsAndIps("deny", ["10.0.0.80/28"]),
			...aclAllProcsAndIps("allow", ["10.0.0.0/24"], 20),
			...DENY_EVERYTHING_RULES,
		],
	},
	{
		subnetName: "r-ti",
		rules: [
			...ALLOW_SSH_RULES,
			...aclAllProcsAndIps("allow", ["10.0.0.0/24"]),
			...DENY_EVERYTHING_RULES,
		],
	},
	{
		subnetName: "r-ventas",
		rules: [
			...ALLOW_SSH_RULES,
			...aclAllProcsAndIps("allow", [
				"10.0.0.32/27",
				"10.0.0.64/28",
				"10.0.0.0/27",
			]),
			...DENY_EVERYTHING_RULES,
		],
	},
	{
		subnetName: "r-vpn",
		rules: [
			{
				ruleNumber: 500,
				protocol: -1,
				cidrBlock: "0.0.0.0/0",
				egress: false,
				ruleAction: "allow",
			},
			{
				ruleNumber: 500,
				protocol: -1,
				cidrBlock: "0.0.0.0/0",
				egress: true,
				ruleAction: "allow",
			},
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
