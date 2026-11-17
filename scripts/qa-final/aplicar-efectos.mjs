#!/usr/bin/env node
/**
 * DP-22 · Fase D · pone en `qa/qa-final/datos/efectos.json` el estado y las pruebas de cada ajuste,
 * según lo que la Fase D demostró. Es un guion de una sola vez: la fuente de verdad es el JSON; esto
 * sólo lo llena con las decisiones de abajo (y se puede volver a correr sin efectos secundarios).
 *
 * Estados: `comprobado` (una prueba que se vio fallar con un mutante demuestra el efecto del
 * servidor y no queda parte sin ver), `por ver en navegador` (el efecto es de una pantalla o del
 * papel; la parte del servidor, si la hay, queda citada) y `por comprobar` (nadie lo demuestra aún).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as prettier from 'prettier';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUTA = join(RAIZ, 'qa/qa-final/datos/efectos.json');

const QA = 'packages/app/src/qa-final';
const TERNAS = `${QA}/dinero-ternas.integracion.test.ts#cada combinación de dinero, de la mesa al corte`;
const PARES = `${QA}/pares.integracion.test.ts#cada par de ajustes, con su flujo corto y lo que el servidor hace con ellos`;
const CAMBIOS = `${QA}/cambios-a-media-operacion.integracion.test.ts`;

const comprobado = (pruebas, nota) => ({
  estado: 'comprobado',
  pruebas,
  ...(nota ? { nota } : {}),
});
const navegador = (pruebas, nota) => ({
  estado: 'por ver en navegador',
  pruebas,
  ...(nota ? { nota } : {}),
});
const pendiente = (pruebas, nota) => ({
  estado: 'por comprobar',
  pruebas,
  ...(nota ? { nota } : {}),
});

const PORTAL = 'packages/app/src/portal';
const DECISIONES = {
  impuesto: comprobado(
    [
      TERNAS,
      'packages/app/src/configuracion/impuesto.integracion.test.ts#«Sin IVA»: la cuenta queda con impuestos en 0 y el total son los renglones',
      `${CAMBIOS}#4 · cambiar el IVA con cuentas abiertas`,
    ],
    'Mutante: el total sin sumar el IVA (`totales.ts`) hace caer las combinaciones de IVA sumado.',
  ),
  propina_la_elige_caja: comprobado([
    'packages/app/src/propinas/una-sola-verdad.integracion.test.ts#si la Caja no elige en este negocio, su comando se niega',
    PARES,
    `${CAMBIOS}#5 · cambiar quién elige la propina con cuentas pidiendo la cuenta`,
  ]),
  propina_la_elige_mesero: comprobado([
    'packages/app/src/propinas/una-sola-verdad.integracion.test.ts#con la casilla del mesero, la escribe; y la Caja ya no la pisa sin «Cambiarla»',
    TERNAS,
    PARES,
  ]),
  propinas_activas: comprobado(
    [`${QA}/ajustes-solos.integracion.test.ts#propinas_activas`],
    'Mutante: `quienPuedeElegirEn` sin leer la bandera.',
  ),
  portal_qr_permitir_propina_cliente: comprobado([
    'packages/app/src/propinas/una-sola-verdad.integracion.test.ts#quién puede elegir la propina (M12)',
    'packages/app/src/propinas/una-sola-verdad.integracion.test.ts#el portal elige primero: la Caja recibe 409 con la vigente; «Cambiarla» sí la cambia',
  ]),
  descuentos_permitidos: comprobado(
    [
      PARES,
      'packages/app/src/restaurante/descuento-con-clave.integracion.test.ts#todo descuento pide la clave de quien autoriza',
    ],
    'Mutante: `exigirDescuentosPermitidos` sin leer la bandera (17 de 27 pares caen).',
  ),
  comision_terminal_bp: comprobado([
    'packages/app/src/caja/corte-de-la-caja.integracion.test.ts#el administrador lo enciende: el cajero ve costos y el corte trae la tasa',
    PARES,
  ]),
  mostrar_costos_a_caja: comprobado(
    [
      'packages/app/src/caja/corte-de-la-caja.integracion.test.ts#apagarlo vuelve a esconder los costos al cajero',
      PARES,
    ],
    'Mutante: la cajera siempre ve costos (11 de 27 pares caen).',
  ),
  nombres_de_cajas: comprobado([
    'packages/app/src/caja/lugares.integracion.test.ts#caja.nombrar_cajas',
    `${CAMBIOS}#6 · cambiar el cupo o el nombre de las cajas con cajas abiertas`,
    PARES,
  ]),
  retiro_pin_arriba_de_centavos: comprobado([
    'packages/app/src/caja/retiro-con-pin.integracion.test.ts#hasta el umbral (inclusive) no pide PIN; arriba sin PIN se niega',
    'packages/app/src/caja/retiro-con-pin.integracion.test.ts#apagar el umbral (null) vuelve a no pedir PIN',
  ]),
  folios: comprobado([
    'packages/app/src/configuracion/folios.integracion.test.ts#el contador queda listo: la primera cuenta es la 1001 y el primer corte el 101, sin huecos',
    'packages/app/src/configuracion/folios.integracion.test.ts#«1001», «01001», «DP-01001» y «A-1001» devuelven la misma cuenta; otro prefijo, no',
  ]),
  rfc: comprobado([
    'packages/app/src/caja/corte-de-la-caja.integracion.test.ts#uno con la forma de RFC se guarda y el corte lo imprime',
  ]),
  portal_qr_activo: comprobado(
    [`${QA}/portal-apagado.integracion.test.ts#apagar el portal con carritos abiertos`, PARES],
    'Mutante: `exigirPortalAbierto` y `puedeOrdenarDesdeQR` sin la bandera.',
  ),
  portal_qr_envia_a_cocina: comprobado([
    `${PORTAL}/carrito-sin-cuenta.integracion.test.ts#quién manda a cocina (DP-12.2)`,
  ]),
  portal_qr_comensales_abren_mesa: comprobado([
    `${PORTAL}/carrito-sin-cuenta.integracion.test.ts#también los comensales y pueden abrir: enviar abre la mesa y manda, con confirmación de 2+`,
    `${PORTAL}/carrito-sin-cuenta.integracion.test.ts#también los comensales, con la mesa cerrada y sin poder abrirla: piden que los atiendan`,
  ]),
  portal_qr_mostrar_precios: comprobado([
    `${PORTAL}/carrito-sin-cuenta.integracion.test.ts#sin «Mostrar precios», la respuesta tampoco los trae`,
  ]),
  asignacion_mesas_activa: comprobado(
    [
      `${PORTAL}/sin-asignacion.integracion.test.ts#sin asignación de mesas`,
      `${PORTAL}/sin-asignacion.integracion.test.ts#con la asignación encendida`,
    ],
    'Lo del servidor y el portal. Que el mesero sólo VEA sus mesas es de la pantalla (`asignacionMesas.js`): por ver en navegador.',
  ),
  copias_de_impresion: navegador(
    [
      'packages/app/src/venta/impresion-del-ticket.integracion.test.ts#caja.fijar_copias_de_impresion',
      PARES,
    ],
    'El servidor lo guarda y lo lee (probado); cuántas copias salen del papel es del navegador.',
  ),
  estaciones_preparacion_activas: navegador(
    [
      'packages/app/src/restaurante/estacion-de-cada-comanda.integracion.test.ts#el mesero: cada platillo a la estación de su categoría',
      'pruebas/e2e/estaciones-de-cocina.spec.ts',
      PARES,
    ],
    'Las comandas nacen con su estación con la bandera en cualquier valor (probado); lo que cambia es lo que Cocina DIBUJA.',
  ),
  papel_a_tu_gusto: navegador(
    [
      'packages/app/src/caja/papel-a-tu-gusto.integracion.test.ts#caja.fijar_papel_a_tu_gusto',
      PARES,
    ],
    'El servidor lo guarda completo o con la lista mínima (probado); qué renglones salen en el papel es del navegador.',
  ),
  candado_de_mando_min: navegador(
    ['pruebas/e2e/pin-al-abrir.spec.ts', PARES],
    'El servidor lo guarda en 5 y en 30 (probado); el candado que se cierra es de la pantalla.',
  ),
  qr_de_mesas: navegador(
    [
      'packages/app/src/portal/qr-de-mesas.integracion.test.ts#el dueño guarda un diseño general y uno propio de una mesa',
      'pruebas/e2e/qr-de-mesas.spec.ts',
    ],
    'Se guarda y se valida en el servidor; el QR impreso es del navegador.',
  ),
  portal_qr_modo_menu: navegador(
    [
      `${PORTAL}/botones.integracion.test.ts`,
      'pruebas/e2e/restaurante-menu-personalizado.spec.ts',
      PARES,
    ],
    'Se guarda y se lee; el menú que se pinta es de la pantalla.',
  ),
  portal_qr_cuenta_modo: navegador([
    `${PORTAL}/portal-desde-fuera.integracion.test.ts`,
    'pruebas/e2e/restaurante-portal-qr.spec.ts',
    PARES,
  ]),
  portal_qr_permitir_pedidos_cliente: comprobado([
    `${PORTAL}/sin-asignacion.integracion.test.ts#pide, y su pedido sale a cocina`,
    `${PORTAL}/carrito-sin-cuenta.integracion.test.ts#quién manda a cocina (DP-12.2)`,
  ]),
  portal_qr_botones: navegador([
    `${PORTAL}/botones.integracion.test.ts`,
    'pruebas/e2e/botones-del-menu-qr.spec.ts',
  ]),
  portal_qr_tema: navegador([
    `${PORTAL}/botones.integracion.test.ts`,
    'pruebas/e2e/botones-del-menu-qr.spec.ts',
  ]),
  portal_qr_permitir_ayuda: pendiente(
    [
      `${PORTAL}/sin-asignacion.integracion.test.ts#llama al mesero, y el mesero que lo atiende se queda con la mesa y su cuenta`,
    ],
    'La ayuda funciona encendida; falta la prueba con la casilla APAGADA.',
  ),
  portal_qr_permitir_cuenta: pendiente(
    [],
    'Sin prueba propia: falta apagarla y ver que «Pedir cuenta» no se ofrece ni se acepta.',
  ),
  portal_qr_permitir_ordenar: pendiente([], 'Sin prueba propia.'),
  portal_qr_mostrar_precuenta: pendiente([], 'Sin prueba propia.'),
  portal_qr_mostrar_sin_imagen: navegador([], 'Es sólo de cómo se pinta el menú.'),
  portal_qr_mensaje_bienvenida: navegador([], 'Es sólo un texto del portal.'),
  propina_porcentajes_sugeridos: navegador(
    [
      'packages/app/src/configuracion/configuracion.test.ts',
      'qa/qa-final/propiedades/dinero.propiedades.test.ts#la propina del diálogo de la Caja (pesos en punto flotante) = la del oráculo, al centavo',
    ],
    'Los porcentajes se ofrecen en la Caja y el portal; la cuenta de cada uno es exacta (hallazgo 3, arreglado).',
  ),
  unidades_medida_lista: pendiente([], 'Sin prueba: sólo la lee la pantalla de insumos.'),
  operacion_desde: comprobado([
    'packages/app/src/configuracion/folios.integracion.test.ts#con una sola cuenta posterior al arranque, aunque no tenga folio, se niega; el prefijo no',
  ]),
};

const VISUALES = [
  'ancho_papel_ticket',
  'background_fit',
  'background_image_url',
  'background_logo_url',
  'background_opacity',
  'cocina_alerta_ambar_min',
  'cocina_alerta_roja_min',
  'color_acento',
  'color_primario',
  'colorear_importes_monetarios',
  'correo',
  'descargar_pdf_corte_auto',
  'direccion',
  'footer_text',
  'logo_pdf_url',
  'logo_ticket_url',
  'logo_url',
  'mensaje_ticket',
  'mostrar_logo_ticket',
  'nombre_negocio',
  'nombre_sistema',
  'pdf_footer',
  'platform_brand',
  'telefono',
  'ticket_footer',
  'silenciar_notificaciones_admin',
  'experiencia.mascota',
  'experiencia.pin_al_despertar',
  'experiencia.sonidos_en_el_portal',
  'experiencia.tecla',
  'mh_cocina_voz_config',
  'mh_mesero_alert_config',
  'mh_theme',
  'mh_voice_manual',
  'mh_voice_rate',
  'morphiqpos.cocina-anuncia',
  'morphiqpos.modo-espera',
  'morphiqpos.sonidos',
  'mpos.barra-lateral',
];

async function main() {
  const efectos = JSON.parse(readFileSync(RUTA, 'utf8'));
  for (const [clave, decision] of Object.entries(DECISIONES)) {
    if (efectos[clave] === undefined) throw new Error(`El mapa no tiene «${clave}».`);
    efectos[clave] = { ...efectos[clave], ...decision, pruebas: decision.pruebas };
  }
  for (const clave of VISUALES) {
    const actual = efectos[clave];
    if (actual === undefined) throw new Error(`El mapa no tiene «${clave}».`);
    if (DECISIONES[clave] !== undefined) continue;
    efectos[clave] = {
      ...actual,
      estado: 'por ver en navegador',
      nota:
        actual.pruebas.length === 0
          ? 'Efecto puramente visual o de un aparato: sin prueba de servidor; se ve en el navegador.'
          : 'Efecto de pantalla o de papel; las pruebas citadas cubren lo que hay de lógica.',
    };
  }
  const opciones = (await prettier.resolveConfig(RUTA)) ?? {};
  writeFileSync(
    RUTA,
    await prettier.format(JSON.stringify(efectos), { ...opciones, filepath: RUTA }),
  );
  const cuenta = {};
  for (const e of Object.values(efectos)) cuenta[e.estado] = (cuenta[e.estado] ?? 0) + 1;
  console.log(cuenta);
}

await main();
