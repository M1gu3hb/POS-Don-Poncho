'use client';
import React, { useEffect, useState } from 'react';
import { api } from '@/api/cliente';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/common/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ChevronRight, Tablet } from 'lucide-react';
import { useLocation, useNavigate } from '@/enrutado';
import { canAccessModule } from '@/lib/packageConfig';
import { useConfig } from '@/lib/ConfigContext';
import { usePOSAuth } from '@/lib/POSAuthContext';
import { esUsuarioDePlataforma, hasPermission } from '@/lib/permissions';
import { usePuesto } from '@/components/configuracion/usePuesto';
import { esDeMando } from '@/components/configuracion/puestos';
import IdentidadNegocio from '@/components/configuracion/IdentidadNegocio';
import ColoresSistemaSection from '@/components/configuracion/ColoresSistemaSection';
import ConfiguracionDeVoz from '@/components/configuracion/ConfiguracionDeVoz';
import UsuariosPOSSection from '@/components/configuracion/UsuariosPOSSection';
import ReiniciarSistemaSection from '@/components/configuracion/ReiniciarSistemaSection';
import CategoriasProductoSection from '@/components/configuracion/CategoriasProductoSection';
import UnidadesMedidaSection from '@/components/configuracion/UnidadesMedidaSection';
import ProveedoresSection from '@/components/configuracion/ProveedoresSection';
import EstacionesDeCocina from '@/components/configuracion/EstacionesDeCocina';
import AlertasDeEsperaDeCocina from '@/components/configuracion/AlertasDeEsperaDeCocina';
import MapaDeMesasDeConfiguracion from '@/components/configuracion/MapaDeMesasDeConfiguracion';
import ExportarDatos from '@/components/datos/ExportarDatos';
import ImportarDatos from '@/components/datos/ImportarDatos';
import ConfiguracionQRTab from '@/components/portalqr/ConfiguracionQRTab';
import { SelectorDeApariencia } from '~/configuracion/SelectorDeApariencia';
import { ExperienciaDelNegocio } from '~/configuracion/ExperienciaDelNegocio';
import { AnuncioDeComandasDelAparato } from '~/configuracion/AnuncioDeComandasDelAparato';
import { ModoEsperaDelAparato } from '~/configuracion/ModoEsperaDelAparato';
import { SonidoDelAparato } from '~/configuracion/SonidoDelAparato';
import { SonidosDelNegocio } from '~/configuracion/SonidosDelNegocio';
import { PruebaDeLaVozDeComandas } from '~/configuracion/PruebaDeLaVozDeComandas';
import { CajasALaVez, PermitirDescuentos } from '~/configuracion/CajaYDescuentos';
import { AparatosDeLaSucursal } from '~/configuracion/TerminalesDeLaSucursal';
import { UmbralDeRetiro } from '~/configuracion/UmbralDeRetiro';
import { IvaDelNegocio } from '~/configuracion/IvaDelNegocio';
import { FoliosDelNegocio } from '~/configuracion/FoliosDelNegocio';
import { PapelATuGusto } from '~/configuracion/PapelATuGusto';
import { CandadoDeMando } from '~/configuracion/CandadoDeMando';
import { QuienEligeLaPropina } from '~/configuracion/QuienEligeLaPropina';
import { TarjetaDeAjustes } from '~/configuracion/TarjetaDeAjustes';
import { BarraLateralDelAparato } from '~/configuracion/BarraLateralDelAparato';
import { ImpresionDelAparato } from '~/impresion/pantallas/ImpresionDelAparato';
import { CopiasDeImpresion } from '~/impresion/pantallas/CopiasDeImpresion';
import { EntradaAlLaboratorio } from '~/impresion/pantallas/EntradaAlLaboratorio';
import {
  SECCIONES,
  destinoDeLaUrl,
  direccionDeLaSeccion,
  seccionAMostrar,
  seccionesVisibles,
  tarjetasDe,
} from '~/configuracion/secciones';
import {
  puedoSalir,
  useAvisoAlCerrar,
} from '~/configuracion/cambios-sin-guardar';

/**
 * CONFIGURACIÓN (DP-21 · Bloque 21: «ordenada, sin quitar nada»).
 *
 * Dieciséis secciones en una columna a la izquierda y su contenido a la derecha; en el teléfono,
 * la lista de secciones y luego su página. Cada ajuste vive en UNA tarjeta, con su botón y su
 * «✓ Guardado», y guarda sólo lo suyo (se acabó el «Guardar configuración» que mandaba todo el
 * formulario). Salir con cambios sin guardar avisa. Los `?tab=` de antes siguen sirviendo
 * (`secciones.ts`). El mapa —qué va dónde y quién lo ve— es `~/configuracion/secciones`.
 */

const useIsMobile = () => {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return m;
};

export default function Configuracion() {
  const location = useLocation();
  const navigate = useNavigate();
  const { posUser } = usePOSAuth();
  const { paquete_modo } = useConfig();
  const tieneMesas = canAccessModule('mesas', paquete_modo);
  const puedeEliminarMesas =
    esUsuarioDePlataforma(posUser) && hasPermission(posUser?.rol, 'eliminar_mesas');
  const isMobile = useIsMobile();
  // DP-14 · El puesto REAL de quien tiene la sesión (`posUser.rol` junta dueño, administrador y
  // gerente en «administrador»): decide quién cambia cada cosa.
  const miPuesto = usePuesto();
  useAvisoAlCerrar();

  const { data: config, isPending: configLoading } = useQuery({
    queryKey: ['config'],
    queryFn: () => api.entidades.ConfiguracionNegocio.list(),
    placeholderData: (prev) => prev,
    staleTime: 3000,
  });
  const cfg = Array.isArray(config) && config[0] ? config[0] : null;

  const quien = {
    puesto: miPuesto ?? null,
    tieneMesas,
    rolAdministrador: posUser?.rol === 'administrador',
    esPlataforma: esUsuarioDePlataforma(posUser),
  };
  const visibles = seccionesVisibles(quien);
  const busqueda = location.search;
  const hayDestino = new URLSearchParams(busqueda).has('seccion') || new URLSearchParams(busqueda).has('tab');
  const destino = destinoDeLaUrl(busqueda);
  const activa = hayDestino
    ? seccionAMostrar(destino, visibles)
    : isMobile
      ? null
      : (visibles[0]?.id ?? null);

  // Un `?tab=` de antes que apuntaba a una tarjeta concreta: se baja hasta ella.
  const ancla = hayDestino ? destino.ancla : null;
  useEffect(() => {
    if (ancla === null || activa === null) return;
    document.getElementById(ancla)?.scrollIntoView({ block: 'start' });
  }, [ancla, activa]);

  const elegir = (id) => {
    if (id === activa) return;
    if (!puedoSalir((texto) => window.confirm(texto))) return;
    navigate(id === null ? '/configuracion' : direccionDeLaSeccion(id), { replace: true });
  };

  if (configLoading && !cfg) {
    return (
      <div className="space-y-6">
        <PageHeader title="Configuración" description="Ajustes de Morphiq POS" />
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
            <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
            <p className="text-sm">Cargando configuración…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /** El contenido de cada tarjeta. La clave es su `id` en `secciones.ts`. */
  const CONTENIDO = {
    'datos-del-negocio': () => <TarjetaDeAjustes id="datos-del-negocio" configuracion={cfg} />,
    'logo-y-marca': () => <IdentidadNegocio cfg={cfg} grupo="marca" />,
    estilo: () =>
      miPuesto === 'dueno' ? (
        <SelectorDeApariencia />
      ) : (
        <p className="text-sm text-muted-foreground">
          La apariencia del negocio (colores y estilo) la cambia el dueño.
        </p>
      ),
    colores: () => (
      <Card className="mt-4">
        <CardContent className="pt-2">
          <ColoresSistemaSection cfg={cfg} />
        </CardContent>
      </Card>
    ),
    fondo: () => <IdentidadNegocio cfg={cfg} grupo="fondo" />,
    'importes-en-color': () => <IdentidadNegocio cfg={cfg} grupo="importes" />,
    morfi: () => <ExperienciaDelNegocio grupo="morfi" />,
    iva: () => <IvaDelNegocio puedeCambiar={esDeMando(miPuesto)} />,
    propinas: () => <TarjetaDeAjustes id="propinas" configuracion={cfg} />,
    'quien-elige-la-propina': () => <QuienEligeLaPropina puedeCambiar={esDeMando(miPuesto)} />,
    descuentos: () => <PermitirDescuentos />,
    ticket: () => <TarjetaDeAjustes id="ticket" configuracion={cfg} />,
    'papel-a-tu-gusto': () => <PapelATuGusto puedeCambiar={esDeMando(miPuesto)} />,
    'logos-de-papel': () => <IdentidadNegocio cfg={cfg} grupo="logos-de-papel" />,
    'pdf-y-reportes': () => <TarjetaDeAjustes id="pdf-y-reportes" configuracion={cfg} />,
    folios: () => <FoliosDelNegocio puedeCambiar={miPuesto === 'dueno'} />,
    copias: () => <CopiasDeImpresion puedeCambiar={esDeMando(miPuesto)} />,
    'las-cajas': () => <CajasALaVez />,
    'pin-en-retiros': () => <UmbralDeRetiro />,
    'pdf-al-cerrar': () => <TarjetaDeAjustes id="pdf-al-cerrar" configuracion={cfg} />,
    'mapa-de-mesas': () => (
      <MapaDeMesasDeConfiguracion
        miPuesto={miPuesto}
        cfg={cfg}
        puedeEliminarMesas={puedeEliminarMesas}
      />
    ),
    'asignacion-de-mesas': () => (
      <TarjetaDeAjustes id="asignacion-de-mesas" configuracion={cfg} />
    ),
    estaciones: () => <EstacionesDeCocina cfg={cfg} />,
    'alertas-de-espera': () => <AlertasDeEsperaDeCocina cfg={cfg} />,
    'voz-de-las-comandas': () => <PruebaDeLaVozDeComandas />,
    'portal-activacion': () => <ConfiguracionQRTab config={cfg} grupo="activacion" />,
    'portal-pedidos': () => (
      <ConfiguracionQRTab config={cfg} grupo="pedidos" conMesas={tieneMesas} />
    ),
    'portal-cuenta': () => <ConfiguracionQRTab config={cfg} grupo="cuenta" />,
    categorias: () => (
      <div className="mt-4">
        <CategoriasProductoSection />
      </div>
    ),
    unidades: () => (
      <div className="mt-4">
        <UnidadesMedidaSection />
      </div>
    ),
    proveedores: () => (
      <div className="mt-4">
        <ProveedoresSection />
      </div>
    ),
    'usuarios-pos': () => <UsuariosPOSSection cfg={cfg} />,
    'pin-al-despertar': () => <ExperienciaDelNegocio grupo="pin" />,
    'candado-de-mando': () => <CandadoDeMando puedeCambiar={esDeMando(miPuesto)} />,
    'sonidos-de-cada-momento': () => <SonidosDelNegocio />,
    'avisos-del-administrador': () => (
      <TarjetaDeAjustes id="avisos-del-administrador" configuracion={cfg} />
    ),
    exportar: () => <ExportarDatos />,
    importar: () => <ImportarDatos />,
    'nombre-del-aparato': () => (
      <AparatosDeLaSucursal puedeCambiar={miPuesto === 'dueno' || miPuesto === 'administrador'} />
    ),
    'impresora-y-cajon': () => <ImpresionDelAparato rol={posUser?.rol} />,
    'sonido-del-aparato': () => <SonidoDelAparato />,
    'modo-espera': () => <ModoEsperaDelAparato />,
    'voz-del-aparato': () => <ConfiguracionDeVoz />,
    'anuncio-de-comandas': () => <AnuncioDeComandasDelAparato />,
    'barra-lateral': () => <BarraLateralDelAparato />,
    laboratorio: () => <EntradaAlLaboratorio />,
    'reiniciar-sistema': () => <ReiniciarSistemaSection />,
    'usar-mesas': () => <TarjetaDeAjustes id="usar-mesas" configuracion={cfg} />,
    'vender-sin-existencia': () => (
      <TarjetaDeAjustes id="vender-sin-existencia" configuracion={cfg} />
    ),
    'texto-legal': () => <TarjetaDeAjustes id="texto-legal" configuracion={cfg} />,
  };

  const seccion = SECCIONES.find((s) => s.id === activa) ?? null;
  const tarjetas = seccion === null ? [] : tarjetasDe(seccion.id, quien);

  const lista = (
    <nav aria-label="Secciones de la configuración">
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label="Secciones de la configuración"
        className="flex flex-col gap-1"
      >
        {visibles.map((s, i) => {
          const separar = i > 0 && visibles[i - 1].grupo !== s.grupo;
          return (
            <React.Fragment key={s.id}>
              {separar && <div className="my-2 border-t" aria-hidden="true" />}
              <button
                type="button"
                role="tab"
                aria-selected={s.id === activa}
                onClick={() => elegir(s.id)}
                className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  s.id === activa ? 'bg-primary text-primario-texto' : 'hover:bg-muted'
                }`}
              >
                <span className="flex items-center gap-2">
                  {s.grupo === 'aparato' && <Tablet className="w-4 h-4" aria-hidden="true" />}
                  {s.nombre}
                </span>
                <ChevronRight className="w-4 h-4 shrink-0 opacity-60 md:hidden" aria-hidden="true" />
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );

  const pagina =
    seccion === null ? null : (
      <section role="tabpanel" aria-label={seccion.nombre} className="min-w-0 flex-1">
        {isMobile && (
          <button
            type="button"
            onClick={() => elegir(null)}
            className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Secciones
          </button>
        )}
        <h2 className="text-xl font-heading font-bold">{seccion.nombre}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{seccion.paraQue}</p>
        {seccion.grupo === 'aparato' && (
          <p className="mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold">
            Sólo este aparato
          </p>
        )}
        {tarjetas.map((t) => {
          const pintar = CONTENIDO[t.id];
          if (pintar === undefined) return null;
          if (seccion.id === 'avanzado') {
            return (
              <details key={t.id} id={t.id} className="mt-4 rounded-xl border p-3">
                <summary className="cursor-pointer text-sm font-semibold">{t.titulo}</summary>
                <p className="mt-2 text-xs text-muted-foreground">Qué era: {t.queEra}</p>
                {pintar()}
              </details>
            );
          }
          return (
            <div key={t.id} id={t.id}>
              {pintar()}
            </div>
          );
        })}
      </section>
    );

  return (
    <div className="space-y-6">
      <PageHeader title="Configuración" description="Ajustes de Morphiq POS" />
      {isMobile ? (
        seccion === null ? (
          lista
        ) : (
          pagina
        )
      ) : (
        <div className="flex items-start gap-6">
          <div className="w-60 shrink-0">{lista}</div>
          {pagina}
        </div>
      )}
    </div>
  );
}
