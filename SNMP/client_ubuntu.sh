#!/bin/bash -xe

sudo apt install snmp snmpd snmp-mibs-downloader

cat <<EOF >temp
rocommunity public 10.66.0.0/24
syslocation My-Mom
syscontact admin@example.com
EOF
sudo mv temp /etc/snmp/snmpd.conf

sudo systemctl enable snmpd
sudo systemctl start snmpd
