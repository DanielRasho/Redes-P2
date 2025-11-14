### Actualizar DNS (Arch Linux)
```bash
sudo cp /etc/resolv.conf /etc/resolv.conf.backup
echo "nameserver 10.66.0.2" | sudo tee /etc/resolv.conf

# When done, restore original DNS
sudo cp /etc/resolv.conf.backup /etc/resolv.conf
```

### Conectarse a la VPN
sudo openvpn --config <profile-path>

### Notas importantes
Acceso a la subred : 10.66.0.0/24