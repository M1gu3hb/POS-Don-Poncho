# 11 · Puente de las mesas unidas hasta la mudanza (DP-10.3)

## Qué hace y por qué

Hasta que la rama `fase-b` llegue a producción, la unión de mesas de `main` es la vieja (F-302):
la 5 se une a la 4, su cuenta se absorbe y la 5 se queda SIN cuenta propia. Tres cosas quedaban
mal; aquí se arreglan sin migración.

- **El QR de la mesa unida (obligatorio).** El comensal de la 5 veía «Mesa 5», y pedir o llamar
  caía en una mesa sin cuenta. Ahora, mientras la unión está ABIERTA
  (`union_mesa_miembros.union_abierta`, `uniones_mesa.mesa_principal_id`, `cerrada_en` nulo), el
  QR de la 5 resuelve a la principal: el portal dice «Mesa 4» y «Esta mesa está unida a la
  mesa 4», y los pedidos y las solicitudes caen en la 4. Nunca se abre una cuenta aparte en la 5.
  El QR propio sigue mandando: apagado en la 5, no sirve. Separadas, cada QR es de su mesa.
- **D-2 · «Separar mesas»** en la mesa activa de la principal de un grupo vivo. Usa
  `restaurante.separar_mesas`, que ya existía y ninguna pantalla llamaba.
- **D-3 · Entregar desde la principal.** Al unir, las comandas de la unida pasan a la cuenta del
  grupo (`comandas.orden_id`), igual que sus líneas. «Marcar entregado» en la principal las
  alcanza; antes se quedaban en «listo» hasta que cocina las quitaba.

## Archivos

| Archivo                                                                | Qué                                             |
| ---------------------------------------------------------------------- | ----------------------------------------------- |
| `packages/app/src/portal/ambito.ts`                                    | `principalDeLaUnion`: el QR de la unida, a la 4 |
| `packages/app/src/portal/cuenta-publica.ts`, `consulta.ts`             | `mesa.unida_a_la_mesa` en la respuesta pública  |
| `apps/web/heredado/pages/PortalCliente.jsx`                            | «Esta mesa está unida a la mesa N»              |
| `packages/app/src/restaurante/sala-escrituras.ts`                      | D-3: las comandas pasan a la cuenta del grupo   |
| `apps/web/src/restaurante/unir-mesas/SepararMesasDialog.tsx`           | El diálogo (el mismo de la fase B)              |
| `apps/web/src/restaurante/unir-mesas/use-union-de-la-mesa.ts`          | ¿Esta mesa encabeza un grupo vivo?              |
| `apps/web/src/restaurante/AccionesDeLaMesa.tsx`, `MesaActiva.tsx`      | El botón «Separar mesas»                        |
| `packages/app/src/restaurante/union-puente-del-qr.integracion.test.ts` | Contra Postgres                                 |
| `pruebas/e2e/restaurante-operaciones.spec.ts`                          | D-2 y D-3 dejan de ser `fixme`                  |

## Migraciones

Ninguna. Usa las tablas de la unión vieja.

## Genérico o de Don Poncho

Genérico para el giro restaurante. Es un puente: la unión de la fase B (`mesas.unida_a_mesa_id`,
migración 187, DP-D30) lo reemplaza. Al fusionar `main` en `fase-b`, ganan los archivos de la
fase B, y el aviso del portal se conserva sobre su unión.

## Cómo portarlo

Si el maestro no trae la unión de la fase B: copiar `principalDeLaUnion` y el campo
`unida_a_la_mesa`, el aviso del portal, el `update` de comandas en `unirMesas`, el diálogo, el
hook y el botón. Si la trae, basta el aviso del portal sobre `unida_a_mesa_id`.
