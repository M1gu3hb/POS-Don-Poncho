'use client';

import {
  claveDeColorDeCategoria,
  mismoOrden,
  moverEnLaLista,
  ordenarCategorias,
  ordenarMenu,
} from '@morphiqpos/domain/catalogo';
import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso, EsqueletoDeLista, Vacio } from '@morphiqpos/ui/sistema';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, UtensilsCrossed } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { toast } from 'sonner';

import { DondeSeVe } from './DondeSeVe';
import {
  avisoDeVisibilidad,
  cambioDe,
  visibilidadDe,
  type AccionDeVisibilidad,
} from './donde-se-ve';
import {
  useOrdenDelMenu,
  type CategoriaDelOrden,
  type PlatilloDelOrden,
} from './use-orden-del-menu';

/**
 * DP-24 · 3.2 · «EL ORDEN DEL MENÚ» (Configuración → Portal de comensales): las secciones
 * (categorías) y los platillos dentro de cada una, con botones ↑ ↓ de 44 px que funcionan con el
 * dedo, y mostrar u ocultar cada platillo del menú digital. Se guarda con comandos de catálogo (con
 * auditoría) y, si otra persona ordenó mientras tanto, se rechaza y se vuelve a leer.
 */

/** El blanco táctil de cada botón: 44 px POR COMPONENTE (nunca un selector global de `button`). */
const BOTON = 'min-h-(--altura-tactil) min-w-(--altura-tactil)';

type Hacia = 'arriba' | 'abajo';

const nombreDe = (n: string | null | undefined, reserva: string): string =>
  (n ?? '').trim() || reserva;

const textoDelError = (error: unknown): string =>
  error instanceof Error ? error.message : 'No se pudo guardar. Intenta otra vez.';

/** Los platillos de una categoría en el orden en que se ven hoy (lo guardado). */
function idsGuardados(platillos: readonly PlatilloDelOrden[], categoriaId: string): string[] {
  return ordenarMenu(
    platillos.filter((p) => p.categoria_id === categoriaId),
    [{ id: categoriaId, orden: 0 }],
  ).map((p) => p.id);
}

function BotonesDeOrden({
  nombre,
  primero,
  ultimo,
  alMover,
}: {
  readonly nombre: string;
  readonly primero: boolean;
  readonly ultimo: boolean;
  readonly alMover: (hacia: Hacia) => void;
}) {
  return (
    <span className="flex shrink-0">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={BOTON}
        aria-label={`Subir ${nombre}`}
        disabled={primero}
        onClick={() => {
          alMover('arriba');
        }}
      >
        <ArrowUp aria-hidden className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={BOTON}
        aria-label={`Bajar ${nombre}`}
        disabled={ultimo}
        onClick={() => {
          alMover('abajo');
        }}
      >
        <ArrowDown aria-hidden className="size-4" />
      </Button>
    </span>
  );
}

function FilaDePlatillo({
  platillo,
  lugar,
  total,
  ocupado,
  alMover,
  alMostrar,
}: {
  readonly platillo: PlatilloDelOrden;
  readonly lugar: number;
  readonly total: number;
  readonly ocupado: boolean;
  readonly alMover: (hacia: Hacia) => void;
  readonly alMostrar: (accion: AccionDeVisibilidad) => void;
}) {
  const nombre = nombreDe(platillo.nombre, 'el platillo');
  return (
    <li className="flex flex-wrap items-center gap-(--espacio-2) rounded-lg border border-borde px-(--espacio-2)">
      <span className="w-6 text-right text-sm tabular-nums text-texto-sutil">{lugar + 1}</span>
      <DondeSeVe
        nombre={nombre}
        visibilidad={visibilidadDe(platillo)}
        ocupado={ocupado}
        alElegir={alMostrar}
      />
      <BotonesDeOrden
        nombre={nombre}
        primero={lugar === 0}
        ultimo={lugar === total - 1}
        alMover={alMover}
      />
    </li>
  );
}

interface DatosDeLaFila {
  readonly categoria: CategoriaDelOrden;
  readonly lugar: number;
  readonly total: number;
  readonly ids: readonly string[];
  readonly platilloPorId: ReadonlyMap<string, PlatilloDelOrden>;
  readonly abierta: boolean;
  readonly ocupado: string | null;
  readonly sinGuardar: boolean;
}

interface AccionesDeLaFila {
  readonly alAbrir: () => void;
  readonly alMoverCategoria: (hacia: Hacia) => void;
  readonly alMoverPlatillo: (id: string, hacia: Hacia) => void;
  readonly alMostrar: (id: string, accion: AccionDeVisibilidad) => void;
  readonly alGuardarPlatillos: () => void;
}

function PlatillosDeLaCategoria({
  nombre,
  d,
  a,
}: {
  readonly nombre: string;
  readonly d: DatosDeLaFila;
  readonly a: AccionesDeLaFila;
}) {
  return (
    <div className="ml-(--espacio-6) flex flex-col gap-(--espacio-2)">
      <ol
        className="flex flex-col gap-(--espacio-1)"
        aria-label={`Platillos de ${nombre}, en orden`}
      >
        {d.ids.map((id, j) => {
          const platillo = d.platilloPorId.get(id);
          if (platillo === undefined) return null;
          return (
            <FilaDePlatillo
              key={id}
              platillo={platillo}
              lugar={j}
              total={d.ids.length}
              ocupado={d.ocupado !== null}
              alMover={(hacia) => {
                a.alMoverPlatillo(id, hacia);
              }}
              alMostrar={(accion) => {
                a.alMostrar(id, accion);
              }}
            />
          );
        })}
      </ol>
      <Button
        type="button"
        className={`${BOTON} self-start`}
        disabled={!d.sinGuardar}
        cargando={d.ocupado === `platillos-${d.categoria.id}`}
        onClick={a.alGuardarPlatillos}
      >
        Guardar el orden de «{nombre}»
      </Button>
    </div>
  );
}

function FilaDeCategoria({ d, a }: { readonly d: DatosDeLaFila; readonly a: AccionesDeLaFila }) {
  const nombre = nombreDe(d.categoria.nombre, 'la sección');
  return (
    <li className="flex flex-col gap-(--espacio-1)">
      <div
        className="flex items-center gap-(--espacio-2) rounded-lg border border-borde px-(--espacio-2)"
        data-categoria-color={claveDeColorDeCategoria(d.categoria.color) ?? undefined}
      >
        <span className="w-6 text-right text-sm tabular-nums text-texto-sutil">{d.lugar + 1}</span>
        <span
          aria-hidden
          className="franja-de-categoria h-[calc(var(--altura-control)*0.55)] rounded-sm"
        />
        <span className="min-w-0 flex-1 font-medium">
          {nombre}
          <span className="ml-(--espacio-2) text-sm font-normal text-texto-sutil">
            {d.ids.length} platillos
          </span>
        </span>
        <Button
          type="button"
          variant="ghost"
          className={`${BOTON} shrink-0 gap-(--espacio-1)`}
          aria-expanded={d.abierta}
          aria-label={`${d.abierta ? 'Ocultar' : 'Ver'} los platillos de ${nombre}`}
          onClick={a.alAbrir}
        >
          {d.abierta ? (
            <ChevronDown aria-hidden className="size-4" />
          ) : (
            <ChevronRight aria-hidden className="size-4" />
          )}
          <span className="text-sm">Platillos</span>
        </Button>
        <BotonesDeOrden
          nombre={nombre}
          primero={d.lugar === 0}
          ultimo={d.lugar === d.total - 1}
          alMover={a.alMoverCategoria}
        />
      </div>
      {d.abierta ? <PlatillosDeLaCategoria nombre={nombre} d={d} a={a} /> : null}
    </li>
  );
}

export function OrdenDelMenu() {
  const datos = useOrdenDelMenu();
  const [borradorCategorias, setBorradorCategorias] = useState<readonly string[] | null>(null);
  const [borradorProductos, setBorradorProductos] = useState<
    Readonly<Record<string, readonly string[]>>
  >({});
  const [abierta, setAbierta] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  if (datos.categorias.isPending || datos.platillos.isPending) {
    return <EsqueletoDeLista filas={4} />;
  }
  if (datos.categorias.isError || datos.platillos.isError) {
    return (
      <Aviso tono="peligro" titulo="No se pudo leer el menú. Recarga la página para reintentar." />
    );
  }
  if (datos.categorias.data.length === 0) {
    return (
      <Vacio
        icono={<UtensilsCrossed />}
        titulo="Todavía no hay secciones en el menú"
        explicacion="Crea tus categorías en Configuración → Productos e inventario → Categorías de productos; aquí las ordenas."
      />
    );
  }
  const categorias = ordenarCategorias(datos.categorias.data);
  const platillos = datos.platillos.data;
  const guardadasCategorias = categorias.map((c) => c.id);
  const ordenCategorias = borradorCategorias ?? guardadasCategorias;
  const porId = new Map<string, CategoriaDelOrden>(categorias.map((c) => [c.id, c]));
  const platilloPorId = new Map<string, PlatilloDelOrden>(platillos.map((p) => [p.id, p]));

  /** Guarda con aviso. Si otra persona ordenó, vuelve a leer y suelta los borradores. */
  async function guardar(que: string, hacer: () => Promise<void>, listo: string) {
    setOcupado(que);
    setFallo(null);
    try {
      await hacer();
      toast.success(listo);
    } catch (error: unknown) {
      setFallo(textoDelError(error));
      await datos.refrescar();
      setBorradorCategorias(null);
      setBorradorProductos({});
    } finally {
      setOcupado(null);
    }
  }

  const filas = ordenCategorias.flatMap((id, lugar): ReactElement[] => {
    const categoria = porId.get(id);
    if (categoria === undefined) return [];
    const guardados = idsGuardados(platillos, id);
    const ids = borradorProductos[id] ?? guardados;
    const d: DatosDeLaFila = {
      categoria,
      lugar,
      total: ordenCategorias.length,
      ids,
      platilloPorId,
      abierta: abierta === id,
      ocupado,
      sinGuardar: !mismoOrden(ids, guardados),
    };
    const a: AccionesDeLaFila = {
      alAbrir: () => {
        setAbierta(abierta === id ? null : id);
      },
      alMoverCategoria: (hacia) => {
        setBorradorCategorias(moverEnLaLista(ordenCategorias, id, hacia));
      },
      alMoverPlatillo: (pid, hacia) => {
        setBorradorProductos({ ...borradorProductos, [id]: moverEnLaLista(ids, pid, hacia) });
      },
      alMostrar: (pid, accion) => {
        const platillo = platilloPorId.get(pid);
        const que = nombreDe(platillo?.nombre, 'El platillo');
        const cambio = cambioDe(accion);
        const hoy = visibilidadDe(platillo ?? {});
        const queda = {
          portal: cambio.visible ?? hoy.portal,
          pos: cambio.visibleEnPos ?? hoy.pos,
        };
        void guardar(
          `ver-${pid}`,
          () => datos.mostrar(pid, cambio),
          avisoDeVisibilidad(que, queda),
        );
      },
      alGuardarPlatillos: () => {
        void guardar(
          `platillos-${id}`,
          async () => {
            await datos.guardarProductos(id, ids, guardados);
            setBorradorProductos(
              Object.fromEntries(Object.entries(borradorProductos).filter(([k]) => k !== id)),
            );
          },
          `Orden de «${nombreDe(categoria.nombre, 'la sección')}» guardado`,
        );
      },
    };
    return [<FilaDeCategoria key={id} d={d} a={a} />];
  });

  return (
    <section aria-labelledby="orden-del-menu-titulo" className="flex flex-col gap-(--espacio-3)">
      <h3 id="orden-del-menu-titulo" className="text-lg font-semibold">
        El orden del menú
      </h3>
      <p className="text-sm text-texto-sutil">
        Así se ordenan las secciones y los platillos en el portal, en la mesa del mesero y en la
        Caja. Toca las flechas para subir o bajar; con «Dónde se ve» eliges si un platillo se oculta
        del portal QR, del POS (mesero y Caja) o de todo.
      </p>
      <ol className="flex flex-col gap-(--espacio-2)" aria-label="Secciones del menú, en orden">
        {filas}
      </ol>
      <Button
        type="button"
        className={`${BOTON} self-start`}
        disabled={mismoOrden(ordenCategorias, guardadasCategorias)}
        cargando={ocupado === 'categorias'}
        onClick={() => {
          void guardar(
            'categorias',
            async () => {
              await datos.guardarCategorias(ordenCategorias, guardadasCategorias);
              setBorradorCategorias(null);
            },
            'Orden de las secciones guardado',
          );
        }}
      >
        Guardar el orden de las secciones
      </Button>
      {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
    </section>
  );
}
