# Capacidad · un día lleno de Don Poncho contra los planes de Vercel y Supabase (DP-15)

Medido el 08-11-2026 en **producción**, ya en la base propia, sólo leyendo (sin abrir mesas ni
cajas): cada puesto entró con su PIN y dejó su pantalla abierta, a la vez, con Playwright
(Chromium). Dos corridas: 120 s a la vista + 60 s con la pantalla oculta, y 60 s a la vista
midiendo además el cuerpo sin comprimir de cada respuesta.

## Lo medido, por aparato abierto en su pantalla

| Aparato · pantalla              | Peticiones/min a la vista | Transferencia comprimida (KB/min) | Cuerpo de la API sin comprimir (KB/min) | Con la pantalla oculta |
| ------------------------------- | ------------------------: | --------------------------------: | --------------------------------------: | ---------------------- |
| Caja · `/caja`                  |                     42–44 |                            71–257 |                                     2,9 | 1/min                  |
| Mesero · `/mesero` (tableta)    |                     61–62 |                           110–112 |                                    82,5 | 0/min                  |
| Cocina · `/cocina` (tableta)    |                   36–36,5 |                            62–245 |                                    15,5 | 1/min                  |
| Dueño · Inicio                  |                     28–29 |                             46–48 |                                     0,6 | 3/min                  |
| Comensal · portal QR (teléfono) |                   36–36,5 |                           210–217 |                               **1.231** | 0/min                  |
| Teléfono de cocina              |                   22,5–23 |                             39–40 |                                     3,2 | 0/min                  |

- Todo lo que se repite es la API (`/api/datos/consultar`, `/api/caja/estado`, el carrito y el
  estado del portal, la pantalla del teléfono de cocina). Las pantallas no recargan la página.
- **Con la pantalla oculta el sondeo se detiene** (TanStack Query pausa sus intervalos): 0 a 3
  peticiones por minuto.
- El portal del comensal vuelve a bajar el menú completo cada ~4 s
  (`apps/web/heredado/pages/PortalCliente.jsx:101`, `refetchInterval: 4000`): unos 80 KB sin
  comprimir por vez. Es lo único pesado.

## El día lleno

Supuestos: 8 horas abiertas, los 30 días del mes. Pantallas del personal a la vista todo el turno:
2 cajas, 3 meseros, 2 de cocina (Cocina y Bebidas) y el dueño. Comensales: **peor caso**, los 10
teléfonos con el portal abierto las 8 horas; **realista**, 10 mesas × 4 familias × 15 minutos con el
portal a la vista (600 minutos de teléfono al día).

| Concepto                                                                        |                           Peor caso al mes | Realista al mes |
| ------------------------------------------------------------------------------- | -----------------------------------------: | --------------: |
| Peticiones a la API (= invocaciones de función)                                 | 10,6 M (personal 5,4 M + comensales 5,2 M) |           6,0 M |
| Peticiones CDN (API + estáticos al entrar)                                      |                                   ≈ 11,5 M |         ≈ 6,5 M |
| Transferencia a los navegadores (comprimida)                                    |                                    ≈ 41 GB |         ≈ 15 GB |
| Cuerpos de la API sin comprimir (≈ egress de la base y transferencia de origen) |                                   ≈ 181 GB |         ≈ 26 GB |
| Peticiones por segundo en la hora pico                                          |                                       ≈ 12 |             ≈ 7 |

## Contra los planes

**Vercel — equipo `mh-astral-systems` en Pro** (20 USD al mes con 20 USD de crédito de uso;
precios de vercel.com/pricing del 08-11-2026):

| Recurso                                                | Incluido / precio                      |                      Peor caso |                  Realista |
| ------------------------------------------------------ | -------------------------------------- | -----------------------------: | ------------------------: |
| Peticiones CDN                                         | 10 M incluidas; 2 USD por millón extra |                        ≈ 3 USD |                         0 |
| Transferencia rápida                                   | 1 TB incluido                          |                              0 |                         0 |
| Invocaciones de función                                | 0,60 USD por millón (del crédito)      |                      ≈ 6,4 USD |                 ≈ 3,6 USD |
| CPU activa (supuesto: 25 ms por petición)              | 0,128 USD por hora                     |                      ≈ 9,4 USD |                 ≈ 5,3 USD |
| Memoria aprovisionada (1–2 instancias de 2 GB las 8 h) | 0,0106 USD por GB-hora                 |                       ≈ 10 USD |                   ≈ 5 USD |
| Transferencia de origen                                | desde 0,06 USD por GB                  |                     ≈ 10,6 USD |                 ≈ 1,3 USD |
| **Total contra el crédito de 20 USD**                  |                                        | **≈ 39 USD: se pasa ≈ 19 USD** | **≈ 15 USD: cabe, justo** |

**Supabase — proyecto «POS Don Poncho», Pro con cómputo Micro** (1 GB, compartido; 60 conexiones
directas; el pooler admite 200 clientes con 15 conexiones a la base):

| Recurso           | Incluido                |                                                                                                                                     Peor caso |       Realista |
| ----------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------: | -------------: |
| Egress            | 250 GB al mes           |                                                                                                                               ≈ 181 GB (72 %) | ≈ 26 GB (10 %) |
| Tamaño de la base | 8 GB                    |                                                                                                                             hoy unos pocos MB |              — |
| Conexiones        | 200 clientes del pooler | cada instancia de Vercel abre como mucho 10 (`MORPHIQPOS_DB_POOL_MAX`), por el pooler de transacción (6543); a 12 peticiones/s caben de sobra |              — |

## Lo que se concluye

- **El personal cabe holgado** en los dos planes. Lo que acerca al límite es el **portal del
  comensal**: si los 10 teléfonos se quedan con el portal abierto toda la jornada, Vercel se pasa
  del crédito (≈ 19 USD al mes extra) y Supabase llega al 72 % del egress. En lo realista (el
  comensal ve el menú, pide y bloquea el teléfono) cabe, pero justo en Vercel (≈ 15 de 20 USD, y
  ese crédito es de todo el equipo).
- **El ajuste más barato** (una línea de lógica, sin cambiar lo que se ve): que el portal baje el
  menú **una vez** y sondee sólo el estado ligero (carrito y avisos); o, como mínimo, que el estado
  completo pase de 4 s a 15 s. Con eso el peso de cada teléfono baja ~90 % en egress y transferencia
  de origen y ~40 % en invocaciones, y el peor caso cae a ≈ 22 USD en Vercel y ≈ 25 GB en Supabase.
  Los meseros (61 peticiones/min: el mapa cada 5–6 s) son lo siguiente, si hiciera falta.
- **Pausar con la pantalla oculta ya ocurre**: no hace falta hacer nada para eso.
- **El ajuste, aplicado (DP-15, `8f5a422`):** el estado completo del portal se sondea cada **12 s**
  (y al volver a la pantalla), no cada 4 s; el carrito compartido sigue con su sondeo ligero. Por
  teléfono, las lecturas completas bajan de 15 a 5 por minuto: unos 400 KB/min sin comprimir en vez
  de 1.231 (−67 %) y unas 26 peticiones por minuto en vez de 36 (−28 %). Es una estimación con los
  tamaños medidos, no una medición nueva; el peor caso queda por debajo del crédito o muy cerca, y lo
  realista con holgura.
- Lo que hay que vigilar la primera semana: en Vercel, Usage del proyecto (invocaciones, CPU
  activa, transferencia de origen); en Supabase, Reports → Egress.
