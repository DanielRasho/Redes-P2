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
}

export interface SubnetNaclConfig {
  subnetName: string;
  rules: NaclRuleConfig[];
}

// Define all NACL rules per subnet here
export const subnetNaclRules: SubnetNaclConfig[] = [
  {
    subnetName: "r-rrhh",
    rules: [
      // Allow all inbound
      {
        ruleNumber: 100,
        protocol: -1,
        cidrBlock: "0.0.0.0/0",
        egress: false,
        ruleAction: "allow",
      },
      // Allow all outbound
      {
        ruleNumber: 100,
        protocol: -1,
        cidrBlock: "0.0.0.0/0",
        egress: true,
        ruleAction: "allow",
      },
    ],
  },
  {
    subnetName: "r-visitas",
    rules: [
      {
        ruleNumber: 200,
        protocol: -1,
        cidrBlock: "0.0.0.0/0",
        egress: false,
        ruleAction: "allow",
      },
      {
        ruleNumber: 200,
        protocol: -1,
        cidrBlock: "0.0.0.0/0",
        egress: true,
        ruleAction: "allow",
      },
    ],
  },
  {
    subnetName: "r-datacenter",
    rules: [
      {
        ruleNumber: 300,
        protocol: -1,
        cidrBlock: "0.0.0.0/0",
        egress: false,
        ruleAction: "allow",
      },
      {
        ruleNumber: 300,
        protocol: -1,
        cidrBlock: "0.0.0.0/0",
        egress: true,
        ruleAction: "allow",
      },
      // HTTPS specific rule
      {
        ruleNumber: 301,
        protocol: 6, // TCP
        cidrBlock: "0.0.0.0/0",
        egress: false,
        ruleAction: "allow",
        portRange: {
          from: 443,
          to: 443,
        },
      },
    ],
  },
  {
    subnetName: "r-ti",
    rules: [
      {
        ruleNumber: 400,
        protocol: -1,
        cidrBlock: "0.0.0.0/0",
        egress: false,
        ruleAction: "allow",
      },
      {
        ruleNumber: 400,
        protocol: -1,
        cidrBlock: "0.0.0.0/0",
        egress: true,
        ruleAction: "allow",
      },
      // SSH specific rule
      {
        ruleNumber: 401,
        protocol: 6, // TCP
        cidrBlock: "10.66.0.0/24",
        egress: false,
        ruleAction: "allow",
        portRange: {
          from: 22,
          to: 22,
        },
      },
    ],
  },
  {
    subnetName: "r-ventas",
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
  naclConfigs: SubnetNaclConfig[]
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
      }
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
