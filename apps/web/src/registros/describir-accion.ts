/**
 * DP-15 · Cada renglón de la auditoría, dicho como lo diría el dueño. DP-15.1: todas las acciones
 * de los grupos del filtro (`domain/auditoria`) tienen su frase; lo demás se dice por su familia
 * («Movimiento de venta») y, si ni eso, «Otro cambio registrado»: nunca el nombre crudo del comando.
 */

import {
  CAMPOS_DEL_PAPEL,
  NOMBRE_DEL_PAPEL,
  folioVisible,
  type ConFolios,
} from '@morphiqpos/domain/venta';

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

/** «folio del ticket de venta, logo de la precuenta» a partir de «ticket.folio», «precuenta.logo». */
function renglonesDelPapel(lista: unknown): string {
  if (!Array.isArray(lista)) return '';
  return lista
    .map((item) => {
      const [papel = '', campo = ''] = texto(item).split('.');
      const nombre = CAMPOS_DEL_PAPEL.find((c) => c.id === campo)?.nombre.toLowerCase();
      const delPapel = (NOMBRE_DEL_PAPEL as Readonly<Record<string, string>>)[papel];
      return nombre === undefined || delPapel === undefined
        ? ''
        : `${nombre} (${delPapel.toLowerCase()})`;
    })
    .filter((x) => x !== '')
    .join(', ');
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

/** DP-20 · Por qué se abrió el cajón sin venta (`caja.abrir_cajon`). */
const MOTIVOS_DEL_CAJON: Readonly<Record<string, string>> = {
  dar_cambio: 'dar cambio',
  guardar_billete: 'guardar un billete',
  conteo: 'conteo',
  otro: 'otro motivo',
};

const objeto = (valor: unknown): Payload =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor) ? (valor as Payload) : {};

/** «16 % incluido en el precio», «8 % sumado al precio» o «sin IVA». */
function ivaEnPalabras(valor: unknown): string {
  const iva = objeto(valor);
  const puntos = Number(iva['puntosBase']);
  if (!Number.isFinite(puntos) || puntos <= 0) return 'sin IVA';
  return `${String(puntos / 100)} % ${iva['incluidoEnPrecio'] === false ? 'sumado al precio' : 'incluido en el precio'}`;
}

/** «comensales y Caja», «comensales, mesero y Caja» o «nadie». */
function quienElige(valor: unknown): string {
  const casillas = objeto(valor);
  const quienes = [
    casillas['comensales'] === true ? 'comensales' : null,
    casillas['mesero'] === true ? 'mesero' : null,
    casillas['caja'] === true ? 'Caja' : null,
  ].filter((q): q is string => q !== null);
  if (quienes.length === 0) return 'nadie';
  if (quienes.length === 1) return quienes[0] ?? 'nadie';
  return `${quienes.slice(0, -1).join(', ')} y ${quienes[quienes.length - 1] ?? ''}`;
}

/** «10 %», «sin propina» o «por decidir». Nunca un importe: la propina se calcula sobre el total. */
function propinaEnPalabras(valor: unknown): string {
  const propina = objeto(valor);
  const tipo = texto(propina['tipo']);
  const puntos = Number(propina['puntosBase']);
  if (tipo === 'sin_propina') return 'sin propina';
  if (Number.isFinite(puntos) && puntos > 0) return `${String(puntos / 100)} %`;
  return 'por decidir';
}

/** Los nombres por lugar; sin nombre, «Caja N». Tantos como tenga la lista más larga de las dos. */
function nombresDeCajas(lista: unknown, laOtra: unknown): string {
  const propia: readonly unknown[] = Array.isArray(lista) ? lista : [];
  const ajena: readonly unknown[] = Array.isArray(laOtra) ? laOtra : [];
  const cuantas = Math.max(propia.length, ajena.length, 1);
  return Array.from({ length: cuantas }, (_, i) => {
    const nombre = texto(propia[i]);
    return `«${nombre === '' ? `Caja ${String(i + 1)}` : nombre}»`;
  }).join(', ');
}

const DESCRIPCIONES: Readonly<
  Record<string, (p: Payload, folios: ConFolios | null | undefined) => string>
> = {
  // DP-21 · Bloque 5: una terminal es un APARATO; la caja es un lugar con su nombre.
  'caja.nombrar_terminal': (p) =>
    `Cambió el nombre de un aparato: «${texto(p['antes'])}» → «${texto(p['despues'])}»`,
  'caja.nombrar_cajas': (p) =>
    `Nombres de las cajas: ${nombresDeCajas(p['antes'], p['despues'])} → ${nombresDeCajas(p['despues'], p['antes'])}`,
  'mantenimiento.renombrar_aparatos': (p) => {
    const omitidos = Number(p['omitidos']) || 0;
    const resto =
      omitidos === 0
        ? ''
        : omitidos === 1
          ? ' (1 se quedó como estaba)'
          : ` (${String(omitidos)} se quedaron como estaban)`;
    return `Renombró ${texto(p['renombrados'])} aparatos de «Caja N» a «Aparato N»${resto}`;
  },
  // DP-21 · Bloque 6 (H1): desde el arranque real, lo cobrado ya no se borra.
  'mantenimiento.activar_operacion': (p) =>
    p['yaEstaba'] === true
      ? 'Pidió activar la operación real: ya estaba activa'
      : 'Activó la operación real: desde aquí lo cobrado ya no se borra',
  'mantenimiento.quitar_bloqueo_de_operacion': () => 'QUITÓ el bloqueo de la operación real',
  // DP-21 · Bloques 1, 2 y 4.
  'configuracion.fijar_impuesto': (p) =>
    `Cambió el IVA: ${ivaEnPalabras(p['antes'])} → ${ivaEnPalabras(p['despues'])}`,
  'configuracion.fijar_candado_de_mando': (p) =>
    `Candado del mando sin uso: ${texto(objeto(p['antes'])['minutos'])} min → ${texto(objeto(p['despues'])['minutos'])} min`,
  'configuracion.fijar_quien_elige_la_propina': (p) =>
    `Quién elige la propina: ${quienElige(p['antes'])} → ${quienElige(p['despues'])}`,
  'cuenta.fijar_propina': (p) =>
    p['cambio'] === true
      ? `La Caja CAMBIÓ la propina que ya estaba elegida: ${propinaEnPalabras(p['antes'])} → ${propinaEnPalabras(p['despues'])}`
      : `La Caja eligió la propina: ${propinaEnPalabras(p['despues'])}`,
  'caja.fijar_cajas_simultaneas': (p) =>
    `Cajas abiertas a la vez: ${texto(p['antes'])} → ${texto(p['despues'])}`,
  'caja.fijar_umbral_de_retiro': (p) =>
    p['despues'] === null || p['despues'] === undefined
      ? 'Dejó de pedir PIN de gerente en los retiros'
      : `Pide PIN de gerente en retiros mayores a ${dinero(p['despues'])}`,
  'caja.abrir_cajon': (p) =>
    `Abrió el cajón sin venta${MOTIVOS_DEL_CAJON[texto(p['motivo'])] === undefined ? '' : ` (${MOTIVOS_DEL_CAJON[texto(p['motivo'])] ?? ''})`}`,
  // La referencia es el número del ticket (una cuenta, serie `A`): se lee como el ticket.
  'caja.cajon_por_cobro': (p, folios) =>
    `Se abrió el cajón al cobrar${texto(p['referencia']) === '' ? '' : ` el ticket ${folioVisible('A', texto(p['referencia']), folios, 'numero')}`}`,
  'caja.fijar_copias_de_impresion': (p) => {
    const despues = (p['despues'] ?? {}) as Payload;
    return `Copias de impresión: ticket ${texto(despues['ticket'])}, precuenta ${texto(despues['precuenta'])}, corte ${texto(despues['corte'])}`;
  },
  'caja.fijar_ajustes_del_corte': (p) => {
    const antes = (p['antes'] ?? {}) as Payload;
    const despues = (p['despues'] ?? {}) as Payload;
    const tasa = (bp: unknown): string =>
      typeof bp === 'number' ? `${(bp / 100).toLocaleString('es-MX')} %` : 'sin tasa';
    const partes: string[] = [];
    if (antes['mostrarCostosACaja'] !== despues['mostrarCostosACaja']) {
      partes.push(
        despues['mostrarCostosACaja'] === true
          ? 'el cajero ahora ve costos y utilidad en su corte'
          : 'el cajero ya no ve costos ni utilidad en su corte',
      );
    }
    if (antes['comisionTerminalBp'] !== despues['comisionTerminalBp']) {
      partes.push(
        `comisión de la terminal: ${tasa(antes['comisionTerminalBp'])} → ${tasa(despues['comisionTerminalBp'])}`,
      );
    }
    return `Corte de la caja: ${partes.length === 0 ? 'sin cambios' : partes.join('; ')}`;
  },
  'caja.fijar_papel_a_tu_gusto': (p) => {
    const apagados = renglonesDelPapel(p['apagados']);
    const encendidos = renglonesDelPapel(p['encendidos']);
    const partes = [
      apagados === '' ? '' : `quitó ${apagados}`,
      encendidos === '' ? '' : `volvió a poner ${encendidos}`,
    ].filter((parte) => parte !== '');
    return `Ticket a su gusto: ${partes.length === 0 ? 'sin cambios' : partes.join('; ')}`;
  },
  'venta.registrar_impresion': (p, folios) =>
    `${p['reimpresion'] === true ? 'Reimprimió' : 'Imprimió'} el ticket${texto(p['folio']) === '' ? '' : ` ${folioVisible(null, texto(p['folio']), folios)}`}${p['reimpresion'] === true ? ` (salida ${texto(p['numero'])})` : ''}`,
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
  'configuracion.fijar_folios': (p) => {
    const antes = (p['antes'] ?? {}) as Payload;
    const despues = (p['despues'] ?? {}) as Payload;
    const prefijo = (f: Payload) =>
      texto(f['prefijo']) === '' ? 'sin prefijo' : `prefijo «${texto(f['prefijo'])}»`;
    return `Folios: ${prefijo(despues)}, primer folio de las cuentas ${texto(despues['primerFolioDeCuentas'])} y de los cortes ${texto(despues['primerFolioDeCortes'])} (antes: ${prefijo(antes)}, ${texto(antes['primerFolioDeCuentas'])} y ${texto(antes['primerFolioDeCortes'])})`;
  },
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

function describirLoHecho(
  accion: string,
  p: Payload,
  folios: ConFolios | null | undefined,
): string {
  const describir = Object.hasOwn(DESCRIPCIONES, accion) ? DESCRIPCIONES[accion] : undefined;
  if (describir !== undefined) return describir(p, folios);
  const familia = accion.split('.')[0] ?? '';
  return (
    (Object.hasOwn(FAMILIAS, familia) ? FAMILIAS[familia] : undefined) ?? 'Otro cambio registrado'
  );
}

export function describirAccion(
  accion: string,
  payload: unknown,
  folios?: ConFolios | null,
): string {
  const p: Payload =
    typeof payload === 'object' && payload !== null && !Array.isArray(payload)
      ? (payload as Payload)
      : {};
  const dicho = describirLoHecho(accion, p, folios);
  const resultado = p['resultado'];
  const causa =
    typeof resultado === 'string' && Object.hasOwn(CAUSA_DEL_RECHAZO, resultado)
      ? CAUSA_DEL_RECHAZO[resultado]
      : undefined;
  return causa === undefined ? dicho : `Intento rechazado (${causa}): ${dicho}`;
}
