'use client';
import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency, formatPercent } from '@/utils/financialUtils';
import { desgloseMetodosPagoConPropinas } from '@/utils/tipsUtils';
import {
  NOMBRE_DEL_NEGOCIO,
  marcaVisibleDePlataforma,
  nombreVisibleDelSistema,
} from '~/marca/nombre-visible';
import { seccionesDeCancelaciones } from '~/corte/cancelaciones';
import {
  dineroODato,
  diferenciaDelCorte,
  efectivoEsperadoDelCorte,
} from '~/corte-heredado/diferencia-del-corte';
import {
  AVISO_SIN_DESCUENTOS,
  EXPLICACION_SIN_DESCUENTOS,
  avisoDeLosDescuentosCortados,
  cuentaDelDescuento,
  tituloDeLosDescuentos,
} from '~/corte-heredado/descuentos-del-corte';
import { TITULO_DEL_DIA, celdasDelDia, seccionesExtraDelDia } from '~/corte-heredado/ventas-del-dia';
import {
  SIN_RECETA,
  costoDelProductoConocido,
  economiaDelPeriodo,
  rotuloDeLaUtilidadNeta,
  seVeElMargen,
  subtituloDelMargen,
} from '~/restaurante/margen-de-las-ventas';
import { SeccionPintada } from '~/corte/HojaDelCorte';
import { AVISO_SIN_EXTRAS } from '~/corte-heredado/extras-del-corte';
import { folioDelCorte, folioDeLaVenta, mesaDeLaVenta } from '~/corte-heredado/folio-y-mesa';
import { textoDeLaLinea } from '~/corte/linea-de-venta';
import { grupoDelCanal, referenciaParaLlevar, sumaPorGrupo } from '~/corte/canales';
import {
  AVISO_SIN_CANCELACIONES,
  EXPLICACION_SIN_CANCELACIONES,
} from '~/corte-heredado/cancelaciones-sin-trabar';

/**
 * Internal printable corte de caja PDF/document.
 * Wraps content in `.ticket-printable` so the existing print CSS only prints this.
 */
const CorteTicket = React.forwardRef(function CorteTicket(
  {
    corte,
    ventas = [],
    detalles = [],
    ingredientes = [],
    gastos = [],
    cancelaciones = [],
    cancelacionesNoLeidas = false,
    // DP-13.2 · 'caja' o 'dia' (Cierre del día): la sección dice de qué cancelaciones habla.
    alcanceDeCancelaciones = null,
    // DP-14.6 · Todas las del corte (contadas en SQL): «se muestran X de N» si la lista se cortó.
    totalDeCancelaciones = null,
    // DP-14.2 · Cada descuento con quién lo autorizó y por qué (`leerDescuentosDelCorte`).
    descuentos = null,
    // DP-15 (QA, J-H6) · Sólo en el Cierre del día: las ventas de todas las cajas (`leerVentasDelDia`).
    ventasDelDia = null,
    // DP-16 (QA-J, H3) · Opciones vendidas y retiros con PIN, de la hoja del servidor.
    extras = null,
    alertas = [],
    config = {},
    sinCostos = false,
    haySala = false,
  },
  ref,
) {
  // Parse desglose por mesero (guardado como JSON string). Tolerante a errores.
  let propinasPorMesero = [];
  try {
    const raw = corte?.propinas_por_mesero;
    if (raw && typeof raw === 'string') {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) propinasPorMesero = parsed;
    } else if (Array.isArray(raw)) {
      propinasPorMesero = raw;
    }
  } catch (_) {
    propinasPorMesero = [];
  }
  const totalPropinas = Number(corte?.total_propinas) || 0;
  // Desglose ventas/propinas/total por método de pago
  const metodos = desgloseMetodosPagoConPropinas(ventas);
  const totalRealMetodos =
    metodos.efectivo.total + metodos.tarjeta.total + metodos.transferencia.total;
  // En el puente la apertura es `fecha_apertura`; `fecha_inicio` era el nombre de su fuente.
  const aperturaDelCorte = corte?.fecha_apertura;
  const fInicio = aperturaDelCorte
    ? format(new Date(aperturaDelCorte), 'd MMM yyyy, HH:mm', { locale: es })
    : '—';
  const fCierre = corte?.fecha_cierre
    ? format(new Date(corte.fecha_cierre), 'd MMM yyyy, HH:mm', { locale: es })
    : '—';
  // DP-13.2 · Costo, utilidad y margen de LAS VENTAS DEL CORTE con costo completo (la regla del
  // servidor, `estado_costo`), no de los totales que se guardaban al cerrar: esos sumaban costo
  // cero por lo que no tiene receta. Sin ninguna con costo completo, «—, sin receta».
  const economia = economiaDelPeriodo(ventas);
  // DP-14.6 · Sin dato, «—»: el papel no inventa «$0.00» donde no hay nada que decir.
  const enPapel = (valor) => dineroODato(valor, formatCurrency);
  const enPesos = (valor) => (valor === null ? SIN_RECETA : formatCurrency(valor));
  // Quien no ve márgenes no lee «sin receta»: ni costo, ni utilidad, ni margen en su ticket.
  const conMargen = !sinCostos && seVeElMargen(economia);
  const utilidadNeta =
    economia.utilidad === null ? null : economia.utilidad - (corte?.total_gastos || 0);

  // Detalle agrupado por venta
  const detallesPorVenta = detalles.reduce((acc, d) => {
    (acc[d.venta_id] = acc[d.venta_id] || []).push(d);
    return acc;
  }, {});

  // Productos vendidos
  // 6B / 1.I — Agrupamos por producto. Para productos variables sumamos
  // también la cantidad real (g/ml/shots) para mostrarla en columna aparte.
  const productosMap = {};
  detalles.forEach((d) => {
    const key = d.producto_id || d.producto_nombre;
    const tipo = d?.tipo_venta_snapshot || 'precio_fijo';
    if (!productosMap[key]) {
      productosMap[key] = {
        nombre: d.producto_nombre,
        cantidad: 0,
        total: 0,
        costo: 0,
        tipo_venta: tipo,
        // Sumas reales para variables
        cantidad_variable_total: 0,
        unidad_variable: d?.unidad_variable_snapshot || '',
        cantidad_porciones_total: 0,
        nombre_porcion: d?.nombre_porcion_snapshot || '',
      };
    }
    productosMap[key].cantidad += d.cantidad || 0;
    productosMap[key].total += d.subtotal || 0;
    // QA2-012 (DP-13.5): el puente entrega el costo UNITARIO de la línea, no el total; leer
    // `costo_total_linea_snapshot` (que no llega) dejaba «Costo $0.00 · Utilidad = Total».
    productosMap[key].costo += (Number(d.costo_unitario_snapshot) || 0) * (Number(d.cantidad) || 0);
    if (tipo === 'variable_medida') {
      productosMap[key].cantidad_variable_total += Number(d?.cantidad_variable_snapshot) || 0;
    } else if (tipo === 'porcion_contenedor') {
      productosMap[key].cantidad_porciones_total += Number(d?.cantidad_porciones_snapshot) || 0;
    }
  });
  // 6B / 1.I — Texto de cantidad real para mostrar en tabla.
  const productos = Object.values(productosMap)
    .map((p) => {
      let cantidadReal = '';
      if (p.tipo_venta === 'variable_medida' && p.cantidad_variable_total > 0) {
        const n = p.cantidad_variable_total;
        const txt = Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
        cantidadReal = `${txt} ${p.unidad_variable || ''}`.trim();
      } else if (p.tipo_venta === 'porcion_contenedor' && p.cantidad_porciones_total > 0) {
        const n = p.cantidad_porciones_total;
        const nombre = p.nombre_porcion || 'porción';
        cantidadReal =
          n === 1 ? `1 ${nombre}` : `${n} ${/[sx]$/i.test(nombre) ? nombre : nombre + 's'}`;
      }
      return { ...p, cantidadReal };
    })
    .sort((a, b) => b.total - a.total);

  return (
    <div
      ref={ref}
      id="cash-cut-pdf-document"
      className="ticket-printable letter-doc cash-cut-pdf pdf-corte-caja bg-superficie text-texto mx-auto text-sm"
      style={{
        fontFamily: 'Inter, sans-serif',
        width: '210mm',
        maxWidth: '210mm',
        padding: '14mm',
        boxSizing: 'border-box',
      }}
    >
      {/* Encabezado con logo grande */}
      <div className="flex items-center gap-4 border-b-2 border-borde-fuerte pb-4 mb-4 avoid-break">
        {(config?.logo_pdf_url || config?.logo_url) && (
          <img
            src={config.logo_pdf_url || config.logo_url}
            alt={config?.nombre_negocio || ''}
            crossOrigin="anonymous"
            style={{ height: '80px', width: '80px', objectFit: 'contain' }}
          />
        )}
        <div className="flex-1">
          <h1 className="text-3xl font-heading font-black tracking-wider">
            {config?.nombre_negocio || NOMBRE_DEL_NEGOCIO}
          </h1>
          {config?.direccion && <p className="text-xs">{config.direccion}</p>}
          {config?.telefono && <p className="text-xs">Tel: {config.telefono}</p>}
          {config?.correo && <p className="text-xs">{config.correo}</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-black">CORTE DE CAJA</p>
          <p className="text-xs">
            Folio: <span className="font-mono font-bold">{folioDelCorte(corte ?? {})}</span>
          </p>
          <p className="text-[10px] text-texto-sutil mt-1">
            {marcaVisibleDePlataforma(config?.platform_brand)}
          </p>
        </div>
      </div>

      {/* Datos del corte */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-4 border p-3 rounded">
        <div>
          <strong>Apertura:</strong> {fInicio}
        </div>
        <div>
          <strong>Cierre:</strong> {fCierre}
        </div>
        <div>
          <strong>Cajero apertura:</strong>{' '}
          {corte?.usuario_apertura_nombre || corte?.usuario_cajero_nombre || '—'}
        </div>
        <div>
          <strong>Cajero cierre:</strong> {corte?.usuario_cajero_nombre || '—'}
        </div>
        <div>
          <strong>Estado:</strong> {corte?.estado === 'cerrado' ? 'Cerrado' : 'Abierto'}
        </div>
        <div>
          <strong>Tipo:</strong>{' '}
          {corte?.tipo_corte === 'turno' ? 'Corte de turno' : 'Cierre diario'}
        </div>
        {corte?.notas_apertura && (
          <div className="col-span-2">
            <strong>Notas apertura:</strong> {corte.notas_apertura}
          </div>
        )}
        {corte?.notas && (
          <div className="col-span-2">
            <strong>Notas cierre:</strong> {corte.notas}
          </div>
        )}
      </div>

      {/* Apertura / fondo */}
      <Section title="Apertura y fondo">
        <Grid>
          <Cell label="Fondo esperado apertura" value={enPapel(corte?.fondo_esperado_apertura)} />
          <Cell label="Efectivo inicial contado" value={enPapel(corte?.efectivo_inicial_contado)} />
          <Cell label="Diferencia apertura" value={enPapel(corte?.diferencia_apertura)} />
          <Cell label="Efectivo contado al cierre" value={enPapel(corte?.efectivo_contado)} />
          <Cell label="Efectivo esperado" value={enPapel(efectivoEsperadoDelCorte(corte))} />
          <Cell label="Diferencia efectivo" value={enPapel(diferenciaDelCorte(corte))} />
          <Cell label="Dinero dejado en caja" value={enPapel(corte?.dinero_dejado_en_caja)} bold />
        </Grid>
      </Section>

      {/* DP-15 (QA, J-H6) · El Cierre del día con varias cajas: las ventas de todas */}
      {ventasDelDia && (
        <Section title={TITULO_DEL_DIA}>
          <Grid>
            {celdasDelDia(ventasDelDia).map((c) => (
              <Cell
                key={c.etiqueta}
                label={c.etiqueta}
                value={c.pesos === undefined ? c.texto : formatCurrency(c.pesos)}
                bold={c.fuerte}
              />
            ))}
          </Grid>
        </Section>
      )}
      {/* DP-17 · Las opciones y los retiros con PIN del día, de todas las cajas. */}
      {ventasDelDia &&
        seccionesExtraDelDia(ventasDelDia).map((seccion) => (
          <SeccionPintada key={seccion.titulo} seccion={seccion} />
        ))}

      {/* Resumen financiero — sin el módulo `costos_basicos` sólo se muestran ventas y métodos de pago */}
      <Section
        title={
          ventasDelDia ? 'Resumen de esta caja' : sinCostos ? 'Resumen de ventas' : 'Resumen financiero'
        }
      >
        <Grid>
          <Cell label="Total ventas" value={formatCurrency(corte?.total_general)} bold />
          <Cell label="N° tickets" value={corte?.numero_ventas || 0} />
          <Cell label="Ticket promedio" value={formatCurrency(corte?.ticket_promedio)} />
          <Cell label="Efectivo" value={formatCurrency(corte?.total_efectivo)} />
          <Cell label="Tarjeta" value={formatCurrency(corte?.total_tarjeta)} />
          <Cell label="Transferencia" value={formatCurrency(corte?.total_transferencia)} />
          {conMargen && <Cell label="Costo de ventas" value={enPesos(economia.costo)} />}
          {conMargen && <Cell label="Utilidad bruta" value={enPesos(economia.utilidad)} />}
          {conMargen && (
            <Cell label="Margen promedio" value={subtituloDelMargen(economia) || SIN_RECETA} />
          )}
          {!sinCostos && (
            <Cell label="Gastos operativos" value={formatCurrency(corte?.total_gastos)} />
          )}
          {conMargen && (
            <Cell
              label={rotuloDeLaUtilidadNeta(economia.estado === 'parcial')}
              value={enPesos(utilidadNeta)}
              bold
            />
          )}
          <Cell
            label="Total general"
            value={formatCurrency(
              (corte?.total_efectivo || 0) +
                (corte?.total_tarjeta || 0) +
                (corte?.total_transferencia || 0),
            )}
          />
        </Grid>
      </Section>

      {/* Métodos de pago — ventas / propinas / total */}
      {totalPropinas > 0 && (
        <Section title="Métodos de pago — ventas, propinas y total">
          <table className="w-full text-xs border">
            <thead className="bg-fondo-sutil">
              <tr>
                <th className="border px-2 py-1 text-left">Método</th>
                <th className="border px-2 py-1 text-right">Ventas</th>
                <th className="border px-2 py-1 text-right">Propinas</th>
                <th className="border px-2 py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border px-2 py-1">Efectivo</td>
                <td className="border px-2 py-1 text-right">
                  {formatCurrency(metodos.efectivo.ventas)}
                </td>
                <td className="border px-2 py-1 text-right text-peligro">
                  {formatCurrency(metodos.efectivo.propinas)}
                </td>
                <td className="border px-2 py-1 text-right font-bold">
                  {formatCurrency(metodos.efectivo.total)}
                </td>
              </tr>
              <tr>
                <td className="border px-2 py-1">Tarjeta</td>
                <td className="border px-2 py-1 text-right">
                  {formatCurrency(metodos.tarjeta.ventas)}
                </td>
                <td className="border px-2 py-1 text-right text-peligro">
                  {formatCurrency(metodos.tarjeta.propinas)}
                </td>
                <td className="border px-2 py-1 text-right font-bold">
                  {formatCurrency(metodos.tarjeta.total)}
                </td>
              </tr>
              <tr>
                <td className="border px-2 py-1">Transferencia</td>
                <td className="border px-2 py-1 text-right">
                  {formatCurrency(metodos.transferencia.ventas)}
                </td>
                <td className="border px-2 py-1 text-right text-peligro">
                  {formatCurrency(metodos.transferencia.propinas)}
                </td>
                <td className="border px-2 py-1 text-right font-bold">
                  {formatCurrency(metodos.transferencia.total)}
                </td>
              </tr>
              <tr className="bg-fondo-sutil">
                <td className="border px-2 py-1 font-bold">TOTAL</td>
                <td className="border px-2 py-1 text-right font-bold">
                  {formatCurrency(
                    metodos.efectivo.ventas + metodos.tarjeta.ventas + metodos.transferencia.ventas,
                  )}
                </td>
                <td className="border px-2 py-1 text-right font-bold text-peligro">
                  {formatCurrency(totalPropinas)}
                </td>
                <td className="border px-2 py-1 text-right font-bold">
                  {formatCurrency(totalRealMetodos)}
                </td>
              </tr>
            </tbody>
          </table>
        </Section>
      )}

      {/* Propinas — siempre visible cuando hay propinas, separado de ventas/utilidad */}
      <Section title="Propinas">
        <Grid>
          <Cell label="Total propinas" value={formatCurrency(totalPropinas)} bold />
          <Cell label="Ventas reales (sin propina)" value={formatCurrency(corte?.total_general)} />
          <Cell
            label="Total cobrado (con propina)"
            value={formatCurrency((Number(corte?.total_general) || 0) + totalPropinas)}
            bold
          />
        </Grid>
        {haySala && propinasPorMesero.length > 0 && (
          <table className="w-full text-xs border mt-2">
            <thead className="bg-fondo-sutil">
              <tr>
                <th className="border px-2 py-1 text-left">Mesero</th>
                <th className="border px-2 py-1 text-right">Propinas</th>
              </tr>
            </thead>
            <tbody>
              {propinasPorMesero.map((m, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1">{m?.mesero_nombre || 'Sin mesero asignado'}</td>
                  <td className="border px-2 py-1 text-right font-bold">
                    {formatCurrency(m?.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* DP-16 · Mesas y para llevar, por separado (el mismo cálculo que el documento del cierre). */}
      {ventas.some((v) => grupoDelCanal(v.canal) === 'llevar') &&
        (() => {
          const suma = sumaPorGrupo(
            ventas.map((v) => ({
              canal: v.canal || 'aqui',
              totalCentavos: String(Math.round((Number(v.total) || 0) * 100)),
            })),
          );
          return (
            <Section title="Mesas y para llevar">
              <table className="w-full text-xs border">
                <tbody>
                  {[
                    ['Mesas', suma.mesas],
                    ['Para llevar', suma.llevar],
                  ].map(([nombre, g]) => (
                    <tr key={nombre}>
                      <td className="border px-2 py-1">{nombre}</td>
                      <td className="border px-2 py-1 text-right">{g.cuentas} cuentas</td>
                      <td className="border px-2 py-1 text-right font-bold">
                        {formatCurrency(Number(g.totalCentavos) / 100)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          );
        })()}

      {/* Detalle de ventas */}
      <Section title={`Detalle de ventas (${ventas.length})`}>
        <table className="w-full text-xs border">
          <thead className="bg-fondo-sutil">
            <tr>
              <th className="border px-2 py-1 text-left">Folio</th>
              <th className="border px-2 py-1 text-left">Hora</th>
              <th className="border px-2 py-1 text-left">Mesa o pedido</th>
              <th className="border px-2 py-1 text-left">Productos</th>
              <th className="border px-2 py-1 text-right">Total</th>
              <th className="border px-2 py-1 text-left">Pago</th>
            </tr>
          </thead>
          <tbody>
            {ventas.map((v) => {
              const dets = detallesPorVenta[v.id] || [];
              return (
                <tr key={v.id}>
                  <td className="border px-2 py-1 font-mono">{folioDeLaVenta(v)}</td>
                  <td className="border px-2 py-1">
                    {v.fecha_cierre
                      ? format(new Date(v.fecha_cierre), 'HH:mm', { locale: es })
                      : '—'}
                  </td>
                  <td className="border px-2 py-1">
                    {grupoDelCanal(v.canal) === 'llevar' ? (
                      referenciaParaLlevar(v.numero_pedido, v.nombre_pedido)
                    ) : (
                      // DP-17 (QA R3) · Una parte no tiene mesa y su nombre ya la dice: sin «— · ».
                      [mesaDeLaVenta(v), v.cliente_nombre].filter(Boolean).join(' · ') || '—'
                    )}
                  </td>
                  <td className="border px-2 py-1">
                    {dets.map((d, i) => (
                      // DP-15 · El mismo texto que el documento del cierre (`textoDeLaLinea`):
                      // «Barbacoa de horno — ½ kg», «Arrachera ×2».
                      <div key={i}>
                        {textoDeLaLinea({
                          nombre: d.producto_nombre,
                          cantidad: d.cantidad,
                          tipo_venta_snapshot: d.tipo_venta_snapshot,
                          cantidad_variable_snapshot: d.cantidad_variable_snapshot,
                          unidad_variable_snapshot: d.unidad_variable_snapshot,
                        })}
                      </div>
                    ))}
                    {dets.length === 0 && <span className="text-texto-tenue">—</span>}
                  </td>
                  <td className="border px-2 py-1 text-right font-bold">
                    {formatCurrency(v.total)}
                  </td>
                  <td className="border px-2 py-1 capitalize">{v.metodo_pago || '—'}</td>
                </tr>
              );
            })}
            {ventas.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center text-texto-tenue py-2">
                  Sin ventas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      {/* Productos vendidos — sin `costos_basicos`, sin columnas de costo/utilidad.
          6B / 1.I — Nueva columna "Cantidad real" muestra g/ml/shots para variables. */}
      <Section title="Productos vendidos">
        <table className="w-full text-xs border">
          <thead className="bg-fondo-sutil">
            <tr>
              <th className="border px-2 py-1 text-left">Producto</th>
              <th className="border px-2 py-1 text-right">Líneas</th>
              <th className="border px-2 py-1 text-right">Cantidad real</th>
              <th className="border px-2 py-1 text-right">Total</th>
              {conMargen && <th className="border px-2 py-1 text-right">Costo</th>}
              {conMargen && <th className="border px-2 py-1 text-right">Utilidad</th>}
            </tr>
          </thead>
          <tbody>
            {productos.map((p, i) => (
              <tr key={i}>
                <td className="border px-2 py-1">{p.nombre}</td>
                <td className="border px-2 py-1 text-right">{p.cantidad}</td>
                <td className="border px-2 py-1 text-right">{p.cantidadReal || '—'}</td>
                <td className="border px-2 py-1 text-right">{formatCurrency(p.total)}</td>
                {/* DP-14.6-2 · Un producto vendido con costo cero no tiene costo conocido: «—», no
                    «$0.00» con la utilidad igual al total. */}
                {conMargen && (
                  <td className="border px-2 py-1 text-right">
                    {costoDelProductoConocido(p) ? formatCurrency(p.costo) : '—'}
                  </td>
                )}
                {conMargen && (
                  <td className="border px-2 py-1 text-right font-bold">
                    {costoDelProductoConocido(p) ? formatCurrency(p.total - p.costo) : '—'}
                  </td>
                )}
              </tr>
            ))}
            {productos.length === 0 && (
              <tr>
                <td colSpan={sinCostos ? 4 : 6} className="text-center text-texto-tenue py-2">
                  Sin productos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      {/* Ingredientes consumidos — solo con el módulo `recetas` */}
      {!sinCostos && (
        <Section title="Ingredientes / insumos consumidos">
          <table className="w-full text-xs border">
            <thead className="bg-fondo-sutil">
              <tr>
                <th className="border px-2 py-1 text-left">Ingrediente</th>
                <th className="border px-2 py-1 text-right">Cantidad</th>
                <th className="border px-2 py-1 text-left">Unidad</th>
                <th className="border px-2 py-1 text-right">Costo unit.</th>
                <th className="border px-2 py-1 text-right">Costo total</th>
              </tr>
            </thead>
            <tbody>
              {ingredientes.map((i, idx) => (
                <tr key={idx}>
                  <td className="border px-2 py-1">{i.nombre}</td>
                  <td className="border px-2 py-1 text-right">
                    {Number.isFinite(Number(i?.cantidad)) ? Number(i.cantidad).toFixed(2) : '0.00'}
                  </td>
                  <td className="border px-2 py-1">{i.unidad}</td>
                  <td className="border px-2 py-1 text-right">{formatCurrency(i.costoUnit)}</td>
                  <td className="border px-2 py-1 text-right font-bold">
                    {formatCurrency(i.costoTotal)}
                  </td>
                </tr>
              ))}
              {ingredientes.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center text-texto-tenue py-2">
                    Sin consumo registrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Section>
      )}

      {/* Gastos — solo con el módulo `gastos` */}
      {!sinCostos && gastos.length > 0 && (
        <Section title="Gastos operativos">
          <table className="w-full text-xs border">
            <thead className="bg-fondo-sutil">
              <tr>
                <th className="border px-2 py-1 text-left">Categoría</th>
                <th className="border px-2 py-1 text-left">Descripción</th>
                <th className="border px-2 py-1 text-left">Pago</th>
                <th className="border px-2 py-1 text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((g, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1 capitalize">{g.categoria}</td>
                  <td className="border px-2 py-1">{g.descripcion}</td>
                  <td className="border px-2 py-1 capitalize">{g.metodo_pago || '—'}</td>
                  <td className="border px-2 py-1 text-right font-bold">
                    {formatCurrency(g.monto)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Inventario bajo / crítico — solo con el módulo `inventario` */}
      {!sinCostos && alertas.length > 0 && (
        <Section title="Inventario bajo / crítico">
          <table className="w-full text-xs border">
            <thead className="bg-fondo-sutil">
              <tr>
                <th className="border px-2 py-1 text-left">Ingrediente</th>
                <th className="border px-2 py-1 text-right">Stock actual</th>
                <th className="border px-2 py-1 text-right">Stock mínimo</th>
                <th className="border px-2 py-1 text-left">Estado</th>
                <th className="border px-2 py-1 text-left">Recomendación</th>
              </tr>
            </thead>
            <tbody>
              {alertas.map((a, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1">{a.nombre}</td>
                  <td className="border px-2 py-1 text-right">
                    {a.stock_actual} {a.unidad_base}
                  </td>
                  <td className="border px-2 py-1 text-right">
                    {a.stock_minimo || 0} {a.unidad_base}
                  </td>
                  <td className="border px-2 py-1 capitalize">{a.status}</td>
                  <td className="border px-2 py-1">
                    {a.status === 'agotado'
                      ? 'Comprar urgente'
                      : a.status === 'critico'
                        ? 'Comprar pronto'
                        : 'Reabastecer'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Cancelaciones · DP-12.4: las filas son las del servidor (quién canceló, motivo, importe
          y si ya estaba preparado) y las pinta el MISMO código que arma el corte de Cierre diario:
          la pérdida aparte y resaltada, y lo cancelado antes de prepararse sin resaltar.
          DP-13.4: si no se pudieron leer, la sección lo dice (una lista vacía parecería «sin
          cancelaciones»). */}
      {cancelacionesNoLeidas ? (
        <Section title="Cancelaciones">
          <p role="alert" className="text-xs font-bold text-peligro">
            {AVISO_SIN_CANCELACIONES}
          </p>
          <p className="text-xs text-texto-sutil">{EXPLICACION_SIN_CANCELACIONES}</p>
        </Section>
      ) : (
        seccionesDeCancelaciones(
          cancelaciones,
          alcanceDeCancelaciones ?? undefined,
          totalDeCancelaciones ?? undefined,
        ).map((seccion) => <SeccionPintada key={seccion.titulo} seccion={seccion} />)
      )}

      {/* Descuentos · DP-14.2: cada uno con cuánto, quién lo autorizó con su PIN y por qué, y el
          total. En el Cierre del día, los de todas las cajas, cada uno una vez. Si no se pudieron
          leer, la sección lo dice. */}
      {descuentos?.noSePudieronLeer === true && (
        <Section title="Descuentos">
          <p role="alert" className="text-xs font-bold text-peligro">
            {AVISO_SIN_DESCUENTOS}
          </p>
          <p className="text-xs text-texto-sutil">{EXPLICACION_SIN_DESCUENTOS}</p>
        </Section>
      )}
      {descuentos !== null && !descuentos.noSePudieronLeer && descuentos.filas.length > 0 && (
        <Section title={tituloDeLosDescuentos(descuentos.alcance)}>
          <table className="w-full text-xs border">
            <thead className="bg-fondo-sutil">
              <tr>
                <th className="border px-2 py-1 text-left">Cuenta</th>
                <th className="border px-2 py-1 text-right">Descuento</th>
                <th className="border px-2 py-1 text-left">Autorizó</th>
                <th className="border px-2 py-1 text-left">Por qué</th>
              </tr>
            </thead>
            <tbody>
              {descuentos.filas.map((d) => (
                <tr key={d.ordenId}>
                  <td className="border px-2 py-1">{cuentaDelDescuento(d)}</td>
                  <td className="border px-2 py-1 text-right">
                    {formatCurrency(Number(d.montoCentavos) / 100)}
                  </td>
                  <td className="border px-2 py-1">{d.autorizo || '—'}</td>
                  <td className="border px-2 py-1">{d.motivo || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td className="border px-2 py-1">Total</td>
                <td className="border px-2 py-1 text-right">
                  {formatCurrency(descuentos.totalCentavos / 100)}
                </td>
                <td className="border px-2 py-1" colSpan={2} />
              </tr>
            </tfoot>
          </table>
          {/* DP-14 ronda 2 · Si el servidor cortó la lista, el total sigue siendo el completo. */}
          {avisoDeLosDescuentosCortados(descuentos) !== null && (
            <p className="mt-1 text-xs text-texto-sutil">
              {avisoDeLosDescuentosCortados(descuentos)}
            </p>
          )}
        </Section>
      )}

      {/* DP-16 (QA-J, H3) · Lo mismo que el documento al cerrar: opciones y retiros con PIN. */}
      {extras?.noSePudieronLeer === true && (
        <p role="status" className="mb-4 text-xs text-advertencia">
          {AVISO_SIN_EXTRAS}: vuelve a abrir el corte para leerlos.
        </p>
      )}
      {extras?.secciones.map((seccion) => (
        <SeccionPintada key={seccion.titulo} seccion={seccion} />
      ))}

      {/* Firmas */}
      <div className="grid grid-cols-2 gap-8 mt-10 text-xs">
        <div className="text-center">
          <div className="border-t border-borde-fuerte pt-1">Responsable de caja</div>
          <p>{corte?.usuario_cajero_nombre || ''}</p>
        </div>
        <div className="text-center">
          <div className="border-t border-borde-fuerte pt-1">Administrador</div>
        </div>
      </div>

      {config?.pdf_footer && (
        <p className="text-center text-[10px] text-texto mt-4">{config.pdf_footer}</p>
      )}
      <p className="text-center text-[10px] text-texto-sutil mt-6">
        Documento interno ·{' '}
        {nombreVisibleDelSistema(config?.nombre_sistema || config?.platform_brand)} · Generado{' '}
        {format(new Date(), 'd MMM yyyy HH:mm', { locale: es })}
      </p>
    </div>
  );
});

export default CorteTicket;

function Section({ title, children }) {
  return (
    <div className="mb-4">
      <h2 className="font-bold text-sm uppercase border-b border-borde-fuerte mb-2">{title}</h2>
      {children}
    </div>
  );
}
function Grid({ children }) {
  return <div className="grid grid-cols-3 gap-2 text-xs">{children}</div>;
}
function Cell({ label, value, bold }) {
  return (
    <div className="border p-2 rounded">
      <div className="text-[10px] text-texto-sutil uppercase">{label}</div>
      <div className={bold ? 'font-bold' : ''}>{value}</div>
    </div>
  );
}
