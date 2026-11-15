'use client';

import type { ReactElement } from 'react';

import { Banknote, ListChecks } from 'lucide-react';

import { CampoDeElegir, CampoDeTexto, Casilla, SeccionDelLab } from './campos';
import { poniendo, type PropsDelFormulario } from './lab-tipos.ts';

/**
 * 5 · EL CAJÓN y 6 · QUÉ IMPRIME ESTE APARATO (DP-20 · laboratorio).
 */

export function LabCajon({ formulario, errores, actualizar }: PropsDelFormulario): ReactElement {
  const enTiempoReal = formulario.cajonModo === 'tiempo-real';
  return (
    <SeccionDelLab
      titulo="5 · El cajón"
      icono={<Banknote aria-hidden className="size-5 shrink-0 text-primario" />}
      descripcion="El cajón de dinero se conecta a la impresora y lo abre un pulso eléctrico."
    >
      <Casilla
        etiqueta="Esta impresora tiene cajón de dinero"
        marcada={formulario.hayCajon}
        alCambiar={(hayCajon) => {
          actualizar(poniendo({ hayCajon }));
        }}
      />
      {formulario.hayCajon ? (
        <div className="flex flex-col gap-(--espacio-4)">
          <div className="grid gap-(--espacio-4) sm:grid-cols-2">
            <CampoDeElegir
              etiqueta="Pin del conector"
              valor={String(formulario.cajonPin)}
              opciones={[
                { valor: '2', nombre: 'Pin 2 (el de casi todos)' },
                { valor: '5', nombre: 'Pin 5' },
              ]}
              alCambiar={(valor) => {
                actualizar(poniendo({ cajonPin: valor === '5' ? 5 : 2 }));
              }}
            />
            <CampoDeElegir
              etiqueta="Modo del pulso"
              valor={formulario.cajonModo}
              opciones={[
                { valor: 'esc-p', nombre: 'ESC p (con tiempos)' },
                { valor: 'tiempo-real', nombre: 'Tiempo real (DLE DC4)' },
              ]}
              ayuda={
                enTiempoReal
                  ? 'El tiempo real usa un pulso fijo de 0.2 s: la impresora lo atiende aunque esté ocupada.'
                  : undefined
              }
              alCambiar={(valor) => {
                actualizar(
                  poniendo({ cajonModo: valor === 'tiempo-real' ? 'tiempo-real' : 'esc-p' }),
                );
              }}
            />
            <CampoDeTexto
              etiqueta="Pulso encendido (ms)"
              numerico
              deshabilitado={enTiempoReal}
              valor={formulario.cajonEncendidoMs}
              error={errores.cajonEncendidoMs}
              ayuda="De 2 a 510. De fábrica, 50."
              alCambiar={(cajonEncendidoMs) => {
                actualizar(poniendo({ cajonEncendidoMs }));
              }}
            />
            <CampoDeTexto
              etiqueta="Pulso apagado (ms)"
              numerico
              deshabilitado={enTiempoReal}
              valor={formulario.cajonApagadoMs}
              error={errores.cajonApagadoMs}
              ayuda="De 2 a 510. De fábrica, 500."
              alCambiar={(cajonApagadoMs) => {
                actualizar(poniendo({ cajonApagadoMs }));
              }}
            />
          </div>
          <Casilla
            etiqueta="Abrir el cajón al cobrar en efectivo"
            marcada={formulario.cajonAlCobrar}
            ayuda="Siempre queda registrado quién lo abrió. «Abrir cajón» a mano sigue disponible."
            alCambiar={(cajonAlCobrar) => {
              actualizar(poniendo({ cajonAlCobrar }));
            }}
          />
        </div>
      ) : null}
    </SeccionDelLab>
  );
}

export function LabQueImprime({
  formulario,
  errores,
  actualizar,
}: PropsDelFormulario): ReactElement {
  return (
    <SeccionDelLab
      titulo="6 · Qué imprime este aparato"
      icono={<ListChecks aria-hidden className="size-5 shrink-0 text-primario" />}
      descripcion="Cada punto de venta puede tener su impresora para unas cosas y no para otras."
    >
      <div className="grid gap-x-(--espacio-6) sm:grid-cols-2">
        <Casilla
          etiqueta="Ticket de venta"
          marcada={formulario.imprimeTicket}
          alCambiar={(imprimeTicket) => {
            actualizar(poniendo({ imprimeTicket }));
          }}
        />
        <Casilla
          etiqueta="Precuenta"
          marcada={formulario.imprimePrecuenta}
          alCambiar={(imprimePrecuenta) => {
            actualizar(poniendo({ imprimePrecuenta }));
          }}
        />
        <Casilla
          etiqueta="Corte"
          marcada={formulario.imprimeCorte}
          alCambiar={(imprimeCorte) => {
            actualizar(poniendo({ imprimeCorte }));
          }}
        />
        <Casilla
          etiqueta="Cierre del día"
          marcada={formulario.imprimeCierre}
          alCambiar={(imprimeCierre) => {
            actualizar(poniendo({ imprimeCierre }));
          }}
        />
      </div>
      <div className="sm:max-w-md">
        <CampoDeTexto
          etiqueta="Estación cuyas comandas salen aquí (opcional)"
          valor={formulario.estacion}
          error={errores.estacion}
          marcador="Cocina, Barra…"
          ayuda="Déjalo vacío si en esta impresora no salen comandas."
          alCambiar={(estacion) => {
            actualizar(poniendo({ estacion }));
          }}
        />
      </div>
    </SeccionDelLab>
  );
}
