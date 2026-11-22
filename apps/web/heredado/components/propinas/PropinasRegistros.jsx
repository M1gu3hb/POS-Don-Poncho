'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/api/cliente';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Wallet, Heart, Calendar, Filter, History } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/utils/financialUtils';
import LiquidarPropinasDialog from '@/components/propinas/LiquidarPropinasDialog';
import { claves } from '~/cliente/claves-de-consulta';
import { invocarComando } from '~/cliente/api';
import {
  avisoDeLasPropinas,
  desgloseDeLasPropinas,
  peticionDeLasPropinas,
  rangoDeLasPropinas,
  totalesDeLasPropinas,
} from '~/registros/propinas-del-servidor';
import { folioVisible } from '@morphiqpos/domain/venta';
import { useConfig } from '@/lib/ConfigContext';

const RANGOS = [
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: 'Esta semana' },
  { id: 'quincena', label: 'Quincena' },
  { id: 'month', label: 'Este mes' },
  { id: 'custom', label: 'Personalizado' },
];

const ESTADOS = [
  { id: 'todas', label: 'Todas' },
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'liquidadas', label: 'Liquidadas' },
];

export default function PropinasRegistros() {
  const { config } = useConfig();
  const [rango, setRango] = useState('week');
  const [desde, setDesde] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [hasta, setHasta] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [estado, setEstado] = useState('todas');
  const [meseroId, setMeseroId] = useState('__all__');
  const [showLiquidar, setShowLiquidar] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);

  const { data: meseros = [] } = useQuery({
    queryKey: claves.usuarios.activos(),
    queryFn: () => api.entidades.UsuarioPOS.filter({ activo: true }),
    initialData: [],
  });

  // El `.catch(() => [])` que había en este `queryFn` anulaba el estado de
  // error de react-query: la pantalla decía «no hay liquidaciones» y el mesero
  // creía que no le habían pagado (F1-06 §4.9). Ahora el fallo llega a
  // `isError` y se dice en voz alta, con el motivo del servidor.
  const { data: liquidaciones = [], isError: liquidacionesFallaron } = useQuery({
    queryKey: ['liquidaciones_propinas'],
    queryFn: () => api.entidades.LiquidacionPropina.list('-fecha_liquidacion', 200),
    initialData: [],
  });

  useEffect(() => {
    if (liquidacionesFallaron) {
      toast.error('No se pudieron cargar las liquidaciones de propinas.');
    }
  }, [liquidacionesFallaron]);

  // Los días se leen en hora local (`new Date('2026-11-10')` era el día anterior en México).
  const range = useMemo(() => rangoDeLasPropinas(rango, desde, hasta), [rango, desde, hasta]);

  // A23 · El servidor suma el rango ENTERO por mesero (centavos enteros, sin el tope de filas del
  // puente) y dice si la lista de detalle viene topada. Aquí sólo se pide y se pinta.
  const peticion = peticionDeLasPropinas(range, estado, meseroId);
  const {
    data: propinas,
    isPending: propinasCargando,
    isError: propinasFallaron,
    error,
    refetch: releerPropinas,
  } = useQuery({
    queryKey: ['registros_propinas', peticion],
    queryFn: ({ signal }) => invocarComando('/api/propinas/del-rango', peticion, { signal }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const totales = propinas ? totalesDeLasPropinas(propinas) : null;
  const desglose = propinas ? desgloseDeLasPropinas(propinas) : [];
  const ventasFiltradas = propinas?.ventas ?? [];
  const total = totales?.total ?? 0;
  const totalPendientes = totales?.pendientes ?? 0;
  const avisoDelDetalle = propinas ? avisoDeLasPropinas(propinas) : null;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="p-4 bg-superficie/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="font-heading font-bold text-sm">Filtros</h3>
          <div className="ml-auto flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setVerHistorial((v) => !v)}
            >
              <History className="w-3.5 h-3.5 mr-1" /> {verHistorial ? 'Ocultar' : 'Ver'}{' '}
              liquidaciones
            </Button>
            <Button
              size="sm"
              onClick={() => setShowLiquidar(true)}
              disabled={totalPendientes <= 0}
              className="h-8 text-xs text-exito-texto"
              style={{
                background: 'linear-gradient(135deg, hsl(152,60%,40%) 0%, hsl(152,60%,32%) 100%)',
              }}
            >
              <Wallet className="w-3.5 h-3.5 mr-1" /> Liquidar propinas
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {RANGOS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRango(r.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${rango === r.id ? 'bg-primary text-primario-texto' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {rango === 'custom' && (
          <div className="grid grid-cols-2 gap-3 mb-3 p-2 rounded-lg bg-muted/40">
            <div>
              <Label className="text-[10px] uppercase">Desde</Label>
              <Input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase">Hasta</Label>
              <Input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px] uppercase">Estado</Label>
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase">Mesero</Label>
            <Select value={meseroId} onValueChange={setMeseroId}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos los meseros</SelectItem>
                {meseros.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Total" value={total} color="rose" />
        <SummaryCard
          label="Pendientes"
          value={totalPendientes}
          color="amber"
          highlight={totalPendientes > 0}
        />
        <SummaryCard label="Liquidadas" value={totales?.liquidadas ?? 0} color="emerald" />
        <SummaryCard
          label="Ventas con propina"
          value={totales?.nVentas ?? 0}
          isCount
          color="slate"
        />
      </div>

      {propinasFallaron && (
        <Card className="p-4 bg-superficie/80 flex flex-wrap items-center gap-3">
          <p className="text-sm text-peligro">
            {error?.message || 'No se pudieron leer las propinas del periodo.'}
          </p>
          <Button size="sm" variant="outline" onClick={() => releerPropinas()}>
            Reintentar
          </Button>
        </Card>
      )}

      {/* Historial de liquidaciones */}
      {verHistorial && (
        <Card className="p-4 bg-superficie/80">
          <h3 className="font-heading font-bold text-sm mb-3 flex items-center gap-2">
            <History className="w-4 h-4" /> Historial de liquidaciones
          </h3>
          {liquidaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Sin liquidaciones registradas
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {liquidaciones.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-3 flex-wrap p-2.5 rounded-lg border bg-superficie"
                >
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-mono font-bold text-xs">{folioVisible(l.serie, l.folio, config, 'numero')}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {l.fecha_liquidacion
                        ? format(new Date(l.fecha_liquidacion), 'd MMM yyyy HH:mm', { locale: es })
                        : ''}
                      {l.mesero_nombre ? ` · ${l.mesero_nombre}` : ''}
                      {l.usuario_liquido_nombre ? ` · por ${l.usuario_liquido_nombre}` : ''}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {l.numero_ventas || 0} ventas
                  </Badge>
                  {/* DP-25 · De dónde salió el dinero: del cajón de una caja, o fuera de la caja. */}
                  <Badge variant="outline" className="text-[10px]" data-entrega-de-la-liquidacion>
                    {l.entregada_en_caja_id ? 'Salió del cajón' : 'Fuera de la caja'}
                  </Badge>
                  <p className="font-heading font-black text-exito min-w-[80px] text-right">
                    {formatCurrency(l.total_liquidado)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Desglose por mesero */}
      {desglose.length > 0 && (
        <Card className="p-4 bg-superficie/80">
          <h3 className="font-heading font-bold text-sm mb-3">Por mesero</h3>
          <div className="space-y-1.5">
            {desglose.map((m, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40"
              >
                <div>
                  <p className="font-medium text-sm">{m.mesero_nombre}</p>
                  <p className="text-[10px] text-muted-foreground">{m.num_ventas} ventas</p>
                </div>
                <p className="font-bold text-peligro">{formatCurrency(m.total)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Lista de ventas */}
      <Card className="p-0 bg-superficie/80 overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-heading font-bold text-sm flex items-center gap-2">
            <Heart className="w-4 h-4 text-peligro" />
            Propinas ({totales?.nVentas ?? 0})
          </h3>
          <p className="text-[10px] text-muted-foreground">
            {format(range.from, 'd MMM', { locale: es })} –{' '}
            {format(range.to, 'd MMM yyyy', { locale: es })}
          </p>
        </div>
        {avisoDelDetalle && (
          <p className="px-4 py-2 text-xs text-advertencia border-b">{avisoDelDetalle}</p>
        )}
        {propinasCargando ? (
          <p className="text-sm text-muted-foreground text-center py-8">Cargando propinas…</p>
        ) : ventasFiltradas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Sin propinas en el periodo
          </p>
        ) : (
          <div className="divide-y max-h-[60vh] overflow-y-auto">
            {ventasFiltradas.map((v) => (
              <div
                key={v.ordenId}
                className="px-4 py-2.5 flex items-center gap-3 flex-wrap text-sm hover:bg-muted/30"
              >
                <div className="flex-1 min-w-[140px]">
                  <p className="font-mono font-bold text-xs">{folioVisible(v.serie, v.folio, config, 'numero')}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {v.cerradaEn ? format(new Date(v.cerradaEn), 'd MMM HH:mm', { locale: es }) : ''}
                    {v.mesaNumero ? ` · Mesa ${v.mesaNumero}` : ''}
                  </p>
                </div>
                <div className="min-w-[120px] text-xs text-muted-foreground truncate">
                  {v.meseroNombre || 'Sin mesero'}
                </div>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {v.metodoPago || '—'}
                </Badge>
                <Badge
                  className={`text-[10px] ${v.liquidada ? 'bg-exito/15 text-exito border-exito/30' : 'bg-advertencia/15 text-advertencia border-advertencia/30'}`}
                  variant="outline"
                >
                  {v.liquidada ? 'Liquidada' : 'Pendiente'}
                </Badge>
                <Badge variant="secondary" className="text-[10px] capitalize">
                  {v.origen || '—'}
                </Badge>
                <p className="font-heading font-black min-w-[80px] text-right text-peligro">
                  {formatCurrency(Number(v.propinaCentavos) / 100)}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <LiquidarPropinasDialog
        open={showLiquidar}
        onClose={() => setShowLiquidar(false)}
        meseros={meseros}
        rangoInicial={rango === 'custom' ? 'today' : rango}
        meseroInicialId={meseroId === '__all__' ? '' : meseroId}
      />
    </div>
  );
}

function SummaryCard({ label, value, color, highlight, isCount }) {
  const palette =
    {
      rose: 'text-peligro',
      amber: 'text-advertencia',
      emerald: 'text-exito',
      slate: 'text-texto',
    }[color] || 'text-foreground';
  return (
    <div className={`rounded-xl bg-superficie border p-3 ${highlight ? 'ring-2 ring-advertencia/40' : ''}`}>
      <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-1">
        <Filter className="w-3 h-3" />
        {label}
      </p>
      <p className={`font-heading font-black text-lg mt-1 ${palette}`}>
        {isCount ? value || 0 : formatCurrency(value || 0)}
      </p>
    </div>
  );
}
