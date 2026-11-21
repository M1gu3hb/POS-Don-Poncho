'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api, nuevaClave } from '@/api/cliente';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Wallet, CheckCircle2, Loader2 } from 'lucide-react';
import {
  format,
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/financialUtils';
import { aPesos } from '@/components/caja/dinero';
import { folioVisible } from '@morphiqpos/domain/venta';
import { usePuesto } from '@/components/configuracion/usePuesto';
import { PinDeSupervisor } from '~/venta/PinDeSupervisor';
import { liquidaSinPin, quienesRecibenPropina } from '~/venta/quien-recibe-propina';

/**
 * Dialog de liquidación de propinas.
 * - Selecciona rango y opcionalmente un mesero.
 * - Lista las ventas con propina pendiente del rango.
 * - Al confirmar: crea LiquidacionPropina + marca cada venta con propina_liquidada=true.
 * - NUNCA borra ventas ni propinas.
 *
 * DP-24 · Es el MISMO diálogo en el Tablero y en el corte de la Caja. Desde el corte llega con
 * `deLaCaja`: la liquidación se entrega en efectivo de esa caja y el servidor deja la salida en su
 * cajón (el efectivo esperado del corte baja lo mismo). Ahí la cajera la entrega con el PIN de un
 * gerente, administrador o dueño; la gerencia, sin PIN. Y en la lista de personas sólo aparece quien
 * vende, cobra o atiende cuentas: nunca cocina, bebidas ni almacén.
 *
 * DP-25 · En el Tablero, si hay cajas abiertas, se pregunta DE CUÁL sale el dinero (sale de su cajón y
 * su corte lo descuenta) o si se paga fuera de la caja; sin cajas abiertas, queda pagada fuera de la
 * caja y así se dice. Y un doble toque manda UNA vez: el segundo, mientras va el primero, no sale.
 */
/** DP-25 · «Fuera de la caja»: el dinero no sale de ningún cajón. */
const FUERA_DE_LA_CAJA = 'fuera';
const RANGOS = [
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: 'Esta semana' },
  { id: 'quincena', label: 'Quincena (15 días)' },
  { id: 'month', label: 'Este mes' },
  { id: 'custom', label: 'Personalizado' },
];
/** DP-24 · Sólo desde el corte: lo cobrado desde que abrió ESTA caja (lo mismo que lista el corte). */
const RANGO_DE_LA_CAJA = { id: 'caja', label: 'Este turno de caja' };

export default function LiquidarPropinasDialog({
  open,
  onClose,
  // `ventas` ya no se recibe: lo pendiente lo deriva `propinas.pendientes`
  // en la base, no un filtro sobre la lista que la pantalla padre tenga cargada.
  meseros = [],
  rangoInicial = 'today',
  meseroInicialId = '',
  deLaCaja = false,
  desdeLaApertura = null,
  onLiquidada,
}) {
  const queryClient = useQueryClient();
  const puesto = usePuesto();
  // Sólo quien atiende cuentas; la persona ya elegida se conserva aunque su puesto no esté en la lista.
  const personas = quienesRecibenPropina(meseros);
  // Desde el corte, quien no es de gerencia entrega con el PIN de un gerente (lo exige el servidor).
  const pidePin = deLaCaja && !liquidaSinPin(puesto);
  const rangos = desdeLaApertura ? [RANGO_DE_LA_CAJA, ...RANGOS] : RANGOS;
  const [rango, setRango] = useState(rangoInicial);
  const [desde, setDesde] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [hasta, setHasta] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [meseroId, setMeseroId] = useState(meseroInicialId);
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  // La clave de idempotencia se genera al ABRIR el diálogo y se reusa mientras
  // siga abierto: es lo que impide que un doble clic en «Liquidar» registre dos
  // liquidaciones del mismo dinero (F1-02 §8, trampa T5).
  const [claveLiquidacion, setClaveLiquidacion] = useState(null);
  // DP-25 · De qué caja sale el dinero en el Tablero: el id de una sesión abierta o FUERA_DE_LA_CAJA.
  const [cajaElegida, setCajaElegida] = useState(null);
  // DP-25 · El candado del doble toque: un segundo toque, mientras va el primero, no manda nada.
  const enviando = useRef(false);

  useEffect(() => {
    if (open) {
      setRango(rangoInicial);
      setMeseroId(meseroInicialId);
      setNotas('');
      setDesde(format(new Date(), 'yyyy-MM-dd'));
      setHasta(format(new Date(), 'yyyy-MM-dd'));
      setClaveLiquidacion(nuevaClave());
      setCajaElegida(null);
    }
  }, [open, rangoInicial, meseroInicialId]);

  // DP-25 · Las cajas abiertas de la sucursal, sólo en el Tablero y para quien liquida sin PIN (la
  // gerencia): de una de ellas puede salir el dinero.
  const preguntaLaCaja = !deLaCaja && liquidaSinPin(puesto);
  const { data: cajas, isError: cajasFallaron } = useQuery({
    queryKey: ['cajas_abiertas_para_liquidar'],
    queryFn: () => api.comandos.ejecutar('/api/caja/abiertas', { todas: true }),
    enabled: open && preguntaLaCaja,
    staleTime: 5000,
  });
  const cajasAbiertas = Array.isArray(cajas?.abiertas) ? cajas.abiertas : [];
  const cajaDeLaLista = cajasAbiertas.find((c) => c?.sesionId === cajaElegida) ?? null;
  // Con cajas abiertas hay que decir de dónde sale; sin ninguna, se paga fuera de la caja.
  const faltaElegirCaja =
    preguntaLaCaja && cajasAbiertas.length > 0 && cajaElegida === null;

  const range = useMemo(() => {
    const now = new Date();
    if (rango === 'caja' && desdeLaApertura) {
      const apertura = new Date(desdeLaApertura);
      if (Number.isFinite(apertura.getTime())) return { from: apertura, to: endOfDay(now) };
    }
    if (rango === 'today') return { from: startOfDay(now), to: endOfDay(now) };
    if (rango === 'week')
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }),
        to: endOfWeek(now, { weekStartsOn: 1 }),
      };
    if (rango === 'quincena') return { from: startOfDay(subDays(now, 14)), to: endOfDay(now) };
    if (rango === 'month') return { from: startOfMonth(now), to: endOfMonth(now) };
    try {
      return { from: startOfDay(new Date(desde)), to: endOfDay(new Date(hasta)) };
    } catch {
      return { from: startOfDay(now), to: endOfDay(now) };
    }
  }, [rango, desde, hasta, desdeLaApertura]);

  // Ventas pendientes de liquidar en el rango (y opcionalmente del mesero).
  //
  // ── Por qué esto ya no se filtra en el navegador ──────────────────────────
  // El filtro anterior era `propina_monto > 0 && propina_liquidada !== true`, y
  // ninguno de esos dos campos existe: `ordenes` no tiene columna con el importe
  // de la propina —es lo que impide inflar `total` con una (F1-04 §6.1)— y
  // «liquidada» se DERIVA de `propina_liquidacion_id is not null` (F1-04 §6.4),
  // que es lo que hace que no pueda desincronizarse. Sobre esos dos campos
  // ausentes el filtro devolvía SIEMPRE cero, y el diálogo decía «no hay
  // propinas pendientes» con las propinas del turno sin pagar.
  //
  // `propinas.pendientes` lo deriva en la base, con el mismo `condicionPendiente`
  // que usa el `UPDATE` de liquidar: así la pantalla no puede enseñar ocho
  // ventas mientras el botón liquida siete.
  const { data: pendientes, isError: pendientesFallaron } = useQuery({
    queryKey: [
      'propinas_pendientes',
      range.from.toISOString(),
      range.to.toISOString(),
      meseroId || '__all__',
    ],
    queryFn: () =>
      api.comandos.ejecutar('/api/propinas/pendientes', {
        desde: range.from.toISOString(),
        hasta: range.to.toISOString(),
        meseroId: meseroId && meseroId !== '__all__' ? meseroId : null,
        limite: 200,
      }),
    enabled: open,
    staleTime: 5000,
  });

  useEffect(() => {
    if (pendientesFallaron) {
      toast.error('No se pudieron cargar las propinas pendientes del periodo.');
    }
  }, [pendientesFallaron]);

  // El número de ventas del PERIODO ENTERO, no el de la página: `ventas` va
  // topada por `limite` y contarla enseñaría «200 ventas» de un mes con mil.
  const numeroVentas = Number(pendientes?.numeroVentas) || 0;
  const total = aPesos(pendientes?.totalCentavos);
  const totalCentavos = Number(pendientes?.totalCentavos) || 0;
  // Se remapea a los nombres que este diálogo ya dibujaba, para no tocar el JSX.
  const desglose = useMemo(
    () =>
      (Array.isArray(pendientes?.meseros) ? pendientes.meseros : []).map((m) => ({
        mesero_id: m?.meseroId ?? null,
        mesero_nombre: m?.meseroNombre || '',
        num_ventas: Number(m?.numeroVentas) || 0,
        total: aPesos(m?.propinaCentavos),
      })),
    [pendientes],
  );

  const liquidar = async (autorizacion) => {
    if (enviando.current) return;
    if (numeroVentas === 0) {
      toast.error('No hay propinas pendientes en ese periodo');
      return;
    }
    if (faltaElegirCaja) {
      toast.error('Elige de qué caja sale el dinero, o si se paga fuera de la caja.');
      return;
    }
    enviando.current = true;
    setLoading(true);
    try {
      // ── Lo que desaparece aquí ──────────────────────────────────────────
      // Antes: crear la `LiquidacionPropina` y DESPUÉS marcar las ventas en
      // lotes de cinco, cada `Venta.update` con su `.catch` que sólo escribía
      // en consola. Un fallo a mitad dejaba la liquidación hecha y ventas sin
      // marcar, la pantalla decía «liquidado» y esa propina se volvía a
      // liquidar mañana. Y el `total_liquidado` iba calculado en el navegador
      // sobre una lista que podía llevar minutos abierta.
      //
      // `propinas.liquidar` hace las dos cosas en UNA transacción y SUMA el
      // importe él mismo, de `pagos.propina_centavos`, sobre las órdenes que
      // esa misma transacción reclamó. Por eso no se manda ningún total.
      //
      // El rango SÍ viaja: es el que el administrador vio en pantalla antes de
      // pulsar, y volver a derivarlo en el servidor liquidaría otro periodo.
      const cuerpo = {
        rangoTipo:
          rango === 'today'
            ? 'dia'
            : rango === 'week'
              ? 'semana'
              : rango === 'quincena'
                ? 'quincena'
                : rango === 'month'
                  ? 'mes'
                  : 'personalizado',
        desde: range.from.toISOString(),
        hasta: range.to.toISOString(),
        meseroId: meseroId && meseroId !== '__all__' ? meseroId : null,
      };
      if (notas) cuerpo.notas = notas;
      // DP-24 · Desde el corte: se entrega en efectivo de esta caja (el servidor deja la salida en el
      // cajón); y si quien liquida es la cajera, con la autorización del PIN de un gerente.
      if (deLaCaja) cuerpo.entregarDeLaCaja = true;
      // DP-25 · Desde el Tablero: de la caja elegida (sale de su cajón), o fuera de la caja.
      if (preguntaLaCaja && cajaDeLaLista !== null) {
        cuerpo.entregarDeLaCaja = true;
        cuerpo.sesionCajaId = cajaDeLaLista.sesionId;
      }
      if (typeof autorizacion === 'string') cuerpo.autorizacion = autorizacion;
      // Exactamente las ventas que el diálogo LISTÓ, que son las que el
      // administrador vio al aprobar el total — pero sólo cuando la lista está
      // completa. Si el periodo tiene más ventas de las que cupieron en la
      // página (`hayMasVentas`), mandar los ids de la página liquidaría una
      // parte y dejaría el resto pendiente sin decirlo: en ese caso se omite el
      // campo, que es como se pide «todo el periodo», y es lo que el diálogo
      // acaba de sumar en pantalla. Una lista VACÍA nunca se manda: el comando
      // la interpretaría como el periodo entero, que es otra cosa.
      const ordenIds = (Array.isArray(pendientes?.ventas) ? pendientes.ventas : [])
        .map((v) => v?.ordenId)
        .filter(Boolean);
      if (!pendientes?.hayMasVentas && ordenIds.length > 0 && ordenIds.length <= 500) {
        cuerpo.ordenIds = ordenIds;
      }

      // Clave propia: el diálogo se abre una vez y liquida una vez. Sin ella,
      // un doble clic en «Liquidar» crearía dos liquidaciones del mismo dinero.
      const liquidacion = await api.comandos.ejecutar(
        '/api/propinas/liquidar',
        cuerpo,
        claveLiquidacion,
      );

      queryClient.invalidateQueries({ queryKey: ['ventas_hoy'] });
      queryClient.invalidateQueries({ queryKey: ['registros_ventas'] });
      queryClient.invalidateQueries({ queryKey: ['registros_propinas'] });
      queryClient.invalidateQueries({ queryKey: ['liquidaciones_propinas'] });
      queryClient.invalidateQueries({ queryKey: ['propinas_dashboard_ventas'] });
      queryClient.invalidateQueries({ queryKey: ['propinas_pendientes'] });
      // Lo entregado de la caja cambia lo que el corte espera en el cajón.
      queryClient.invalidateQueries({ queryKey: ['cortes_caja_estado'] });
      queryClient.invalidateQueries({ queryKey: ['cajas_abiertas_para_liquidar'] });
      onLiquidada?.(liquidacion);
      // Folio e importe son los del servidor: `LIQ-000042` del consecutivo
      // atómico, y el total sumado dentro de la transacción.
      toast.success(
        `Liquidación ${folioVisible(liquidacion?.serie, liquidacion?.folio, null, 'numero')} registrada · ${formatCurrency(aPesos(liquidacion?.totalCentavos))}`,
      );
      onClose?.();
    } catch (err) {
      // «El periodo está al revés», «El periodo no puede pasar de 366 días»:
      // el dominio ya lo dice, y con el motivo.
      toast.error(err?.message || 'No se pudo registrar la liquidación');
      // Otro intento es otra petición (y, con PIN, otra autorización): clave nueva.
      setClaveLiquidacion(nuevaClave());
    } finally {
      enviando.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cajasFallaron) toast.error('No se pudieron leer las cajas abiertas.');
  }, [cajasFallaron]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !loading) onClose?.();
      }}
    >
      <DialogContent className="sm:max-w-lg w-[calc(100%-2rem)] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Wallet className="w-5 h-5 text-exito" />
            Liquidar propinas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Rango */}
          <div>
            <Label className="text-xs font-semibold">Periodo</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
              {rangos.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRango(r.id)}
                  className={`text-xs px-2 py-2 rounded-lg border-2 font-medium ${
                    rango === r.id
                      ? 'bg-exito/10 border-exito/30 text-exito'
                      : 'bg-superficie border-border text-muted-foreground'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {rango === 'custom' && (
            <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-muted/40">
              <div>
                <Label className="text-[10px] uppercase">Desde</Label>
                <Input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase">Hasta</Label>
                <Input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          )}

          {/* Mesero */}
          <div>
            <Label className="text-xs font-semibold">Persona</Label>
            <Select
              value={meseroId || '__all__'}
              onValueChange={(v) => setMeseroId(v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="h-9 mt-1">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {personas.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Resumen */}
          <div className="p-3 rounded-xl bg-exito/10 border border-exito/30">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">
                {format(range.from, 'd MMM', { locale: es })} –{' '}
                {format(range.to, 'd MMM yyyy', { locale: es })}
              </p>
              <p className="text-[10px] text-muted-foreground">{numeroVentas} ventas</p>
            </div>
            <p className="text-[10px] uppercase font-semibold text-exito">Total a liquidar</p>
            <p className="font-heading font-black text-3xl text-exito">
              {formatCurrency(total)}
            </p>
          </div>

          {/* Desglose */}
          {desglose.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="px-3 py-1.5 bg-muted/40 text-[10px] uppercase font-semibold text-muted-foreground">
                Desglose
              </div>
              <div className="max-h-40 overflow-y-auto divide-y">
                {desglose.map((m, i) => (
                  <div key={i} className="flex justify-between items-center px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{m.mesero_nombre}</p>
                      <p className="text-[10px] text-muted-foreground">{m.num_ventas} ventas</p>
                    </div>
                    <p className="font-bold text-exito">{formatCurrency(m.total)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {deLaCaja && (
            <div className="p-3 rounded-xl bg-info/10 border border-info/30 text-xs text-info">
              Se entrega en efectivo de esta caja: {formatCurrency(total)} salen del cajón y el corte
              los descuenta, para que el conteo cuadre.
            </div>
          )}

          {/* DP-25 · En el Tablero: de qué caja sale el dinero, o fuera de la caja. */}
          {preguntaLaCaja && cajasAbiertas.length > 0 && (
            <fieldset data-de-que-caja className="space-y-2">
              <legend className="text-xs font-semibold">¿De dónde sale el dinero?</legend>
              {[
                ...cajasAbiertas.map((c) => ({ id: c.sesionId, rotulo: `Del cajón de ${c.nombre}` })),
                { id: FUERA_DE_LA_CAJA, rotulo: 'Fuera de la caja (no sale de ningún cajón)' },
              ].map((opcion) => (
                <button
                  key={opcion.id}
                  type="button"
                  aria-pressed={cajaElegida === opcion.id}
                  onClick={() => setCajaElegida(opcion.id)}
                  className={`w-full text-left text-sm px-3 py-2 rounded-lg border-2 font-medium any-pointer-coarse:min-h-(--altura-tactil) ${
                    cajaElegida === opcion.id
                      ? 'bg-exito/10 border-exito/30 text-exito'
                      : 'bg-superficie border-border text-foreground'
                  }`}
                >
                  {opcion.rotulo}
                </button>
              ))}
              {cajaDeLaLista !== null && (
                <p className="text-xs text-info">
                  {formatCurrency(total)} salen del cajón de {cajaDeLaLista.nombre} y su corte los
                  descuenta, para que el conteo cuadre.
                </p>
              )}
            </fieldset>
          )}
          {preguntaLaCaja && cajas !== undefined && cajasAbiertas.length === 0 && (
            <div className="p-3 rounded-xl bg-muted/40 border text-xs text-muted-foreground">
              No hay ninguna caja abierta: esta liquidación queda pagada fuera de la caja.
            </div>
          )}

          {/* Notas */}
          <div>
            <Label className="text-xs font-semibold">Notas (opcional)</Label>
            <Input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej. Entregado en efectivo"
              className="h-9 mt-1"
            />
          </div>
        </div>

        {/* DP-24 · La cajera entrega con el PIN de un gerente: sirve una vez y para este importe. */}
        {pidePin && numeroVentas > 0 && (
          <div className="rounded-xl border border-advertencia/40 bg-advertencia/10 p-3 space-y-2">
            <p className="text-xs font-semibold">
              Entregar {formatCurrency(total)} de la caja lo autoriza un gerente, administrador o
              dueño con su PIN.
            </p>
            <PinDeSupervisor
              key={totalCentavos}
              para="retiro"
              montoCentavos={totalCentavos}
              idDelCampo="liquidar-propinas-pin"
              alAutorizar={(autorizada) => {
                void liquidar(autorizada.token);
              }}
            />
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={() => liquidar()}
            disabled={loading || numeroVentas === 0 || faltaElegirCaja}
            className={pidePin ? 'hidden' : 'gap-2'}
            style={{
              background: 'linear-gradient(135deg, hsl(152,60%,40%) 0%, hsl(152,60%,32%) 100%)',
            }}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            {loading ? 'Liquidando…' : `Liquidar ${formatCurrency(total)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
