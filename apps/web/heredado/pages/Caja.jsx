'use client';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { api, nuevaClave } from '@/api/cliente';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePOSAuth } from '@/lib/POSAuthContext';
import { useConfig } from '@/lib/ConfigContext';
import { formatCurrency, formatPercent, generateFolio } from '@/utils/financialUtils';
import { hasPermission } from '@/lib/permissions';
import { canAccessModule } from '@/lib/packageConfig';
import { toast } from 'sonner';
import {
  Landmark,
  Search,
  DollarSign,
  Smartphone,
  Receipt,
  TrendingUp,
  CheckCircle2,
  Scissors,
  Printer,
  FileText,
  ShoppingBag,
  Plus,
  Wallet,
  ShoppingCart,
  DoorOpen,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { Link } from '@/enrutado';
import PreCuentaTicket from '@/components/tickets/PreCuentaTicket';
import LiquidarPropinasDialog from '@/components/propinas/LiquidarPropinasDialog';
import CorteViewerDialog from '@/components/cortes/CorteViewerDialog';
import CorteAutoDownloader from '@/components/cortes/CorteAutoDownloader';
import { printDocument } from '@/lib/print';
import CorteHistorialList from '@/components/cortes/CorteHistorialList';
import ResumenDelDia from '@/components/caja/ResumenDelDia';
import ParaLlevarDialog, { claveDelParaLlevar } from '@/components/caja/ParaLlevarDialog';
import { ParaLlevarDeHoy, CLAVE_PARA_LLEVAR_DEL_DIA } from '~/restaurante/para-llevar/ParaLlevarDeHoy';
import { almacenDelBorrador, borrarBorrador } from '~/restaurante/borrador-del-pedido';
import {
  agruparPropinasPorMesero,
  desgloseMetodosPagoExacto,
  getPorcentajesSugeridos,
  propinaAlReleer,
  propinaDerivada,
  sumarPropinas,
  tipsEnabled,
} from '@/utils/tipsUtils';
import SafeBoundary from '@/components/common/SafeBoundary';
import AbrirCajaDialog from '@/components/caja/AbrirCajaDialog';
import { textoDeAbrir } from '~/restaurante/cajas-en-otros-aparatos';
import CajasEnOtrosAparatos from '@/components/caja/CajasEnOtrosAparatos';
import CorteTurnoDialog from '@/components/caja/CorteTurnoDialog';
import CierreDiarioDialog from '@/components/caja/CierreDiarioDialog';
import MesasPendientesCierreDialog from '@/components/caja/MesasPendientesCierreDialog';
import { obtenerMesasPendientesCierre } from '@/utils/mesasPendientesCierre';
import { useCajaAbierta } from '@/lib/useCajaAbierta';
import { sumarSubtotalDetalles } from '@/utils/ventaTotales';
import { TIPO_VENTA } from '@/utils/tipoVentaUtils';
// El cobro entero es una transacción del servidor (`venta.cobrar`), así que el
// costeo por línea variable y la validación de stock del navegador ya no se
// usan aquí: los hace el comando, sobre las líneas que está congelando.
import { aCentavos, aPesos } from '@/components/caja/dinero';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { safeFormatDate } from '@/lib/safeFormat';
import StatCard from '@/components/common/StatCard';
import { claves } from '~/cliente/claves-de-consulta';
import {
  liberarMesaConPregunta,
  preguntarPorElGrupo,
} from '~/restaurante/unir-mesas/liberar-con-pregunta';
import {
  liberarTrasCobrar,
  mesaParaLiberarTrasCobrar,
} from '~/restaurante/unir-mesas/liberar-tras-cobrar';
import { MovimientosDeCaja } from '~/restaurante/MovimientosDeCaja';
import { AparatoEnLaCaja, abrirCajonAlCobrar } from '~/impresion/CajonEnLaCaja';
import { usePuesto } from '@/components/configuracion/usePuesto';

/** DP-15 · Quien registra un gasto o una devolución desde la caja (los roles de esos comandos). */
const PUEDEN_ADMINISTRAR_LA_CAJA = ['dueno', 'administrador', 'gerente'];
import { sonar } from '~/sonidos/gestor';
import { economiaDelPeriodo } from '~/restaurante/margen-de-las-ventas';
import { DividirLaCuenta } from '~/restaurante/DividirLaCuenta';
import { CancelarLaCuenta, DescuentoDeLaCuenta } from '~/restaurante/AjustesDeLaCuenta';
import { rotuloDeLaCuenta } from '~/restaurante/cuenta-de-la-caja';
import { DescuentoAutorizado } from '~/restaurante/DescuentoAutorizado';
import { cantidadParaMostrar } from '~/restaurante/peso';
import { totalesDelPapel } from '~/venta/totales-del-papel';
import {
  alUsarEsa,
  entradaDeFijarPropina,
  estaDecidida,
  laCajaEligeLaPropina,
  propinaDelConflicto,
  textoDelAviso,
} from '~/venta/propina-en-la-caja';
import { TarjetaDeCobro } from '~/venta/TarjetaDeCobro';
import { QuitarDeLaCuenta } from '~/venta/QuitarDeLaCuenta';
import { propinaBase } from '~/venta/cuenta-del-cobro';
import { propinaDeLaCuenta, propinaParaLaCuenta } from '~/venta/propina-del-cobro';
import { notaSinLasOpciones, renglonesDeLasOpciones } from '~/venta/opciones-del-renglon';
import { usePropinaAlDia } from '~/venta/use-propina-al-dia';
import { coincideConElFolio, folioVisible } from '@morphiqpos/domain/venta';

/**
 * Los valores que `venta.cobrar` acepta como metadato de la propina.
 *
 * Son los seis del `check propina_tipo` y los cinco del `check propina_origen`.
 * Se filtra contra estas listas antes de mandar: una venta vieja con un valor
 * fuera del `check` haría fallar el cobro ENTERO con ENTRADA_INVALIDA, y lo que
 * está en juego es el cobro, no la etiqueta de cómo se decidió la propina.
 */
const TIPOS_DE_PROPINA = [
  'sin_propina',
  'porcentaje',
  'monto_manual',
  'pendiente',
  'pendiente_cliente',
  'decidir_en_caja',
];
const ORIGENES_DE_PROPINA = ['mesero', 'caja', 'tradicional', 'portal_qr', 'pendiente_portal_qr'];

export default function Caja() {
  const { posUser } = usePOSAuth();
  const { config, paquete_modo } = useConfig();
  const queryClient = useQueryClient();
  const verCostos = hasPermission(posUser?.rol, 'ver_costos');
  // Sin mesas no hay flujo de mesero/cocina ⇒ no hay cobros pendientes. Se
  // pregunta por el módulo y no por el nombre de la plantilla: enumerar nombres
  // es lo que dejó esta pantalla creyendo que un abarrotes cobra por mesa.
  const isCajaDirecta = !canAccessModule('mesas', paquete_modo);
  const [showTicketFinal, setShowTicketFinal] = useState(false);
  const [ticketFinalData, setTicketFinalData] = useState(null);
  const [codigoBusqueda, setCodigoBusqueda] = useState('');
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
  const [detallesSeleccionados, setDetallesSeleccionados] = useState([]);
  const [procesando, setProcesando] = useState(false);
  const [procesandoMsg, setProcesandoMsg] = useState('');
  const [showCierreExito, setShowCierreExito] = useState(false);
  const [corteCerrado, setCorteCerrado] = useState(null);
  const [verPDFCorte, setVerPDFCorte] = useState(null);
  const [autoDownloadCorte, setAutoDownloadCorte] = useState(null);

  // === Estados de los 3 modales nuevos ===
  const [showAbrirCaja, setShowAbrirCaja] = useState(false);
  // DP-21 · Bloque 5: el lugar que se eligió abrir («Abrir Caja 2 aquí»); null = el primero libre.
  const [lugarParaAbrir, setLugarParaAbrir] = useState(null);
  const [showCorteTurno, setShowCorteTurno] = useState(false);
  const [showCierreDiario, setShowCierreDiario] = useState(false);
  const [accionLoading, setAccionLoading] = useState(false);
  // 6A: bloqueo de cierre si hay mesas abiertas
  const [mesasPendientes, setMesasPendientes] = useState(null); // array | null
  const [verificandoMesas, setVerificandoMesas] = useState(false);
  // DP-24 · La propina se elige en la tarjeta de cobro: mientras viaja al servidor, y lo que haya
  // que decirle a quien cobra (la eligió otra pantalla).
  const [guardandoPropina, setGuardandoPropina] = useState(false);
  const [avisoDeLaPropina, setAvisoDeLaPropina] = useState(null);
  // DP-24 · «Agregar a la cuenta» y «Para llevar» desde la tarjeta: `null`, o qué se agrega.
  const [agregandoALaCuenta, setAgregandoALaCuenta] = useState(null);
  // DP-24 · El renglón que se está quitando desde la tarjeta (con motivo, y PIN si es la cajera).
  const [quitandoDeLaCuenta, setQuitandoDeLaCuenta] = useState(null);
  // DP-24 · «Liquidar propinas» que se ofrece al terminar el corte (el mismo diálogo del Tablero).
  const [liquidandoTrasElCorte, setLiquidandoTrasElCorte] = useState(false);
  const { data: usuariosDeLaCaja = [] } = useQuery({
    queryKey: claves.usuarios.activos(),
    queryFn: () => api.entidades.UsuarioPOS.filter({ activo: true }),
    initialData: [],
  });

  // Caja abierta global (fuente única de verdad)
  // Mientras carga, `hayCaja` es falso: el aviso amarillo de «No hay caja abierta» y «Abrir
  // caja» habilitado aparecían medio segundo con la caja ya abierta (el día del restaurante).
  const {
    cajaAbierta,
    hayCaja,
    otrasCajas,
    abiertasEnLaSucursal,
    puedoAbrir,
    cupoDeCajas,
    lugaresLibres,
    nombreDeLaCaja,
    fondoEsperado,
    isLoading: cargandoCaja,
  } = useCajaAbierta({ deEstaTerminal: true });
  const miPuesto = usePuesto();

  // Clave de idempotencia del cobro: se genera al ABRIR el diálogo de cobro y
  // se reusa mientras siga abierto (F1-02 §8, trampa T5). Es lo que impide que
  // un doble clic en «Cobrar» —o un reintento de red— cobre dos veces y
  // descuente el inventario dos veces. Al cerrar el diálogo se descarta, para
  // que el siguiente cobro no herede la clave del anterior.
  const [claveCobro, setClaveCobro] = useState(null);
  const ventaEnCobroId = ventaSeleccionada?.id || null;
  // DP-21 (Bloque 4): con el cobro abierto, la cuenta se relee cada pocos segundos. Si los
  // comensales (o el mesero) eligen la propina mientras tanto, sale un aviso que interrumpe.
  const propinaAlDia = usePropinaAlDia({
    cuenta: ventaSeleccionada,
    pausada: procesando || guardandoPropina,
    leer: (ordenId) => api.entidades.Venta.get(ordenId),
    alCambiar: (parche) => setVentaSeleccionada((prev) => (prev ? { ...prev, ...parche } : prev)),
  });
  useEffect(() => {
    setClaveCobro(ventaEnCobroId === null ? null : nuevaClave());
    setAvisoDeLaPropina(null);
  }, [ventaEnCobroId]);
  // DP-24 · Si los comensales (o el mesero) eligen la propina con el cobro abierto, llega ya puesta
  // a la tarjeta y se dice ahí mismo, sin un diálogo encima.
  const propinaDeOtraPantalla = propinaAlDia.aviso;
  useEffect(() => {
    if (!propinaDeOtraPantalla) return;
    setAvisoDeLaPropina(
      `${textoDelAviso(propinaDeOtraPantalla)}. Ya está puesta en la cuenta; aquí la puedes cambiar.`,
    );
    propinaAlDia.usarEsa();
  }, [propinaDeOtraPantalla]);

  // DP-16 · EL PEDIDO PARA LLEVAR. «Cobrar» en su pantalla arma el borrador en el servidor y abre
  // ESTE diálogo de cobro. Si se cobra, el pedido guardado en el aparato se borra; si se cancela,
  // el borrador del servidor se vacía (a la cocina no salió nada) y la pantalla vuelve con todo.
  const [showParaLlevar, setShowParaLlevar] = useState(false);
  const [turnoParaLlevar, setTurnoParaLlevar] = useState(0);
  // DP-18 · A7 · El borrador lo dejó ESTA pantalla (cobro cancelado, o la X «Cerrar sin cobrar (el
  // pedido se guarda)»): al reabrir vuelve sin preguntar. Sólo lo que quedó de antes de una recarga
  // se pregunta.
  const [paraLlevarDeEstaSesion, setParaLlevarDeEstaSesion] = useState(false);
  const paraLlevarEnCobroRef = useRef(null);
  const paraLlevarPagadoRef = useRef(false);
  const cobrarParaLlevar = async (ordenId) => {
    const venta = await api.entidades.Venta.get(ordenId);
    if (!venta?.id) throw new Error('No se encontró el pedido para cobrarlo. Intenta de nuevo.');
    paraLlevarEnCobroRef.current = ordenId;
    paraLlevarPagadoRef.current = false;
    setShowParaLlevar(false);
    await abrirVenta(venta);
  };
  useEffect(() => {
    if (ventaEnCobroId !== null || paraLlevarEnCobroRef.current === null) return;
    const ordenId = paraLlevarEnCobroRef.current;
    paraLlevarEnCobroRef.current = null;
    if (paraLlevarPagadoRef.current) {
      paraLlevarPagadoRef.current = false;
      const clave = claveDelParaLlevar(posUser?.id);
      if (clave) borrarBorrador(almacenDelBorrador(), clave);
      setTurnoParaLlevar((n) => n + 1);
      queryClient.invalidateQueries({ queryKey: CLAVE_PARA_LLEVAR_DEL_DIA });
      return;
    }
    api.comandos
      .ejecutar('/api/restaurante/descartar-para-llevar', { ordenId }, nuevaClave())
      .catch((err) => {
        toast.warning(err?.message || 'No se pudo limpiar el cobro cancelado.', { duration: 8000 });
      });
    setParaLlevarDeEstaSesion(true);
    setShowParaLlevar(true);
  }, [ventaEnCobroId, posUser?.id, queryClient]);

  // BLOQUE 0: refetch cada 2s para que QR/Mesero → Caja sea casi en vivo.
  // Sin esto, una cuenta solicitada podía tardar hasta 6s en aparecer en Caja.
  // QA1-6 (DP-13.5): la parte de una cuenta dividida no tiene mesa; se llama por su nombre
  // («Mesa 5 · cuenta 1 de 2»), no «Mesa —».
  const rotuloDeCaja = (v) =>
    rotuloDeLaCuenta(
      { mesa_numero: v?.mesa_numero ?? null, cliente_nombre: v?.cliente_nombre ?? null },
      { mesa: 'Mesa', sinMesa: 'Sin mesa' },
    );

  const { data: ventasPendientes = [] } = useQuery({
    queryKey: ['ventas_pendientes_caja'],
    queryFn: () => api.entidades.Venta.filter({ estado: 'cuenta_solicitada' }),
    initialData: [],
    refetchInterval: 2000,
    staleTime: 1000,
  });

  const { data: ventasHoy = [] } = useQuery({
    queryKey: ['ventas_pagadas_caja'],
    queryFn: () => api.entidades.Venta.filter({ estado: 'pagada' }),
    initialData: [],
  });

  const { data: gastos = [] } = useQuery({
    // Con su tope en la clave: Compras pide otros (21-10, claves por pregunta).
    queryKey: claves.gastos.recientes(100),
    queryFn: () => api.entidades.GastoOperativo.list('-created_date', 100),
    initialData: [],
  });

  const { data: cortes = [] } = useQuery({
    queryKey: ['cortes'],
    queryFn: () => api.entidades.CorteCaja.list('-created_date', 20),
    initialData: [],
  });

  // corteAbierto = alias del cierre_diario abierto (single source of truth)
  const corteAbierto = cajaAbierta;

  // El resumen operativo se basa en la caja abierta actual.
  // Incluye ventas con corte_caja_id == cajaAbierta.id O ventas pagadas DESPUÉS
  // de fecha_apertura sin corte_caja_id (fallback para ventas en tránsito).
  // Si NO hay caja abierta, todos los KPIs operativos quedan en 0.
  const resumen = useMemo(() => {
    const safeVentas = Array.isArray(ventasHoy) ? ventasHoy : [];
    const safeGastos = Array.isArray(gastos) ? gastos : [];
    if (!cajaAbierta) {
      // DP-13.2: también sin caja, la economía de la regla (vacía): quien la lea no se cae.
      const economia = economiaDelPeriodo([]);
      return {
        numVentas: 0,
        totalEfectivo: 0,
        totalTarjeta: 0,
        totalTransferencia: 0,
        totalGeneral: 0,
        costoTotal: economia.costo,
        utilidadBruta: economia.utilidad,
        economia,
        totalGastos: 0,
        ticketPromedio: 0,
      };
    }
    const aperturaIso =
      cajaAbierta.fecha_apertura || cajaAbierta.fecha_inicio || cajaAbierta.created_date;
    const apertura = aperturaIso ? new Date(aperturaIso).getTime() : 0;
    const ventas = safeVentas.filter((v) => {
      if (!v) return false;
      if (v.corte_caja_id && v.corte_caja_id === cajaAbierta.id) return true;
      // Fallback: pagadas después de la apertura, sin corte asociado
      if (!v.corte_caja_id && v.fecha_cierre) {
        const t = new Date(v.fecha_cierre).getTime();
        return Number.isFinite(t) && t >= apertura;
      }
      return false;
    });
    const gastosCaja = safeGastos.filter((g) => {
      if (!g) return false;
      const tCreated = g.created_date ? new Date(g.created_date).getTime() : 0;
      return tCreated >= apertura;
    });
    // Propinas: sumadas aparte. NO entran a totalGeneral / utilidad / costos.
    const totalPropinas = sumarPropinas(ventas);
    // Desglose por mesero (solo se usa donde hay sala: el módulo `mesero`)
    const propinasPorMesero = agruparPropinasPorMesero(ventas);

    // === Desglose EXACTO por método de pago (sin reparto proporcional) ===
    // Usa propina_efectivo/tarjeta/transferencia cuando existen.
    // Para ventas antiguas aplica fallback seguro (ver desgloseMetodosPagoExacto).
    const metodosPagoExacto = desgloseMetodosPagoExacto(ventas);
    // Adaptador para componentes ya escritos: estructura idéntica.
    const metodosPagoConPropinas = metodosPagoExacto;
  // DP-13.2 · Costo, utilidad y margen SÓLO de las ventas con costo completo: la regla es del
  // servidor (`estado_costo`, `caja/corte/costo-conocido.ts`) y la aplica `economiaDelPeriodo`.
  // Sumar la foto del cobro contaba costo cero lo que no tiene receta e inflaba el margen.
    const economia = economiaDelPeriodo(ventas);

    return {
      numVentas: ventas.length,
      totalEfectivo: metodosPagoExacto.efectivo.ventas,
      totalTarjeta: metodosPagoExacto.tarjeta.ventas,
      totalTransferencia: metodosPagoExacto.transferencia.ventas,
      totalGeneral: ventas.reduce((s, v) => s + (v.total || 0), 0),
      costoTotal: economia.costo,
      utilidadBruta: economia.utilidad,
      economia,
      totalGastos: gastosCaja.reduce((s, g) => s + (g.monto || 0), 0),
      ticketPromedio:
        ventas.length > 0 ? ventas.reduce((s, v) => s + (v.total || 0), 0) / ventas.length : 0,
      totalPropinas,
      propinasPorMesero,
      metodosPagoConPropinas,
    };
  }, [ventasHoy, gastos, cajaAbierta]);

  // DP-13.2 · El margen de las ventas con costo completo; nulo si ninguna lo tiene.
  const margenProm = resumen.economia?.margen ?? null;

  // === FIX 6B-B: Búsqueda histórica completa por folio/código ===
  // Caso real: cliente regresa horas/días después diciendo "me cobraron mal".
  // El cajero teclea el folio/código del ticket y debe encontrar la venta
  // aunque sea de ayer, antier o de una caja cerrada.
  //
  // Estrategia:
  //  1. Normalizar (trim + UPPERCASE) la query.
  //  2. Buscar primero en pendientes (más rápido) si aplica.
  //  3. Buscar en TODO el historial (`Venta.list` con límite grande).
  //  4. Si encuentra y está pagada → mostrar ticket en modo consulta (no cobrar
  //     dos veces — `handleCobrar` ya rechaza ventas sin total válido).
  //  5. Si encuentra pendiente → flujo de cobro normal.
  //  6. Si no encuentra → mensaje claro.
  const buscarVenta = async () => {
    const codigo = String(codigoBusqueda || '')
      .trim()
      .toUpperCase();
    if (!codigo) return;

    const norm = (s) =>
      String(s || '')
        .trim()
        .toUpperCase();
    let candidatas = [];
    try {
      const lista = [];
      // En Pro priorizamos las pendientes para no chocar con búsqueda activa,
      // pero igualmente cargamos historial completo para soportar "venta vieja".
      // Sin `.catch(() => [])`: era una lectura que DECIDE. Si fallaba, la lista
      // de candidatas quedaba coja y el cajero leía «No se encontró una venta
      // con ese folio» sobre una venta que existe (F1-06 §4.1, `:281` y `:288`).
      // Ahora el fallo sube al `catch` de abajo, que lo dice.
      if (!isCajaDirecta) {
        const pend = await api.entidades.Venta.filter({ estado: 'cuenta_solicitada' });
        lista.push(...(Array.isArray(pend) ? pend : []));
      }
      // Historial extenso. Si el negocio tiene más de 5000 ventas, el cliente
      // puede reportar al cajero el ticket exacto; el límite cubre meses normales.
      const hist = await api.entidades.Venta.list('-created_date', 5000);
      lista.push(...(Array.isArray(hist) ? hist : []));
      // Deduplicar
      const seen = new Set();
      candidatas = lista.filter((v) => {
        if (!v?.id || seen.has(v.id)) return false;
        seen.add(v.id);
        return true;
      });
    } catch (err) {
      toast.error(err?.message || 'No se pudo cargar el historial. Intenta de nuevo.');
      return;
    }

    const found = candidatas.find(
      (v) =>
        norm(v?.codigo_caja) === codigo ||
        // DP-21 · «1001», «01001» y «DP-01001» son el mismo folio (DP-D128).
        coincideConElFolio(codigo, v?.serie, v?.folio, config) ||
        norm(folioVisible(v?.serie, v?.folio, config, 'numero')).includes(codigo) ||
        norm(v?.notas).includes(codigo),
    );

    if (!found) {
      toast.error('No se encontró una venta con ese folio.');
      return;
    }

    try {
      // Idem `:317`: con `.catch(() => [])` la cuenta se abría SIN líneas y el
      // cajero veía un ticket en $0.00 de una venta que sí tiene productos.
      const detalles = await api.entidades.DetalleVenta.filter({ venta_id: found.id });
      // Ventas pagadas/canceladas → modo consulta (ticket histórico).
      // Caja no debe permitir cobrar dos veces (handleCobrar valida total > 0).
      if (found.estado === 'pagada' || found.estado === 'cancelada') {
        setTicketFinalData({ venta: found, detalles: Array.isArray(detalles) ? detalles : [] });
        setShowTicketFinal(true);
        if (found.estado === 'cancelada') {
          toast.info('Esta venta está cancelada (solo consulta).');
        }
      } else {
        // Pendientes (cuenta_solicitada, abierta, etc.) → flujo de cobro.
        setVentaSeleccionada({ ...found, propina_monto: propinaDerivada(found) });
        setDetallesSeleccionados(Array.isArray(detalles) ? detalles : []);
      }
    } catch (err) {
      toast.error(err?.message || 'Se encontró la venta pero no se pudieron cargar los productos.');
    }
  };

  const abrirVenta = async (venta) => {
    const detalles = await api.entidades.DetalleVenta.filter({ venta_id: venta.id });
    const detallesArr = Array.isArray(detalles) ? detalles : [];

    // HOTFIX 6A — Rescate de totales en CERO al abrir cobro.
    // Si la venta llega con total <= 0 pero los detalles tienen subtotal real,
    // pedimos el total al servidor antes de mostrar el modal. Así el cajero ve
    // el total correcto y puede cobrar normalmente.
    //
    // Antes esto SUMABA las líneas en el navegador y escribía el resultado en
    // `Venta` (subtotal, total, costo, utilidad y margen). Dos cosas mal: la
    // escritura ya no existe —los totales de una orden los pone el servidor— y
    // el número era el del navegador, sin impuestos ni descuentos. `venta.estado`
    // devuelve la cotización recalculada sobre las líneas persistidas, que es la
    // misma que `venta.cobrar` usará para cobrar; usar otra sería enseñar en
    // pantalla un total distinto del que se va a cobrar.
    let ventaFinal = venta;
    const ventaTotal = Number(venta?.total) || 0;
    const subtotalReal = sumarSubtotalDetalles(detallesArr);
    if (subtotalReal > 0 && ventaTotal <= 0) {
      try {
        const estado = await api.comandos.ejecutar('/api/venta/estado', { ordenId: venta.id });
        const totalServidor = aPesos(estado?.cotizacion?.totalCentavos);
        if (totalServidor > 0) {
          ventaFinal = {
            ...venta,
            subtotal: aPesos(estado?.cotizacion?.subtotalCentavos),
            total: totalServidor,
          };
          toast.info('Totales recalculados desde los productos.');
        }
      } catch (err) {
        // No bloqueamos — el cajero verá $0 y el botón "Borrar ticket en cero"
        // como ya estaba antes. Pero el motivo se dice, no se traga.
        toast.error(err?.message || 'No se pudieron recalcular los totales de la cuenta.');
      }
    }

    // La propina del porcentaje se deriva del total ya resuelto, no del que la
    // venta traía: si el total se acaba de recalcular, un 15 % sobre el viejo
    // sería una propina que no corresponde a lo que se va a cobrar.
    setVentaSeleccionada({ ...ventaFinal, propina_monto: propinaDerivada(ventaFinal) });
    setDetallesSeleccionados(detallesArr);
  };

  // DP-14.1 (punto 2) · Después de descontar, la cuenta se relee del servidor: el total, las
  // líneas con su descuento repartido y la propina que se deriva de él. Lo tecleado de pagos se
  // limpia, porque era para el total de antes.
  const releerLaCuentaDelCobro = async (ordenId) => {
    try {
      const [venta, detalles] = await Promise.all([
        api.entidades.Venta.get(ordenId),
        api.entidades.DetalleVenta.filter({ venta_id: ordenId }),
      ]);
      // QA2-A3 · La propina que el cajero ya eligió se conserva (el porcentaje, sobre el total nuevo).
      setVentaSeleccionada((previa) => ({ ...venta, ...propinaAlReleer(previa, venta) }));
      setDetallesSeleccionados(Array.isArray(detalles) ? detalles : []);
      queryClient.invalidateQueries({ queryKey: ['ventas_pendientes_caja'] });
      // Al reemplazar el descuento, «Autorizó X · motivo» es el del nuevo, no el de antes.
      queryClient.invalidateQueries({ queryKey: ['descuento_autorizado', ordenId] });
    } catch (err) {
      toast.error(err?.message || 'Se aplicó, pero no se pudo releer la cuenta. Ábrela otra vez.');
    }
  };

  // Total a cobrar = venta real + propina (la venta real `total` NUNCA se modifica).
  // DP-14 (ronda 2, bloqueante 1 y medio 4): lo que dice el cobro sale del mismo cálculo que el
  // papel: los renglones en bruto, el descuento, el IVA y el total del SERVIDOR. Suma.
  const papelDelCobro = useMemo(
    () => totalesDelPapel(ventaSeleccionada, detallesSeleccionados),
    [ventaSeleccionada, detallesSeleccionados],
  );
  // DP-24 · Los renglones de la cuenta, en palabras, para la tarjeta de cobro: lo que se vende por
  // peso dice su peso («Barbacoa · 500 g»), y cada platillo enseña sus opciones y su nota.
  const renglonesDelCobro = useMemo(
    () =>
      (Array.isArray(detallesSeleccionados) ? detallesSeleccionados : []).map((d, i) => {
        const tipoSnap = d?.tipo_venta_snapshot;
        const cantidad =
          tipoSnap === TIPO_VENTA.VARIABLE_MEDIDA
            ? cantidadParaMostrar(d)
            : tipoSnap === TIPO_VENTA.PORCION_CONTENEDOR
              ? `${Number(d?.cantidad_porciones_snapshot) || 0} ${d?.nombre_porcion_snapshot || ''}`.trim()
              : `×${d?.cantidad}`;
        const nota = notaSinLasOpciones(d?.notas_producto, d?.opciones_snapshot);
        return {
          id: d?.id || String(i),
          nombre: d?.producto_nombre || 'Producto',
          cantidad,
          importeCentavos: aCentavos(d?.subtotal),
          detalles: [...renglonesDeLasOpciones(d?.opciones_snapshot), ...(nota ? [nota] : [])],
        };
      }),
    [detallesSeleccionados],
  );

  // Lo que la tarjeta dice arriba de la cuenta: la propina que eligió otra pantalla, o el aviso del
  // portal QR (el comensal todavía no elige, o pidió decidirla en caja).
  const avisoDelCobro = (() => {
    if (!ventaSeleccionada) return null;
    const origen = ventaSeleccionada.propina_origen;
    const tipo = ventaSeleccionada.propina_tipo;
    let mensaje = avisoDeLaPropina;
    let tono = 'bg-info/10 border-info/30 text-info';
    if (!mensaje && (origen === 'portal_qr' || origen === 'pendiente_portal_qr')) {
      if (origen === 'pendiente_portal_qr' || tipo === 'pendiente_cliente') {
        mensaje = 'QR: el comensal todavía no elige su propina. Puedes esperar o elegirla aquí.';
        tono = 'bg-advertencia/10 border-advertencia/30 text-advertencia';
      } else if (tipo === 'decidir_en_caja') {
        mensaje = 'QR: el comensal pidió decidir la propina en caja. Elígela aquí.';
      } else if (tipo === 'sin_propina') {
        mensaje = 'QR: el comensal eligió no dejar propina.';
      } else if ((Number(ventaSeleccionada.propina_monto) || 0) > 0) {
        mensaje = `QR: propina elegida por el comensal: ${formatCurrency(Number(ventaSeleccionada.propina_monto) || 0)}. Aquí la puedes cambiar.`;
      } else {
        mensaje = 'Cuenta pedida desde el QR.';
      }
    }
    if (!mensaje) return null;
    return (
      <div role="status" className={`rounded-lg border p-2 text-xs flex items-start gap-2 ${tono}`}>
        <Smartphone className="w-4 h-4 shrink-0 mt-0.5" />
        <p className="flex-1 font-semibold">{mensaje}</p>
      </div>
    );
  })();

  // La propina que otra pantalla decidió (los comensales, el mesero) pasa a ser la del cobro, y se
  // dice en la tarjeta. «Una sola verdad»: la vigente manda; la Caja puede cambiarla ahí mismo.
  const ponerLaVigente = (vigente) => {
    setVentaSeleccionada((prev) => (prev ? { ...prev, ...alUsarEsa(vigente) } : prev));
    setAvisoDeLaPropina(
      `${textoDelAviso(vigente)}. Ya está puesta en la cuenta; aquí la puedes cambiar.`,
    );
  };

  // DP-24 · La propina se elige en la tarjeta de cobro, con un toque, y se puede cambiar hasta antes
  // de cobrar.
  //
  // El IMPORTE no viaja al servidor por su cuenta: va DENTRO del cobro, en cada pago y con su
  // método (`venta.cobrar`, regla 3 de `F1-01` §3), y `ordenes` ni siquiera tiene columna de
  // importe de propina — precisamente para que `total` no se pueda inflar con una (F1-04 §6.1).
  //
  // DP-21 (Bloque 4): lo que SÍ viaja en el momento es CÓMO se decidió (tipo y puntos base), por
  // `cuenta.fijar_propina` y con la versión de la cuenta que esta pantalla leyó. Así la propina
  // queda en el servidor cuando se elige: el portal se entera y deja de ofrecerla, y si la cuenta
  // cambió mientras tanto (los comensales acaban de elegir), el servidor contesta la vigente y no
  // escribe nada. Tocar otra propina en la tarjeta ES cambiarla a propósito: la vigente está a la vista.
  const aplicarPropinaCaja = async (propina) => {
    if (!ventaSeleccionada?.id || guardandoPropina) return;
    const payload = {
      ...propinaParaLaCuenta(propina, aCentavos(ventaSeleccionada.total)),
      propina_origen: 'caja',
    };
    if (typeof ventaSeleccionada.version === 'number' && laCajaEligeLaPropina(config)) {
      setGuardandoPropina(true);
      try {
        const fijada = await api.comandos.ejecutar(
          '/api/venta/fijar-propina',
          entradaDeFijarPropina(ventaSeleccionada.id, ventaSeleccionada.version, payload, true),
        );
        if (typeof fijada?.version === 'number') payload.version = fijada.version;
      } catch (err) {
        // Otra pantalla la decidió antes (o la cuenta cambió): se enseña la vigente.
        const vigente = propinaDelConflicto(err?.datos, ventaSeleccionada.total);
        if (vigente) {
          ponerLaVigente(vigente);
        } else {
          toast.error(err?.message || 'No se pudo guardar la propina. Intenta de nuevo.');
          // La cuenta cambió por otra cosa (un platillo, un descuento): se relee con su versión.
          if (err?.datos?.regla === 'PROPINA_VIGENTE') {
            await releerLaCuentaDelCobro(ventaSeleccionada.id);
          }
        }
        return;
      } finally {
        setGuardandoPropina(false);
      }
    }
    setAvisoDeLaPropina(null);
    setVentaSeleccionada((prev) => (prev ? { ...prev, ...payload } : prev));
  };

  // Eliminar/cancelar tickets en CERO ($0.00) — para limpiar caja sin afectar ventas reales.
  const handleEliminarTicketCero = async (venta) => {
    if (!venta) return;
    const total = venta.total || 0;
    if (total > 0) {
      toast.error('Solo se pueden eliminar tickets con total $0.00');
      return;
    }
    if (
      !confirm(
        `¿Seguro que quieres borrar este ticket en cero (${folioVisible(venta.serie, venta.folio, config, 'numero')})?\nEsta acción no se puede deshacer.`,
      )
    )
      return;
    try {
      // Cancelar la venta y liberar la mesa eran DOS escrituras sueltas, y la
      // de la mesa iba con `.catch(() => {})` (F1-06 §4.1, `:462`): el ticket se
      // cancelaba y la mesa se quedaba ocupada apuntando a una venta que ya no
      // existe. Mesa huérfana, y el cierre del día bloqueado por ella.
      //
      // Con mesa va `restaurante.liberar_mesa`, que en UNA transacción cancela
      // la orden vacía y deja la mesa libre —es la transición «ticket en cero →
      // libre» de F1-04 §8.2— y que además REHÚSA si la cuenta tiene consumo,
      // que es justo lo que este botón nunca debe borrar. Sin mesa (venta
      // directa de mostrador) no hay mesa que liberar: se cancela la orden.
      if (venta.mesa_id) {
        // DP-9.6: si se cancela «¿Separar o dejarlas unidas?», no pasó nada y no se dice otra cosa.
        const liberada = await liberarMesaConPregunta(venta.mesa_id, (entrada) =>
          api.comandos.ejecutar('/api/restaurante/liberar-mesa', entrada),
        );
        if (!liberada) return;
      } else {
        await api.comandos.ejecutar('/api/restaurante/cancelar-orden', {
          ordenId: venta.id,
          motivo: 'Ticket en $0.00 eliminado desde Caja',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['ventas_pendientes_caja'] });
      queryClient.invalidateQueries({ queryKey: ['mesas'] });
      setVentaSeleccionada(null);
      setDetallesSeleccionados([]);
      toast.success('Ticket en cero eliminado');
    } catch (err) {
      // El dominio ya lo dice en español: «La mesa 4 tiene una cuenta sin
      // cobrar…». Se enseña tal cual en vez de un «No se pudo» que no explica
      // nada y hace que el cajero lo intente otra vez.
      toast.error(err?.message || 'No se pudo eliminar el ticket');
    }
  };

  // DP-24 · La cuenta del cobro la hace la tarjeta (`~/venta/cuenta-del-cobro`), en centavos: aquí
  // llega con sus renglones de pago ya armados —la venta por un lado, la propina por otro, cada
  // tarjeta en su renglón— o con el motivo por el que NO se puede cobrar. Un «Recibido» menor al
  // total ya no se cobra como efectivo exacto: llega con su tropiezo y sin pagos.
  const handleCobrar = async (loTecleado) => {
    if (!ventaSeleccionada?.id) {
      toast.error('No hay venta seleccionada');
      return;
    }
    if (procesando) return;
    if (!hayCaja) {
      toast.error('No hay caja abierta. Abre caja para cobrar.');
      return;
    }
    if (!loTecleado || loTecleado.tropiezo !== null || loTecleado.pagos.length === 0) {
      toast.error(loTecleado?.tropiezo || 'Revisa los pagos antes de cobrar.');
      return;
    }
    setProcesando(true);
    setProcesandoMsg('Procesando cobro…');

    // Lo que físicamente entra por cada método (con su propina y sin el cambio): para el ticket.
    const mEfec = aPesos(loTecleado.efectivoCentavos);
    const mTar = aPesos(loTecleado.tarjetaCentavos);
    const mTrans = aPesos(loTecleado.transferenciaCentavos);
    const metodosUsados = [...new Set(loTecleado.pagos.map((pago) => pago.metodo))];
    const metodoPago = metodosUsados.length === 1 ? metodosUsados[0] : 'mixto';

    // === El cuerpo del cobro ================================================
    // Un renglón por pago, cada uno con SU propina (regla 3 de `F1-01` §3). `montoCentavos` es la
    // VENTA; la propina viaja en su propio campo y NO cuenta para cubrir el total, que es la
    // regla 1 — `Venta.total` es la venta SIN propina.
    const cuerpoCobro = {
      ordenId: ventaSeleccionada.id,
      pagos: loTecleado.pagos,
      // Lo que ESTA pantalla creía que costaba. No cobra: el servidor recalcula y, si no
      // coincide, rechaza con el total correcto en vez de cobrar otro número en silencio.
      totalEsperadoCentavos: loTecleado.totalCentavos,
    };
    // Cómo se decidió la propina (nunca un importe: en `ordenes` no cabe ninguno). Si llegó puesta
    // de otra pantalla —los comensales, el mesero— y así se cobra, se respeta tal cual; si la Caja
    // la eligió, la cambió o dejó el cambio de propina, queda como decisión de la Caja.
    const propinaQueTraia = propinaBase(loTecleado.totalCentavos, propinaDeLaCuenta(ventaSeleccionada));
    if (estaDecidida(ventaSeleccionada) && loTecleado.propinaCentavos === propinaQueTraia) {
      const puntosBase = Math.round((Number(ventaSeleccionada.propina_porcentaje) || 0) * 100);
      if (puntosBase > 0 && puntosBase <= 10000) cuerpoCobro.propinaPuntosBase = puntosBase;
      if (TIPOS_DE_PROPINA.includes(ventaSeleccionada.propina_tipo)) {
        cuerpoCobro.propinaTipo = ventaSeleccionada.propina_tipo;
      }
      if (ORIGENES_DE_PROPINA.includes(ventaSeleccionada.propina_origen)) {
        cuerpoCobro.propinaOrigen = ventaSeleccionada.propina_origen;
      }
    } else {
      cuerpoCobro.propinaTipo = loTecleado.propinaAEnviar.tipo;
      cuerpoCobro.propinaPuntosBase = loTecleado.propinaAEnviar.puntosBase;
      cuerpoCobro.propinaOrigen = 'caja';
    }
    // DP-21: la versión de la cuenta que está en pantalla. Si cambió después (los comensales
    // eligieron su propina), el servidor rechaza el cobro con la vigente en vez de cobrar otra.
    if (typeof ventaSeleccionada.version === 'number') {
      cuerpoCobro.versionDeLaCuenta = ventaSeleccionada.version;
    }

    // 🟡 HOTFIX bandera amarilla #2: bandera declarada FUERA del try para que
    // el catch final pueda leerla y diferenciar errores pre/post-cobro.
    // (Las `let` declaradas dentro de un try NO son visibles desde el catch.)
    let ventaQuedoPagada = false;
    let cambio = 0;

    try {
      setProcesandoMsg('Guardando venta…');
      // ── D-07, y es el motivo de este archivo ────────────────────────────
      // Aquí había dos pasos y medio: se marcaba la venta `pagada` y DESPUÉS se
      // lanzaban en paralelo el descuento de stock, el movimiento de inventario
      // y los descuentos de venta, los tres con `.catch(() => {})` y bajo un
      // `catch` exterior que sólo hacía `console.warn`. Si el lote fallaba no
      // fallaba nada visible: quedaba una venta pagada de $1 180 con el stock
      // intacto y el ledger vacío, y se descubría a media noche del viernes.
      //
      // `venta.cobrar` hace TODO eso en UNA transacción —totales, folio, pagos,
      // propina por método, movimiento de caja, stock y ledger— y o confirma
      // todo o no persiste nada. Por eso también desaparece la validación de
      // stock del navegador: el servidor la hace con la guarda en el `WHERE` de
      // las existencias, dentro de la misma transacción que descuenta, y una
      // comprobación previa sobre una lectura anterior no puede ser exacta.
      //
      // Y desaparece el costeo del cliente: costo, utilidad y margen los calcula
      // el servidor sobre las líneas que está congelando.
      //
      // `claveCobro` se generó al ABRIR el diálogo y se reusa mientras siga
      // abierto: es lo que impide que un doble clic en «Cobrar» cobre dos veces.
      const cobro = await api.comandos.ejecutar(
        '/api/venta/cobrar',
        cuerpoCobro,
        claveCobro || undefined,
      );
      ventaQuedoPagada = true;
      if (paraLlevarEnCobroRef.current === ventaSeleccionada.id) {
        paraLlevarPagadoRef.current = true;
        // DP-18 · A7 · El borrador se borra AL COBRAR, no cuando el diálogo se cierre: una recarga
        // entre las dos cosas lo dejaba vivo y el pedido siguiente lo arrastraba (cobro doble).
        const claveDelBorrador = claveDelParaLlevar(posUser?.id);
        if (claveDelBorrador) borrarBorrador(almacenDelBorrador(), claveDelBorrador);
      }
      // El cambio que se le da al cliente es el del servidor, no el de la resta
      // del navegador: allí es donde se sabe qué se cobró de verdad.
      cambio = aPesos(cobro?.cambioCentavos);

      // La mesa se libera con su comando, no con un `Mesa.update` suelto y
      // silencioso (`:923`): «se cobró la mesa y sigue marcada como ocupada»
      // es exactamente lo que bloquea el cierre del día. La venta YA está
      // cobrada, así que un fallo aquí no puede tirar el cobro — pero sí se
      // dice, porque la mesa se queda ocupada y alguien tiene que liberarla.
      // DP-17: una parte de una cuenta dividida nace sin mesa; la suya es la de su cuenta madre,
      // y se libera al cobrar la ÚLTIMA parte (con las anteriores el servidor dice que faltan).
      try {
        const mesaALiberar = await mesaParaLiberarTrasCobrar(ventaSeleccionada, (ordenId) =>
          api.entidades.Venta.filter({ id: ordenId }, undefined, 1).then((r) => r[0] ?? null),
        );
        if (mesaALiberar) {
          // DP-9.6: la principal de mesas unidas pregunta «¿Separar o dejarlas unidas?».
          await liberarTrasCobrar(
            mesaALiberar,
            (entrada) => api.comandos.ejecutar('/api/restaurante/liberar-mesa', entrada),
            preguntarPorElGrupo,
            Boolean(ventaSeleccionada.orden_padre_id),
          );
        }
      } catch (errMesa) {
        toast.warning(errMesa?.message || 'La venta se cobró, pero la mesa sigue ocupada.', {
          duration: 10000,
        });
      }

      // BLOQUE 0 — OPTIMISTIC UPDATE:
      // Quitar la venta cobrada del listado de pendientes INMEDIATAMENTE,
      // sin esperar al próximo refetch. Si por algún motivo el cobro falla más
      // adelante, el siguiente refetch automático corregirá el estado.
      const ventaCobradaId = ventaSeleccionada.id;
      queryClient.setQueryData(['ventas_pendientes_caja'], (prev) => {
        const arr = Array.isArray(prev) ? prev : [];
        return arr.filter((v) => v?.id !== ventaCobradaId);
      });

      // Invalidar TODO lo que se refleja en Caja, Ventas, Registros y Dashboard.
      queryClient.invalidateQueries({ queryKey: ['ventas_pendientes_caja'] });
      queryClient.invalidateQueries({ queryKey: ['ventas_pagadas_caja'] });
      queryClient.invalidateQueries({ queryKey: ['mesas'] });
      queryClient.invalidateQueries({ queryKey: ['ventas_hoy'] });
      queryClient.invalidateQueries({ queryKey: ['ventas_all'] }); // ← FIX: query de pages/Ventas.jsx
      queryClient.invalidateQueries({ queryKey: ['registros_ventas'] });
      queryClient.invalidateQueries({ queryKey: ['propinas_dashboard_ventas'] });
      queryClient.invalidateQueries({ queryKey: ['cortes_caja_estado'] });
      // El stock y el ledger los movió la misma transacción del cobro: las tres
      // vistas de inventario se refrescan igual que antes lo hacía el bloque
      // que descontaba a mano.
      queryClient.invalidateQueries({ queryKey: ['ingredientes_all'] });
      queryClient.invalidateQueries({ queryKey: ['descuentos_hoy'] });
      queryClient.invalidateQueries({ queryKey: ['registros_movimientos'] });
      // Refetch activo de pendientes para que el badge en el header baje al instante.
      queryClient
        .refetchQueries({ queryKey: ['ventas_pendientes_caja'], type: 'active' })
        .catch(() => {});

      setProcesandoMsg('Generando ticket…');
      // Construir SNAPSHOT defensivo de los datos del ticket ANTES de limpiar nada.
      // Si algo de aquí falla, atrapamos el error y la venta NO se rompe — solo
      // perdemos el ticket en pantalla (la venta ya quedó cobrada en BD).
      try {
        const ventaPagada = {
          ...(ventaSeleccionada || {}),
          estado: 'pagada',
          // El folio lo pone el servidor con un consecutivo atómico AL COBRAR:
          // `ordenes.folio` es nulo hasta entonces (`orden_pagada_con_folio`),
          // así que sin esto el ticket salía sin número. Se enseña el folio a
          // secas —sin la serie— porque es lo que la misma venta enseña luego en
          // Ventas y en Registros, y es el número que el cliente va a citar.
          folio: cobro?.folio ? String(cobro.folio) : ventaSeleccionada?.folio,
          // DP-21 · Con la serie el ticket sabe que es una cuenta y pinta el prefijo del negocio.
          serie: cobro?.serie ?? ventaSeleccionada?.serie,
          // DP-16 · El número del pedido para llevar lo pone el servidor al cobrar.
          ...(typeof cobro?.numeroPedido === 'number'
            ? { canal: 'llevar', numero_pedido: cobro.numeroPedido }
            : {}),
          metodo_pago: metodoPago,
          monto_efectivo: mEfec,
          monto_tarjeta: mTar,
          monto_transferencia: mTrans,
          cambio,
          // DP-24 · La propina que de verdad se cobró (con el cambio, si se dejó de propina).
          propina_monto: aPesos(loTecleado.propinaCentavos),
          propina_tipo: cuerpoCobro.propinaTipo,
        };
        const detallesSnap = Array.isArray(detallesSeleccionados) ? [...detallesSeleccionados] : [];
        setTicketFinalData({ venta: ventaPagada, detalles: detallesSnap });
        setShowTicketFinal(true);
      } catch (errTicket) {
        toast.error(
          errTicket?.message ||
            'Venta cobrada, pero no se pudo mostrar el ticket. Búscalo en historial.',
        );
      }

      // Limpieza de estados del cobro (independiente del ticket)
      setVentaSeleccionada(null);
      setDetallesSeleccionados([]);
      toast.success(`¡Venta cobrada! Cambio: ${formatCurrency(cambio)}`);
      sonar('cobro');
      // DP-20 · El cajón del aparato se abre solo al cobrar en efectivo (y queda en la auditoría).
      if (mEfec > 0) {
        abrirCajonAlCobrar(ventaCobradaId, cobro?.folio ? String(cobro.folio) : undefined);
      }
    } catch (err) {
      // 🟡 HOTFIX bandera amarilla #2: mensaje correcto según el momento del fallo.
      // - Si venta NO quedó pagada → el motivo TAL CUAL lo dice el dominio, que
      //   ya viene en español: «No hay inventario suficiente para completar la
      //   venta», «Abre la caja antes de cobrar», «Esa venta ya se cobró». Un
      //   «no se pudo, intenta de nuevo» hace que el cajero lo intente otra vez
      //   sin arreglar lo que falla.
      // - Si venta SÍ quedó pagada → confirmar cobro y avisar que el problema
      //   fue posterior. La venta YA está en Ventas/Registros.
      if (ventaQuedoPagada) {
        toast.warning(
          'Venta cobrada correctamente. Hubo un problema con el ticket. ' +
            'Búscala en Ventas o Registros — no la cobres de nuevo.',
          { duration: 10000 },
        );
      } else {
        toast.error(err?.message || 'No se pudo cobrar la venta. Intenta de nuevo.');
        // DP-21: la cuenta cambió mientras se cobraba y el servidor mandó la propina vigente:
        // se enseña con su aviso («Usar ésa» o «Cambiarla»), nunca se cobra otra en silencio.
        const propinaVigente = propinaDelConflicto(err?.datos, ventaSeleccionada?.total);
        if (propinaVigente) ponerLaVigente(propinaVigente);
        // DP-14 (ronda 2, medio 3): otra caja ya la cobró (o se canceló o se dividió): aquí ya no se
        // cobra. El cobro se cierra y la lista se relee, en vez de dejar al cajero frente a una
        // cuenta que ya no está pendiente.
        if (err?.datos?.regla === 'ORDEN_NO_EDITABLE') {
          setVentaSeleccionada(null);
          setDetallesSeleccionados([]);
          queryClient.invalidateQueries({ queryKey: ['ventas_pendientes_caja'] });
        }
        // DP-22 (hallazgo 12): el total cambió con el cobro abierto (se quitó un platillo con la
        // clave de gerencia, o se descontó desde otro aparato; agregar ya no se puede: la cuenta
        // pedida no se edita). El aviso de arriba ya lo dijo; aquí la cuenta se RELEE
        // para que la cajera vea el total nuevo y teclee los pagos otra vez. Sin esto la pantalla
        // se quedaba con el total viejo y «Cobrar» fallaba igual cada vez, hasta cerrar la cuenta
        // y volver a abrirla.
        // DP-D168: lo mismo cuando la cuenta cambió y la caja ya había elegido la propina
        // (`PROPINA_VIGENTE`: el mesero quitó un platillo con el PIN del gerente): el servidor
        // rechaza igual y la pantalla se quedaba con los renglones y el total de antes.
        // DP-D172: el servidor manda `codigo: 'REGLA_DE_NEGOCIO'` y la regla en `datos.regla`; comparar
        // el `codigo` con 'TOTAL_DESACTUALIZADO' nunca coincidía y la relectura de DP-D168 no corría.
        if (
          (err?.datos?.regla === 'TOTAL_DESACTUALIZADO' ||
            err?.datos?.regla === 'PROPINA_VIGENTE') &&
          ventaSeleccionada?.id
        ) {
          await releerLaCuentaDelCobro(ventaSeleccionada.id);
        }
      }
    } finally {
      setProcesando(false);
      setProcesandoMsg('');
    }
  };

  const invalidarCajaQueries = () => {
    // Refresca TODOS los lugares donde se ven cortes o resúmenes derivados de ellos.
    // Al cerrar caja, el dashboard y registros deben actualizarse inmediatamente.
    queryClient.invalidateQueries({ queryKey: ['cortes'] });
    queryClient.invalidateQueries({ queryKey: ['cortes_caja_estado'] });
    queryClient.invalidateQueries({ queryKey: ['cortes_historial'] });
    queryClient.invalidateQueries({ queryKey: ['registros_cortes'] });
    queryClient.invalidateQueries({ queryKey: ['ventas_hoy'] });
    queryClient.invalidateQueries({ queryKey: ['ventas_pagadas_caja'] });
    queryClient.invalidateQueries({ queryKey: ['ventas_pendientes_caja'] });
    queryClient.invalidateQueries({ queryKey: ['gastos_hoy'] });
    queryClient.invalidateQueries({ queryKey: ['ingredientes_all'] });
    queryClient.invalidateQueries({ queryKey: ['descuentos_hoy'] });
    queryClient.invalidateQueries({ queryKey: ['propinas_dashboard_ventas'] });
    queryClient.invalidateQueries({ queryKey: ['registros_ventas'] });
    // Refetch inmediato de las queries activas más importantes:
    queryClient.refetchQueries({ queryKey: ['cortes'] }).catch(() => {});
    queryClient.refetchQueries({ queryKey: ['ventas_hoy'] }).catch(() => {});
  };

  // 1) ABRIR CAJA — crea CorteCaja tipo cierre_diario, estado abierto.
  const handleAbrirCaja = async (form) => {
    if (accionLoading) return;
    if (!posUser?.id) {
      toast.error('No hay usuario POS activo');
      return;
    }
    setAccionLoading(true);
    try {
      // La comprobación «¿ya hay otra caja abierta?» que había aquí era una
      // lectura del navegador entre dos cajeros: los dos leían «no hay» y los
      // dos abrían. Ahora la impone el índice único parcial
      // `sesiones_caja_una_abierta_por_terminal`, y `caja.abrir` traduce esa
      // colisión a «Esta terminal ya tiene una caja abierta» — una frase que ya
      // viene en español y se enseña tal cual.
      //
      // Del formulario sólo viaja el efectivo contado: el fondo esperado y la
      // diferencia los deriva el servidor, y el folio lo pone el consecutivo
      // atómico, no `generateFolio` en el navegador.
      const abierta = await api.comandos.ejecutar('/api/caja/abrir', {
        fondoInicialCentavos: aCentavos(form.efectivo_inicial_contado),
        // DP-21 · Bloque 5: la caja es un lugar con nombre; sin elegir, el servidor da el primero libre.
        ...(lugarParaAbrir ? { lugar: lugarParaAbrir } : {}),
      });
      invalidarCajaQueries();
      setShowAbrirCaja(false);
      setLugarParaAbrir(null);
      toast.success(`${abierta?.nombreDeLaCaja || 'Caja'} abierta. Ya puedes cobrar.`);
    } catch (err) {
      toast.error(err?.message || 'No se pudo abrir la caja');
    } finally {
      setAccionLoading(false);
    }
  };

  // 2) CORTE DE TURNO — registro independiente, NO cierra la caja.
  //
  // Aquí había un `api.entidades.CorteCaja.create({ folio: generateFolio('CT'),
  // usuario_cajero_id: posUser?.id, total_general: resumen.totalGeneral, … })`
  // con tres defectos en una llamada: el folio lo inventaba el navegador —dos
  // terminales cortando a la vez producían el mismo—, la atribución viajaba en
  // el cuerpo, y los cuatro totales los sumaba la pantalla sobre lo que tuviera
  // cargado. Y encima `CorteCaja` mapea `sesiones_caja`, no `cortes_turno`, así
  // que el puente la rechazaba y el botón FALLABA SIEMPRE.
  //
  // `caja.corte_turno` lo hace entero en el servidor: folio de la serie `CT`,
  // el firmante de la sesión, y el arqueo derivado dentro de la transacción,
  // con el rango arrancando donde acabó el corte anterior —sin eso, el segundo
  // corte del día vuelve a contar las ventas del primero—. Lo único que el
  // cajero aporta sigue siendo lo que CONTÓ.
  const handleCorteTurno = async (form) => {
    if (accionLoading) return;
    if (!cajaAbierta?.id) {
      toast.error('No hay caja abierta');
      return;
    }
    setAccionLoading(true);
    try {
      await api.comandos.ejecutar('/api/caja/corte-turno', {
        efectivoContadoCentavos: aCentavos(form.efectivo_contado),
        notas: form.notas || null,
      });
      invalidarCajaQueries();
      setShowCorteTurno(false);
      toast.success('Corte de turno registrado');
    } catch (err) {
      toast.error(err?.message || 'No se pudo registrar el corte de turno');
    } finally {
      setAccionLoading(false);
    }
  };

  // 6A: Verificar mesas pendientes ANTES de abrir el dialog de cierre.
  // Si todas están libres, abre el dialog. Si hay alguna ocupada, muestra el
  // dialog de bloqueo con la lista.
  const intentarAbrirCierreDiario = async () => {
    if (verificandoMesas) return;
    if (!hayCaja) {
      toast.error('No hay caja abierta.');
      return;
    }
    setVerificandoMesas(true);
    try {
      const pendientes = await obtenerMesasPendientesCierre();
      if (Array.isArray(pendientes) && pendientes.length > 0) {
        setMesasPendientes(pendientes);
        return;
      }
      // Sin mesas pendientes → permitir cierre
      setShowCierreDiario(true);
    } catch (e) {
      // Antes esto abría el diálogo igual, «mejor permitir que el cajero cierre
      // que dejarlo varado». Pero cerrar el día sin saber si hay mesas abiertas
      // no es permitir: es cerrar a ciegas, y lo que queda mal en la base no lo
      // arregla nadie al día siguiente. Si no se pudo comprobar, no se cierra.
      toast.error(
        e?.message || 'No se pudo comprobar si quedan mesas abiertas. Reintenta antes de cerrar.',
      );
    } finally {
      setVerificandoMesas(false);
    }
  };

  // 3) CIERRE DIARIO — cierra la caja, genera PDF, reinicia dashboard operativo.
  const handleCierreDiario = async (form) => {
    if (accionLoading) return;
    if (!cajaAbierta?.id) {
      toast.error('No hay caja abierta para cerrar');
      return;
    }
    setAccionLoading(true);
    try {
      // 6A: segunda verificación anti-race. Si alguien abrió una mesa
      // mientras el dialog estaba abierto, bloqueamos aquí también.
      //
      // El `.catch(() => [])` que había aquí anulaba este guardia entero: si la
      // lectura fallaba devolvía «no hay pendientes» y el día se cerraba igual.
      // Ahora el fallo sube al `catch` de abajo, que avisa y NO cierra.
      const pendientesFinales = await obtenerMesasPendientesCierre();
      if (Array.isArray(pendientesFinales) && pendientesFinales.length > 0) {
        setMesasPendientes(pendientesFinales);
        setShowCierreDiario(false);
        setAccionLoading(false);
        return;
      }
      const fechaCierreIso = new Date().toISOString();
      const corteId = cajaAbierta.id;

      // El cierre entero es UNA transacción del servidor. Antes eran tres pasos
      // sueltos: el `CorteCaja.update` con veinte totales calculados en el
      // navegador, el lote de `Venta.update({corte_caja_id})` con
      // `.catch(() => {})` —ventas pagadas que se quedaban sin corte y no salían
      // ni en el PDF ni cuadraban con el efectivo (F1-06 §4.1, `:1211`)— y la
      // cola de sincronización.
      //
      // `caja.cerrar` deriva el arqueo DENTRO de su propia transacción, así que
      // una venta cobrada mientras el diálogo estaba abierto entra en el corte
      // en vez de quedarse fuera. Y por eso no se le manda ningún total: lo
      // único que el servidor no puede saber es cuánto dinero hay físicamente
      // en el cajón, y eso es lo que viaja.
      const arqueo = await api.comandos.ejecutar('/api/caja/cerrar', {
        efectivoContadoCentavos: aCentavos(form.efectivo_contado),
        // DP-D178 · El conteo por billetes y monedas, si se capturó (suma exactamente lo contado).
        ...(form.denominaciones?.length ? { denominaciones: form.denominaciones } : {}),
        ...(form.notas ? { notas: form.notas } : {}),
      });
      // DP-10.2: cerró con cuentas de mesa vivas porque queda otra caja abierta; el servidor
      // dice cuáles y que las cobrará la otra. (La última caja ni siquiera cierra.)
      if (arqueo?.aviso?.mensaje) toast.warning(arqueo.aviso.mensaje, { duration: 10000 });

      // Lo que se enseña y se imprime. El esperado, la diferencia y el número de
      // ventas son los del SERVIDOR —los del navegador se calculaban sobre una
      // lista que llevaba minutos en pantalla—; el resto del desglose sigue
      // siendo el mismo resumen que el cajero acaba de ver en el diálogo.
      const data = {
        tipo_corte: 'cierre_diario',
        estado: 'cerrado',
        fecha_inicio:
          cajaAbierta.fecha_apertura || cajaAbierta.fecha_inicio || cajaAbierta.created_date,
        fecha_cierre: fechaCierreIso,
        usuario_cajero_id: posUser?.id,
        usuario_cajero_nombre: posUser?.nombre,
        total_efectivo: resumen.totalEfectivo,
        total_tarjeta: resumen.totalTarjeta,
        total_transferencia: resumen.totalTransferencia,
        total_general: resumen.totalGeneral,
        total_propinas: resumen.totalPropinas || 0,
        propinas_por_mesero: JSON.stringify(resumen.propinasPorMesero || []),
        costo_total_estimado: resumen.costoTotal,
        utilidad_bruta_total: resumen.utilidadBruta,
        margen_promedio: margenProm,
        numero_ventas: arqueo?.numeroVentas ?? resumen.numVentas,
        ticket_promedio: resumen.ticketPromedio,
        total_gastos: resumen.totalGastos,
        efectivo_esperado: aPesos(arqueo?.efectivoEsperadoCentavos),
        efectivo_contado: aPesos(arqueo?.efectivoContadoCentavos),
        diferencia_efectivo: aPesos(arqueo?.diferenciaCentavos),
        dinero_dejado_en_caja: form.dinero_dejado_en_caja,
        utilidad_neta_estimada: form.utilidad_neta_estimada,
        notas: form.notas,
      };

      invalidarCajaQueries();
      queryClient.invalidateQueries({ queryKey: ['ventas_pagadas_caja'] });
      queryClient.invalidateQueries({ queryKey: ['ventas_hoy'] });

      // El folio lo asigna el SERVIDOR al cerrar, así que sale de `arqueo` —la
      // respuesta del comando— y no de `data`, que es el objeto que arma esta
      // pantalla para enseñar e imprimir. Leerlo de `cajaAbierta` lo dejaba
      // siempre en blanco: ahí todavía es nulo, porque la sesión abierta aún no
      // tiene folio.
      const folioDelCorte =
        arqueo?.serie && arqueo?.folio
          ? folioVisible(arqueo.serie, arqueo.folio, config)
          : folioVisible(cajaAbierta.serie, cajaAbierta.folio, config);
      const corteFinal = { ...data, id: corteId, folio: folioDelCorte };
      setCorteCerrado(corteFinal);
      setShowCierreDiario(false);

      // Auto-descarga PDF si la config lo permite
      const autoPDF = config?.descargar_pdf_corte_auto !== false;
      if (autoPDF) setAutoDownloadCorte(corteFinal);

      setShowCierreExito(true);
      toast.success('¡Caja cerrada correctamente!');
    } catch (err) {
      // «No hay una caja abierta», «Esa caja ya se había cerrado», «Cierra la
      // caja desde la terminal»: el dominio ya lo dice en español y con el
      // motivo. Un «intenta de nuevo» genérico haría reintentar un cierre que
      // no va a funcionar hasta que se arregle lo que falla.
      toast.error(err?.message || 'No se pudo cerrar la caja. Intenta de nuevo.');
    } finally {
      setAccionLoading(false);
    }
  };

  return (
    <div className="space-y-4 px-1 sm:px-0 max-w-full overflow-x-clip">
      {/* Header — responsive: stack en móvil, botones en grid 3-col */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, hsl(4,72%,46%) 0%, hsl(4,72%,34%) 100%)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            <Landmark className="w-5 h-5 text-primario-texto" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-heading font-bold">Caja</h1>
            <p className="text-xs text-muted-foreground truncate">
              {hayCaja
                ? `${nombreDeLaCaja ? `${nombreDeLaCaja} · ` : ''}${
                    isCajaDirecta
                      ? 'Punto de venta directo'
                      : `${ventasPendientes.length} cobros pendientes`
                  }`
                : 'Caja cerrada'}
            </p>
          </div>
        </div>

        {/* === 3 BOTONES PRINCIPALES — grid en móvil para que se vean enteros === */}
        <div className="grid grid-cols-3 sm:flex gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            onClick={() => {
              // DP-14 (ronda 2, medio 3): en la tercera caja lo dice en pantalla, no en un tooltip.
              if (!puedoAbrir) {
                toast.error(`Ya hay ${cupoDeCajas ?? 2} cajas abiertas: cierra una.`);
                return;
              }
              setLugarParaAbrir(null);
              setShowAbrirCaja(true);
            }}
            disabled={hayCaja || cargandoCaja}
            variant={hayCaja || !puedoAbrir ? 'outline' : 'default'}
            title={
              hayCaja
                ? 'Ya hay una caja abierta'
                : !puedoAbrir
                  ? `Ya hay ${cupoDeCajas ?? 2} cajas abiertas: cierra una.`
                  : 'Abrir caja para comenzar operación'
            }
            className="px-2"
          >
            <DoorOpen className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Abrir caja</span>
            <span className="sm:hidden text-[10px]">Abrir</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCorteTurno(true)}
            disabled={!hayCaja}
            title={!hayCaja ? 'Necesitas una caja abierta' : 'Corte parcial de turno'}
            className="px-2"
          >
            <Scissors className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Corte de turno</span>
            <span className="sm:hidden text-[10px]">Turno</span>
          </Button>
          <Button
            size="sm"
            onClick={intentarAbrirCierreDiario}
            disabled={!hayCaja || verificandoMesas}
            title={!hayCaja ? 'Necesitas una caja abierta' : 'Cierre final del día'}
            className="px-2"
            style={
              hayCaja
                ? { background: 'linear-gradient(135deg, hsl(0,72%,46%) 0%, hsl(0,72%,36%) 100%)' }
                : undefined
            }
          >
            <Lock className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">
              {verificandoMesas ? 'Verificando…' : 'Cierre diario'}
            </span>
            <span className="sm:hidden text-[10px]">{verificandoMesas ? '…' : 'Cierre'}</span>
          </Button>
        </div>
      </div>

      {/* DP-18 (revisa DP-14): las cajas abiertas en OTROS aparatos se ven SIEMPRE, con «Trasladar
          aquí» y, si cabe, «Abrir otra caja aquí (N de M)». El 11-11 esta pantalla callaba la de la
          tableta cuando cabía otra, y parecía que se había cerrado sola. */}
      {!cargandoCaja && (
        <CajasEnOtrosAparatos
          cajas={otrasCajas}
          hayCaja={hayCaja}
          puedoAbrir={puedoAbrir}
          cupo={cupoDeCajas ?? 1}
          abiertas={abiertasEnLaSucursal}
          lugaresLibres={lugaresLibres}
          onAbrir={(lugar) => {
            setLugarParaAbrir(lugar ?? null);
            setShowAbrirCaja(true);
          }}
        />
      )}

      {/* Aviso si NO hay caja abierta en este aparato ni en otro */}
      {!hayCaja && !cargandoCaja && otrasCajas.length === 0 && (
        <div className="px-4 py-3 rounded-xl bg-advertencia/10 border-2 border-advertencia/30 text-sm text-advertencia flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-advertencia" />
          <div className="flex-1">
            <p className="font-bold">No hay caja abierta en este aparato</p>
            <p className="text-xs opacity-90">
              Abre caja para comenzar operación. No se puede cobrar ni generar tickets finales sin
              caja abierta.
            </p>
          </div>
          {/* DP-21 · Bloque 5: con dos lugares libres se elige cuál; con uno, se dice su nombre. */}
          {lugaresLibres.length > 1 ? (
            <div className="flex shrink-0 flex-wrap gap-2">
              {lugaresLibres.map((libre) => (
                <Button
                  key={libre.lugar}
                  size="sm"
                  onClick={() => {
                    setLugarParaAbrir(libre.lugar);
                    setShowAbrirCaja(true);
                  }}
                >
                  <DoorOpen className="w-4 h-4 mr-1" /> {textoDeAbrir(libre)}
                </Button>
              ))}
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                setLugarParaAbrir(null);
                setShowAbrirCaja(true);
              }}
              className="shrink-0"
            >
              <DoorOpen className="w-4 h-4 mr-1" />{' '}
              {lugaresLibres.length === 1 ? textoDeAbrir(lugaresLibres[0]) : 'Abrir caja'}
            </Button>
          )}
        </div>
      )}

      {/* Acción principal sin sala —sin el módulo `mesas`—: NUEVA VENTA */}
      {isCajaDirecta && hayCaja && (
        <div className="grid sm:grid-cols-2 gap-3">
          <Link to="/pos" className="block">
            <button
              className="w-full p-5 rounded-2xl border-2 border-primary bg-primary text-primary-foreground text-left transition-all hover:brightness-110 active:scale-[0.99]"
              style={{
                boxShadow: '0 2px 0 rgba(255,255,255,0.2) inset, 0 6px 18px rgba(0,0,0,0.15)',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-superficie/20 flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-heading font-black text-xl leading-tight">Nueva venta</p>
                  <p className="text-xs opacity-90">Selecciona productos y cobra al instante</p>
                </div>
              </div>
            </button>
          </Link>
          <button
            onClick={intentarAbrirCierreDiario}
            disabled={verificandoMesas}
            className="w-full p-5 rounded-2xl border-2 border-border bg-card text-left transition-all hover:bg-muted active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              boxShadow: '0 2px 0 rgba(255,255,255,0.9) inset, 0 6px 18px rgba(0,0,0,0.06)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <Lock className="w-6 h-6 text-foreground" />
              </div>
              <div>
                <p className="font-heading font-black text-xl leading-tight">
                  {verificandoMesas ? 'Verificando…' : 'Cierre diario'}
                </p>
                <p className="text-xs text-muted-foreground">Finaliza el día y genera PDF</p>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* DP-16 · PARA LLEVAR: la cajera toma el pedido aquí y lo cobra directo. */}
      {!isCajaDirecta && hayCaja && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setShowParaLlevar(true)}
            className="w-full min-h-20 p-5 rounded-2xl border-2 border-primary bg-primary text-primary-foreground text-left transition-all hover:brightness-110 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              boxShadow: '0 2px 0 rgba(255,255,255,0.2) inset, 0 6px 18px rgba(0,0,0,0.15)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-superficie/20 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <p className="font-heading font-black text-xl leading-tight">Para llevar</p>
                <p className="text-xs opacity-90">Toma el pedido y cóbralo aquí</p>
              </div>
            </div>
          </button>
          <ParaLlevarDeHoy />
        </div>
      )}

      {hayCaja && cajaAbierta && (
        <div className="px-4 py-2.5 rounded-xl bg-exito/10 border border-exito/30 text-sm text-exito flex items-center gap-2 flex-wrap">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            Caja abierta desde{' '}
            {safeFormatDate(cajaAbierta.fecha_apertura || cajaAbierta.fecha_inicio, 'd MMM, HH:mm')}
            {folioVisible(cajaAbierta.serie, cajaAbierta.folio, config, 'numero')
              ? ` · ${folioVisible(cajaAbierta.serie, cajaAbierta.folio, config, 'numero')}`
              : null}
            {cajaAbierta.usuario_apertura_nombre && ` · por ${cajaAbierta.usuario_apertura_nombre}`}
          </span>
        </div>
      )}

      {/* DP-20 · Dentro de la app: «Abrir cajón» y el aviso de la impresora del aparato. */}
      <AparatoEnLaCaja rol={posUser?.rol} />

      <Tabs defaultValue={isCajaDirecta ? 'buscar' : 'cobros'}>
        {/* Tabs scrollable horizontalmente en móvil */}
        <TabsList className="mb-4 flex w-full overflow-x-auto justify-start no-scrollbar">
          {!isCajaDirecta && (
            <TabsTrigger value="cobros" className="shrink-0">
              Pendientes ({ventasPendientes.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="buscar" className="shrink-0">
            Buscar
          </TabsTrigger>
          <TabsTrigger value="resumen" className="shrink-0">
            Resumen
          </TabsTrigger>
          <TabsTrigger value="historial" className="shrink-0">
            Historial
          </TabsTrigger>
          {/* DP-15 · Retiros, entradas de cambio y corte de turno: antes sólo existían en
              `/restaurante/caja`, adonde la cajera no llega (se la regresa a `/caja`). */}
          <TabsTrigger value="movimientos" className="shrink-0">
            Movimientos
          </TabsTrigger>
        </TabsList>

        {/* COBROS PENDIENTES (solo con sala: el módulo `mesas`) */}
        {!isCajaDirecta && (
          <TabsContent value="cobros">
            {ventasPendientes.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-exito" />
                <p className="font-medium">Sin cobros pendientes</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ventasPendientes.map((v) => {
                  const esCero = !v.total || v.total <= 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => (esCero ? handleEliminarTicketCero(v) : abrirVenta(v))}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${esCero ? 'border-peligro/30 bg-peligro/10 hover:bg-peligro/15' : 'border-acento/30 bg-acento/10 hover:bg-acento/15'}`}
                      style={{
                        boxShadow:
                          '0 2px 0 rgba(255,255,255,0.8) inset, 0 3px 8px rgba(0,0,0,0.08)',
                        touchAction: 'manipulation',
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-heading font-bold text-base">{rotuloDeCaja(v)}</p>
                          <p className="text-xs text-muted-foreground">
                            {folioVisible(v.serie, v.folio, config, 'numero')}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${esCero ? 'bg-peligro/20 text-peligro' : 'bg-acento/20 text-acento'}`}
                        >
                          {esCero ? 'En cero' : 'Cuenta'}
                        </span>
                      </div>
                      <p
                        className={`text-2xl font-heading font-black ${config?.colorear_importes_monetarios !== false ? 'text-primary' : 'text-foreground'}`}
                      >
                        {formatCurrency(v.total)}
                      </p>
                      {/* Badges QR — diferencian estado de la propina del comensal */}
                      {(v.propina_origen === 'portal_qr' ||
                        v.propina_origen === 'pendiente_portal_qr') && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {v.propina_origen === 'pendiente_portal_qr' ||
                          v.propina_tipo === 'pendiente_cliente' ? (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-advertencia/15 text-advertencia border border-advertencia/30">
                              QR: esperando propina
                            </span>
                          ) : v.propina_tipo === 'decidir_en_caja' ? (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-info/15 text-info border border-info/30">
                              QR: decidir en caja
                            </span>
                          ) : v.propina_tipo === 'sin_propina' ? (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-fondo-sutil text-texto border border-borde">
                              QR: sin propina
                            </span>
                          ) : v.propina_tipo === 'porcentaje' &&
                            Number(v.propina_porcentaje) > 0 ? (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-peligro/15 text-peligro border border-peligro/30">
                              QR: propina {v.propina_porcentaje}% (
                              {formatCurrency(propinaDerivada(v))})
                            </span>
                          ) : propinaDerivada(v) > 0 ? (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-peligro/15 text-peligro border border-peligro/30">
                              QR: propina {formatCurrency(propinaDerivada(v))}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-info/15 text-info border border-info/30">
                              QR: cuenta solicitada
                            </span>
                          )}
                        </div>
                      )}
                      {v.codigo_caja && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Código: <span className="font-mono font-bold">{v.codigo_caja}</span>
                        </p>
                      )}
                      {v.personas > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          {v.personas} personas{v.cliente_nombre ? ` · ${v.cliente_nombre}` : ''}
                        </p>
                      )}
                      <p
                        className={`mt-2 text-xs font-semibold ${esCero ? 'text-peligro' : 'text-primary'}`}
                      >
                        {esCero ? '🗑 Borrar ticket en cero →' : 'Toca para cobrar →'}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </TabsContent>
        )}

        {/* BUSCAR */}
        <TabsContent value="buscar">
          <div className="max-w-sm mx-auto space-y-4">
            <div
              className="p-5 rounded-xl border bg-superficie space-y-3"
              style={{
                boxShadow: '0 2px 0 rgba(255,255,255,0.9) inset, 0 4px 12px rgba(0,0,0,0.06)',
              }}
            >
              <p className="font-heading font-semibold">Buscar por código o folio</p>
              <div className="flex gap-2">
                <Input
                  value={codigoBusqueda}
                  onChange={(e) => setCodigoBusqueda(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && buscarVenta()}
                  placeholder="Ej: M03-5821"
                  aria-label="Código o folio"
                  className="font-mono text-lg h-12 tracking-wider"
                />
                <Button onClick={buscarVenta} className="h-12 px-4" aria-label="Buscar">
                  <Search className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* RESUMEN — usa componente unificado con propinas + total cobrado */}
        <TabsContent value="resumen">
          <ResumenDelDia
            resumen={resumen}
            margenProm={margenProm}
            verCostos={verCostos}
            ventasHoy={ventasHoy}
            cajaAbierta={cajaAbierta}
            ventasPendientes={ventasPendientes}
            colorearImportes={config?.colorear_importes_monetarios !== false}
          />
        </TabsContent>

        {/* HISTORIAL */}
        <TabsContent value="historial">
          <CorteHistorialList limit={100} />
        </TabsContent>
        <TabsContent value="movimientos">
          <MovimientosDeCaja
            puedeAdministrar={PUEDEN_ADMINISTRAR_LA_CAJA.includes(miPuesto)}
            alMover={() => {
              // El estado de la caja (y su resumen) se releen: el corte ya cuenta lo que se movió.
              queryClient.invalidateQueries({ queryKey: ['cortes_caja_estado'] });
            }}
          />
        </TabsContent>
      </Tabs>

      {/* DP-24 · LA TARJETA DE COBRO: la cuenta y el pago en una sola vista, sin diálogos encimados.
          La propina se elige ahí mismo (ya no hay «¿Desean agregar propina?» encima del cobro) y la
          cuenta del dinero la hace `~/venta/cuenta-del-cobro`, en centavos. La cuenta
          (`ventaSeleccionada`) sigue viviendo aquí. */}
      <TarjetaDeCobro
        abierta={!!ventaSeleccionada}
        titulo={`Cobrar — ${
          ventaSeleccionada?.canal === 'llevar'
            ? `Para llevar${ventaSeleccionada?.nombre_pedido ? ` · ${ventaSeleccionada.nombre_pedido}` : ''}`
            : ventaSeleccionada?.mesa_numero || ventaSeleccionada?.cliente_nombre
              ? rotuloDeCaja(ventaSeleccionada)
              : folioVisible(ventaSeleccionada?.serie, ventaSeleccionada?.folio, config, 'numero')
        }`}
        clave={`${ventaSeleccionada?.id ?? ''}|${String(aCentavos(ventaSeleccionada?.total))}`}
        renglones={renglonesDelCobro}
        subtotalCentavos={aCentavos(papelDelCobro.renglones)}
        descuentoCentavos={aCentavos(papelDelCobro.descuento)}
        ivaCentavos={aCentavos(papelDelCobro.iva)}
        ivaSeSuma={papelDelCobro.ivaSeSuma}
        totalCentavos={aCentavos(ventaSeleccionada?.total)}
        propina={tipsEnabled(config) ? propinaDeLaCuenta(ventaSeleccionada) : { tipo: 'sin_propina' }}
        porcentajes={getPorcentajesSugeridos(config)}
        propinas={
          !tipsEnabled(config) ? 'apagadas' : laCajaEligeLaPropina(config) ? 'elige' : 'solo-lectura'
        }
        guardandoPropina={guardandoPropina}
        procesando={procesando}
        mensajeDeProceso={procesandoMsg}
        aviso={avisoDelCobro}
        bajoElDescuento={
          ventaSeleccionada?.id ? <DescuentoAutorizado ordenId={ventaSeleccionada.id} /> : null
        }
        alElegirPropina={aplicarPropinaCaja}
        alCobrar={handleCobrar}
        alCerrar={() => setVentaSeleccionada(null)}
        alBorrarEnCero={() => handleEliminarTicketCero(ventaSeleccionada)}
        // DP-24 · Quitar un platillo, aquí donde se cobra: de la cuenta de una mesa (el pedido para
        // llevar se corrige en el suyo, y a una parte de una cuenta dividida no se le quita).
        alQuitar={
          ventaSeleccionada?.mesa_id && !ventaSeleccionada?.orden_padre_id
            ? (renglon) => setQuitandoDeLaCuenta(renglon)
            : undefined
        }
        acciones={
          <>
            {/* DP-24 · La Caja le agrega a la cuenta de una mesa, con el mismo buscador y rejilla del
                mesero: «Agregar» (para comer aquí) y «Para llevar» (va marcado a cocina). A una parte
                de una cuenta dividida no se le agrega, y el pedido para llevar se corrige en el suyo. */}
            {ventaSeleccionada?.mesa_id && !ventaSeleccionada?.orden_padre_id && (
              <>
                <Button
                  variant="outline"
                  disabled={procesando}
                  aria-label="Agregar a la cuenta"
                  onClick={() => setAgregandoALaCuenta({ paraLlevar: false })}
                >
                  <Plus className="w-4 h-4" /> Agregar
                </Button>
                <Button
                  variant="outline"
                  disabled={procesando}
                  onClick={() => setAgregandoALaCuenta({ paraLlevar: true })}
                >
                  <ShoppingBag className="w-4 h-4" /> Para llevar
                </Button>
              </>
            )}
            {/* DP-14.1 (punto 2): el descuento —con la clave de quien lo autoriza— y la
                cancelación de la cuenta, aquí donde se cobra. Con los descuentos apagados, el
                botón no aparece. */}
            {(ventaSeleccionada?.mesa_id ||
              ventaSeleccionada?.orden_padre_id ||
              ventaSeleccionada?.canal === 'llevar') &&
              ventaSeleccionada.total > 0 && (
                <DescuentoDeLaCuenta
                  ordenId={ventaSeleccionada.id}
                  base={Math.round(
                    (Number(ventaSeleccionada.subtotal) || Number(ventaSeleccionada.total) || 0) *
                      100,
                  )}
                  alAplicar={() => {
                    void releerLaCuentaDelCobro(ventaSeleccionada.id);
                  }}
                />
              )}
            {/* DP-16 · El pedido para llevar aún no cobrado no se «cancela»: «Cerrar» regresa a él. */}
            {ventaSeleccionada?.id && ventaSeleccionada.total > 0 && ventaSeleccionada?.canal !== 'llevar' && (
              <CancelarLaCuenta
                ordenId={ventaSeleccionada.id}
                alCancelar={(cancelada) => {
                  if (!cancelada) return;
                  setVentaSeleccionada(null);
                  setDetallesSeleccionados([]);
                  queryClient.invalidateQueries({ queryKey: ['ventas_pendientes_caja'] });
                  queryClient.invalidateQueries({ queryKey: ['mesas'] });
                  toast.success('Cuenta cancelada: queda en el corte con su motivo.');
                }}
              />
            )}
            {/* QA1-5 (DP-13.5): la cuenta de una mesa se divide aquí, donde se cobra. */}
            {ventaSeleccionada?.mesa_id && ventaSeleccionada.total > 0 && (
              <DividirLaCuenta
                ordenId={ventaSeleccionada.id}
                lineas={detallesSeleccionados}
                onDividida={() => {
                  setVentaSeleccionada(null);
                  queryClient.invalidateQueries({ queryKey: ['ventas_pendientes_caja'] });
                  toast.success('Cuenta dividida: cobra cada parte en Pendientes.');
                }}
              />
            )}
          </>
        }
      />

      {/* TICKET FINAL DIALOG — envuelto en SafeBoundary para que un fallo de
          render NO produzca pantalla blanca: solo muestra fallback compacto. */}
      <Dialog open={showTicketFinal} onOpenChange={setShowTicketFinal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Venta cobrada</DialogTitle>
          </DialogHeader>
          <SafeBoundary
            label="TicketFinal"
            fallbackTitle="No se pudo mostrar el ticket."
            fallbackMessage="La venta se cobró correctamente. Puedes verla en el historial."
            onReset={() => setShowTicketFinal(false)}
          >
            <div className="bg-muted/30 rounded-lg p-3 max-h-[60vh] overflow-y-auto">
              {ticketFinalData?.venta ? (
                <PreCuentaTicket
                  venta={ticketFinalData.venta}
                  detalles={Array.isArray(ticketFinalData.detalles) ? ticketFinalData.detalles : []}
                  config={config}
                  esFinal
                />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sin datos del ticket.
                </p>
              )}
            </div>
          </SafeBoundary>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTicketFinal(false)}>
              Cerrar
            </Button>
            <Button
              onClick={() => {
                try {
                  sonar('ticket');
                  printDocument({
                    mode: 'thermal',
                    title: `Ticket-${folioVisible(ticketFinalData?.venta?.serie, ticketFinalData?.venta?.folio, config, 'numero')}`,
                  });
                } catch (err) {
                  console.error('[Caja] imprimir ticket:', err);
                  toast.error('No se pudo iniciar la impresión');
                }
              }}
            >
              <Printer className="w-4 h-4 mr-1" />
              Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DP-24 · Quitar un platillo de la cuenta que se está cobrando. */}
      {quitandoDeLaCuenta && ventaSeleccionada?.id && (
        <QuitarDeLaCuenta
          key={quitandoDeLaCuenta.id}
          ordenId={ventaSeleccionada.id}
          lineaId={quitandoDeLaCuenta.id}
          nombre={quitandoDeLaCuenta.nombre}
          alCerrar={() => setQuitandoDeLaCuenta(null)}
          alQuitar={async () => {
            setQuitandoDeLaCuenta(null);
            // La cuenta cambió en el servidor: se relee sin el platillo, con su total y su versión.
            await releerLaCuentaDelCobro(ventaSeleccionada.id);
            queryClient.invalidateQueries({ queryKey: ['mesas'] });
          }}
        />
      )}

      {/* DP-24 · Agregar a la cuenta que se está cobrando (mismo buscador y rejilla). */}
      {agregandoALaCuenta && ventaSeleccionada?.id && (
        <ParaLlevarDialog
          key={`agregar-${ventaSeleccionada.id}-${agregandoALaCuenta.paraLlevar ? 'llevar' : 'aqui'}`}
          open
          usuarioId={posUser?.id}
          agregarA={{
            ordenId: ventaSeleccionada.id,
            rotulo: rotuloDeCaja(ventaSeleccionada),
            paraLlevar: agregandoALaCuenta.paraLlevar,
          }}
          onCerrar={() => setAgregandoALaCuenta(null)}
          onAgregado={async () => {
            const eraParaLlevar = agregandoALaCuenta.paraLlevar;
            setAgregandoALaCuenta(null);
            // La cuenta cambió en el servidor: se relee con sus renglones, su total y su versión.
            await releerLaCuentaDelCobro(ventaSeleccionada.id);
            queryClient.invalidateQueries({ queryKey: ['mesas'] });
            toast.success(
              eraParaLlevar
                ? 'Agregado para llevar: ya salió a cocina.'
                : 'Agregado a la cuenta: ya salió a cocina.',
            );
          }}
        />
      )}

      {/* DP-16 · La toma del pedido para llevar (se monta al abrirla: lee su borrador del aparato). */}
      {showParaLlevar && (
        <ParaLlevarDialog
          key={turnoParaLlevar}
          open
          usuarioId={posUser?.id}
          deEstaSesion={paraLlevarDeEstaSesion}
          onCerrar={() => {
            setParaLlevarDeEstaSesion(true);
            setShowParaLlevar(false);
          }}
          onCobrar={cobrarParaLlevar}
        />
      )}


      {/* === 3 MODALES NUEVOS === */}
      <AbrirCajaDialog
        open={showAbrirCaja}
        onOpenChange={setShowAbrirCaja}
        posUser={posUser}
        fondoEsperado={fondoEsperado}
        loading={accionLoading}
        onConfirm={handleAbrirCaja}
      />
      <CorteTurnoDialog
        open={showCorteTurno}
        onOpenChange={setShowCorteTurno}
        posUser={posUser}
        resumen={resumen}
        loading={accionLoading}
        onConfirm={handleCorteTurno}
      />
      <CierreDiarioDialog
        open={showCierreDiario}
        onOpenChange={setShowCierreDiario}
        posUser={posUser}
        cajaAbierta={cajaAbierta}
        resumen={resumen}
        loading={accionLoading}
        onConfirm={handleCierreDiario}
        colorearImportes={config?.colorear_importes_monetarios !== false}
      />

      {/* CIERRE EXITO DIALOG */}
      <Dialog open={showCierreExito} onOpenChange={setShowCierreExito}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-exito" />
              Caja cerrada correctamente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-exito/10 border border-exito/30">
              <p className="text-xs text-muted-foreground">Folio del corte</p>
              <p className="font-mono font-bold text-lg">{folioVisible(corteCerrado?.serie, corteCerrado?.folio, config)}</p>
              <p className="text-xs text-muted-foreground mt-2">Total cerrado</p>
              <p
                className={`font-heading font-black text-2xl ${config?.colorear_importes_monetarios !== false ? 'text-exito' : 'text-foreground'}`}
              >
                {formatCurrency(corteCerrado?.total_general || resumen.totalGeneral)}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <Button
                onClick={() => {
                  setVerPDFCorte(corteCerrado);
                  setShowCierreExito(false);
                }}
                className="gap-2"
              >
                <FileText className="w-4 h-4" /> Ver PDF de corte
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setVerPDFCorte(corteCerrado);
                  setShowCierreExito(false);
                }}
                className="gap-2"
              >
                <Printer className="w-4 h-4" /> Imprimir / descargar
              </Button>
              {/* DP-24 · Ya con el corte hecho, las propinas que queden se liquidan aquí mismo. La
                  caja ya cerró: esta entrega no cambia el corte (es la del Tablero). */}
              {PUEDEN_ADMINISTRAR_LA_CAJA.includes(miPuesto) && tipsEnabled(config) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCierreExito(false);
                    setLiquidandoTrasElCorte(true);
                  }}
                  className="gap-2"
                >
                  <Wallet className="w-4 h-4" /> Liquidar propinas
                </Button>
              )}
              <Button variant="ghost" onClick={() => setShowCierreExito(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DP-24 · Liquidar propinas tras el corte: el diálogo de siempre (no hay un segundo camino). */}
      <LiquidarPropinasDialog
        open={liquidandoTrasElCorte}
        onClose={() => setLiquidandoTrasElCorte(false)}
        meseros={usuariosDeLaCaja}
        rangoInicial="today"
      />

      {/* 6A: bloqueo cuando hay mesas abiertas */}
      <MesasPendientesCierreDialog
        open={Array.isArray(mesasPendientes) && mesasPendientes.length > 0}
        mesas={mesasPendientes || []}
        onClose={() => setMesasPendientes(null)}
      />

      {/* PDF VIEWER (al cerrar caja o desde historial) */}
      <CorteViewerDialog
        corte={verPDFCorte}
        open={!!verPDFCorte}
        onClose={() => setVerPDFCorte(null)}
      />

      {/* Auto-descarga del PDF al finalizar corte (sin abrir imprimir) */}
      {autoDownloadCorte && (
        <CorteAutoDownloader corte={autoDownloadCorte} onDone={() => setAutoDownloadCorte(null)} />
      )}
    </div>
  );
}
