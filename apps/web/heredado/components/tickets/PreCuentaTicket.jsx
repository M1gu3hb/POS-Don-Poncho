'use client';
import React from 'react';
import { formatCurrency } from '@/utils/financialUtils';
import { totalesDelPapel } from '~/venta/totales-del-papel';
import { formatearCantidadVariable } from '@/utils/tipoVentaUtils';
import { propinaDerivada } from '@/utils/tipsUtils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { NOMBRE_DEL_NEGOCIO } from '~/marca/nombre-visible';
import { anchoDelPapel } from '~/impresion/papel';
import {
  ESCALA_EN_PANTALLA,
  LINEA_GRUESA,
  LINEA_TERMICA,
  estiloDelLienzo,
  letraTermica,
  logoTermico,
  puntosDelLienzo,
} from '~/impresion/termico/estilo';
import { sufijoDelNombreDeLaMesa } from '~/restaurante/nombre-de-la-mesa';
import { esParaLlevar, rotuloDeLaComanda } from '~/restaurante/rotulo-de-la-comanda';
import { notaSinLasOpciones, renglonesDeLasOpciones } from '~/venta/opciones-del-renglon';

/**
 * Ticket / pre-cuenta para impresora térmica, con el ESTILO TÉRMICO (DP-20 · refuerzo §1).
 *
 * Ancho: el rollo del negocio, 58 u 80 mm (`ancho_papel_ticket`). El documento se dibuja en un
 * lienzo medido en PUNTOS de la impresora (`puntos`: 384, 576 o los del perfil del aparato) con
 * negro puro, letra gruesa y separadores sólidos; en pantalla se achica con `zoom` a su tamaño
 * real en papel. Es el MISMO lienzo el que se manda como imagen a la impresora (`soloLienzo`) y
 * el que imprime el navegador (@media print, `.ticket-printable`): no hay plantilla aparte.
 *
 * `pie`: «ORIGINAL — CLIENTE» / «COPIA — NEGOCIO». `reimpresion`: la fecha y la hora, si este
 * papel es una reimpresión.
 */
export default function PreCuentaTicket({
  venta,
  detalles,
  mesa,
  config,
  codigo,
  esFinal = false,
  puntos,
  pie,
  reimpresion,
  soloLienzo = false,
}) {
  if (!venta) return null;
  // DP-15 · El rollo del negocio (58 u 80 mm); DP-20 · sus puntos, o los del perfil del aparato.
  const ancho = anchoDelPapel(config?.ancho_papel_ticket);
  const enPuntos = puntosDelLienzo(ancho, puntos);
  const letra = letraTermica(ancho);
  const logo = logoTermico(ancho);
  const px = (n) => `${n}px`;
  const montoPropina = propinaDerivada(venta);
  const fecha =
    venta.fecha_cierre || venta.fecha_apertura
      ? format(new Date(venta.fecha_cierre || venta.fecha_apertura), 'd MMM yyyy · HH:mm', {
          locale: es,
        })
      : format(new Date(), 'd MMM yyyy · HH:mm', { locale: es });

  const lienzo = (
    <div
      data-lienzo-termico
      style={{ ...estiloDelLienzo(ancho, enPuntos), zoom: soloLienzo ? 1 : ESCALA_EN_PANTALLA }}
    >
      {reimpresion && (
        <div
          data-reimpresion
          style={{
            border: LINEA_GRUESA,
            textAlign: 'center',
            padding: '6px 4px',
            marginBottom: '10px',
          }}
        >
          <p style={{ fontWeight: 900, fontSize: px(letra.fuerte), letterSpacing: '2px', margin: 0 }}>
            REIMPRESIÓN
          </p>
          <p style={{ fontSize: px(letra.chica), margin: 0 }}>{reimpresion}</p>
        </div>
      )}

      {/* Encabezado con logo */}
      <div style={{ textAlign: 'center', paddingBottom: '10px', marginBottom: '10px', borderBottom: LINEA_TERMICA }}>
        {(config?.logo_ticket_url || config?.logo_url) && config?.mostrar_logo_ticket !== false && (
          <img
            src={config.logo_ticket_url || config.logo_url}
            alt=""
            crossOrigin="anonymous"
            style={{
              maxWidth: px(logo.ancho),
              maxHeight: px(logo.alto),
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              margin: '0 auto 8px',
              display: 'block',
            }}
          />
        )}
        <h1 style={{ fontWeight: 900, fontSize: px(letra.titulo), letterSpacing: '1px', lineHeight: 1.1, margin: 0 }}>
          {config?.nombre_negocio || NOMBRE_DEL_NEGOCIO}
        </h1>
        {config?.direccion && (
          <p style={{ fontSize: px(letra.chica), margin: '4px 0 0' }}>{config.direccion}</p>
        )}
        {config?.telefono && (
          <p style={{ fontSize: px(letra.chica), margin: 0 }}>Tel: {config.telefono}</p>
        )}
        <p style={{ fontWeight: 900, marginTop: '8px', marginBottom: 0, fontSize: px(letra.fuerte) }}>
          {esFinal ? 'TICKET DE PAGO' : 'PRE-CUENTA'}
        </p>
        {/* DP-16 · El pedido para llevar se grita por su número: va grande, antes de todo. */}
        {esParaLlevar(venta) && (
          <p
            data-para-llevar
            style={{ fontWeight: 900, marginTop: '6px', marginBottom: 0, fontSize: px(letra.titulo), letterSpacing: '1px' }}
          >
            {rotuloDeLaComanda(venta)}
          </p>
        )}
      </div>

      {/* Datos */}
      <div style={{ fontSize: px(letra.chica), marginBottom: '10px' }}>
        <Row label="Folio" value={venta.folio} bold />
        {mesa && <Row label="Mesa" value={`#${mesa.numero}${sufijoDelNombreDeLaMesa(mesa)}`} />}
        {venta.personas > 0 && <Row label="Personas" value={venta.personas} />}
        {venta.cliente_nombre && <Row label="Cliente" value={venta.cliente_nombre} />}
        {venta.usuario_mesero_nombre && <Row label="Mesero" value={venta.usuario_mesero_nombre} />}
        {venta.usuario_cajero_nombre && <Row label="Cajero" value={venta.usuario_cajero_nombre} />}
        <Row label="Fecha" value={fecha} />
      </div>

      {/* Productos — 6B: si la línea es variable, mostramos "500 g × Producto"
          o "4 shots × Producto" en lugar de "1× Producto". precio_fijo intacto. */}
      <div style={{ borderTop: LINEA_TERMICA, paddingTop: '8px', marginBottom: '8px' }}>
        {(detalles || []).map((d, i) => {
          const cantVarTxt = formatearCantidadVariable(d || {});
          const prefijo = cantVarTxt ? `${cantVarTxt} ×` : `${d?.cantidad || 0}×`;
          // DP-16 · Las opciones salen con su precio; la nota, sólo con lo escrito a mano.
          const nota = notaSinLasOpciones(d?.notas_producto, d?.opciones_snapshot);
          return (
            <div key={i} style={{ marginBottom: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                <span style={{ flex: 1 }}>
                  {prefijo} {d?.producto_nombre || ''}
                </span>
                <span style={{ whiteSpace: 'nowrap' }}>{formatCurrency(d?.subtotal)}</span>
              </div>
              {(d?.opciones_snapshot != null
                ? renglonesDeLasOpciones(d.opciones_snapshot)
                : String(d?.opciones_texto || '')
                    .split(' · ')
                    .filter(Boolean)
              ).map((texto) => (
                <p
                  key={texto}
                  data-opciones-del-renglon
                  style={{ fontSize: px(letra.chica), paddingLeft: '16px', margin: '2px 0 0' }}
                >
                  + {texto}
                </p>
              ))}
              {nota && (
                <p style={{ fontSize: px(letra.chica), paddingLeft: '16px', margin: '2px 0 0' }}>
                  ↳ {nota}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Totales — DP-14 (ronda 2, bloqueante 1): el papel SUMA. Renglones − descuento (+ IVA si
          no va incluido) = el total del servidor; + propina = lo cobrado (`totalesDelPapel`, que
          conserva el respaldo de HOTFIX 6A para la venta leída con total 0). */}
      {(() => {
        const papel = totalesDelPapel(venta, detalles);
        return (
          <div style={{ borderTop: LINEA_TERMICA, paddingTop: '8px', marginBottom: '8px' }}>
            <Row label="Subtotal" value={formatCurrency(papel.renglones)} />
            {papel.descuento > 0 && (
              <Row label="Descuento" value={`-${formatCurrency(papel.descuento)}`} />
            )}
            {papel.iva > 0 && (
              <Row
                label={papel.ivaSeSuma ? 'IVA' : 'IVA incluido'}
                value={formatCurrency(papel.iva)}
              />
            )}
            {montoPropina > 0 && (
              <Row
                label={`Propina${venta.propina_porcentaje > 0 ? ` (${venta.propina_porcentaje}%)` : ''}`}
                value={formatCurrency(montoPropina)}
              />
            )}
            {venta.propina_tipo === 'pendiente' && !esFinal && (
              <Row label="Propina" value="A definir en caja" />
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 900,
                fontSize: px(letra.total),
                borderTop: LINEA_GRUESA,
                marginTop: '6px',
                paddingTop: '6px',
              }}
            >
              <span>TOTAL</span>
              <span>{formatCurrency(papel.total + montoPropina)}</span>
            </div>
            {esFinal && venta.metodo_pago && (
              <div style={{ marginTop: '8px', fontSize: px(letra.chica) }}>
                <Row label="Pago" value={venta.metodo_pago} capitalize />
                {venta.monto_efectivo > 0 && (
                  <Row label="Efectivo" value={formatCurrency(venta.monto_efectivo)} />
                )}
                {venta.monto_tarjeta > 0 && (
                  <Row label="Tarjeta" value={formatCurrency(venta.monto_tarjeta)} />
                )}
                {venta.monto_transferencia > 0 && (
                  <Row label="Transf." value={formatCurrency(venta.monto_transferencia)} />
                )}
                {venta.cambio > 0 && (
                  <Row label="Cambio" value={formatCurrency(venta.cambio)} bold />
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Código caja para precuentas */}
      {!esFinal && codigo && (
        <div
          style={{
            border: LINEA_GRUESA,
            textAlign: 'center',
            padding: '12px 6px',
            margin: '14px 0',
          }}
        >
          <p style={{ fontSize: px(letra.chica), margin: 0 }}>CÓDIGO PARA CAJA</p>
          <p
            style={{
              fontSize: px(letra.codigo),
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing: ancho === 58 ? '4px' : '8px',
              margin: '4px 0',
            }}
          >
            {codigo}
          </p>
          <p style={{ fontSize: px(letra.chica), margin: 0 }}>Presenta este código en caja</p>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', borderTop: LINEA_TERMICA, paddingTop: '8px', fontSize: px(letra.chica) }}>
        <p style={{ margin: 0 }}>{config?.mensaje_ticket || '¡Gracias por tu visita!'}</p>
        {config?.ticket_footer && <p style={{ margin: '2px 0 0' }}>{config.ticket_footer}</p>}
        {esFinal && <p style={{ margin: '2px 0 0' }}>Conserva este ticket</p>}
      </div>

      {/* DP-20 · El pie de la copia: de quién es este papel. */}
      {pie && (
        <p
          data-pie-de-copia
          style={{
            textAlign: 'center',
            fontWeight: 900,
            fontSize: px(letra.base),
            borderTop: LINEA_TERMICA,
            marginTop: '10px',
            marginBottom: 0,
            paddingTop: '8px',
          }}
        >
          {pie}
        </p>
      )}
    </div>
  );

  if (soloLienzo) return lienzo;

  return (
    <div
      className={`ticket-printable ticket-termico thermal-${String(ancho)} mx-auto`}
      data-puntos={enPuntos}
      data-documento={esFinal ? 'ticket' : 'precuenta'}
      data-orden-id={venta.id || undefined}
      style={{
        width: `${enPuntos * ESCALA_EN_PANTALLA}px`,
        maxWidth: '100%',
        background: '#fff',
        color: '#000',
      }}
    >
      {lienzo}
    </div>
  );
}

function Row({ label, value, bold, capitalize }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '10px',
        textTransform: capitalize ? 'capitalize' : 'none',
      }}
    >
      <span>{label}:</span>
      <span style={{ fontWeight: bold ? 900 : 700, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
