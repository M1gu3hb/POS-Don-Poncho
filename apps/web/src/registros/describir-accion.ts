/**
 * DP-15 · Cada renglón de la auditoría, dicho como lo diría el dueño. DP-15.1: todas las acciones
 * de los grupos del filtro (`domain/auditoria`) tienen su frase; lo demás se dice por su familia
 * («Movimiento de venta») y, si ni eso, «Otro cambio registrado»: nunca el nombre crudo del comando.
 */

type Payload = Readonly<Record<string, unknown>>;

const texto = (valor: unknown): string =>
  typeof valor === 'string'
    ? valor
    : typeof valor === 'number' || typeof valor === 'boolean'
      ? String(valor)
      : '';

const PESOS = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

/** «150000» centavos → «$1,500.00». Lo que no es un número entero de centavos no se inventa. */
function dinero(centavos: unknown): string {
  const valor =
    typeof centavos === 'string' || typeof centavos === 'number' ? Number(centavos) : NaN;
  return Number.isFinite(valor) ? PESOS.format(valor / 100) : 'un monto';
}

/** «: Cortesía» si el payload trae un motivo; nada si no. */
const conMotivo = (p: Payload): string =>
  texto(p['motivo']) === '' ? '' : `: ${texto(p['motivo'])}`;

const ORIGENES_DE_CAMBIO: Readonly<Record<string, string>> = {
  banco: 'del banco',
  caja_chica: 'de la caja chica',
  dueno: 'del dueño',
  otra_caja: 'de otra caja',
};

const MOVIMIENTOS_DE_CAJA: Readonly<Record<string, string>> = {
  gasto: 'Gasto',
  retiro: 'Retiro de efectivo',
  ajuste: 'Ajuste de caja',
};

const FAMILIAS: Readonly<Record<string, string>> = {
  venta: 'Movimiento de venta',
  caja: 'Movimiento de caja',
  inventario: 'Cambio de inventario',
  catalogo: 'Cambio del catálogo',
  compras: 'Movimiento de compras',
  gastos: 'Movimiento de gastos',
  restaurante: 'Movimiento del salón',
  configuracion: 'Cambio de configuración',
  identidad: 'Cambio de personas',
  propinas: 'Movimiento de propinas',
  credito: 'Movimiento de crédito',
  cliente: 'Cambio de clientes',
};

const DESCRIPCIONES: Readonly<Record<string, (p: Payload) => string>> = {
  'caja.nombrar_terminal': (p) =>
    `Cambió el nombre de una caja: «${texto(p['antes'])}» → «${texto(p['despues'])}»`,
  'caja.fijar_cajas_simultaneas': (p) =>
    `Cajas abiertas a la vez: ${texto(p['antes'])} → ${texto(p['despues'])}`,
  'caja.fijar_umbral_de_retiro': (p) =>
    p['despues'] === null || p['despues'] === undefined
      ? 'Dejó de pedir PIN de gerente en los retiros'
      : `Pide PIN de gerente en retiros mayores a ${dinero(p['despues'])}`,
  'catalogo.marcar_agotado': (p) =>
    p['agotado'] === true
      ? `Marcó «${texto(p['nombre'])}» agotado por hoy`
      : `Volvió a ofrecer «${texto(p['nombre'])}»`,
  'identidad.establecer_pin': (p) => `Cambió el PIN de ${texto(p['nombre']) || 'una persona'}`,
  'identidad.guardar_empleado': (p) =>
    `Guardó a ${texto(p['nombre']) || 'una persona'}${texto(p['rol']) ? ` (${texto(p['rol'])})` : ''}`,
  'caja.movimiento': (p) =>
    `${MOVIMIENTOS_DE_CAJA[texto(p['tipo'])] ?? 'Movimiento de efectivo'} de ${dinero(p['montoCentavos'])}${conMotivo(p)}${p['autorizadoPor'] === undefined ? '' : ' (con PIN de gerente)'}`,
  'caja.entrada_cambio': (p) =>
    `Entró cambio a la caja: ${dinero(p['montoCentavos'])}${ORIGENES_DE_CAMBIO[texto(p['origen'])] === undefined ? '' : ` (${ORIGENES_DE_CAMBIO[texto(p['origen'])] ?? ''})`}`,
  'venta.aplicar_descuento': (p) =>
    `Descuento de ${dinero(p['descuentoCentavos'])} en una venta${conMotivo(p)}`,
  'restaurante.descontar_cuenta': (p) =>
    `Descuento de ${dinero(p['descuentoCentavos'])} en una cuenta${conMotivo(p)}`,
  'restaurante.cancelar_orden': (p) => `Canceló una cuenta${conMotivo(p)}`,
  'restaurante.anular_linea': (p) =>
    `Anuló un platillo de la cuenta${p['importeAnuladoCentavos'] === undefined ? '' : ` (${dinero(p['importeAnuladoCentavos'])})`}${conMotivo(p)}`,
  'venta.devolver_venta': (p) =>
    `Devolvió ${dinero(p['montoCentavos'])} de una venta${conMotivo(p)}`,
  'configuracion.guardar': (p) =>
    p['impuestoPuntosBase'] === undefined
      ? 'Guardó la configuración del negocio'
      : `Guardó la configuración del negocio (impuesto ${String(Number(p['impuestoPuntosBase']) / 100)} %)`,
  'configuracion.fijar_apariencia': () => 'Cambió la apariencia del sistema',
  'configuracion.fijar_modulo': (p) =>
    `${p['activo'] === false ? 'Apagó' : 'Encendió'} el módulo «${texto(p['modulo'])}»`,
  'configuracion.restablecer_modulo': (p) => `Restableció el módulo «${texto(p['modulo'])}»`,
  'configuracion.fijar_termino': (p) =>
    `Cambió cómo se llama «${texto(p['entidad'])}» → «${texto(p['singular'])}»`,
  'configuracion.restablecer_termino': (p) => `Restableció el nombre de «${texto(p['entidad'])}»`,
  'propinas.guardar_esquema': (p) =>
    `Guardó el reparto de propinas${texto(p['nombre']) === '' ? '' : ` «${texto(p['nombre'])}»`}`,
  'configuracion.permitir_descuentos': (p) =>
    p['permitir'] === false ? 'Apagó los descuentos' : 'Encendió los descuentos',
};

/**
 * DP-15.1 · La auditoría también guarda lo que el servidor NEGÓ (`comando.ts`, `registrarRechazo`:
 * `resultado` denegado, conflicto o error). Sin marca, un «Cambió el PIN de Mesero 1» que en
 * realidad se rechazó se leía como hecho: justo lo contrario de lo que se busca en una auditoría.
 */
const CAUSA_DEL_RECHAZO: Readonly<Record<string, string>> = {
  denegado: 'sin permiso',
  conflicto: 'conflicto',
  error: 'error',
};

function describirLoHecho(accion: string, p: Payload): string {
  const describir = Object.hasOwn(DESCRIPCIONES, accion) ? DESCRIPCIONES[accion] : undefined;
  if (describir !== undefined) return describir(p);
  const familia = accion.split('.')[0] ?? '';
  return (
    (Object.hasOwn(FAMILIAS, familia) ? FAMILIAS[familia] : undefined) ?? 'Otro cambio registrado'
  );
}

export function describirAccion(accion: string, payload: unknown): string {
  const p: Payload =
    typeof payload === 'object' && payload !== null && !Array.isArray(payload)
      ? (payload as Payload)
      : {};
  const dicho = describirLoHecho(accion, p);
  const resultado = p['resultado'];
  const causa =
    typeof resultado === 'string' && Object.hasOwn(CAUSA_DEL_RECHAZO, resultado)
      ? CAUSA_DEL_RECHAZO[resultado]
      : undefined;
  return causa === undefined ? dicho : `Intento rechazado (${causa}): ${dicho}`;
}
