'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@morphiqpos/ui/primitivas/dialog';
import { Label } from '@morphiqpos/ui/primitivas/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@morphiqpos/ui/primitivas/select';
import { Aviso, EsqueletoDeLista, Vacio } from '@morphiqpos/ui/sistema';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ListChecks, Pencil, Plus, X } from 'lucide-react';
import { useState } from 'react';

import { invocarComando } from '~/cliente/api';
import { CLAVE_DE_LAS_OPCIONES } from '~/restaurante/opciones-de-los-platillos';
import { useOpcionesDeLosPlatillos } from '~/restaurante/use-opciones-de-los-platillos';

import {
  cambiosDelGrupo,
  entradaDeAsignar,
  entradaDeGuardar,
  grupoDesdeLectura,
  grupoNuevo,
  moverAbajo,
  moverArriba,
  productosQueLoUsan,
  validarGrupo,
  type GrupoDeLectura,
  type GrupoEditable,
} from './editor-de-grupos.ts';
import { EditorDeGrupo } from './EditorDeGrupo.tsx';
import { problemaDePrecio, type PlatilloConPrecio } from './piso-del-platillo.ts';

const CLAVE_DE_LA_BIBLIOTECA = ['grupos_de_opciones'] as const;
const RUTA_LEER = '/api/catalogo/grupos-de-opciones';
const RUTA_GUARDAR = '/api/catalogo/guardar-grupo-de-opciones';
const RUTA_ASIGNAR = '/api/catalogo/asignar-grupos-de-opciones';
const BOTON_TACTIL = 'min-h-(--altura-control) min-w-(--altura-control)';

export interface ProductoConOpciones extends PlatilloConPrecio {
  readonly id: string;
  readonly nombre?: string;
}

interface Props {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly producto: ProductoConOpciones | null;
}

/** «Opciones de <producto>»: los grupos del platillo, en orden, sobre la biblioteca de grupos. */
export function OpcionesDelPlatilloDialog({ open, onClose, producto }: Props) {
  const biblioteca = useQuery({
    queryKey: CLAVE_DE_LA_BIBLIOTECA,
    queryFn: () => invocarComando<{ grupos: readonly GrupoDeLectura[] }>(RUTA_LEER, {}),
    enabled: open && producto !== null,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const porPlatillo = useOpcionesDeLosPlatillos();
  const listo =
    biblioteca.data !== undefined &&
    !biblioteca.isFetching &&
    porPlatillo.frescas &&
    !porPlatillo.leyendo;
  const fallo = biblioteca.isError || (porPlatillo.fallo && !porPlatillo.frescas);

  return (
    <Dialog
      open={open}
      onOpenChange={(abierto) => {
        if (!abierto) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        {producto === null ? null : listo ? (
          <Contenido
            producto={producto}
            biblioteca={biblioteca.data.grupos}
            idsAsignados={(porPlatillo.opciones[producto.id] ?? []).map((g) => g.id)}
            onClose={onClose}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Opciones de {producto.nombre ?? 'el platillo'}</DialogTitle>
              <DialogDescription>Leyendo los grupos de opciones.</DialogDescription>
            </DialogHeader>
            {fallo ? (
              <Aviso
                tono="peligro"
                titulo="No se pudieron leer las opciones."
                accion={
                  <Button
                    type="button"
                    variant="outline"
                    className={BOTON_TACTIL}
                    onClick={() => {
                      void biblioteca.refetch();
                      porPlatillo.reintentar();
                    }}
                  >
                    Reintentar
                  </Button>
                }
              />
            ) : (
              <EsqueletoDeLista filas={3} />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

type Vista =
  | { readonly nombre: 'lista' }
  | { readonly nombre: 'grupo'; readonly borrador: GrupoEditable; readonly indice: number | null };

interface ContenidoProps {
  readonly producto: ProductoConOpciones;
  readonly biblioteca: readonly GrupoDeLectura[];
  readonly idsAsignados: readonly string[];
  readonly onClose: () => void;
}

function ordenInicial(
  biblioteca: readonly GrupoDeLectura[],
  idsAsignados: readonly string[],
  productoId: string,
): GrupoDeLectura[] {
  const porId = new Map(biblioteca.map((g) => [g.id, g]));
  const enOrden = idsAsignados.flatMap((id) => porId.get(id) ?? []);
  const vistos = new Set(enOrden.map((g) => g.id));
  const demas = biblioteca.filter((g) => g.productoIds.includes(productoId) && !vistos.has(g.id));
  return [...enOrden, ...demas];
}

function Contenido({ producto, biblioteca, idsAsignados, onClose }: ContenidoProps) {
  const cliente = useQueryClient();
  const [grupos, setGrupos] = useState<readonly GrupoEditable[]>(() =>
    ordenInicial(biblioteca, idsAsignados, producto.id).map(grupoDesdeLectura),
  );
  const [originales, setOriginales] = useState<Readonly<Record<string, GrupoEditable>>>(() =>
    Object.fromEntries(
      ordenInicial(biblioteca, idsAsignados, producto.id).map((g) => {
        const editable = grupoDesdeLectura(g);
        return [g.id, editable];
      }),
    ),
  );
  const [vista, setVista] = useState<Vista>({ nombre: 'lista' });
  const [erroresDelGrupo, setErroresDelGrupo] = useState<readonly string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [porConfirmar, setPorConfirmar] = useState(false);
  const [elegido, setElegido] = useState('');

  const nombre = producto.nombre ?? 'el platillo';
  const disponibles = biblioteca.filter((g) => !grupos.some((a) => a.id === g.id));
  const compartidosCambiados = grupos.filter(
    (g) =>
      cambiosDelGrupo(g, g.id === undefined ? undefined : originales[g.id]) &&
      g.id !== undefined &&
      productosQueLoUsan(g.productoIds, producto.id) > 0,
  );

  function cambiarGrupos(nuevos: readonly GrupoEditable[]): void {
    setGrupos(nuevos);
    setPorConfirmar(false);
  }

  function agregarExistente(): void {
    const lectura = biblioteca.find((g) => g.id === elegido);
    if (lectura === undefined) return;
    cambiarGrupos([...grupos, grupoDesdeLectura(lectura)]);
    setOriginales({ ...originales, [lectura.id]: grupoDesdeLectura(lectura) });
    setElegido('');
  }

  function aceptarBorrador(): void {
    if (vista.nombre !== 'grupo') return;
    const errores = validarGrupo(vista.borrador);
    setErroresDelGrupo(errores);
    if (errores.length > 0) return;
    const { indice, borrador } = vista;
    cambiarGrupos(
      indice === null ? [...grupos, borrador] : grupos.map((g, i) => (i === indice ? borrador : g)),
    );
    setVista({ nombre: 'lista' });
  }

  async function guardar(): Promise<void> {
    const invalido = grupos.find((g) => validarGrupo(g).length > 0);
    if (invalido !== undefined) {
      setFallo(`${invalido.nombre || 'Un grupo'}: ${validarGrupo(invalido).join(' ')}`);
      return;
    }
    // DP-18 · M6: ninguna opción que reste puede dejar el platillo en $0 o menos.
    const sinPrecio = problemaDePrecio(producto, grupos);
    if (sinPrecio !== null) {
      setFallo(sinPrecio);
      return;
    }
    if (compartidosCambiados.length > 0 && !porConfirmar) {
      setPorConfirmar(true);
      return;
    }
    setGuardando(true);
    setFallo(null);
    let trabajo = [...grupos];
    let base = { ...originales };
    try {
      for (let i = 0; i < trabajo.length; i += 1) {
        const actual = trabajo[i];
        if (actual === undefined) continue;
        const previo = actual.id === undefined ? undefined : base[actual.id];
        if (!cambiosDelGrupo(actual, previo)) continue;
        const { grupoId } = await invocarComando<{ grupoId: string }>(
          RUTA_GUARDAR,
          entradaDeGuardar(actual),
        );
        const guardado = { ...actual, id: grupoId };
        trabajo = trabajo.map((g, j) => (j === i ? guardado : g));
        base = { ...base, [grupoId]: guardado };
      }
      const ids = trabajo.flatMap((g) => (g.id === undefined ? [] : [g.id]));
      await invocarComando(RUTA_ASIGNAR, entradaDeAsignar(producto.id, ids));
      await Promise.all([
        cliente.invalidateQueries({ queryKey: ['productos_all'] }),
        cliente.invalidateQueries({ queryKey: ['productos_pos'] }),
        cliente.invalidateQueries({ queryKey: CLAVE_DE_LAS_OPCIONES }),
        cliente.invalidateQueries({ queryKey: CLAVE_DE_LA_BIBLIOTECA }),
      ]);
      onClose();
    } catch (error: unknown) {
      // Lo que ya se guardó queda anotado (con su id): reintentar no lo duplica.
      setGrupos(trabajo);
      setOriginales(base);
      setFallo(error instanceof Error ? error.message : 'No se pudo guardar. Intenta otra vez.');
      setPorConfirmar(false);
    } finally {
      setGuardando(false);
    }
  }

  if (vista.nombre === 'grupo') {
    const { borrador, indice } = vista;
    return (
      <>
        <DialogHeader>
          <DialogTitle>
            {indice === null ? 'Grupo nuevo' : `Grupo: ${borrador.nombre || 'sin nombre'}`}
          </DialogTitle>
          <DialogDescription>Opciones de {nombre}.</DialogDescription>
        </DialogHeader>
        <EditorDeGrupo
          grupo={borrador}
          productoId={producto.id}
          deshabilitado={false}
          errores={erroresDelGrupo}
          alCambiar={(g) => {
            setVista({ nombre: 'grupo', borrador: g, indice });
          }}
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className={BOTON_TACTIL}
            onClick={() => {
              setErroresDelGrupo([]);
              setVista({ nombre: 'lista' });
            }}
          >
            Descartar cambios
          </Button>
          <Button type="button" className={BOTON_TACTIL} onClick={aceptarBorrador}>
            Aceptar grupo
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Opciones de {nombre}</DialogTitle>
        <DialogDescription>
          Los grupos se le piden al mesero en este orden. Un grupo se puede usar en varios
          productos.
        </DialogDescription>
      </DialogHeader>

      {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
      {porConfirmar ? (
        <Aviso
          tono="atencion"
          titulo={`Este grupo también lo usan otros productos: el cambio aplica a todos. Vuelve a pulsar «Guardar» para confirmar.`}
        />
      ) : null}

      {grupos.length === 0 ? (
        <Vacio tamano="compacto" icono={<ListChecks />} titulo="Este platillo no tiene opciones." />
      ) : (
        <ol className="flex flex-col gap-(--espacio-2)">
          {grupos.map((grupo, indice) => {
            const otros = productosQueLoUsan(grupo.productoIds, producto.id);
            const etiqueta = grupo.nombre || 'grupo sin nombre';
            return (
              <li
                key={grupo.clave}
                className="flex min-w-0 flex-col gap-(--espacio-2) rounded-md border border-borde p-(--espacio-3)"
              >
                <div className="min-w-0">
                  <p className="font-semibold break-words">{etiqueta}</p>
                  <p className="text-sm text-texto-suave">
                    {grupo.tipo === 'multiple' ? 'Varias' : 'Una'} · {grupo.opciones.length}{' '}
                    {grupo.opciones.length === 1 ? 'opción' : 'opciones'}
                    {grupo.obligatorio ? ' · obligatorio' : ''}
                    {grupo.activo ? '' : ' · inactivo'}
                    {otros > 0 ? ` · también en ${String(otros)} productos` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-(--espacio-2)">
                  <Button
                    type="button"
                    variant="outline"
                    className={BOTON_TACTIL}
                    aria-label={`Subir ${etiqueta}`}
                    disabled={guardando || indice === 0}
                    onClick={() => {
                      cambiarGrupos(moverArriba(grupos, indice));
                    }}
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={BOTON_TACTIL}
                    aria-label={`Bajar ${etiqueta}`}
                    disabled={guardando || indice === grupos.length - 1}
                    onClick={() => {
                      cambiarGrupos(moverAbajo(grupos, indice));
                    }}
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={BOTON_TACTIL}
                    disabled={guardando}
                    onClick={() => {
                      setErroresDelGrupo([]);
                      setVista({ nombre: 'grupo', borrador: grupo, indice });
                    }}
                  >
                    <Pencil aria-hidden />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={BOTON_TACTIL}
                    aria-label={`Quitar ${etiqueta} del producto`}
                    disabled={guardando}
                    onClick={() => {
                      cambiarGrupos(grupos.filter((_, i) => i !== indice));
                    }}
                  >
                    <X aria-hidden />
                    Quitar
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {disponibles.length > 0 ? (
        <div className="flex flex-col gap-(--espacio-2)">
          <Label htmlFor="grupo-existente">Agregar un grupo que ya existe</Label>
          <div className="flex flex-wrap gap-(--espacio-2)">
            <div className="min-w-0 flex-1">
              <Select value={elegido} onValueChange={setElegido} disabled={guardando}>
                <SelectTrigger id="grupo-existente" className="w-full">
                  <SelectValue placeholder="Elige un grupo" />
                </SelectTrigger>
                <SelectContent>
                  {disponibles.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.nombre} · {g.tipo === 'multiple' ? 'Varias' : 'Una'} · {g.opciones.length}{' '}
                      {g.opciones.length === 1 ? 'opción' : 'opciones'} · se usa en{' '}
                      {g.productoIds.length} {g.productoIds.length === 1 ? 'producto' : 'productos'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              className={BOTON_TACTIL}
              disabled={guardando || elegido === ''}
              onClick={agregarExistente}
            >
              Agregar
            </Button>
          </div>
        </div>
      ) : null}

      <Button
        type="button"
        variant="outline"
        className={BOTON_TACTIL}
        disabled={guardando}
        onClick={() => {
          setErroresDelGrupo([]);
          setVista({ nombre: 'grupo', borrador: grupoNuevo(), indice: null });
        }}
      >
        <Plus aria-hidden />
        Crear grupo nuevo
      </Button>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className={BOTON_TACTIL}
          disabled={guardando}
          onClick={onClose}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          className={BOTON_TACTIL}
          disabled={guardando}
          onClick={() => {
            void guardar();
          }}
        >
          {guardando ? 'Guardando…' : porConfirmar ? 'Guardar de todos modos' : 'Guardar'}
        </Button>
      </DialogFooter>
    </>
  );
}
