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
import { Aviso, Esqueleto, Superficie, Vacio } from '@morphiqpos/ui/sistema';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { ErrorApi, consultarPuente, invocarComando } from '~/cliente/api';

import {
  mesasQueSePuedenAgregar,
  posicionesAlAgregar,
  type MesaParaAgregar,
} from './agregar-mesas';
import { nombreConUnidas } from './plano-de-union';

/**
 * «AGREGAR MESAS» (DP-24 · P5): al grupo que ya está unido se le suman más mesas, las veces que
 * haga falta. Se tocan las mesas que se juntaron (con dedo: cada una es una tesela de 80 px) y
 * van a la principal del grupo con su cuenta, sus comandas y sus avisos. Si una de las que se
 * tocan encabeza otro grupo, entra con todas las suyas.
 */
export interface AgregarMesasDialogProps {
  readonly unionId: string;
  /** La mesa principal del grupo: la que conserva la cuenta. */
  readonly principalId: string;
  readonly alCerrar: () => void;
  readonly alHecho: () => void;
}

function useSalon(): {
  readonly mesas: readonly MesaParaAgregar[] | null;
  readonly fallo: string | null;
} {
  const [mesas, setMesas] = useState<readonly MesaParaAgregar[] | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  useEffect(() => {
    const control = new AbortController();
    consultarPuente<MesaParaAgregar>('Mesa', {
      filtro: { activo: true },
      limite: 200,
      signal: control.signal,
    })
      .then((filas) => {
        if (!control.signal.aborted) setMesas(filas);
      })
      .catch(() => {
        if (!control.signal.aborted) setFallo('No se pudo leer el salón.');
      });
    return () => {
      control.abort();
    };
  }, []);
  return { mesas, fallo };
}

export function AgregarMesasDialog(props: AgregarMesasDialogProps) {
  const { mesas, fallo: falloDeLectura } = useSalon();
  const [elegidas, setElegidas] = useState<readonly string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const opciones = mesas === null ? null : mesasQueSePuedenAgregar(mesas, props.principalId);

  const alternar = (id: string) => {
    setElegidas((antes) => (antes.includes(id) ? antes.filter((x) => x !== id) : [...antes, id]));
  };

  const agregar = async () => {
    if (mesas === null) return;
    setEnviando(true);
    setFallo(null);
    const delGrupo = [
      props.principalId,
      ...mesas.filter((m) => m.unida_a_mesa_id === props.principalId).map((m) => m.id),
    ];
    try {
      await invocarComando('/api/restaurante/agregar-a-la-union', {
        unionId: props.unionId,
        mesaIds: elegidas,
        posiciones: posicionesAlAgregar(mesas, delGrupo, elegidas),
      });
      toast.success(
        elegidas.length === 1 ? 'Mesa agregada al grupo.' : 'Mesas agregadas al grupo.',
      );
      props.alHecho();
    } catch (error: unknown) {
      setFallo(error instanceof ErrorApi ? error.message : 'No se pudieron agregar las mesas.');
      setEnviando(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(abierto) => {
        if (!abierto && !enviando) props.alCerrar();
      }}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar mesas al grupo</DialogTitle>
          <DialogDescription>
            Toca las mesas que se juntaron. Su cuenta y lo que pidieron pasan a la cuenta de este
            grupo.
          </DialogDescription>
        </DialogHeader>
        <ListaParaAgregar
          opciones={opciones}
          todas={mesas ?? []}
          elegidas={elegidas}
          falloDeLectura={falloDeLectura}
          enviando={enviando}
          alTocar={alternar}
        />
        {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
        <DialogFooter>
          <Button variant="outline" disabled={enviando} onClick={props.alCerrar}>
            Cancelar
          </Button>
          <Button disabled={enviando || elegidas.length === 0} onClick={() => void agregar()}>
            {enviando
              ? 'Agregando…'
              : elegidas.length === 0
                ? 'Agregar mesas'
                : `Agregar ${String(elegidas.length)} ${elegidas.length === 1 ? 'mesa' : 'mesas'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ListaParaAgregarProps {
  readonly opciones: readonly MesaParaAgregar[] | null;
  readonly todas: readonly MesaParaAgregar[];
  readonly elegidas: readonly string[];
  readonly falloDeLectura: string | null;
  readonly enviando: boolean;
  readonly alTocar: (id: string) => void;
}

function ListaParaAgregar(props: ListaParaAgregarProps) {
  if (props.falloDeLectura !== null) return <Aviso tono="peligro" titulo={props.falloDeLectura} />;
  if (props.opciones === null) return <Esqueleto className="h-32 w-full rounded-lg" />;
  if (props.opciones.length === 0) return <Vacio titulo="No hay más mesas que agregar." />;
  return (
    <ul className="grid grid-cols-3 gap-(--espacio-2) sm:grid-cols-4">
      {props.opciones.map((mesa) => {
        const elegida = props.elegidas.includes(mesa.id);
        const aparte = nombreConUnidas(mesa, props.todas);
        return (
          <li key={mesa.id}>
            <Superficie
              como="button"
              type="button"
              interactiva
              relleno={3}
              disabled={props.enviando}
              aria-pressed={elegida}
              onClick={() => {
                props.alTocar(mesa.id);
              }}
              className={`flex min-h-20 w-full flex-col items-center justify-center gap-(--espacio-1) ${elegida ? 'ring-2 ring-primario' : ''}`}
            >
              <span className="text-xs text-texto-sutil">Mesa</span>
              <span className="font-numeros text-2xl font-bold tabular-nums">
                {String(mesa.numero)}
              </span>
              <span className="text-xs text-texto-sutil">
                {aparte ?? (mesa.venta_activa_id == null ? (mesa.zona ?? '') : 'Con cuenta')}
              </span>
            </Superficie>
          </li>
        );
      })}
    </ul>
  );
}
