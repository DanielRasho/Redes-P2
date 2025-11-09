# Proyecto 2

## Configurar AWS CLI

Tener instalado AWS CDK!

```
aws configure

<ingresar credenciales de usuario IAM>
```

## Desplegar infraestructura

```
cd VPC

cdk synth # compilar nueva plantilla de AWS

cdk deploy <stack name> # Despliega cambios a la infraestructura

cdk destroy <stack name> # Destruye todos los recursos del stack
```

## Project structure

Se cuentan con 2 stacks, `RayoUwUStack` para la definición de la red y
conectividad, `RayoUwUEC2` para definir EC2 permantentes de los que depende la
red como el LDAP o el WebServer.

### Advertencias ⚠️

- Evitar lo más posibles modificar las redes manualmente desde la página web.
- Aquellos recursos que esten cambiando frecuentemente es mejor dejarlos fuera
  del CDK.
- Experimentar primero con recursos manuales, una vez definida bien la
  estructura agregarlos al CDK

```
├── LDAP/
├── Server/
└── VPC
    ├── bin
    │   └── vpc.ts              # Entrypoint
    ├── lib
    │   ├── ec2-stack.ts        # Definicion Stack EC2
    │   ├── network-acls.ts     # Definicion ACLs
    │   ├── route-53.ts         # Definición DNS
    │   ├── security-groups.ts  # Definición Security Groups
    │   └── vpc-stack.ts        # Definicion Stack VPC
    └── cdk.context.json
```
