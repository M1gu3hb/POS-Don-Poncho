# 06 · QR de las mesas con diseño (DP-9.8)

## Qué hace y por qué

Miguel: «los QR de las mesas tienen que verse como de La Tradicional Barbacoa, no como un código
cualquiera; y que no se pueda imprimir uno que no se lea».

- En Portal QR → Mesas QR, arriba, **Diseño de los QR**: un diseño general para todas las mesas
  (módulos, esquinas y su centro, tinta, color de las esquinas, fondo, degradado, logo del negocio
  al centro, marco con textos —`{mesa}` se cambia por el número— y tamaño impreso en mm).
- Cada mesa puede tener el suyo: «Personalizar» en su tarjeta, y «Restablecer al diseño general».
- El editor enseña el QR con una mesa de verdad y revisa si se lee mientras se diseña. Un diseño
  que no se leería (poco contraste, tinta clara sobre fondo oscuro) no se puede guardar, y el
  servidor tampoco lo acepta.
- Para imprimir: **PDF de todas** (hoja carta, cada mesa a su tamaño, centradas) y, en «Ver QR» de
  una mesa, **PNG** (300 ppp), **SVG** (en mm) y **PDF** de esa mesa. Antes de cada exportación,
  cada QR se lee con jsQR en cuatro condiciones —tal cual, pequeño, girado 3°, como foto
  comprimida— y tiene que decir EXACTAMENTE la dirección de su mesa; si uno falla, no sale ninguno
  y se dice cuál y en qué prueba.
- **El contenido del QR no cambia**: sigue siendo la dirección con el token de la mesa. Ningún QR
  ya impreso deja de servir.

## De dónde sale el motor

Del estudio de Miguel, `M1gu3hb/Morphiq-QRs` (sólo lectura), portado a TypeScript estricto en
`packages/domain/src/qr/`: 18 estilos de módulos, 9 de esquinas, 7 centros, degradados, logo al
centro con ventana segura (los módulos de alineación, tiempo y formato quedan visibles encima) y
43 marcos. Puro: sin DOM ni archivos. Se comparó contra el original con 55 181 dibujos y salió
idéntico. Quedó fuera lo que no sirve a una mesa: los 13 tipos de contenido, proyectos, lotes por
CSV, la PWA, siluetas y arte de fondo. Un id de marco desconocido ahora falla en vez de caer en el
primero.

La codificación (la matriz) la sigue haciendo `qrcode`, la librería que ya dibujaba los QR; con
logo, la corrección de errores sube a la alta (H).

## Licencias

| Pieza                      | Licencia   | Cómo se usa                                                                                  |
| -------------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| Morphiq-QRs                | De Miguel  | Portado (geometría y marcos)                                                                 |
| `qrcode` 1.5               | MIT        | Ya estaba: codifica la matriz                                                                |
| `jsqr` 1.4                 | Apache-2.0 | Nuevo: lee el QR antes de exportar. Su licencia se sirve en `/licencias/jsQR-Apache-2.0.txt` |
| `jspdf` 4.2                | MIT        | Ya estaba (corte de caja): arma el PDF                                                       |
| `fflate` 0.8               | MIT        | Ya estaba, como dependencia de `jspdf`                                                       |
| `svg2pdf.js`               | MIT        | No se trajo: el PDF lleva cada QR como imagen a 300 ppp                                      |
| Simple Icons (del estudio) | CC0        | No se trajo                                                                                  |
| qrcodegen (Nayuki)         | MIT        | No se copió: las posiciones de alineación salen de la tabla E.1 de ISO/IEC 18004             |

## Archivos

| Archivo                                                   | Qué                                                     |
| --------------------------------------------------------- | ------------------------------------------------------- |
| `packages/domain/src/qr/*` (+11 pruebas, 487 casos)       | El motor de diseño, puro                                |
| `packages/app/src/portal/qr-de-mesas.ts` (+test)          | La forma del diseño, validada al guardar                |
| `packages/app/src/puente/configuracion.ts`                | `qr_de_mesas` editable y validada                       |
| `packages/app/src/portal/qr-de-mesas.integracion.test.ts` | Contra Postgres                                         |
| `apps/web/src/restaurante/qr-de-mesas/*`                  | Diseño, codificación, lectura, medidas, PDF y pantallas |
| `apps/web/heredado/components/portalqr/MesasQRTab.jsx`    | El panel arriba y el QR con diseño en cada tarjeta      |
| `apps/web/heredado/components/portalqr/QRMesaDialog.jsx`  | Vista con diseño y PNG/SVG/PDF revisados                |
| `apps/web/heredado/components/portalqr/QRCanvas.jsx`      | Borrado: ya nadie lo usaba                              |
| `apps/web/public/licencias/jsQR-Apache-2.0.txt`           | La licencia de jsQR, servida                            |
| `pruebas/e2e/qr-de-mesas.spec.ts`                         | Navegador (escritorio, tablet y teléfono)               |

## Migraciones

Ninguna: `configuracion.valores.qr_de_mesas` (`{ general, porMesa: { [mesaId]: diseño } }`, hasta
50 mesas con diseño propio).

## Genérico o de Don Poncho

Genérico. Don Poncho no trae un diseño guardado: hasta que el dueño diseñe, sus QR salen como
siempre (negro sobre blanco) y con el mismo contenido.

## Cómo portarlo

1. Copiar `packages/domain/src/qr/` y su export `./qr` en `packages/domain/package.json`.
2. Copiar `packages/app/src/portal/qr-de-mesas.ts` y registrar la clave en el puente de
   configuración.
3. Copiar `apps/web/src/restaurante/qr-de-mesas/`, agregar `jsqr` a la app y servir su licencia.
4. En el heredado: el panel y el QR con diseño en la pestaña de mesas y en el diálogo de la mesa.
5. Correr unidad, integración y la e2e.
