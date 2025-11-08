
```
aws configure

<ingresar credenciales de usuario IAM>
```

```
cd VPC

cdk synth # compilar nueva plantilla de AWS

cdk deploy <stack name> # Despliega cambios a la infraestructura

cdk destroy <stack name> # Destruye todos los recursos del stack
```