/**
 * DP-15 · Cada renglón de la auditoría, dicho como lo diría el dueño. Lo conocido se escribe en
 * palabras; lo demás sale con el nombre del comando, para que nada quede escondido.
 */

type Payload = Readonly<Record<string, unknown>>;

const texto = (valor: unknown): string =>
  typeof valor === 'string'
    ? valor
    : typeof valor === 'number' || typeof valor === 'boolean'
      ? String(valor)
      : '';

const DESCRIPCIONES: Readonly<Record<string, (p: Payload) => string>> = {
  'caja.nombrar_terminal': (p) =>
    `Cambió el nombre de una caja: «${texto(p['antes'])}» → «${texto(p['despues'])}»`,
  'caja.fijar_cajas_simultaneas': (p) =>
    `Cajas abiertas a la vez: ${texto(p['antes'])} → ${texto(p['despues'])}`,
  'catalogo.marcar_agotado': (p) =>
    p['agotado'] === true
      ? `Marcó «${texto(p['nombre'])}» agotado por hoy`
      : `Volvió a ofrecer «${texto(p['nombre'])}»`,
  'identidad.establecer_pin': (p) => `Cambió el PIN de ${texto(p['nombre']) || 'una persona'}`,
  'identidad.guardar_empleado': (p) =>
    `Guardó a ${texto(p['nombre']) || 'una persona'}${texto(p['rol']) ? ` (${texto(p['rol'])})` : ''}`,
  'configuracion.permitir_descuentos': (p) =>
    p['permitir'] === false ? 'Apagó los descuentos' : 'Encendió los descuentos',
};

export function describirAccion(accion: string, payload: unknown): string {
  const p: Payload =
    typeof payload === 'object' && payload !== null && !Array.isArray(payload)
      ? (payload as Payload)
      : {};
  const describir = DESCRIPCIONES[accion];
  return describir === undefined ? accion : describir(p);
}
