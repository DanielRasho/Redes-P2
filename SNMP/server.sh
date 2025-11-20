#!/bin/bash -xe

# Installing SNMP Exporter
sudo apt-get update
sudo apt-get install wget
wget -O snmp_exporter.tar.gz https://github.com/prometheus/snmp_exporter/releases/download/v0.29.0/snmp_exporter-0.29.0.linux-amd64.tar.gz
tar -xvzf snmp_exporter.tar.gz

# Run SNMP Exporter on the background...
cd ./snmp_exporter-0.29.0.linux-amd64
./snmp_exporter &
cd ..

# Installing Prometheus
sudo useradd --no-create-home prometheus
sudo mkdir /etc/prometheus
sudo mkdir /var/lib/prometheus

sudo yum install wget -y
wget https://github.com/prometheus/prometheus/releases/latest/download/prometheus-*.tar.gz
tar xvf prometheus-*.tar.gz
sudo cp prometheus-*/prometheus /usr/local/bin/
sudo cp prometheus-*/promtool /usr/local/bin/

cat <<EOF >temp
scrape_configs:
  - job_name: 'snmp'
    static_configs:
      - targets:
        - '10.0.1.10'   # EC2 #1 private IP
        - '10.0.2.15'   # EC2 #2 private IP
        - '10.0.3.20'   # EC2 #3 private IP
    metrics_path: /snmp
    params:
      module: ['if_mib']     # default SNMP interface module
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: 'localhost:9116' # SNMP exporter endpoint
EOF
sudo mkdir /etc/prometheus/
sudo mv temp /etc/prometheus/prometheus.yml

sudo systemctl start prometheus
sudo systemctl enable prometheus

# Installing Grafana
sudo mkdir -p /etc/apt/keyrings/
wget -q -O - https://apt.grafana.com/gpg.key | gpg --dearmor | sudo tee /etc/apt/keyrings/grafana.gpg >/dev/null
echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" | sudo tee -a /etc/apt/sources.list.d/grafana.list
sudo apt-get update

sudo apt-get install apt-transport-https
sudo apt-get install software-properties-common
sudo apt-get install grafana

# Start Grafana
sudo systemctl daemon-reload
sudo systemctl start grafana-server
sudo systemctl enable grafana-server
