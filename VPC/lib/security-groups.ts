import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface SecurityGroupConfig {
  name: string;
  description: string;
  allowAllInbound?: boolean;
  allowAllOutbound?: boolean;
}

export function createSecurityGroups(
  scope: Construct,
  vpc: ec2.Vpc,
  configs: SecurityGroupConfig[]
): ec2.SecurityGroup[] {
  const securityGroups: ec2.SecurityGroup[] = [];

  configs.forEach((config) => {
    const sg = new ec2.SecurityGroup(scope, config.name, {
      vpc,
      description: config.description,
      securityGroupName: config.name,
      allowAllOutbound: config.allowAllOutbound ?? true,
    });

    // Add inbound rule if specified
    if (config.allowAllInbound) {
      sg.addIngressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.allTraffic(),
        'Allow all inbound traffic'
      );
    }

    securityGroups.push(sg);
  });

  return securityGroups;
}

// Define security group configurations
export const securityGroupConfigs: SecurityGroupConfig[] = [
  {
    name: 'r-allow-everything',
    description: 'First security group with allow all traffic',
    allowAllInbound: true,
    allowAllOutbound: true,
  },
];