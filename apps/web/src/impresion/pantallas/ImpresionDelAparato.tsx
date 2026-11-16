'use client';

import { useId, type ReactElement } from 'react';

import { Aviso, Esqueleto, Superficie } from '@morphiqpos/ui/sistema';
import { CircleCheck, FileText, Printer } from 'lucide-react';

import { BotonAbrirCajon } from '../CajonEnLaCaja';
import type { MorphiqApp } from '../puente/contrato.ts';
import { describirDestino, type PerfilDeImpresion } from '../termico/perfil.ts';
import { usePerfilDelAparato } from '../use-app.ts';
import { AjustesDeLaApp } from './AjustesDeLaApp';
import { BotonDePrueba } from './BotonDePrueba';
import { resultadoDelPuente } from './resultado-de-prueba.ts';
import { useCorredorDePruebas } from './use-pruebas.ts';

/**
 * CONFIGURACIÓN → IMPRESIÓN (DP-20 · Parte 4), para el personal.
 *
 * Dice si la impresora de este aparato está lista y deja probarla («Página de prueba», «Abrir
 * cajón»; con el PIN de un gerente). El perfil NO se cambia aquí —tampoco si el aparato tiene
 * cajón—: lo deja listo el proveedor en Operación → «Hardware y pruebas de impresión». Sin la app, la impresión de hoy —el diálogo del navegador— sigue igual.
 */

function ImpresoraLista({
  app,
  perfil,
  rol,
}: {
  readonly app: MorphiqApp;
  readonly perfil: PerfilDeImpresion;
  readonly rol: string | undefined;
}): ReactElement {
  const corredor = useCorredorDePruebas();
  return (
    <div className="flex flex-col gap-(--espacio-4)">
      <div className="flex flex-col gap-(--espacio-1)">
        <p className="flex items-center gap-(--espacio-2) text-base font-semibold">
          <CircleCheck aria-hidden className="size-5 shrink-0 text-exito" />
          Impresora lista ✓
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-(--espacio-4) gap-y-(--espacio-1) text-sm">
          <dt className="text-texto-sutil">Perfil</dt>
          <dd>{perfil.nombre}</dd>
          <dt className="text-texto-sutil">Impresora</dt>
          <dd>{describirDestino(perfil.destino)}</dd>
          <dt className="text-texto-sutil">Papel</dt>
          <dd>{`${String(perfil.papelMm)} mm · ${String(perfil.puntos)} puntos`}</dd>
          <dt className="text-texto-sutil">Cajón de dinero</dt>
          <dd>{perfil.tieneCajon ? 'Sí, este aparato tiene cajón' : 'No tiene cajón'}</dd>
        </dl>
      </div>
      <div className="flex flex-wrap items-start gap-(--espacio-4)">
        <BotonDePrueba
          etiqueta="Página de prueba"
          icono={<FileText aria-hidden className="size-4" />}
          estado={corredor.estados['pagina']}
          ocupado={corredor.ocupado}
          alPulsar={() => {
            void corredor.correr('pagina', async () =>
              resultadoDelPuente(await app.paginaDePrueba()),
            );
          }}
        />
        <BotonAbrirCajon rol={rol} />
      </div>
    </div>
  );
}

export function ImpresionDelAparato({ rol }: { readonly rol: string | undefined }): ReactElement {
  const { app, perfil } = usePerfilDelAparato();
  const titulo = useId();

  return (
    <div className="flex flex-col gap-(--espacio-6)">
      <Superficie
        como="section"
        relleno={0}
        aria-labelledby={titulo}
        className="flex flex-col gap-(--espacio-4) p-(--espacio-4) sm:p-(--espacio-6)"
      >
        <h3 id={titulo} className="flex items-center gap-(--espacio-2) text-lg font-semibold">
          <Printer aria-hidden className="size-5 shrink-0 text-primario" />
          Impresora de este aparato
        </h3>
        {app === null ? (
          <div className="flex flex-col gap-(--espacio-3)">
            <Aviso
              tono="info"
              titulo="Para imprimir directo y abrir el cajón, instala la app de POS Don Poncho."
            />
            <p className="max-w-prose text-sm text-texto-sutil">
              Mientras tanto, imprimir sigue funcionando como hasta hoy: con el diálogo del
              navegador.
            </p>
          </div>
        ) : perfil === undefined ? (
          <Esqueleto className="h-24 w-full max-w-md rounded-lg" />
        ) : perfil === null ? (
          <div className="flex flex-col gap-(--espacio-1)">
            <p className="text-base font-medium">
              Este aparato todavía no tiene impresora configurada.
            </p>
            <p className="max-w-prose text-sm text-texto-sutil">
              La deja lista tu proveedor en Operación → «Hardware y pruebas de impresión».
            </p>
          </div>
        ) : (
          <ImpresoraLista app={app} perfil={perfil} rol={rol} />
        )}
      </Superficie>
      {app === null ? null : <AjustesDeLaApp app={app} />}
    </div>
  );
}
