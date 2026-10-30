import { Badge } from '@morphiqpos/ui/primitivas/badge';
import { Dinero, Superficie, Vacio } from '@morphiqpos/ui/sistema';
import { ArrowRight, CheckCircle2, Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';

import { centavosDelPuente } from '~/cliente/dinero-del-puente';
import { ErrorDeLectura, EsqueletoDeFilas } from '~/cliente/EstadosDeCarga';

import {
  etiquetaDeLaMesa,
  insigniaDeQr,
  tieneTotalCero,
  type InsigniaDeQr,
  type VentaPendiente,
} from './cuentas-pendientes';

/**
 * LA PESTAÑA «PENDIENTES» DE LA CAJA · las cuentas que los meseros ya pidieron.
 *
 * Es el piso de la pantalla, así que es sólido: una tesela por cuenta (`Superficie` que se toca),
 * sin vidrio ni sombras a mano. Lo que importa de cada una se lee de lejos —la mesa y el total— y
 * lo que la distingue lleva palabra además de color: «En cero» y la insignia del QR.
 *
 * El NOMBRE de cada tesela empieza «Mesa N [folio] Cuenta», porque así la busca el navegador
 * de pruebas y así la lee un lector de pantalla: la mesa, su folio y la insignia, en ese orden.
 * Por eso los hijos son bloques (`block`/`flex`): el nombre accesible separa con espacio sólo lo
 * que no es texto corrido.
 *
 * Los tres estados de la lista: la PRIMERA lectura (esqueleto, nunca «Sin cobros»: la lista
 * empieza vacía por construcción), el fallo sin ningún dato anterior (se dice y se ofrece releer)
 * y el vacío de verdad (buena noticia).
 */

export interface CuentasPendientesProps {
  readonly ventas: readonly VentaPendiente[];
  /** La primera lectura no ha llegado: la lista vacía todavía no quiere decir nada. */
  readonly cargando: boolean;
  /** La lectura falló y no hay ninguna lista anterior que enseñar. */
  readonly fallo: boolean;
  readonly alReintentar: () => void;
  /** El ajuste del negocio: los importes en el color del acento, o en el del texto. */
  readonly colorearImportes: boolean;
  /** La propina derivada de la cuenta, en pesos (`propinaDerivada` de la caja heredada). */
  readonly propinaDeLaVenta: (venta: VentaPendiente) => number;
  readonly alCobrar: (venta: VentaPendiente) => void;
  /** Un ticket en cero no se cobra: se borra. */
  readonly alBorrarEnCero: (venta: VentaPendiente) => void;
}

const CLASES_DE_INSIGNIA = {
  esperando: 'border-advertencia/30 bg-advertencia/15 text-advertencia',
  decidir_en_caja: 'border-info/30 bg-info/15 text-info',
  sin_propina: 'border-borde bg-fondo-sutil text-texto',
  porcentaje: 'border-acento/30 bg-acento-suave text-acento-suave-texto',
  monto: 'border-acento/30 bg-acento-suave text-acento-suave-texto',
  solicitada: 'border-info/30 bg-info/15 text-info',
} as const;

function pesosEnCentavos(pesos: number): number {
  return centavosDelPuente(pesos) ?? 0;
}

/** Lo que dice la insignia del QR, con su importe como `<Dinero>` y no como texto. */
function TextoDeLaInsignia({ insignia }: { readonly insignia: InsigniaDeQr }): ReactElement {
  switch (insignia.tipo) {
    case 'esperando':
      return <>QR: esperando propina</>;
    case 'decidir_en_caja':
      return <>QR: decidir en caja</>;
    case 'sin_propina':
      return <>QR: sin propina</>;
    case 'porcentaje':
      return (
        <>
          QR: propina {insignia.porcentaje}% (
          <Dinero centavos={pesosEnCentavos(insignia.propinaPesos)} tamano="xs" />)
        </>
      );
    case 'monto':
      return (
        <>
          QR: propina <Dinero centavos={pesosEnCentavos(insignia.propinaPesos)} tamano="xs" />
        </>
      );
    case 'solicitada':
      return <>QR: cuenta solicitada</>;
  }
}

function TeselaDeCuenta({
  venta,
  colorearImportes,
  propinaPesos,
  alElegir,
}: {
  readonly venta: VentaPendiente;
  readonly colorearImportes: boolean;
  readonly propinaPesos: number;
  readonly alElegir: () => void;
}): ReactElement {
  const enCero = tieneTotalCero(venta);
  const insignia = insigniaDeQr(venta, propinaPesos);
  const personas = venta.personas ?? 0;

  return (
    <li>
      <Superficie
        como="button"
        type="button"
        interactiva
        relleno={4}
        onClick={alElegir}
        className={`flex w-full touch-manipulation flex-col gap-(--espacio-2) ${enCero ? 'border-peligro bg-peligro/10' : ''}`}
      >
        <span className="flex items-start justify-between gap-(--espacio-2)">
          <span className="block">
            <span className="block font-heading text-base font-bold">
              {etiquetaDeLaMesa(venta)}
            </span>
            <span className="block text-xs text-texto-sutil">{venta.folio}</span>
          </span>
          <Badge variant={enCero ? 'destructive' : 'secondary'}>
            {enCero ? 'En cero' : 'Cuenta'}
          </Badge>
        </span>
        <Dinero
          centavos={centavosDelPuente(venta.total) ?? 0}
          tamano="xl"
          className={colorearImportes ? 'text-primario' : 'text-texto'}
        />
        {insignia === null ? null : (
          <Badge variant="outline" className={CLASES_DE_INSIGNIA[insignia.tipo]}>
            <TextoDeLaInsignia insignia={insignia} />
          </Badge>
        )}
        {venta.codigo_caja ? (
          <span className="block text-xs text-texto-sutil">
            Código: <span className="font-mono font-bold">{venta.codigo_caja}</span>
          </span>
        ) : null}
        {personas > 0 ? (
          <span className="block text-xs text-texto-sutil">
            {personas} personas{venta.cliente_nombre ? ` · ${venta.cliente_nombre}` : ''}
          </span>
        ) : null}
        <span
          className={`flex items-center gap-(--espacio-1) text-xs font-semibold ${enCero ? 'text-peligro' : 'text-primario'}`}
        >
          {enCero ? (
            <>
              <Trash2 aria-hidden className="size-4" />
              Borrar ticket en cero
            </>
          ) : (
            <>
              Toca para cobrar
              <ArrowRight aria-hidden className="size-4" />
            </>
          )}
        </span>
      </Superficie>
    </li>
  );
}

export function CuentasPendientes({
  ventas,
  cargando,
  fallo,
  alReintentar,
  colorearImportes,
  propinaDeLaVenta,
  alCobrar,
  alBorrarEnCero,
}: CuentasPendientesProps): ReactElement {
  if (cargando) return <EsqueletoDeFilas filas={3} />;
  if (fallo)
    return <ErrorDeLectura queNoSePudoLeer="los cobros pendientes" alReintentar={alReintentar} />;
  if (ventas.length === 0) {
    return <Vacio tono="exito" icono={<CheckCircle2 />} titulo="Sin cobros pendientes" />;
  }
  return (
    <ul className="grid gap-(--espacio-3) sm:grid-cols-2 lg:grid-cols-3">
      {ventas.map((venta) => (
        <TeselaDeCuenta
          key={venta.id}
          venta={venta}
          colorearImportes={colorearImportes}
          propinaPesos={propinaDeLaVenta(venta)}
          alElegir={() => {
            if (tieneTotalCero(venta)) alBorrarEnCero(venta);
            else alCobrar(venta);
          }}
        />
      ))}
    </ul>
  );
}
