# Configurar LDAP

## Servidor

### Instalar dependencias
```bash
sudo apt install slapd ldap-utils
```

### Iniciar configuración 
```bash
sudo dpkg-reconfigure slapd
```

```bash
sudo ldapsearch -Q -LLL -Y EXTERNAL -H ldapi:/// -b cn=config "(olcSuffix=*)" dn olcSuffix olcRootDN
```

Verificar que el servicio este encendido y se puede acceder al directorio:
```bash
# Check if LDAP is running
sudo systemctl status slapd

# Test connection
ldapsearch -x -LLL -H ldap://localhost -b "dc=rayo,dc=uwu"
```

### Crear Organization entities

Primero crear un archivo que contenga la configuracion a crear en el LDAP, por ejemplo `./organization.ldif` y agregar el siguiente contenido:

```
# Create organizational units
dn: ou=People,dc=rayo,dc=uwu
objectClass: organizationalUnit
ou: People

dn: ou=Groups,dc=rayo,dc=uwu
objectClass: organizationalUnit
ou: Groups

# Create ventas group
dn: cn=ventas,ou=Groups,dc=rayo,dc=uwu
objectClass: posixGroup
cn: ventas
gidNumber: 10000
memberUid: jperez

# Create rrhh group
dn: cn=rrhh,ou=Groups,dc=rayo,dc=uwu
objectClass: posixGroup
cn: rrhh
gidNumber: 10001
memberUid: mgarcia

# Create user in ventas
dn: uid=jperez,ou=People,dc=rayo,dc=uwu
objectClass: inetOrgPerson
objectClass: posixAccount
objectClass: shadowAccount
uid: jperez
sn: Perez
givenName: Juan
cn: Juan Perez
displayName: Juan Perez
uidNumber: 10000
gidNumber: 10000
userPassword: {CRYPT}x
gecos: Juan Perez
loginShell: /bin/bash
homeDirectory: /home/jperez

# Create user in rrhh
dn: uid=mgarcia,ou=People,dc=rayo,dc=uwu
objectClass: inetOrgPerson
objectClass: posixAccount
objectClass: shadowAccount
uid: mgarcia
sn: Garcia
givenName: Maria
cn: Maria Garcia
displayName: Maria Garcia
uidNumber: 10001
gidNumber: 10001
userPassword: {CRYPT}x
gecos: Maria Garcia
loginShell: /bin/bash
homeDirectory: /home/mgarcia
```

Esto crea la siguiente estructure de directorios
```
dc=rayo,dc=uwu
├── ou=People
│   ├── uid=jperez (Juan Perez - ventas)
│   └── uid=mgarcia (Maria Garcia - rrhh)
└── ou=Groups
    ├── cn=ventas (gidNumber: 10000)
    └── cn=rrhh (gidNumber: 10001)
```

**Finalmente, se agrega el contenido en a LDAP:**
```bash
ldapadd -x -D "cn=admin,dc=rayo,dc=uwu" -W -f ./organization.ldif
```

## Cliente

Instalar las dependencias:
```bash
sudo apt update
sudo apt install -y sssd sssd-ldap ldap-utils libpam-sss libnss-sss
```

Después, se debe configurar sssd, al modificar el archivo
```
sudo nano /etc/sssd/sssd.conf
```
Ingresar un contenido como el siguiente
```
[sssd]
config_file_version = 2
services = nss, pam
domains = LDAP

[domain/LDAP]
id_provider = ldap
auth_provider = ldap
ldap_uri = ldap://< YOUR LDAP IP/URL >:389
ldap_search_base = dc=rayo,dc=uwu
ldap_user_search_base = ou=People,dc=rayo,dc=uwu
ldap_group_search_base = ou=Groups,dc=rayo,dc=uwu
ldap_default_bind_dn = cn=admin,dc=rayo,dc=uwu
ldap_default_authtok_type = password
ldap_default_authtok = 1234
ldap_id_use_start_tls = false
ldap_auth_disable_tls_never_use_in_production = true
cache_credentials = true
ldap_tls_reqcert = never
enumerate = true

# ACCESS CONTROL - Only allow ventas group
access_provider = simple
simple_allow_groups = < LDAP GROUP >

[nss]
filter_groups = root
filter_users = root

[pam]
```

### Configurar NSS (Name Service Switch)
```bash
sudo nano /etc/nsswitch.conf
```

Buscar estas lineas y agregar `sss`:
```
passwd:         files systemd sss
group:          files systemd sss
shadow:         files sss
```

### Configurar cracion de directorios HOME
```
sudo pam-auth-update --enable mkhomedir
```

### Activar ingreso SSH con Autenticación
```
sudo nano /etc/ssh/sshd_config
```

Buscar y modificar estas lineas:

```
PasswordAuthentication yes
ChallengeResponseAuthentication yes
```

### Reiniciar servicios

```bash
sudo systemctl restart sssd
sudo systemctl enable sssd
sudo systemctl restart ssh
```

### Verificar acceso a los usuarios del ldap

Iniciar sesion con el usuario jperez
```bash
su - jperez
```

### Loguearse con SSH
```bash
ssh mgarcia@<CLIENTE URL>
```