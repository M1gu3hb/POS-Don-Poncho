import { z } from 'zod';

/**
 * Las entradas de los cinco comandos de restaurante.
 *
 * **Ninguna acepta un importe.** Es la primera línea del encargo: «Precios y
 * totales SIEMPRE en el servidor. El endpoint no acepta importes del cliente.»
 * Enviar un pedido recibe producto, cantidad y unidad; el precio lo pone el
 * catálogo dentro de la misma transacción que escribe la línea.
 *
 * **Ninguna acepta un rol ni un ámbito.** `definirComando` lo rechaza al cargar
 * el módulo (R16), así que esto no es una promesa: es un módulo que no arranca
 * si se incumple.
 *
 * Lo único que se parece a un porcentaje y sí entra es la propina que el mesero
 * eligió antes de imprimir la precuenta, y entra en PUNTOS BASE enteros, no en
 * pesos: `propina_monto` no existe como columna de `ordenes` — la propina vive
 * en `pagos`, en otra tabla, y por eso no hay forma de inflar el total con ella
 * (F1-04 §6.1, regla 1 de `F1-01` §3).
 */

/** Cantidad como cadena decimal: `numeric(14,4)` en la base, nunca un float (R15). */
const cantidadDecimal = z
  .string()
  .regex(/^\d{1,10}(\.\d{1,4})?$/, {
    error: 'La cantidad debe ser un decimal de hasta cuatro cifras.',
    // Sin `abort`, zod 4 corre el `refine` aunque esto no pase, y su `BigInt` LANZA.
    abort: true,
  })
  .refine((v) => BigInt(v.replace('.', '')) > 0n, 'La cantidad debe ser mayor que cero.');

const texto = (maximo: number) => z.string().trim().max(maximo);

/** Una mesa de restaurante: hasta 999 comensales es absurdo, 99 ya lo es. */
const personas = z.number().int().min(1).max(99);

export const entradaAbrirMesa = z.object({
  mesaId: z.uuid(),
  personas,
  clienteNombre: texto(120).optional(),
  /**
   * Instantánea que viaja a la orden Y a cada comanda: la cocina tiene que
   * verla sin consultar la mesa (`F1-04` §10.2).
   */
  notasAlergias: texto(300).optional(),
  celebracionEspecial: z.boolean().default(false),
  tipoCelebracion: texto(60).optional(),
  notas: texto(300).optional(),
});

export const entradaLiberarMesa = z.object({
  mesaId: z.uuid(),
  /**
   * DP-9.6 · Sólo para la principal de mesas unidas: al limpiarla, ¿separarlas (cada una vuelve
   * a donde estaba) o dejarlas unidas para el siguiente cliente?
   */
  grupo: z.enum(['separar', 'mantener']).optional(),
});

/** DP-14.6-3 · La elección de opciones de una línea: por grupo, los ids elegidos. */
export const entradaOpciones = z
  .array(z.object({ grupoId: z.uuid(), opcionIds: z.array(z.uuid()).max(30) }))
  .max(20);

export const entradaEnviarPedido = z.object({
  ordenId: z.uuid(),
  lineas: z
    .array(
      z.object({
        productoId: z.uuid(),
        cantidad: cantidadDecimal,
        /** Para peso y porción. Si falta, la decide el catálogo. */
        unidad: z.string().trim().min(1).max(12).optional(),
        notas: texto(300).optional(),
        /**
         * F-323 · En qué tiempo va este plato: 1 entrada, 2 fuerte, 3 postre.
         *
         * Lo decide el MENÚ (`productos.tiempo_servicio_default`) y el mesero lo
         * puede cambiar aquí, porque la mesa que pide el postre primero existe.
         * No es un dato de dinero: no cambia lo que se cobra, sólo cuándo sale
         * de la cocina.
         */
        tiempoServicio: z.number().int().min(1).max(6).optional(),
        /**
         * DP-14.6-3 · Lo que se eligió de cada grupo de opciones del platillo, ESTRUCTURADO. Sin
         * esto el servidor lee la elección de la nota («Grupo: opción»), pero un grupo obligatorio
         * sin elegir se rechaza de cualquier forma (`OPCION_OBLIGATORIA`).
         */
        opciones: entradaOpciones.optional(),
      }),
    )
    .min(1)
    .max(60),
  /** Nota de la comanda entera («sin picante en toda la mesa»). */
  notas: texto(300).optional(),
});

export const entradaTransicionarPedido = z.object({
  comandaId: z.uuid(),
  /**
   * Cuando viene, se mueve SÓLO ese plato y la comanda queda en el estado que
   * digan sus items —el menos avanzado— en vez de arrastrarlos a todos.
   *
   * Es la razón por la que `items` dejó de ser un arreglo `jsonb`: la cocina
   * marca plato por plato con dos pantallas abiertas (F1-04 §10.1).
   */
  comandaItemId: z.uuid().optional(),
  /**
   * `nuevo` no está: es el estado con el que nace la comanda y volver a él
   * sería el retroceso que la versión monotónica existe para impedir.
   */
  estado: z.enum(['en_preparacion', 'listo', 'entregado', 'cancelado']),
});

export const entradaEntregarPedidos = z.object({
  ordenId: z.uuid(),
});

export const entradaCancelarOrden = z.object({
  ordenId: z.uuid(),
  /**
   * OBLIGATORIO, y por dos razones. La primera es el `check
   * orden_cancelada_con_motivo` (003:162): una cancelación sin motivo no entra
   * en la base. La segunda es que cancelar una cuenta con consumo hace
   * desaparecer dinero del corte, y el corte tiene que poder decir por qué.
   */
  motivo: z.string().trim().min(3).max(300),
  /**
   * DP-13.2 · Con la cuenta ya pedida o impresa, el PIN de un gerente o del dueño firmado para ESTA
   * cuenta (`/api/identidad/supervisor` con `ordenId` y `para: 'cancelacion'`).
   */
  autorizacion: z.string().min(20).max(2000).optional(),
  /**
   * DP-14.6-7 · La Caja no pudo leer lo que la cocina ya preparó (la lectura venció o falló). Se
   * cancela igual, con el PIN de un gerente o del dueño (`autorizacion`), y TODO lo vivo de la
   * cuenta cuenta como ya hecho: pérdida en el corte y merma en el almacén.
   */
  sinComprobarLaCocina: z.literal(true).optional(),
  /**
   * DP-18 (A19) · Sólo para la cuenta de la principal de mesas unidas: al cancelarla, ¿separarlas
   * (cada mesa vuelve a su lugar) o dejarlas unidas? Es la MISMA pregunta de `liberar_mesa`
   * (`entradaLiberarMesa.grupo`). Sin respuesta queda como en DP-9.6: las mesas quedan libres y
   * la unión abierta, igual que con `'mantener'`.
   */
  grupo: z.enum(['separar', 'mantener']).optional(),
});

export const entradaSolicitarCuenta = z.object({
  ordenId: z.uuid(),
  /**
   * Lo que el mesero eligió en el diálogo de propina, en puntos base enteros:
   * `62.5 %` es `6250`. `0.16` no existe exacto en punto flotante; los puntos
   * base sí (F1-04, transformación T-PORCENTAJE).
   */
  propinaPuntosBase: z.number().int().min(0).max(10_000).optional(),
  propinaTipo: z
    .enum([
      'sin_propina',
      'porcentaje',
      'monto_manual',
      'pendiente',
      'pendiente_cliente',
      'decidir_en_caja',
    ])
    .optional(),
});
