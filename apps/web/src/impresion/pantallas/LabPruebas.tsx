'use client';

import { useState, type ReactElement, type ReactNode } from 'react';

import { Aviso } from '@morphiqpos/ui/sistema';
import { FileText, FlaskConical, Gauge, ImageIcon, Printer, Ruler } from 'lucide-react';

import { useConfig } from '@/lib/ConfigContext';

import type { MorphiqApp } from '../puente/contrato.ts';
import type { PerfilDeImpresion } from '../termico/perfil.ts';
import { BotonDePrueba } from './BotonDePrueba';
import { SeccionDelLab } from './campos';
import { RENGLONES_DEL_TICKET_LARGO } from './datos-de-ejemplo.ts';
import { reglaDeEjemplo, ticketDeEjemplo } from './ejemplos';
import { leerElEstado, type EstadoParaLeer } from './estado-de-la-impresora.ts';
import { imprimirElementoDePrueba, type UltimoTrabajo } from './imprimir-prueba.ts';
import { resultadoDelPuente, type ResultadoDePrueba } from './resultado-de-prueba.ts';
import { useCorredorDePruebas } from './use-pruebas.ts';

/**
 * 7 · LAS PRUEBAS (DP-20 · laboratorio). Cada botón pasa por «Enviando…» y termina con su
 * resultado; mientras uno corre, los demás esperan. Nada de aquí crea ventas, cuentas ni folios.
 */

type ConfiguracionDelNegocio = Record<string, unknown> | null | undefined;

function Prueba({
  titulo,
  icono,
  children,
  boton,
}: {
  readonly titulo: string;
  readonly icono: ReactNode;
  readonly children: ReactNode;
  readonly boton: ReactNode;
}): ReactElement {
  return (
    <li className="flex flex-col gap-(--espacio-2) rounded-lg border border-borde p-(--espacio-4)">
      <h4 className="flex items-center gap-(--espacio-2) text-sm font-semibold">
        {icono}
        {titulo}
      </h4>
      <p className="text-sm text-texto-sutil">{children}</p>
      {boton}
    </li>
  );
}

export function LabPruebas({
  app,
  perfil,
  problema,
  alTenerElTrabajo,
}: {
  readonly app: MorphiqApp;
  /** El perfil armado del formulario, o `null` si el formulario todavía no es válido. */
  readonly perfil: PerfilDeImpresion | null;
  readonly problema: string | null;
  readonly alTenerElTrabajo: (trabajo: UltimoTrabajo) => void;
}): ReactElement {
  const corredor = useCorredorDePruebas();
  const { config } = useConfig() as unknown as { config: ConfiguracionDelNegocio };
  const [estadoLeido, setEstadoLeido] = useState<EstadoParaLeer | null>(null);
  const razon = perfil === null ? 'Completa los datos marcados arriba para probar.' : undefined;
  const iconoDe = (Icono: typeof Printer): ReactNode => (
    <Icono aria-hidden className="size-4 shrink-0 text-primario" />
  );

  const botonDe = (
    clave: string,
    etiqueta: string,
    tarea: (perfilListo: PerfilDeImpresion) => Promise<ResultadoDePrueba>,
  ): ReactNode => (
    <BotonDePrueba
      etiqueta={etiqueta}
      estado={corredor.estados[clave]}
      ocupado={corredor.ocupado}
      razon={razon}
      alPulsar={() => {
        if (perfil === null) return;
        void corredor.correr(clave, () => tarea(perfil));
      }}
    />
  );

  const imprimirElemento = (
    clave: string,
    etiqueta: string,
    armar: (perfilListo: PerfilDeImpresion) => ReactElement,
  ): ReactNode =>
    botonDe(clave, etiqueta, (listo) =>
      imprimirElementoDePrueba(app, listo, armar(listo), etiqueta, alTenerElTrabajo),
    );

  return (
    <SeccionDelLab
      titulo="7 · Las pruebas"
      icono={<FlaskConical aria-hidden className="size-5 shrink-0 text-primario" />}
      descripcion="Prueban la impresora con los valores del formulario de arriba, sin guardarlos."
    >
      <Aviso tono="info" titulo="Son pruebas de hardware">
        <p>No crean ventas, cuentas ni folios, y no tocan el dinero de la caja.</p>
      </Aviso>
      {problema === null ? null : (
        <Aviso tono="atencion" titulo="Falta un dato para poder probar">
          <p>{problema}</p>
        </Aviso>
      )}
      <ul className="grid gap-(--espacio-4) md:grid-cols-2">
        <Prueba
          titulo="Página de prueba de la app"
          icono={iconoDe(FileText)}
          boton={botonDe('pagina', 'Imprimir página de prueba', async (listo) =>
            resultadoDelPuente(await app.paginaDePrueba({ destino: listo.destino })),
          )}
        >
          La página que trae la app: confirma que la impresora y la conexión responden.
        </Prueba>
        <Prueba
          titulo="Regla de calibración"
          icono={iconoDe(Ruler)}
          boton={imprimirElemento('regla', 'Imprimir la regla', (listo) =>
            reglaDeEjemplo({ puntos: listo.puntos, papelMm: listo.papelMm }),
          )}
        >
          Una raya por milímetro y rótulos cada 10 mm. Lee en el papel hasta qué número llega: ese
          es el ancho que imprime. El cuadro debe medir 10 × 10 mm.
        </Prueba>
        <Prueba
          titulo="Ticket de ejemplo, con logo"
          icono={iconoDe(Printer)}
          boton={imprimirElemento('con-logo', 'Imprimir ticket con logo', (listo) =>
            ticketDeEjemplo({ config, puntos: listo.puntos, conLogo: true }),
          )}
        >
          Datos inventados (folio EJEMPLO) con acentos, ñ, una nota larga y una opción con precio.
          Usa el logo y el nombre reales del negocio.
        </Prueba>
        <Prueba
          titulo="Ticket de ejemplo, sin logo"
          icono={iconoDe(ImageIcon)}
          boton={imprimirElemento('sin-logo', 'Imprimir ticket sin logo', (listo) =>
            ticketDeEjemplo({ config, puntos: listo.puntos, conLogo: false }),
          )}
        >
          El mismo ticket sin logo: sirve para separar un problema del logo de uno del texto.
        </Prueba>
        <Prueba
          titulo="Ticket largo (velocidad)"
          icono={iconoDe(Gauge)}
          boton={imprimirElemento('largo', 'Imprimir ticket largo', (listo) =>
            ticketDeEjemplo({
              config,
              puntos: listo.puntos,
              renglones: RENGLONES_DEL_TICKET_LARGO,
            }),
          )}
        >
          {`El de ejemplo con ${String(RENGLONES_DEL_TICKET_LARGO)} renglones. Al terminar dice cuánto tardó y cuántos bytes mandó.`}
        </Prueba>
        <Prueba
          titulo="Estado de la impresora"
          icono={iconoDe(Printer)}
          boton={botonDe('estado', 'Leer el estado', async (listo) => {
            const leido = leerElEstado(await app.estado({ destino: listo.destino }));
            setEstadoLeido(leido);
            return { ok: leido.sinProblemas, texto: leido.resumen };
          })}
        >
          Pregunta a la impresora si tiene papel, la tapa cerrada y si está en línea.
        </Prueba>
      </ul>
      {estadoLeido === null || estadoLeido.renglones.length === 0 ? null : (
        <dl className="grid max-w-xs grid-cols-[auto_1fr] gap-x-(--espacio-4) gap-y-(--espacio-1) text-sm">
          {estadoLeido.renglones.map((renglon) => (
            <div key={renglon.etiqueta} className="contents">
              <dt className="text-texto-sutil">{renglon.etiqueta}</dt>
              <dd className="font-medium">
                {renglon.bien === null ? '' : renglon.bien ? '✓ ' : '✕ '}
                {renglon.valor}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </SeccionDelLab>
  );
}
