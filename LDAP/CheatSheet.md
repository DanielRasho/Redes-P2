## Cheatsheet to create a user

```bash
# Step 1: create user
cat > /tmp/newuser.ldif << 'EOF'
dn: uid=USERNAME,ou=People,dc=rayo,dc=uwu
objectClass: inetOrgPerson
objectClass: posixAccount
objectClass: shadowAccount
uid: USERNAME
sn: LASTNAME
givenName: FIRSTNAME
cn: FIRSTNAME LASTNAME
displayName: FIRSTNAME LASTNAME
uidNumber: UNIQUE_UID_NUMBER
gidNumber: 10001
userPassword: {CRYPT}x
gecos: FIRSTNAME LASTNAME
loginShell: /bin/bash
homeDirectory: /home/USERNAME
EOF

# Step 2: Add to LDAP
ldapadd -x -D "cn=admin,dc=rayo,dc=uwu" -W -f /tmp/carlos.ldif

# Step 3: Set password
ldappasswd -x -D "cn=admin,dc=rayo,dc=uwu" -W -s "carlos123" "uid=carlos,ou=People,dc=rayo,dc=uwu"

# Step 4: Add to group memberUid list
cat > /tmp/add-member.ldif << 'EOF'
dn: cn=rrhh,ou=Groups,dc=rayo,dc=uwu
changetype: modify
add: memberUid
memberUid: USERNAME
EOF

# Step 5: Add member to groups
ldapmodify -x -D "cn=admin,dc=rayo,dc=uwu" -W -f /tmp/add-member.ldif
```