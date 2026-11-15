'use client';

import { useMemo, useState, type ReactElement } from 'react';

import { Button } from '@morphiqpos/ui/primitivas/button';
import { Aviso, Superficie } from '@morphiqpos/ui/sistema';
import { LogOut } from 'lucide-react';

import { usePerfilDelAparato } from '../use-app.ts';
import { textoDeLaSesion, type EstadoDelProveedor } from './acceso-al-laboratorio.ts';
import {
  formularioDesdePerfil,
  formularioInicial,
  perfilDesdeFormulario,
  type FormularioDelPerfil,
} from './formulario.ts';
import { LabAparato } from './LabAparato';
import { LabBytes } from './LabBytes';
import { LabCajon, LabQueImprime } from './LabCajon';
import { LabConexion } from './LabConexion';
import { LabCorte, LabMedidas } from './LabMedidas';
import { LabPendientes } from './LabPendientes';
import { LabPerfil } from './LabPerfil';
import { LabPruebas } from './LabPruebas';
import { LabVistaPrevia } from './LabVistaPrevia';
import {
  poniendo,
  primerProblema,
  type CambioDelFormulario,
  type PropsDelFormulario,
} from './lab-tipos.ts';
import type { UltimoTrabajo } from './imprimir-prueba.ts';

/**
 * HARDWARE Y PRUEBAS DE IMPRESIÓN (DP-20 · refuerzo §2). Sólo el proveedor entra.
 *
 * Un solo formulario —el perfil que se está armando— alimenta todas las secciones: lo que se
 * cambia arriba es lo que se prueba, se ve en la vista previa y se guarda al final. Dentro de la
 * app se puede probar la impresora de verdad; sin ella sólo se ve la vista previa, que no
 * necesita impresora.
 */
export function Laboratorio({
  estado,
  alSalir,
  saliendo,
}: {
  readonly estado: EstadoDelProveedor;
  readonly alSalir: () => void;
  readonly saliendo: boolean;
}): ReactElement {
  const aparato = usePerfilDelAparato();
  const { app, perfil: guardado } = aparato;
  // Lo que se ha editado; mientras no se edite nada, el formulario es el perfil guardado.
  const [editado, setEditado] = useState<FormularioDelPerfil | null>(null);
  const [ultimo, setUltimo] = useState<UltimoTrabajo | null>(null);

  const base = useMemo(
    () => (guardado == null ? formularioInicial() : formularioDesdePerfil(guardado)),
    [guardado],
  );
  const formulario = editado ?? base;
  const completo = perfilDesdeFormulario(formulario);
  const paraLaVista = perfilDesdeFormulario(formulario, { sinDestino: true });

  const props: PropsDelFormulario = {
    formulario,
    errores: completo.ok ? {} : completo.errores,
    actualizar: (cambio: CambioDelFormulario) => {
      setEditado((previo) => cambio(previo ?? base));
    },
  };

  return (
    <div className="flex flex-col gap-(--espacio-6)">
      <Superficie
        como="section"
        relleno={0}
        aria-label="Sesión del proveedor"
        className="flex flex-wrap items-center justify-between gap-(--espacio-3) p-(--espacio-4)"
      >
        <div className="flex flex-col">
          <h3 className="text-lg font-semibold">Hardware y pruebas de impresión</h3>
          <p className="text-sm text-texto-sutil" role="status">
            {textoDeLaSesion(estado)}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={saliendo}
          cargando={saliendo}
          onClick={alSalir}
        >
          <LogOut aria-hidden className="size-4" />
          Salir
        </Button>
      </Superficie>

      {app === null ? (
        <>
          <Aviso tono="atencion" titulo="Las pruebas de hardware sólo funcionan dentro de la app">
            <p>
              Instala la app de POS Don Poncho en este aparato para probar la impresora, el cajón y
              la conexión. Mientras tanto puedes ver la vista previa: no necesita impresora.
            </p>
          </Aviso>
          <LabMedidas {...props} />
          <LabCorte {...props} />
        </>
      ) : (
        <>
          <LabAparato app={app} />
          <LabConexion app={app} {...props} />
          <LabMedidas {...props} />
          <LabCorte {...props} />
          <LabCajon {...props} />
          <LabQueImprime {...props} />
          <LabPruebas
            app={app}
            perfil={completo.ok ? completo.perfil : null}
            problema={completo.ok ? null : primerProblema(completo.errores)}
            alTenerElTrabajo={setUltimo}
          />
        </>
      )}

      <LabVistaPrevia perfil={paraLaVista.ok ? paraLaVista.perfil : null} />

      {app === null ? null : (
        <>
          <LabBytes ultimo={ultimo} />
          <LabPerfil
            nombre={formulario.nombre}
            errorDelNombre={props.errores.nombre}
            alCambiarElNombre={(nombre) => {
              props.actualizar(poniendo({ nombre }));
            }}
            armado={completo}
            guardado={guardado}
            guardar={(perfil) => aparato.guardarPerfil(perfil)}
            alImportar={(perfil) => {
              setEditado(formularioDesdePerfil(perfil));
            }}
          />
        </>
      )}
      <LabPendientes />
    </div>
  );
}
