'use client';

import { Button } from '@morphiqpos/ui/primitivas/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@morphiqpos/ui/primitivas/dialog';
import { Aviso, Esqueleto, Superficie, Vacio } from '@morphiqpos/ui/sistema';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { api } from '@/api/cliente';

import { ErrorApi, invocarComando } from '~/cliente/api';
import { claves } from '~/cliente/claves-de-consulta';
import { useVocabulario } from '~/cliente/vocabulario';

import {
  entradaDelRelevo,
  meserosParaPasar,
  preguntaDelRelevo,
  type MeseroElegible,
  type UsuarioLeido,
} from './pasar-la-mesa';

/**
 * PASAR LA MESA A OTRO MESERO (DP-D156).
 *
 * Dos pasos en el mismo diálogo, sin salir de la mesa: se elige a quién y se confirma con su
 * nombre a la vista. Pasar una mesa cambia de quién es el consumo desde este momento, y un toque
 * de más en hora pico la mandaría a quien no es; por eso, a diferencia de «Cambiar de mesa», sí
 * pregunta. Los blancos son de 44 px o más.
 *
 * Al terminar relee todo lo que pinta meseros (el plano, el panel de cada mesero y la mesa activa):
 * el servidor ya movió la cuenta, la mesa y, con la asignación de mesas activa, la asignación.
 */

export interface PasarLaMesaDialogProps {
  readonly mesaId: string;
  readonly numeroDeMesa: number;
  readonly ordenId: string;
  /** Quien la atiende hoy (`Mesa.atendido_por_id`). */
  readonly atiendeId: string;
  readonly atiendeNombre: string | null;
  readonly alCerrar: () => void;
  /** Ya pasó: la pantalla relee la mesa y avisa. */
  readonly alHecho: (entra: MeseroElegible) => void;
}

function mensajeDe(fallo: unknown, porOmision: string): string {
  return fallo instanceof ErrorApi ? fallo.message : porOmision;
}

/**
 * Lee la plantilla del negocio como la leen las demás pantallas (`api.entidades.UsuarioPOS`, la
 * misma lectura y la misma clave de consulta que «Usuarios POS» y el selector de meseros de las
 * mesas): `/api/datos/consultar` resuelve `UsuarioPOS` aparte, con sus tres tablas y sin el PIN.
 */
function useMeseros(atiendeId: string): {
  readonly meseros: readonly MeseroElegible[] | null;
  readonly fallo: string | null;
} {
  const lectura = useQuery({
    queryKey: claves.usuarios.activos(),
    queryFn: () => api.entidades.UsuarioPOS.filter({ activo: true }),
  });
  if (lectura.isError) {
    return { meseros: null, fallo: mensajeDe(lectura.error, 'No se pudo leer la plantilla.') };
  }
  const filas = lectura.data as unknown as readonly UsuarioLeido[] | undefined;
  return {
    meseros: filas === undefined ? null : meserosParaPasar(filas, atiendeId),
    fallo: null,
  };
}

export function PasarLaMesaDialog(props: PasarLaMesaDialogProps) {
  const voc = useVocabulario();
  const consultas = useQueryClient();
  const { meseros, fallo: falloDeLectura } = useMeseros(props.atiendeId);
  const [elegido, setElegido] = useState<MeseroElegible | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const responsable = voc.singular('responsable');

  async function confirmar(entra: MeseroElegible): Promise<void> {
    setEnviando(true);
    setFallo(null);
    try {
      await invocarComando(
        '/api/restaurante/relevar',
        entradaDelRelevo({ ordenId: props.ordenId, saleId: props.atiendeId, entraId: entra.id }),
      );
      // El plano y el panel de cada mesero se arman con `['mesas']`; la mesa activa se relee en `alHecho`.
      await consultas.invalidateQueries({ queryKey: claves.mesas.raiz() });
      props.alHecho(entra);
    } catch (error: unknown) {
      setFallo(
        mensajeDe(
          error,
          `No se pudo. ${voc.conArticulo('unidad_servicio')} sigue con quien estaba.`,
        ),
      );
      setEnviando(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(abierto) => {
        if (!abierto && !enviando) props.alCerrar();
      }}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Pasar {voc.enFrase('unidad_servicio')} a otro {responsable}
          </DialogTitle>
          <DialogDescription>
            {voc.conArticulo('orden')} y lo que falte por pedir pasan a quien elijas. Lo consumido
            hasta ahora queda a nombre de quien la llevaba.
          </DialogDescription>
        </DialogHeader>
        {elegido === null ? (
          <ListaDeMeseros meseros={meseros} falloDeLectura={falloDeLectura} alElegir={setElegido} />
        ) : (
          <div className="flex flex-col gap-(--espacio-3)">
            <p className="text-base font-semibold">
              {preguntaDelRelevo({
                mesa: props.numeroDeMesa,
                sale: props.atiendeNombre,
                entra: elegido.nombre,
              })}
            </p>
            <div className="flex flex-wrap gap-(--espacio-2)">
              <Button
                size="lg"
                className="min-h-[max(2.75rem,var(--altura-control))] flex-1"
                disabled={enviando}
                onClick={() => {
                  void confirmar(elegido);
                }}
              >
                {enviando ? 'Pasando…' : `Pasar ${voc.enFrase('unidad_servicio')}`}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-h-[max(2.75rem,var(--altura-control))]"
                disabled={enviando}
                onClick={() => {
                  setElegido(null);
                  setFallo(null);
                }}
              >
                Elegir a otro
              </Button>
            </div>
          </div>
        )}
        {fallo === null ? null : <Aviso tono="peligro" titulo={fallo} />}
      </DialogContent>
    </Dialog>
  );
}

interface ListaDeMeserosProps {
  readonly meseros: readonly MeseroElegible[] | null;
  readonly falloDeLectura: string | null;
  readonly alElegir: (mesero: MeseroElegible) => void;
}

/** Los meseros activos como teselas que se tocan con el pulgar. */
function ListaDeMeseros(props: ListaDeMeserosProps) {
  const voc = useVocabulario();
  if (props.falloDeLectura !== null) return <Aviso tono="peligro" titulo={props.falloDeLectura} />;
  if (props.meseros === null) return <Esqueleto className="h-32 w-full rounded-lg" />;
  if (props.meseros.length === 0) {
    return <Vacio titulo={`No hay otro ${voc.singular('responsable')} activo.`} />;
  }
  return (
    <ul className="grid grid-cols-2 gap-(--espacio-2)">
      {props.meseros.map((mesero) => (
        <li key={mesero.id}>
          <Superficie
            como="button"
            type="button"
            interactiva
            relleno={3}
            onClick={() => {
              props.alElegir(mesero);
            }}
            className="flex min-h-[max(3.5rem,var(--altura-control))] w-full items-center justify-center text-center text-base font-semibold"
          >
            {mesero.nombre}
          </Superficie>
        </li>
      ))}
    </ul>
  );
}
