'use client';

import { Aviso, EsqueletoDeLista, Superficie } from '@morphiqpos/ui/sistema';
import { useState } from 'react';
import { toast } from 'sonner';

import { useConfig } from '@/lib/ConfigContext';

import { temaDelPortal } from '../menu-qr/tema-del-portal';
import { EditorDelPlatillo } from './EditorDelPlatillo';
import { MenuEnGeneral } from './MenuEnGeneral';
import {
  conLaEdicion,
  enSuOrden,
  moverSeccion,
  ordenQueCambio,
  parcheDelPlatillo,
  type EdicionDelPlatillo,
} from './personalizar-menu';
import { usePersonalizarMenu, type SeccionDelEditor } from './use-personalizar-menu';
import { VistaDelTelefono } from './VistaDelTelefono';

interface ConfiguracionLeida {
  readonly config: {
    readonly nombre_negocio?: string;
    readonly logo_url?: string;
    readonly portal_qr_mensaje_bienvenida?: string;
    readonly portal_qr_modo_menu?: string;
  };
}

const textoDelError = (error: unknown, porOmision: string): string =>
  error instanceof Error ? error.message : porOmision;

/**
 * DP-18 · 1.3 · PORTAL QR → «PERSONALIZAR MENÚ»: todo lo del menú digital en un solo lugar, con la
 * vista previa del teléfono al lado. Antes el fondo de la tarjeta sólo se cambiaba en Recetas o al
 * crear el producto, y Miguel no lo encontró.
 */
export function PersonalizarMenu() {
  const { config } = useConfig() as unknown as ConfiguracionLeida;
  const datos = usePersonalizarMenu();
  const [elegidoId, setElegidoId] = useState<string | null>(null);
  const [ediciones, setEdiciones] = useState<Readonly<Record<string, EdicionDelPlatillo>>>({});
  const [orden, setOrden] = useState<readonly SeccionDelEditor[] | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [estilo, setEstilo] = useState<string | null | undefined>(undefined);
  const [guardando, setGuardando] = useState<'platillo' | 'orden' | 'encabezado' | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  if (datos.platillos.isPending || datos.secciones.isPending || datos.tema.isPending) {
    return <EsqueletoDeLista filas={4} />;
  }
  if (datos.platillos.isError || datos.secciones.isError) {
    return (
      <Aviso tono="peligro" titulo="No se pudo leer el menú. Recarga la página para reintentar." />
    );
  }
  const platillos = datos.platillos.data;
  const leidas = datos.secciones.data;
  const guardadas = enSuOrden(leidas);
  const secciones = orden ?? guardadas;
  const tema = datos.tema.data ?? temaDelPortal(null);
  const mensajeGuardado = config.portal_qr_mensaje_bienvenida ?? '';
  const mensajeVisto = mensaje ?? mensajeGuardado;
  const estiloVisto = estilo === undefined ? tema.estilo : estilo;
  const elegido = platillos.find((p) => p.id === elegidoId) ?? null;
  const vistos = platillos.map((p) => conLaEdicion(p, ediciones[p.id]));
  const parche = elegido === null ? {} : parcheDelPlatillo(elegido, ediciones[elegido.id] ?? {});

  async function conAviso(
    que: 'platillo' | 'orden' | 'encabezado',
    hacer: () => Promise<void>,
    listo: string,
  ) {
    setGuardando(que);
    setFallo(null);
    try {
      await hacer();
      toast.success(listo);
    } catch (error: unknown) {
      setFallo(textoDelError(error, 'No se pudo guardar. Intenta otra vez.'));
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div className="grid gap-(--espacio-6) lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-col gap-(--espacio-5)">
        {config.portal_qr_modo_menu === 'menu_subido' ? (
          <Aviso
            tono="info"
            titulo="El portal enseña hoy «Páginas subidas»: lo de aquí se ve en «Menú digital» y «A la carta» (Portal QR → Configuración → Cómo se ve el menú)."
          />
        ) : null}
        <Superficie relleno={4} className="flex flex-col gap-(--espacio-4)">
          <EditorDelPlatillo
            platillos={platillos}
            elegido={elegido}
            edicion={elegido === null ? undefined : ediciones[elegido.id]}
            alElegir={(id) => {
              setElegidoId(id);
              setFallo(null);
            }}
            alEditar={(edicion) => {
              if (elegido !== null) setEdiciones({ ...ediciones, [elegido.id]: edicion });
            }}
            guardando={guardando === 'platillo'}
            fallo={guardando === null ? fallo : null}
            alGuardar={() => {
              if (elegido === null || Object.keys(parche).length === 0) return;
              void conAviso(
                'platillo',
                async () => {
                  await datos.guardarPlatillo(elegido.id, parche);
                  setEdiciones(
                    Object.fromEntries(
                      Object.entries(ediciones).filter(([id]) => id !== elegido.id),
                    ),
                  );
                },
                `«${elegido.nombre}» guardado`,
              );
            }}
          />
        </Superficie>
        <Superficie relleno={4}>
          <MenuEnGeneral
            secciones={secciones}
            alMover={(id, hacia) => {
              setOrden(moverSeccion(secciones, id, hacia));
            }}
            hayOrdenNuevo={secciones.map((s) => s.id).join() !== guardadas.map((s) => s.id).join()}
            alGuardarOrden={() => {
              void conAviso(
                'orden',
                async () => {
                  await datos.guardarOrden(ordenQueCambio(leidas, secciones));
                  setOrden(null);
                },
                'Orden de las secciones guardado',
              );
            }}
            mensaje={mensajeVisto}
            alCambiarMensaje={setMensaje}
            estilo={estiloVisto}
            alCambiarEstilo={setEstilo}
            hayEncabezadoNuevo={mensajeVisto !== mensajeGuardado || estiloVisto !== tema.estilo}
            alGuardarEncabezado={() => {
              void conAviso(
                'encabezado',
                async () => {
                  await datos.guardarEncabezado({
                    ...(mensajeVisto === mensajeGuardado ? {} : { mensaje: mensajeVisto }),
                    ...(estiloVisto === tema.estilo ? {} : { estilo: estiloVisto }),
                    temaActual: tema,
                  });
                  setMensaje(null);
                  setEstilo(undefined);
                },
                'Encabezado y colores guardados',
              );
            }}
            guardando={guardando === 'orden' || guardando === 'encabezado' ? guardando : null}
            fallo={guardando === null && elegido === null ? fallo : null}
          />
        </Superficie>
      </div>
      <div className="lg:sticky lg:top-(--espacio-4) lg:self-start">
        <VistaDelTelefono
          platillos={vistos}
          secciones={secciones.map((s) => ({ id: s.id, nombre: s.nombre ?? null }))}
          tema={{ ...tema, estilo: estiloVisto }}
          nombreDelNegocio={config.nombre_negocio ?? ''}
          logo={(config.logo_url ?? '') === '' ? null : (config.logo_url ?? null)}
          mensaje={mensajeVisto}
          aLaCarta={
            config.portal_qr_modo_menu === 'productos_pos' || config.portal_qr_modo_menu === 'mixto'
          }
        />
      </div>
    </div>
  );
}
