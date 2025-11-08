import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as route53 from 'aws-cdk-lib/aws-route53';

export function createRoute53Configuration(
  scope: Construct,
  vpc: ec2.Vpc
): route53.PrivateHostedZone {
  // Create Private Hosted Zone in Route53
  const hostedZone = new route53.PrivateHostedZone(scope, 'PrivateHostedZone', {
    zoneName: 'ruwu.com',
    vpc: vpc,
    comment: 'Private hosted zone for ruwu.com',
  });

  // Add A records
  new route53.ARecord(scope, 'RuwuComRecord', {
    zone: hostedZone,
    recordName: 'ruwu.com',
    target: route53.RecordTarget.fromIpAddresses('10.0.0.74'),
    ttl: cdk.Duration.seconds(5),
  });

  new route53.ARecord(scope, 'LdapRuwuComRecord', {
    zone: hostedZone,
    recordName: 'ldap.ruwu.com',
    target: route53.RecordTarget.fromIpAddresses('10.0.0.69'),
    ttl: cdk.Duration.seconds(5),
  });

  return hostedZone;
}