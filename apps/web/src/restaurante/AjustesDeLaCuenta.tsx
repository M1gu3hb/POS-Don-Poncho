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
import { Textarea } from '@morphiqpos/ui/primitivas/textarea';
import { Aviso } from '@morphiqpos/ui/sistema';
import { BadgePercent, Ban } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ErrorApi, invocarComando } from '~/cliente/api';
import { useVocabulario } from '~/cliente/vocabulario';
import { DescuentoDeVenta, type DescuentoElegido } from '~/venta/DescuentoDeVenta';
import { PinDeSupervisor, type Autorizada } from '~/venta/PinDeSupervisor';
import { useDescuentosPermitidos } from '~/venta/use-descuentos-permitidos';

import {
  NO_PUDE_COMPROBAR_LA_COCINA,
  SI_NO_PUDE_COMPROBARLA,
  TIEMPO_LIMITE_DE_LA_COCINA_MS,
  cocinaTrasElTiempo,
  exigePinPorLaCocina,
  pideElPinDelSupervisor,
  type EstadoDeLaCocina,
} from './permiso-al-cancelar.ts';

/**
 * LO QUE CAMBIA UNA CUENTA ANTES DE COBRARLA: el descuento y la cancelación (día completo
 * del restaurante, 2.4).
 *
 * ── El descuento ─────────────────────────────────────────────────────────
 * `02-DINERO-Y-CAJA` §3: tope por rol, PIN de supervisor por encima del tope y la línea
 * del descuento con nombre en el corte. El restaurante no tenía NINGUNO: el mostrador lo
 * aplica a su borrador (`venta.aplicar_descuento`) y la cuenta de una mesa llega a caja ya
 * pedida. Aquí se usa el MISMO formulario que la tienda y la cafetería —`DescuentoDeVenta`,
 * con su tope a la vista y el PIN del supervisor tecleado en esta terminal— y se aplica con
 * `restaurante.descontar_cuenta`, que reparte el descuento con la misma regla del dominio.
 *
 * ── La cancelación ───────────────────────────────────────────────────────
 * «La mesa que se fue sin pagar» (§10, descuadre 1): el cierre no deja cerrar con ella y
 * su diálogo dice «cóbrala o cancélala», pero la caja del modelo sólo sabía eliminar el
 * ticket SIN consumo. `restaurante.cancelar_orden` existía —con motivo obligatorio y la
 * mesa de vuelta al servicio— y ninguna pantalla lo llamaba para una cuenta con consumo.
 * El motivo no es opcional: una venta que desaparece sin motivo es indistinguible de un
 * robo, y el corte la enseña en su sección de Cancelaciones con quién la canceló.
 */

function mensajeDe(fallo: unknown, porOmision: string): string {
  return fallo instanceof ErrorApi ? fallo.message : porOmision;
}

export function DescuentoDeLaCuenta({
  ordenId,
  base,
  alAplicar,
}: {
  readonly ordenId: string;
  /** La venta sin propina, en centavos: la base del porcentaje y del tope. */
  readonly base: number;
  readonly alAplicar: () => void;
}) {
  const permitidos = useDescuentosPermitidos();
  const [abierto, setAbierto] = useState(false);
  // Cada apertura, un formulario nuevo: la autorización de la vez anterior ya venció.
  const [apertura, setApertura] = useState(0);

  // Ronda 2 (medio 5) · Si el servidor rechaza, el error SUBE al formulario: él dice por qué, borra
  // la autorización que no sirvió y pide el PIN otra vez.
  async function aplicar(elegido: DescuentoElegido): Promise<void> {
    await invocarComando('/api/restaurante/descontar-cuenta', {
      ordenId,
      descuentoCentavos: elegido.centavos,
      motivo: elegido.motivo,
      ...(elegido.autorizacion === undefined ? {} : { autorizacion: elegido.autorizacion }),
    });
    setAbierto(false);
    alAplicar();
  }

  // DP-14.2 · Apagados (o mientras no se sabe), el botón no aparece.
  if (permitidos !== true) return null;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setApertura((n) => n + 1);
          setAbierto(true);
        }}
      >
        <BadgePercent aria-hidden="true" />
        Descuento
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Descuento</DialogTitle>
            <DialogDescription>
              Lo autoriza un gerente, administrador o dueño con su PIN, por el monto exacto.
            </DialogDescription>
          </DialogHeader>
          <DescuentoDeVenta key={apertura} ordenId={ordenId} base={base} onAplicar={aplicar} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CancelarLaCuenta({
  ordenId,
  alCancelar,
  aviso = null,
  cocina: cocinaLeida,
  alAbrir,
}: {
  readonly ordenId: string;
  readonly alCancelar: (cancelada: boolean) => void;
  /**
   * DP-12.4 · Lo que hay que saber ANTES de cancelar, si hay algo: «la cocina ya preparó X, queda
   * como pérdida». Lo calcula quien monta el botón (la pantalla del mesero); sin él, el diálogo
   * es el de siempre.
   */
  readonly aviso?: string | null;
  /**
   * DP-13.2 · Lo que se sabe de la cocina en este momento (la pantalla del mesero lo pasa; sin él,
   * no se dice nada de la cocina). Mientras se comprueba no se cancela a ciegas, y si no se pudo
   * comprobar se dice.
   */
  readonly cocina?: EstadoDeLaCocina;
  /** Al abrir el diálogo: la pantalla del mesero vuelve a leer la cocina. */
  readonly alAbrir?: () => void;
}) {
  const voc = useVocabulario();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  /** DP-13.2 · La cuenta ya se pidió (o se imprimió): el servidor pide el PIN de un gerente. */
  const [pidePin, setPidePin] = useState(false);
  const [autorizada, setAutorizada] = useState<Autorizada | null>(null);
  // DP-14.6-7 · Si «Comprobando la cocina…» no contesta en 8 s, deja de esperar.
  const [vencida, setVencida] = useState(false);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    if (!abierto || cocinaLeida !== 'comprobando') return undefined;
    const reloj = setTimeout(() => {
      setVencida(true);
    }, TIEMPO_LIMITE_DE_LA_COCINA_MS);
    return () => {
      clearTimeout(reloj);
    };
  }, [abierto, cocinaLeida, intento]);
  const cocina = cocinaTrasElTiempo(cocinaLeida, vencida && abierto);
  const sinRespuesta = exigePinPorLaCocina(cocina, vencida && abierto);
  const necesitaPin = pidePin || sinRespuesta;
  const listo =
    motivo.trim().length >= 3 &&
    !enviando &&
    cocina !== 'comprobando' &&
    (!necesitaPin || autorizada !== null);
  // El ejemplo nombra la unidad como la llama el negocio («la mesa equivocada»), con su
  // concordancia: si un día se llama de otro modo, el ejemplo lo sigue.
  const dondeSeCapturo =
    voc.singular('unidad_servicio') === ''
      ? 'por error'
      : `en ${voc.enFrase('unidad_servicio')} ${voc.articulo('unidad_servicio') === 'el' ? 'equivocado' : 'equivocada'}`;

  async function cancelar(): Promise<void> {
    setEnviando(true);
    setFallo(null);
    try {
      await invocarComando('/api/restaurante/cancelar-orden', {
        ordenId,
        motivo: motivo.trim(),
        ...(autorizada === null ? {} : { autorizacion: autorizada.token }),
        // DP-14.6-7 · Sin poder comprobar la cocina, el servidor cuenta todo como ya hecho.
        ...(sinRespuesta ? { sinComprobarLaCocina: true } : {}),
      });
      setAbierto(false);
      alCancelar(true);
    } catch (error: unknown) {
      if (pideElPinDelSupervisor(error)) {
        // La primera vez es «hace falta el PIN»; con una autorización, que venció o no sirve.
        setPidePin(true);
        setAutorizada(null);
      }
      setFallo(mensajeDe(error, `No se pudo cancelar ${voc.enFrase('orden')}.`));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setVencida(false);
          setAbierto(true);
          alAbrir?.();
        }}
      >
        <Ban aria-hidden="true" />
        Cancelar {voc.enFrase('orden')}
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cancelar {voc.enFrase('orden')}</DialogTitle>
            <DialogDescription>
              No se cobra y sale de las ventas del día. Queda en el corte, con su motivo y tu
              nombre.
            </DialogDescription>
          </DialogHeader>
          {cocina === 'comprobando' ? (
            <Aviso tono="info" titulo="Comprobando lo que ya preparó la cocina…" />
          ) : cocina === 'sin_comprobar' ? (
            <Aviso tono="atencion" titulo={NO_PUDE_COMPROBAR_LA_COCINA}>
              {sinRespuesta
                ? 'No pude leer la cocina. Reintenta, o cancela con el PIN de un gerente: como no se sabe qué ya preparó, todo queda como pérdida.'
                : SI_NO_PUDE_COMPROBARLA}
              {alAbrir === undefined ? null : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setVencida(false);
                    setIntento((n) => n + 1);
                    alAbrir();
                  }}
                >
                  Reintentar
                </Button>
              )}
            </Aviso>
          ) : aviso === null ? null : (
            <Aviso tono="atencion" titulo={aviso}>
              Queda en el corte con quién la canceló, cuándo, por qué y cuánto.
            </Aviso>
          )}
          <div className="flex flex-col gap-(--espacio-1)">
            <Label htmlFor="cancelar-cuenta-motivo">Por qué</Label>
            <Textarea
              id="cancelar-cuenta-motivo"
              maxLength={300}
              value={motivo}
              placeholder={`se fueron sin pagar · se capturó ${dondeSeCapturo}`}
              onChange={(evento) => {
                setMotivo(evento.target.value);
              }}
            />
          </div>
          {fallo === null || (necesitaPin && autorizada === null) ? null : (
            <Aviso tono="peligro" titulo={fallo}>
              No se canceló nada: {voc.enFrase('orden')} sigue por cobrar.
            </Aviso>
          )}
          {!necesitaPin ? null : autorizada === null ? (
            <div className="flex flex-col gap-(--espacio-2)">
              <Aviso
                tono="atencion"
                titulo={fallo ?? 'Hace falta el PIN de un gerente o del dueño.'}
              >
                {sinRespuesta
                  ? 'No se pudo comprobar la cocina: lo autoriza un gerente o el dueño.'
                  : `${voc.enFrase('orden')} ya se pidió o se imprimió: lo autoriza un gerente o el dueño.`}
              </Aviso>
              <PinDeSupervisor
                ordenId={ordenId}
                para="cancelacion"
                idDelCampo="cancelar-cuenta-pin"
                alAutorizar={(nueva) => {
                  setAutorizada(nueva);
                  setFallo(null);
                }}
              />
            </div>
          ) : (
            <Aviso tono="exito" titulo={`Autorizó ${autorizada.nombre}.`} />
          )}
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={!listo}
              cargando={enviando}
              onClick={() => {
                void cancelar();
              }}
            >
              Cancelar {voc.enFrase('orden')} sin cobrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
