#!/bin/bash -xe

sudo yum install net-snmp
sudo yum install net-snmp-utils

sudo mkdir -p /etc/snmp

cat <<EOF >temp
rocommunity public 10.66.0.0/24
syslocation My-Mom
syscontact admin@example.com
EOF

sudo mv temp /etc/snmp/snmpd.conf

sudo systemctl enable snmpd
sudo systemctl start snmpd
