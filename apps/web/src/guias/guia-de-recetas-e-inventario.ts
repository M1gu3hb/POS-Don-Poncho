/**
 * LA GUÍA «¿CÓMO FUNCIONA?» DE RECETAS E INVENTARIO (DP-21 · Bloque 17 · M19). UNA sola fuente.
 *
 * De aquí salen las dos cosas que Alejandra y su equipo leen: el panel «¿Cómo funciona?» de la app
 * (`GuiaDeRecetasEInventario.tsx`) y el documento `docs/cliente/GUIA-RECETAS-E-INVENTARIO.md`
 * (`guiaEnMarkdown`, escrito por `scripts/generar-guia-cliente.mjs`). Un contrato compara el
 * documento con esto: si alguien cambia uno sin el otro, la prueba falla.
 *
 * Y cada afirmación trae su ANCLA: el archivo del código (o su prueba) y el texto que lo comprueba.
 * `guia-de-recetas-e-inventario.contrato.test.ts` verifica que el ancla exista. Lo que no se pudo
 * comprobar en el código no está en la guía.
 *
 * Sin dependencias: lo lee el navegador, el contrato y un script de Node.
 */

export interface Ancla {
  /** Desde la raíz del repositorio. */
  readonly archivo: string;
  /** Textos que ese archivo tiene que contener (el título de la prueba, la regla, la etiqueta). */
  readonly contiene: readonly string[];
}

export interface SeccionDeLaGuia {
  readonly id: string;
  readonly titulo: string;
  /** Lo esencial, en una o dos frases. */
  readonly en_corto: string;
  readonly pasos: readonly string[];
  /** Un ejemplo del menú de Don Poncho; las cantidades de una receta las pone cada cocina. */
  readonly ejemplo?: string;
  /** Lo que la guía afirma, con dónde se comprueba. */
  readonly anclas: readonly Ancla[];
}

export const TITULO_DE_LA_GUIA = '¿Cómo funciona? Recetas e inventario';

export const INTRO_DE_LA_GUIA =
  'Así funciona hoy, paso a paso, lo que vendes, compras y cuentas en Don Poncho. Si algo no se parece a lo que ves, avísanos.';

export const SECCIONES_DE_LA_GUIA: readonly SeccionDeLaGuia[] = [
  {
    id: 'receta',
    titulo: 'Crear una receta y dársela a un platillo',
    en_corto:
      'La receta es lo que lleva un platillo. Se hace junto con el platillo, en Recetas, y queda guardada en él.',
    pasos: [
      'Entra a Recetas y toca «Nueva receta».',
      'Escribe el nombre del platillo y su precio.',
      'Toca «Agregar ingrediente» por cada cosa que lleva, y pon cuánto lleva.',
      'La unidad del ingrediente tiene que ser la misma con la que lo cuentas en Inventario (gramos con gramos, piezas con piezas). Si no, no se guarda.',
      'Si al prepararlo se desperdicia algo, escribe la merma de ese ingrediente en por ciento.',
      'Guarda. Desde ese momento, cada vez que se cobre ese platillo se descuentan sus ingredientes.',
    ],
    ejemplo:
      'El «Taco suave de barbacoa» cuesta $95 en tu menú. Su receta lleva la carne y las tortillas; cuánto de cada una lo escribes tú, como lo prepara tu cocina.',
    anclas: [
      {
        archivo: 'apps/web/heredado/pages/Recetas.jsx',
        contiene: ['Nueva receta'],
      },
      {
        archivo: 'apps/web/heredado/components/recetas/RecetaFormDialog.jsx',
        contiene: ['Agregar ingrediente', 'Nombre del producto *', 'Precio de venta *'],
      },
      {
        archivo: 'packages/app/src/inventario/recetas.ts',
        contiene: [
          'La unidad de la receta debe coincidir con la del insumo.',
          'filas.length > 0',
          "'receta'",
        ],
      },
      {
        archivo: 'packages/app/src/venta/consumo-al-cobrar.test.ts',
        contiene: [
          'multiplica la receta por la cantidad vendida',
          'la merma viene en POR CIENTO, no en puntos base',
        ],
      },
      {
        archivo: 'docs/cliente/menu-don-poncho.json',
        contiene: ['"Taco suave de barbacoa"', '"precio": 9500'],
      },
    ],
  },
  {
    id: 'descuento',
    titulo: 'Qué descuenta cada venta, y cuándo',
    en_corto:
      'El inventario baja cuando COBRAS la cuenta, no cuando la cocina prepara el platillo.',
    pasos: [
      'Al cobrar, cada platillo descuenta lo que dice su receta, multiplicado por lo que se vendió: dos tacos descuentan el doble.',
      'Un platillo sin receta ni ingrediente base no descuenta nada.',
      'Lo que se vende por peso no lleva receta: descuenta del «ingrediente base» el peso que se vendió. Un cuarto de kilo baja 250 gramos.',
      'Mientras la cocina prepara, el inventario no se mueve.',
    ],
    ejemplo:
      'La «Barbacoa de horno» se vende a $795 el kilo, en ¼, ½ o 1 kilo. Si un cliente se lleva medio kilo y la cuenta se cobra, bajan 500 gramos del ingrediente que elegiste como base de esa barbacoa.',
    anclas: [
      {
        archivo: 'packages/app/src/venta/cobrar.ts',
        contiene: ["'descontar_stock'", 'Stock ANTES del folio'],
      },
      {
        archivo: 'packages/app/src/restaurante/preparacion.ts',
        // Lo que NO debe contener se declara abajo (`NO_CONTIENEN`).
        contiene: ['transicionarPedido'],
      },
      {
        archivo: 'packages/app/src/venta/cobrar.ts',
        contiene: ['Un producto sin insumo ni receta'],
      },
      {
        archivo: 'packages/app/src/venta/consumo-al-cobrar.test.ts',
        contiene: [
          'multiplica la receta por la cantidad vendida',
          'un producto de receta sin líneas no descuenta, y no revienta la venta',
        ],
      },
      {
        archivo: 'packages/app/src/restaurante/insumo-base-por-peso-y-porcion.integracion.test.ts',
        contiene: [
          'queda con la estrategia insumo_base y la venta baja los gramos del queso',
          'el ingrediente base sin existencias no traba el cobro: queda en negativo para el conteo',
        ],
      },
      {
        archivo: 'docs/cliente/menu-don-poncho.json',
        contiene: ['"Barbacoa de horno"', '"precio": 79500', '"presets": [0.25, 0.5, 1]'],
      },
    ],
  },
  {
    id: 'cancelar',
    titulo: 'Si cancelas algo',
    en_corto:
      'Lo que la cocina todavía no preparó no toca el inventario. Lo que ya estaba hecho sí, porque ya no existe.',
    pasos: [
      'Cancelas una cuenta o quitas un platillo que la cocina NO había preparado: el inventario no cambia.',
      'Cancelas algo que ya estaba listo o entregado: sus ingredientes salen del inventario y quedan anotados como merma «Por cancelación».',
      'Cancelar nunca se traba por el inventario. Si faltaba existencia, queda en negativo para que lo veas al contar.',
      'Si canceló el cliente, la merma no se le carga al empleado.',
    ],
    anclas: [
      {
        archivo: 'packages/app/src/restaurante/merma-por-cancelacion.integracion.test.ts',
        contiene: [
          'la arrachera ya LISTA sale del almacén por su receta; el guacamole sin hacer, no',
          'nada listo: cancelar no toca el almacén',
          'la merma por cancelación lleva un motivo NO imputable',
        ],
      },
      {
        archivo: 'packages/app/src/restaurante/merma-por-cancelacion.ts',
        contiene: [
          'Cancelar nunca se traba por el inventario',
          "NOTA_DE_LA_MERMA = 'Por cancelación'",
        ],
      },
    ],
  },
  {
    id: 'compra',
    titulo: 'Cómo entra una compra al inventario',
    en_corto:
      'Al guardar una compra, lo que compraste se suma al inventario de una vez y el costo del ingrediente se actualiza.',
    pasos: [
      'En Compras y gastos, toca «Registrar compra».',
      'Por cada ingrediente pon cuánto compraste, en qué presentación (cajas, kilos, piezas) y cuánto equivale en la unidad del ingrediente. Tres cajas de 12 kilos son 36 000 gramos.',
      'Pon cuánto costó. El sistema suma las líneas: el total no se captura a mano.',
      'Guarda: la existencia sube y el costo del ingrediente se vuelve el promedio entre lo que ya tenías y lo que acabas de comprar.',
      'Si pagas en efectivo, el dinero sale de la caja abierta; sin caja abierta, la compra en efectivo no se registra.',
      'Los gastos (luz, limpieza, plomero) NO tocan el inventario: sólo las compras.',
    ],
    anclas: [
      {
        archivo: 'apps/web/heredado/pages/Compras.jsx',
        contiene: [
          'Registrar compra',
          'Registrar gasto',
          'Gastos operativos NO afectan el inventario',
        ],
      },
      {
        archivo: 'packages/app/src/compras/linea.ts',
        contiene: ["tipo: 'entrada_compra'", 'existencias.cantidad + excluded.cantidad'],
      },
      {
        archivo: 'packages/app/src/compras/compras.ts',
        contiene: ['recalcularCostosDeLosInsumos', 'const total = totalDeLineas(lineas);'],
      },
      {
        archivo: 'packages/app/src/compras/compras.test.ts',
        contiene: [
          'tres cajas de 12 kg son 36 000 g',
          'con existencia en cero el promedio es el costo de esta compra',
          'pondera contra la existencia anterior con aritmética exacta',
        ],
      },
      {
        archivo: 'packages/app/src/compras/gastos-de-la-caja.integracion.test.ts',
        contiene: ['una compra pagada en efectivo sale del mismo cajón'],
      },
      {
        archivo: 'packages/app/src/compras/sesion-de-caja.ts',
        contiene: ['No hay una caja abierta. Ábrela antes de pagar'],
      },
    ],
  },
  {
    id: 'almacen',
    titulo: 'El almacén principal',
    en_corto:
      'Cada sucursal tiene un almacén principal: ahí entran las compras y de ahí salen las ventas.',
    pasos: [
      'Las compras se reciben en el almacén principal de la sucursal.',
      'Las ventas descuentan de ese mismo almacén.',
      'Si la sucursal todavía no tiene almacén, no se puede registrar una compra. En Compras y gastos aparece un aviso para crearlo con un toque.',
    ],
    anclas: [
      {
        archivo: 'packages/data/src/repos/venta-catalogo.ts',
        contiene: ['El almacén principal de una sucursal: de ahí sale el stock de la venta.'],
      },
      {
        archivo: 'packages/app/src/compras/compras.ts',
        contiene: [
          'Esta sucursal no tiene un almacén donde recibir la compra.',
          'almacenPrincipal',
        ],
      },
      {
        archivo: 'apps/web/heredado/pages/Compras.jsx',
        contiene: ['FaltaElAlmacen'],
      },
    ],
  },
  {
    id: 'conteo',
    titulo: 'El conteo físico y la merma',
    en_corto:
      'Cuando cuentas lo que hay en el estante o tiras algo, lo anotas en Inventario con «Ajustar», y siempre dices por qué.',
    pasos: [
      'En Inventario, en el ingrediente, toca «Ajustar».',
      'Para un conteo físico, elige «Definir stock final (conteo físico)» y escribe lo que contaste: el sistema calcula la diferencia.',
      'Para algo que se tiró o se echó a perder, elige «Merma / producto perdido».',
      'Siempre se pide el motivo. Queda anotado quién lo hizo y cuándo.',
      'Un conteo o una corrección nunca deja la existencia en negativo. Una merma sí puede bajarla más cuando ya estaba en negativo: se registra, y el conteo físico la corrige.',
    ],
    anclas: [
      {
        archivo: 'apps/web/heredado/pages/Inventario.jsx',
        contiene: ['Ajustar stock (merma, conteo físico, corrección)'],
      },
      {
        archivo: 'apps/web/heredado/components/inventario/AjustarStockDialog.jsx',
        contiene: [
          'Definir stock final (conteo físico)',
          'Merma / producto perdido',
          'Indica el motivo del ajuste.',
          'cambio = stockNuevo - stockActual;',
        ],
      },
      {
        archivo: 'packages/app/src/inventario/inventario.ts',
        contiene: [
          'El ajuste dejaría una existencia negativa.',
          "tipo: 'ajuste'",
          'empleado_id: ctx.ambito.empleoId',
        ],
      },
      {
        archivo: 'packages/app/src/inventario/merma.ts',
        contiene: ['and (cantidad + ${delta} >= 0 or cantidad < 0)'],
      },
    ],
  },
  {
    id: 'negativo',
    titulo: 'Qué significa una existencia en negativo',
    en_corto:
      'Quiere decir que se vendió más de lo que el sistema tenía anotado. Casi siempre falta cargar una compra o contar.',
    pasos: [
      'Lo que ya pasó por cocina se cobra siempre: frenar la caja con el cliente enfrente no arregla nada.',
      'Por eso el ingrediente puede quedar en negativo; así lo ves cuando cuentas.',
      'Para arreglarlo, registra la compra que faltaba o haz un conteo físico.',
      'Lo que se vende sin pasar por la cocina sigue la regla de cada producto.',
    ],
    ejemplo:
      'Se cobró medio kilo de una carne que todavía no habías dado de alta en inventario: queda en −500 gramos hasta que registres la compra o la cuentes.',
    anclas: [
      {
        archivo: 'packages/app/src/restaurante/insumo-base-por-peso-y-porcion.integracion.test.ts',
        contiene: [
          'el ingrediente base sin existencias no traba el cobro: queda en negativo para el conteo',
          'expect(await existenciaDe(carneId)).toBe(-500);',
        ],
      },
      {
        archivo: 'packages/app/src/venta/cobrar.ts',
        contiene: [
          'LO QUE PASÓ POR COCINA YA SE PREPARÓ Y SE SIRVIÓ',
          'permiteNegativo: true',
          'Lo que se vende en mostrador sin cocina',
        ],
      },
      {
        archivo: 'DECISIONES.md',
        contiene: ['DP-D116 · Lo que pasó por cocina se cobra aunque el almacén diga que no había'],
      },
    ],
  },
  {
    id: 'valor',
    titulo: 'Cómo se lee el «Valor de inventario»',
    en_corto:
      'Es lo que vale lo que tienes: por cada ingrediente, su existencia por su costo, y todo sumado.',
    pasos: [
      'Por cada ingrediente se multiplica lo que hay por lo que cuesta cada gramo, mililitro o pieza.',
      'El costo sale de tus compras (el promedio de lo que has pagado).',
      'Un ingrediente que tiene existencia pero no tiene costo no entra a la suma: la tarjeta avisa cuántos faltan.',
      'Una existencia en negativo no resta del valor (vale cero, igual que en la valuación): la tarjeta avisa cuántos son; corrígelos con un conteo.',
    ],
    anclas: [
      {
        archivo: 'apps/web/heredado/utils/inventoryUtils.js',
        contiene: [
          'valorDeLaExistencia(ingredient.stock_actual, ingredient.costo_por_unidad_base)',
        ],
      },
      {
        archivo: 'apps/web/heredado/pages/Inventario.jsx',
        contiene: [
          'Valor de inventario',
          'const totalValue = enriched.reduce((s, i) => s + i.valorInventario, 0);',
          'No incluye',
        ],
      },
      {
        archivo: 'apps/web/src/restaurante/valor-de-inventario.ts',
        contiene: [
          'export function valorDeLaExistencia(',
          'hay > 0 ? hay * (costoPorUnidad ?? 0) : 0',
        ],
      },
      {
        archivo: 'packages/app/src/compras/compras.test.ts',
        contiene: ['pondera contra la existencia anterior con aritmética exacta'],
      },
    ],
  },
];

/** Los archivos que NO deben contener cierto texto para que la guía sea cierta. */
export const NO_CONTIENEN: readonly {
  readonly archivo: string;
  readonly texto: string;
  readonly porque: string;
}[] = [
  {
    archivo: 'packages/app/src/restaurante/preparacion.ts',
    texto: 'aplicarMovimientos',
    porque:
      'Preparar un platillo no mueve el inventario: sólo el cobro (y la cancelación de lo ya hecho).',
  },
  {
    archivo: 'packages/app/src/compras/gastos.ts',
    texto: 'movimientos_stock',
    porque: 'Un gasto no toca el inventario.',
  },
];

/**
 * El documento de `docs/cliente/GUIA-RECETAS-E-INVENTARIO.md`, tal cual sale de las secciones.
 * Determinista: el contrato lo compara carácter por carácter con el archivo.
 */
export function guiaEnMarkdown(): string {
  const partes: string[] = [`# ${TITULO_DE_LA_GUIA}`, '', INTRO_DE_LA_GUIA, ''];
  SECCIONES_DE_LA_GUIA.forEach((s, i) => {
    partes.push(`## ${String(i + 1)}. ${s.titulo}`, '', s.en_corto, '');
    s.pasos.forEach((p, j) => partes.push(`${String(j + 1)}. ${p}`));
    partes.push('');
    if (s.ejemplo !== undefined) partes.push(`**Ejemplo.** ${s.ejemplo}`, '');
  });
  partes.push(
    '---',
    '',
    'Esta guía es la misma que el botón «¿Cómo funciona?» de la app. Se escribe en un solo lugar.',
    '',
  );
  return partes.join('\n');
}
