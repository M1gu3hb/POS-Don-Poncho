import {
  conCantidadCambiada,
  conExclusionesDeLinea,
  conLineaPersonalizada,
  conLineaVariable,
  conNotasDeLinea,
  conProducto,
  type Carrito,
  type OpcionesElegidas,
  type ProductoDelMenu,
  type SnapshotVariable,
} from './borrador-de-la-mesa';

/**
 * EL ALMACÉN DEL BORRADOR · fuera de React, para que abrir una mesa no dibuje todo.
 *
 * El carrito, la búsqueda, el filtro de categoría y la nota para cocina eran `useState` del
 * componente `Mesero`. Con ellos ahí, cada toque a un platillo volvía a pintar el mapa y los 107
 * botones. Aquí viven en un almacén pequeño: `Mesero` lo crea UNA vez y lo reparte, pero no lo
 * lee —sus manejadores piden `leer()` cuando los llaman— y sólo se suscriben los componentes que
 * de verdad pintan el carrito o el buscador (`use-borrador-de-la-mesa.ts`).
 *
 * El estado es inmutable y su identidad sólo cambia cuando algo cambió: es lo que
 * `useSyncExternalStore` exige, y lo que evita un aviso por cada tecla repetida. Las acciones son
 * funciones sueltas (no usan `this`), así que se pasan como props sin envolverlas.
 */

export interface EstadoDelBorrador {
  readonly carrito: Carrito;
  readonly busqueda: string;
  /** El id de la categoría elegida, o `'todas'`. */
  readonly categoria: string;
  /** La nota para cocina de todo el envío. */
  readonly nota: string;
}

const ESTADO_INICIAL: EstadoDelBorrador = Object.freeze({
  carrito: [],
  busqueda: '',
  categoria: 'todas',
  nota: '',
});

export interface AlmacenDelBorrador {
  readonly leer: () => EstadoDelBorrador;
  /** Devuelve la baja. */
  readonly suscribir: (oyente: () => void) => () => void;
  readonly agregarProducto: (producto: ProductoDelMenu) => void;
  readonly agregarVariable: (producto: ProductoDelMenu, snapshot: SnapshotVariable) => void;
  readonly agregarPersonalizado: (producto: ProductoDelMenu, elegidas: OpcionesElegidas) => void;
  readonly cambiarCantidad: (id: string, delta: number) => void;
  readonly ponerNotasDeLinea: (id: string, notas: string | null) => void;
  readonly ponerExclusionesDeLinea: (id: string, exclusiones: readonly string[]) => void;
  readonly ponerBusqueda: (busqueda: string) => void;
  readonly ponerCategoria: (categoria: string) => void;
  readonly ponerNota: (nota: string) => void;
  /** Tras enviar o cerrar la mesa: sin carrito y sin nota; el buscador se queda como estaba. */
  readonly vaciarPedido: () => void;
  /** Al abrir otra mesa: todo como al nacer. */
  readonly reiniciar: () => void;
}

export function crearAlmacenDelBorrador(): AlmacenDelBorrador {
  let estado: EstadoDelBorrador = ESTADO_INICIAL;
  const oyentes = new Set<() => void>();

  /** Cambia el estado y avisa — sólo si la identidad cambió. */
  const poner = (siguiente: EstadoDelBorrador): void => {
    if (siguiente === estado) return;
    estado = siguiente;
    for (const oyente of [...oyentes]) oyente();
  };

  /** Cambia el carrito; si el cambio no hizo nada (misma lista) no hay estado nuevo. */
  const ponerCarrito = (carrito: Carrito): void => {
    if (carrito === estado.carrito) return;
    poner({ ...estado, carrito });
  };

  return {
    leer: () => estado,
    suscribir: (oyente) => {
      oyentes.add(oyente);
      return () => {
        oyentes.delete(oyente);
      };
    },
    agregarProducto: (producto) => {
      ponerCarrito(conProducto(estado.carrito, producto));
    },
    agregarVariable: (producto, snapshot) => {
      ponerCarrito(conLineaVariable(estado.carrito, producto, snapshot));
    },
    agregarPersonalizado: (producto, elegidas) => {
      ponerCarrito(conLineaPersonalizada(estado.carrito, producto, elegidas));
    },
    cambiarCantidad: (id, delta) => {
      ponerCarrito(conCantidadCambiada(estado.carrito, id, delta));
    },
    ponerNotasDeLinea: (id, notas) => {
      ponerCarrito(conNotasDeLinea(estado.carrito, id, notas));
    },
    ponerExclusionesDeLinea: (id, exclusiones) => {
      ponerCarrito(conExclusionesDeLinea(estado.carrito, id, exclusiones));
    },
    ponerBusqueda: (busqueda) => {
      if (busqueda !== estado.busqueda) poner({ ...estado, busqueda });
    },
    ponerCategoria: (categoria) => {
      if (categoria !== estado.categoria) poner({ ...estado, categoria });
    },
    ponerNota: (nota) => {
      if (nota !== estado.nota) poner({ ...estado, nota });
    },
    vaciarPedido: () => {
      if (estado.carrito.length === 0 && estado.nota === '') return;
      poner({ ...estado, carrito: [], nota: '' });
    },
    reiniciar: () => {
      poner(ESTADO_INICIAL);
    },
  };
}
