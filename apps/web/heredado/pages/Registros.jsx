'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { api } from '@/api/cliente';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/utils/financialUtils';
import PageHeader from '@/components/common/PageHeader';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  FileText,
  Receipt,
  ShoppingBag,
  Package,
  Scissors,
  Printer,
  Trash2,
  Heart,
  Ban,
} from 'lucide-react';
import { toast } from 'sonner';
import CorteViewerDialog from '@/components/cortes/CorteViewerDialog';
import TicketViewerDialog from '@/components/tickets/TicketViewerDialog';
import ResumenPeriodo from '@/components/registros/ResumenPeriodo';
import PeriodoPDF from '@/components/registros/PeriodoPDF';
import LimpiarSeccionButton from '@/components/registros/LimpiarSeccionButton';
import MovimientosPanel from '@/components/registros/MovimientosPanel';
import ExportarSeccionButton from '@/components/registros/ExportarSeccionButton';
import {
  COLUMNS_CORTES,
  COLUMNS_VENTAS,
  COLUMNS_COMPRAS,
  COLUMNS_GASTOS,
  COLUMNS_MOVIMIENTOS,
  COLUMNS_DETALLES_VENTA,
} from '@/lib/exportColumns';
import { exportToCSV } from '@/lib/exportUtils';
import { useConfig } from '@/lib/ConfigContext';
import { canAccessModule } from '@/lib/packageConfig';
import { printDocument } from '@/lib/print';
import { usePOSAuth } from '@/lib/POSAuthContext';
import PropinasRegistros from '@/components/propinas/PropinasRegistros';
import { tipsEnabled } from '@/utils/tipsUtils';
import { useLocation } from '@/enrutado';
import { claves } from '~/cliente/claves-de-consulta';
import { CancelacionesRegistradas } from '~/corte/CancelacionesRegistradas';
import { AuditoriaReciente } from '~/registros/AuditoriaReciente';
import { usePuesto } from '@/components/configuracion/usePuesto';
import { esDeMando } from '@/components/configuracion/puestos';
import { grupoDelCanal, referenciaParaLlevar } from '~/corte/canales';
import { Aviso } from '@morphiqpos/ui/sistema';
import {
  avisoDelTopeDeRegistros,
  rangoDelPeriodo,
} from '~/registros/periodo-de-registros';
import {
  CAMPO_DEL_PERIODO,
  OPCIONES_DE_LECTURA,
  leerCortesDelPeriodo,
  leerDelPeriodo,
  leerVentasDelPeriodo,
} from '~/registros/lecturas-de-registros';

// Tarjetas que se pintan a la vez (las demás siguen en la búsqueda y en el CSV).
const TOPE_EN_PANTALLA = 200;

export default function Registros() {
  const { config, paquete_modo } = useConfig();
  const sinCostos = !canAccessModule('costos_basicos', paquete_modo);
  const showOperativos = canAccessModule('compras', paquete_modo); // compras, movimientos, gastos
  const showPropinas = tipsEnabled(config);
  const { posUser } = usePOSAuth();
  const miPuesto = usePuesto();
  const isAdmin = posUser?.rol === 'administrador';
  const queryClient = useQueryClient();
  const location = useLocation();
  const [search, setSearch] = useState('');
  // DP-18 · El periodo es de la página: el resumen y todas las listas piden al servidor el mismo.
  const [periodo, setPeriodo] = useState('today');
  const [desde, setDesde] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [hasta, setHasta] = useState(format(new Date(), 'yyyy-MM-dd'));
  const range = useMemo(() => rangoDelPeriodo(periodo, desde, hasta), [periodo, desde, hasta]);
  const desdeIso = range.from.toISOString();
  const hastaIso = range.to.toISOString();
  // DP-16 · Ventas de las mesas, pedidos para llevar, o todas.
  const [canal, setCanal] = useState('todos');
  const [verCorte, setVerCorte] = useState(null);
  const [verVenta, setVerVenta] = useState(null);
  const [pdfData, setPdfData] = useState(null);

  // Tab inicial desde ?tab=propinas (deep link desde Dashboard)
  const initialTab = (() => {
    try {
      const sp = new URLSearchParams(location.search);
      const t = sp.get('tab');
      if (
        t &&
        ['cortes', 'ventas', 'cancelaciones', 'propinas', 'compras', 'movimientos', 'gastos'].includes(
          t,
        )
      )
        return t;
    } catch (_) {
      /* noop */
    }
    return 'cortes';
  })();
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(location.search);
      const t = sp.get('tab');
      if (
        t &&
        ['cortes', 'ventas', 'cancelaciones', 'propinas', 'compras', 'movimientos', 'gastos'].includes(
          t,
        )
      ) {
        setActiveTab(t);
      }
    } catch (_) {
      /* noop */
    }
  }, [location.search]);

  const eliminarCorte = async (c) => {
    // `isAdmin` es una variable del NAVEGADOR: quien abra las herramientas de
    // desarrollo y la ponga en `true` borraba la contabilidad del negocio, y el
    // `confirm` se cancela desde la consola sin tocarlo. Esta comprobación se
    // QUEDA porque sirve para no enseñar un botón que va a fallar —es
    // presentación—, pero la que manda es la del comando: `caja.eliminar_corte`
    // es de DUEÑO, y el rol sale de la cookie de sesión, no de aquí.
    if (!isAdmin) return;
    if (!confirm(`¿Eliminar corte ${c.folio}? Esta acción no se puede deshacer.`)) return;
    try {
      await api.comandos.ejecutar('/api/caja/eliminar-corte', { corteId: c.id });
      queryClient.invalidateQueries({ queryKey: ['registros_cortes'] });
      queryClient.invalidateQueries({ queryKey: ['cortes_historial'] });
      queryClient.invalidateQueries({ queryKey: ['cortes'] });
      queryClient.invalidateQueries({ queryKey: ['cortes_caja_estado'] });
      toast.success('Corte eliminado');
    } catch (err) {
      // El comando cuenta lo que impide el borrado con números: «Ese corte tiene
      // 34 ventas registradas y no se puede eliminar…». Eso es lo que se enseña.
      // Tragarlo dejaba al dueño creyendo que el corte se borró.
      toast.error(err?.message || 'No se pudo eliminar el corte');
    }
  };

  const q = search.trim().toLowerCase();

  // Sin initialData:[] — distinguimos "primer fetch" (loading) de "vacío real".
  // Antes mostraba "Sin registros" mientras cargaba la primera vez.
  // DP-18 · Sin «datos anteriores» de relleno: al cambiar de periodo no se enseña el anterior bajo el rótulo nuevo.
  // DP-18 · Cada pestaña pide el PERIODO al servidor (con ventanas si pasa del tope por petición)
  // y devuelve `{ filas, truncada }`: si algo quedó sin traer, la pantalla lo dice.
  const delPeriodo = { desde: desdeIso, hasta: hastaIso };
  const lectura = (entidad, { campo, tipo }) => ({
    queryFn: () => leerDelPeriodo(api.entidades[entidad], campo, tipo, range),
    ...OPCIONES_DE_LECTURA,
  });
  const { data: cortesRaw, isPending: cortesLoading } = useQuery({
    queryKey: ['registros_cortes', delPeriodo],
    queryFn: () => leerCortesDelPeriodo(api.entidades.CorteCaja, range),
    ...OPCIONES_DE_LECTURA,
  });
  const { data: ventasRaw, isPending: ventasLoading } = useQuery({
    queryKey: claves.registrosVentas.delPeriodo(desdeIso, hastaIso),
    queryFn: () => leerVentasDelPeriodo(api.entidades.Venta, range),
    ...OPCIONES_DE_LECTURA,
  });
  const { data: comprasRaw, isPending: comprasLoading } = useQuery({
    queryKey: ['registros_compras', delPeriodo],
    ...lectura('CompraInsumo', CAMPO_DEL_PERIODO.compras),
  });
  const { data: movimientosRaw, isPending: movimientosLoading } = useQuery({
    queryKey: ['registros_movimientos', delPeriodo],
    ...lectura('MovimientoInventario', CAMPO_DEL_PERIODO.movimientos),
  });
  const { data: gastosRaw, isPending: gastosLoading } = useQuery({
    queryKey: ['registros_gastos', delPeriodo],
    ...lectura('GastoOperativo', CAMPO_DEL_PERIODO.gastos),
  });

  // Normalización defensiva (nunca undefined a .filter/.map).
  const filasDe = (lecturaDe) => (Array.isArray(lecturaDe?.filas) ? lecturaDe.filas : []);
  const cortes = filasDe(cortesRaw);
  const ventas = filasDe(ventasRaw);
  const compras = filasDe(comprasRaw);
  const movimientos = filasDe(movimientosRaw);
  const gastos = filasDe(gastosRaw);
  // Se pintan las más recientes; la búsqueda y la exportación usan todas las cargadas.
  const avisoDeLoListado = (total) => {
    if (total <= TOPE_EN_PANTALLA) return null;
    const texto = `Se listan las ${TOPE_EN_PANTALLA} más recientes de ${total}; la búsqueda y la exportación incluyen las ${total}.`;
    return <Aviso tono="info" titulo={texto} />;
  };
  // DP-18 · Si una lectura llegó al techo, lo que falta se AVISA (antes desaparecía sin decir).
  const avisoDe = (nombre, lecturaDe) => {
    const texto = avisoDelTopeDeRegistros(
      nombre,
      filasDe(lecturaDe).length,
      lecturaDe?.truncada === true,
    );
    return texto === null ? null : <Aviso tono="atencion" titulo={texto} />;
  };

  // Flags de "primera carga aún en curso": NO mostrar empty mientras esté true.
  const cortesFirstLoad = cortesLoading && !cortesRaw;
  const ventasFirstLoad = ventasLoading && !ventasRaw;
  const comprasFirstLoad = comprasLoading && !comprasRaw;
  const movimientosFirstLoad = movimientosLoading && !movimientosRaw;
  const gastosFirstLoad = gastosLoading && !gastosRaw;

  // Búsqueda universal por código, folio, producto, fecha, mesa, etc.
  const filterFn = (text) => !q || (text || '').toString().toLowerCase().includes(q);

  const ventasFiltradas = useMemo(
    () =>
      ventas.filter(
        (v) =>
          (canal === 'todos' || grupoDelCanal(v.canal) === canal) &&
          (filterFn(v.folio) ||
          filterFn(v.codigo_caja) ||
          filterFn(v.cliente_nombre) ||
          filterFn(v.usuario_cajero_nombre) ||
          filterFn(v.usuario_mesero_nombre) ||
          filterFn(String(v.mesa_numero)) ||
          filterFn(v.metodo_pago) ||
          filterFn(v.estado) ||
          filterFn(v.fecha_apertura?.slice(0, 10)) ||
          filterFn(v.fecha_cierre?.slice(0, 10)) ||
          filterFn(v.nombre_pedido)),
      ),
    [ventas, q, canal],
  );

  const cortesFiltrados = useMemo(
    () =>
      cortes.filter(
        (c) =>
          filterFn(c.folio) ||
          filterFn(c.usuario_cajero_nombre) ||
          filterFn(c.estado) ||
          filterFn(c.fecha_cierre?.slice(0, 10)),
      ),
    [cortes, q],
  );

  const comprasFiltradas = useMemo(
    () =>
      compras.filter(
        (c) =>
          filterFn(c.proveedor_nombre) ||
          filterFn(c.factura_folio) ||
          filterFn(c.usuario_nombre) ||
          filterFn(c.metodo_pago) ||
          filterFn(c.fecha),
      ),
    [compras, q],
  );

  const movimientosFiltrados = useMemo(
    () =>
      movimientos.filter(
        (m) =>
          filterFn(m.ingrediente_nombre) ||
          filterFn(m.tipo_movimiento) ||
          filterFn(m.motivo) ||
          filterFn(m.usuario_nombre),
      ),
    [movimientos, q],
  );

  const gastosFiltrados = useMemo(
    () =>
      gastos.filter(
        (g) =>
          filterFn(g.descripcion) ||
          filterFn(g.categoria) ||
          filterFn(g.usuario_nombre) ||
          filterFn(g.fecha),
      ),
    [gastos, q],
  );

  const handlePDF = (data) => {
    setPdfData(data);
    setTimeout(() => {
      printDocument({ mode: 'letter', title: `Reporte-${data.periodo}` });
    }, 250);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registros"
        description="Historial completo de operaciones y reportes administrativos"
      />

      {/* Resumen general con periodos y PDF */}
      <ResumenPeriodo
        periodo={periodo}
        desde={desde}
        hasta={hasta}
        range={range}
        onPeriodo={setPeriodo}
        onDesde={setDesde}
        onHasta={setHasta}
        ventas={ventas}
        compras={compras}
        gastos={gastos}
        onPDF={handlePDF}
        cargando={ventasFirstLoad || (showOperativos && (comprasFirstLoad || gastosFirstLoad))}
      />

      <p className="text-xs text-muted-foreground">
        Las listas de abajo muestran el periodo de arriba:{' '}
        {format(range.from, 'd MMM', { locale: es })} – {format(range.to, 'd MMM yyyy', { locale: es })}.
      </p>

      {/* Buscador universal */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por código de corte, folio, ticket, producto, fecha, mesa, responsable..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 bg-superficie/80 backdrop-blur-sm"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto bg-superficie/70 backdrop-blur-sm">
          <TabsTrigger value="cortes" className="gap-1">
            <FileText className="w-3 h-3" />
            Cortes ({cortesFiltrados.length})
          </TabsTrigger>
          <TabsTrigger value="ventas" className="gap-1">
            <Receipt className="w-3 h-3" />
            {/* DP-15 · La lista trae TODAS (también canceladas y divididas); arriba se cuentan las
                cobradas. Cada número dice qué cuenta. */}
            Ventas ({ventasFiltradas.length}
            {ventasFiltradas.some((v) => v?.estado !== 'pagada')
              ? ` · ${ventasFiltradas.filter((v) => v?.estado === 'pagada').length} cobradas`
              : ''}
            )
          </TabsTrigger>
          {/* DP-12.4 · Las cuentas canceladas y los platillos anulados, con quién, cuándo, por qué,
              cuánto y si ya estaban preparados (pérdida). Del servidor, como el corte. */}
          <TabsTrigger value="cancelaciones" className="gap-1">
            <Ban className="w-3 h-3" />
            Cancelaciones
          </TabsTrigger>
          {showPropinas && (
            <TabsTrigger value="propinas" className="gap-1">
              <Heart className="w-3 h-3" />
              Propinas
            </TabsTrigger>
          )}
          {showOperativos && (
            <TabsTrigger value="compras" className="gap-1">
              <ShoppingBag className="w-3 h-3" />
              Compras ({comprasFiltradas.length})
            </TabsTrigger>
          )}
          {showOperativos && (
            <TabsTrigger value="movimientos" className="gap-1">
              <Package className="w-3 h-3" />
              Movimientos ({movimientos.length})
            </TabsTrigger>
          )}
          {showOperativos && (
            <TabsTrigger value="gastos" className="gap-1">
              <Scissors className="w-3 h-3" />
              Gastos ({gastosFiltrados.length})
            </TabsTrigger>
          )}
          {/* DP-15 · Lo que se cambió, quién y cuándo (la caja renombrada, un PIN, un agotado…). */}
          {esDeMando(miPuesto) && (
            <TabsTrigger value="auditoria" className="gap-1">
              Auditoría
            </TabsTrigger>
          )}
        </TabsList>

        {/* CANCELACIONES (DP-12.4) */}
        <TabsContent value="cancelaciones" className="mt-4 space-y-3">
          <CancelacionesRegistradas busqueda={search} />
        </TabsContent>

        {/* PROPINAS */}
        {showPropinas && (
          <TabsContent value="propinas" className="mt-4">
            <PropinasRegistros />
          </TabsContent>
        )}

        {/* CORTES */}
        <TabsContent value="cortes" className="mt-4 space-y-3">
          {avisoDe('cortes', cortesRaw)}
          <div className="flex justify-end gap-2">
            <ExportarSeccionButton
              rows={(q ? cortesFiltrados : cortes).filter((c) => c.estado === 'cerrado')}
              columns={COLUMNS_CORTES}
              disabled={cortesFirstLoad}
              filename="cortes-caja"
            />
            <LimpiarSeccionButton seccion="cortes" />
          </div>
          {cortesFirstLoad ? (
            <LoadingRow label="Cargando cortes…" />
          ) : (
            (() => {
              const fuente = q ? cortesFiltrados : cortes;
              const items = fuente
                .filter((c) => {
                  const tipo = c?.tipo_corte === 'turno' ? 'turno' : 'cierre_diario';
                  return (
                    (tipo === 'cierre_diario' && c?.estado === 'cerrado') ||
                    (tipo === 'turno' && c?.estado === 'registrado')
                  );
                })
                .slice(0, TOPE_EN_PANTALLA);
              if (items.length === 0) return <Empty />;
              return (
                <div className="space-y-2">
                  {items.map((c) => (
                    <CorteRow
                      key={c.id}
                      corte={c}
                      onView={setVerCorte}
                      onDelete={isAdmin ? eliminarCorte : null}
                    />
                  ))}
                </div>
              );
            })()
          )}
        </TabsContent>

        {/* VENTAS */}
        <TabsContent value="ventas" className="mt-4 space-y-3">
          {avisoDe('ventas', ventasRaw)}
          {avisoDeLoListado(ventasFiltradas.length)}
          <div className="flex justify-between gap-2 flex-wrap">
            <div className="flex gap-1.5" role="group" aria-label="Filtrar por canal">
              {[
                ['todos', 'Todas'],
                ['mesas', 'Mesas'],
                ['llevar', 'Para llevar'],
              ].map(([valor, nombre]) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={canal === valor}
                  onClick={() => setCanal(valor)}
                  className={`min-h-9 px-3 rounded-full text-sm font-medium border ${
                    canal === valor ? 'bg-primary text-primario-texto border-primary' : 'bg-superficie'
                  }`}
                >
                  {nombre}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 flex-wrap">
            <ExportarSeccionButton
              rows={ventasFiltradas}
              columns={COLUMNS_VENTAS}
              disabled={ventasFirstLoad}
              filename="ventas"
            />
            {/* 6B / 1.I — Export granular por producto (líneas de venta).
                Distingue cantidad lógica vs cantidad variable (500 g / 4 shots). */}
            <ExportarDetallesButton ventas={ventasFiltradas} disabled={ventasFirstLoad} />
            <LimpiarSeccionButton seccion="ventas" />
            </div>
          </div>
          <div className="space-y-2">
            {ventasFirstLoad ? (
              <LoadingRow label="Cargando ventas…" />
            ) : ventasFiltradas.length === 0 ? (
              <Empty />
            ) : null}
            {!ventasFirstLoad &&
              ventasFiltradas.slice(0, TOPE_EN_PANTALLA).map((v) => (
                <Card
                  key={v.id}
                  className="premium-sheen p-3 flex items-center gap-3 flex-wrap bg-superficie/70 backdrop-blur-sm"
                >
                  <div className="flex-1 min-w-[180px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono font-bold text-sm">{v.folio}</p>
                      {/* Valoración del comensal (Prompt 6C). Solo lectura. */}
                      {v.satisfaccion_score && v.satisfaccion_emoji && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted/60 border text-[10px] font-semibold"
                          title={v.satisfaccion_label || ''}
                        >
                          <span className="text-sm leading-none">{v.satisfaccion_emoji}</span>
                          <span>{v.satisfaccion_label || `${v.satisfaccion_score}/5`}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {v.fecha_apertura
                        ? format(new Date(v.fecha_apertura), 'd MMM yyyy, HH:mm', { locale: es })
                        : ''}
                      {grupoDelCanal(v.canal) === 'llevar'
                        ? ` · ${referenciaParaLlevar(v.numero_pedido, v.nombre_pedido)}`
                        : v.mesa_numero
                          ? ` · Mesa ${v.mesa_numero}`
                          : ''}
                      {v.usuario_cajero_nombre ? ` · ${v.usuario_cajero_nombre}` : ''}
                    </p>
                    {v.satisfaccion_comentario && (
                      <p className="text-[11px] italic text-muted-foreground mt-0.5 line-clamp-2">
                        💬 “{v.satisfaccion_comentario}”
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="capitalize text-[10px]">
                    {v.estado}
                  </Badge>
                  <Badge variant="secondary" className="capitalize text-[10px]">
                    {v.metodo_pago || '—'}
                  </Badge>
                  <p className="font-heading font-black min-w-[80px] text-right">
                    {formatCurrency(v.total)}
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setVerVenta(v)}>
                    <Printer className="w-3 h-3 mr-1" /> Ver ticket
                  </Button>
                </Card>
              ))}
          </div>
        </TabsContent>

        {/* COMPRAS */}
        <TabsContent value="compras" className="mt-4 space-y-3">
          {avisoDe('compras', comprasRaw)}
          <div className="flex justify-end gap-2">
            <ExportarSeccionButton
              rows={comprasFiltradas}
              columns={COLUMNS_COMPRAS}
              disabled={comprasFirstLoad}
              filename="compras"
            />
            <LimpiarSeccionButton seccion="compras" />
          </div>
          <div className="space-y-2">
            {comprasFirstLoad ? (
              <LoadingRow label="Cargando compras…" />
            ) : comprasFiltradas.length === 0 ? (
              <Empty />
            ) : null}
            {!comprasFirstLoad &&
              comprasFiltradas.map((c) => (
                <Card
                  key={c.id}
                  className="premium-sheen p-3 flex items-center gap-3 flex-wrap bg-superficie/70 backdrop-blur-sm"
                >
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-semibold text-sm">
                      {c.proveedor_nombre || 'Compra directa'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.fecha} {c.factura_folio ? `· ${c.factura_folio}` : ''}
                      {c.usuario_nombre ? ` · ${c.usuario_nombre}` : ''}
                    </p>
                  </div>
                  <Badge variant="secondary" className="capitalize text-[10px]">
                    {c.metodo_pago || '—'}
                  </Badge>
                  <p className="font-heading font-black min-w-[80px] text-right">
                    {formatCurrency(c.total_compra)}
                  </p>
                </Card>
              ))}
          </div>
        </TabsContent>

        {/* MOVIMIENTOS — con paginación */}
        <TabsContent value="movimientos" className="mt-4 space-y-3">
          {avisoDe('movimientos', movimientosRaw)}
          <div className="flex justify-end gap-2">
            <ExportarSeccionButton
              rows={movimientosFiltrados}
              columns={COLUMNS_MOVIMIENTOS}
              disabled={movimientosFirstLoad}
              filename="movimientos-inventario"
            />
            <LimpiarSeccionButton seccion="movimientos" />
          </div>
          {movimientosFirstLoad ? (
            <LoadingRow label="Cargando movimientos…" />
          ) : (
            <MovimientosPanel movimientos={movimientos} />
          )}
        </TabsContent>

        {/* GASTOS */}
        <TabsContent value="gastos" className="mt-4 space-y-3">
          {avisoDe('gastos', gastosRaw)}
          <div className="flex justify-end gap-2">
            <ExportarSeccionButton
              rows={gastosFiltrados}
              columns={COLUMNS_GASTOS}
              disabled={gastosFirstLoad}
              filename="gastos-operativos"
            />
            <LimpiarSeccionButton seccion="gastos" />
          </div>
          <div className="space-y-2">
            {gastosFirstLoad ? (
              <LoadingRow label="Cargando gastos…" />
            ) : gastosFiltrados.length === 0 ? (
              <Empty />
            ) : null}
            {!gastosFirstLoad &&
              gastosFiltrados.map((g) => (
                <Card
                  key={g.id}
                  className="premium-sheen p-3 flex items-center gap-3 flex-wrap bg-superficie/70 backdrop-blur-sm"
                >
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-semibold text-sm">{g.descripcion}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.fecha} · <span className="capitalize">{g.categoria}</span>
                      {g.usuario_nombre ? ` · ${g.usuario_nombre}` : ''}
                    </p>
                  </div>
                  <Badge variant="secondary" className="capitalize text-[10px]">
                    {g.metodo_pago || '—'}
                  </Badge>
                  <p
                    className={`font-heading font-black min-w-[80px] text-right ${config?.colorear_importes_monetarios !== false ? 'text-peligro' : 'text-foreground'}`}
                  >
                    −{formatCurrency(g.monto)}
                  </p>
                </Card>
              ))}
          </div>
        </TabsContent>
        {esDeMando(miPuesto) && (
          <TabsContent value="auditoria" className="mt-4">
            <AuditoriaReciente />
          </TabsContent>
        )}
      </Tabs>

      <CorteViewerDialog corte={verCorte} open={!!verCorte} onClose={() => setVerCorte(null)} />
      <TicketViewerDialog venta={verVenta} open={!!verVenta} onClose={() => setVerVenta(null)} />

      {/* PDF de periodo (solo visible al imprimir) */}
      {pdfData && (
        <div className="fixed inset-0 z-[9999] bg-fondo-sutil overflow-auto">
          <div className="no-print sticky top-0 bg-superficie border-b shadow-sm flex justify-between items-center px-4 py-2">
            <p className="text-sm font-medium">Vista previa del reporte</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-1" />
                Imprimir
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPdfData(null)}>
                Cerrar
              </Button>
            </div>
          </div>
          <div className="py-6 flex justify-center">
            <PeriodoPDF data={pdfData} config={config} sinCostos={sinCostos} />
          </div>
        </div>
      )}
    </div>
  );
}

function Empty() {
  return <p className="text-center text-muted-foreground py-8 text-sm">Sin registros</p>;
}

/** Loader compacto en línea — se muestra mientras la query hace su primer fetch.
 *  Evita el "Sin registros" falso al entrar a Registros con caché vacía. */
function LoadingRow({ label = 'Cargando…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
      <span className="w-4 h-4 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
      {label}
    </div>
  );
}

/**
 * 6B / 1.I — Exporta el desglose por producto (DetalleVenta) de las ventas
 * actualmente filtradas. Carga bajo demanda (no afecta render inicial).
 *
 * Distingue cantidad lógica (líneas) vs cantidad variable real (g, ml, shots).
 * Para productos precio_fijo, las columnas variables salen vacías (no NaN).
 */
function ExportarDetallesButton({ ventas, disabled = false }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    const lista = Array.isArray(ventas) ? ventas : [];
    if (lista.length === 0) {
      toast.warning('No hay ventas para exportar productos.');
      return;
    }
    if (lista.length > 300) {
      const ok = window.confirm(
        `Vas a exportar el desglose por producto de ${lista.length} ventas. Puede tardar unos segundos. ¿Continuar?`,
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      // Cargar detalles de venta para las ventas filtradas, en lotes pequeños
      // para no saturar al backend (cada filter es una request).
      const detalles = [];
      const CHUNK = 5;
      for (let i = 0; i < lista.length; i += CHUNK) {
        const slice = lista.slice(i, i + CHUNK);
        // Sin `.catch(() => [])`: con él, el CSV se descargaba COMPLETO en
        // apariencia y con ventas sin sus productos dentro (F1-06 §4.11). Un
        // archivo incompleto que se descarga solo es peor que uno que no se
        // descarga: nadie vuelve a comprobarlo. Ahora el fallo aborta la
        // exportación y lo dice.
        const results = await Promise.all(
          slice.map((v) => api.entidades.DetalleVenta.filter({ venta_id: v.id })),
        );
        results.forEach((arr, idx) => {
          const venta = slice[idx];
          (Array.isArray(arr) ? arr : []).forEach((d) => {
            detalles.push({
              ...d,
              venta_id: venta?.folio || d?.venta_id, // mostramos folio en el CSV
            });
          });
        });
      }
      if (detalles.length === 0) {
        toast.warning('No se encontraron productos en las ventas seleccionadas.');
        setBusy(false);
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      exportToCSV(detalles, COLUMNS_DETALLES_VENTA, `productos-vendidos-${stamp}`);
      toast.success(`Exportadas ${detalles.length} líneas de venta`);
    } catch (err) {
      toast.error(err?.message || 'No se pudo exportar el desglose por producto.');
    }
    setBusy(false);
  };
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy || disabled}
      onClick={run}
      className="gap-1.5"
    >
      <FileText className="w-4 h-4" />
      {busy ? 'Exportando…' : 'Exportar productos'}
    </Button>
  );
}

function CorteRow({ corte, onView, onDelete }) {
  const tipo = corte?.tipo_corte === 'turno' ? 'turno' : 'cierre_diario';
  const esCierreDiario = tipo === 'cierre_diario';
  const tipoLabel = esCierreDiario ? 'Cierre diario' : 'Corte de turno';
  const tipoCls = esCierreDiario
    ? 'bg-peligro/15 text-peligro border-peligro/30'
    : 'bg-advertencia/15 text-advertencia border-advertencia/30';
  return (
    <Card className="p-3 flex items-center gap-3 flex-wrap bg-superficie/70 backdrop-blur-sm">
      <div className="flex-1 min-w-[180px]">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-heading font-bold text-sm">{corte.folio}</p>
          <span
            className={`px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${tipoCls}`}
          >
            {tipoLabel}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {corte.fecha_cierre
            ? format(new Date(corte.fecha_cierre), 'd MMM yyyy, HH:mm', { locale: es })
            : ''}
          {corte.usuario_cajero_nombre ? ` · ${corte.usuario_cajero_nombre}` : ''}
        </p>
      </div>
      <p className="font-heading font-black min-w-[100px] text-right">
        {formatCurrency(corte.total_general)}
      </p>
      {esCierreDiario ? (
        <Button size="sm" variant="outline" onClick={() => onView(corte)}>
          <FileText className="w-4 h-4 mr-1" /> Ver PDF
        </Button>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => onView(corte)}>
          Ver detalle
        </Button>
      )}
      {onDelete && (
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10"
          onClick={() => onDelete(corte)}
          title="Eliminar este corte"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </Card>
  );
}
