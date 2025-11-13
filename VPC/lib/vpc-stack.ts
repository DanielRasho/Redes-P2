import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { createNetworkAcls, SubnetConfig } from "./network-acls";
import { subnetNaclRules } from "./network-acls";
import { createRoute53Configuration } from "./route-53";
import { createSecurityGroups, securityGroupConfigs } from "./security-groups";

export class VpcStack extends cdk.Stack {
  public readonly vpcId: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC with custom CIDR
    const vpc = new ec2.Vpc(this, "RayoUwU", {
      ipAddresses: ec2.IpAddresses.cidr("10.66.0.0/24"),
      maxAzs: 1,
      subnetConfiguration: [],
      natGateways: 0,
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    this.vpcId = vpc.vpcId;

    // Create Internet Gateway
    const internetGateway = new ec2.CfnInternetGateway(
      this,
      "InternetGateway",
      {
        tags: [{ key: "Name", value: "RUwU-VPC-IGW" }],
      }
    );

    // Attach Internet Gateway to VPC
    new ec2.CfnVPCGatewayAttachment(this, "IGWAttachment", {
      vpcId: vpc.vpcId,
      internetGatewayId: internetGateway.ref,
    });

    // Get the first availability zone
    const availabilityZone = cdk.Stack.of(this).availabilityZones[0];

    // Define subnet configurations
    const subnetConfigs: SubnetConfig[] = [
      { name: "r-ventas", cidr: "10.66.0.0/27", aclRulePriority: 500 },
      { name: "r-ti", cidr: "10.66.0.32/27", aclRulePriority: 400 },
      { name: "r-datacenter", cidr: "10.66.0.64/28", aclRulePriority: 300 },
      { name: "r-visitas", cidr: "10.66.0.80/28", aclRulePriority: 200 },
      { name: "r-rrhh", cidr: "10.66.0.96/28", aclRulePriority: 100 }
    ];

    // Create subnets with their route tables
    const subnets: { [key: string]: ec2.CfnSubnet } = {};
    const routeTables: { [key: string]: ec2.CfnRouteTable } = {};

    subnetConfigs.forEach((config) => {
      // Create Subnet
      const subnet = new ec2.CfnSubnet(this, `r-${config.name}`, {
        vpcId: vpc.vpcId,
        cidrBlock: config.cidr,
        availabilityZone: availabilityZone,
        tags: [{ key: "Name", value: config.name }],
        mapPublicIpOnLaunch: true,
      });
      subnets[config.name] = subnet;

      // Create Route Table for each subnet
      const routeTable = new ec2.CfnRouteTable(this, `r-${config.name}-rt`, {
        vpcId: vpc.vpcId,
        tags: [{ key: "Name", value: `r-${config.name}-rt` }],
      });
      routeTables[config.name] = routeTable;

      // Associate Route Table with Subnet
      new ec2.CfnSubnetRouteTableAssociation(
        this,
        `RTAssociation-${config.name}`,
        {
          subnetId: subnet.ref,
          routeTableId: routeTable.ref,
        }
      );

      // Add route to Internet Gateway (0.0.0.0/0)
      new ec2.CfnRoute(this, `Route-IGW-${config.name}`, {
        routeTableId: routeTable.ref,
        destinationCidrBlock: "0.0.0.0/0",
        gatewayId: internetGateway.ref,
      });
    });

    // Create Network ACLs using configuration
    const networkAcls = createNetworkAcls(this, vpc, subnets, subnetNaclRules);

    // Create Security Groups using configuration
    const securityGroups = createSecurityGroups(
      this,
      vpc,
      securityGroupConfigs
    );

    // Create Route53 configuration
    const hostedZone = createRoute53Configuration(this, vpc);

    // Outputs
    new cdk.CfnOutput(this, "VPCId", {
      value: vpc.vpcId,
      description: "VPC ID",
    });

    securityGroups.forEach((sg, index) => {
      new cdk.CfnOutput(this, `SecurityGroup${index + 1}Id`, {
        value: sg.securityGroupId,
        description: `Security Group ${index + 1} ID`,
        exportName: `${securityGroupConfigs[index].name}-Id`,
      });
    });

    new cdk.CfnOutput(this, "HostedZoneId", {
      value: hostedZone.hostedZoneId,
      description: "Private Hosted Zone ID",
    });

    // Output subnet IDs
    Object.entries(subnets).forEach(([name, subnet]) => {
      new cdk.CfnOutput(this, `Subnet-${name}-Id`, {
        value: subnet.ref,
        description: `Subnet ${name} ID`,
        exportName: `${name}-SubnetId`,
      });

      new cdk.CfnOutput(this, `RouteTable-${name}-Id`, {
        value: routeTables[name].ref,
        description: `Route Table ${name} ID`,
        exportName: `${name}-RouteTableId`,
      });
    });
  }
}
