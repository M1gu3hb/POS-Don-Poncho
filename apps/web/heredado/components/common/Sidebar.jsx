'use client';
import React, { useState, useEffect } from 'react';
import { marcaVisibleDePlataforma, nombreVisibleDelNegocio } from '~/marca/nombre-visible';
import { Link, useLocation } from '@/enrutado';
import { usePOSAuth } from '@/lib/POSAuthContext';
import { useConfig } from '@/lib/ConfigContext';
import { etiquetaDeNavegacion, hasPermission } from '@/lib/permissions';
import { useVocabulario } from '~/cliente/vocabulario';
import { NavegacionConAviso } from '~/tacto/NavegacionConAviso';
import { navegacionParaRolYPlantilla } from '@/lib/packageConfig';
import { ROLE_LABELS } from '@/lib/constants';
import {
  BellRing,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  ChefHat,
  ClipboardCheck,
  Clock,
  Coffee,
  CreditCard,
  FileCheck,
  FileSpreadsheet,
  FileText,
  HandCoins,
  History,
  IdCard,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  LogOut,
  Volume2,
  Menu,
  NotebookPen,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  QrCode,
  Receipt,
  ReceiptText,
  Ruler,
  ScanBarcode,
  Scissors,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Stamp,
  Tag,
  Timer,
  Truck,
  UserCheck,
  Users,
  UtensilsCrossed,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { DialogoDelSonido } from '~/configuracion/DialogoDelSonido';

const ICON_MAP = {
  BellRing,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  ChefHat,
  ClipboardCheck,
  Clock,
  Coffee,
  CreditCard,
  FileCheck,
  FileSpreadsheet,
  FileText,
  HandCoins,
  History,
  IdCard,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  NotebookPen,
  Package,
  PlusCircle,
  QrCode,
  Receipt,
  ReceiptText,
  Ruler,
  ScanBarcode,
  Scissors,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  Stamp,
  Tag,
  Timer,
  Truck,
  UserCheck,
  Users,
  UtensilsCrossed,
  Wallet,
  Wrench,
};

// El ORDEN ya no se calcula aquí, y las listas de rutas tampoco.
//
// Había dos órdenes tecleados a mano —mostrador y restaurante— y una lista fija
// de doce entradas en `permissions.js`, ninguna de las cuales llevaba a una
// pantalla de modelo. El resultado es que las 61 pantallas de los cinco modelos
// respondían y no colgaban de ningún menú: para abrirlas había que teclear la
// URL.
//
// Ahora el menú lo declara el SERVIDOR, en
// `packages/contracts/src/comandos/navegacion.ts`, con el orden del DÍA DE
// TRABAJO de cada giro —un restaurante abre el mapa de mesas y termina en el
// arqueo; una estética abre la agenda y termina en la liquidación— y este
// componente se limita a pintarlo. Ordenar aquí volvería a crear la segunda
// lista que se queda atrás.

export default function Sidebar({ collapsed, onToggle }) {
  const { posUser, logout } = usePOSAuth();
  const { config, paquete_modo } = useConfig();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  // DP-13.3: el diálogo del sonido vive aquí, fuera del cajón del teléfono (que lo taparía).
  const [sonidoAbierto, setSonidoAbierto] = useState(false);

  // Cerrar al cambiar de ruta
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Bloquear scroll del body cuando el drawer está abierto
  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mobileOpen]);

  // F-017 · Como habla este negocio. Lo pone el envoltorio de servidor, asi
  // que aqui ya esta resuelto y no hay parpadeo en la primera pintada.
  const vocabulario = useVocabulario();

  // La plantilla dice qué COMPRÓ el negocio y el rol qué puede TOCAR esta
  // persona. Son dos preguntas distintas y se responden en ese orden.
  const navItems = navegacionParaRolYPlantilla(posUser?.rol, paquete_modo, hasPermission).map(
    (entrada) => ({
      path: entrada.ruta,
      label: entrada.etiqueta,
      icon: entrada.icono,
      entidad: entrada.entidad,
      pluralPropio: entrada.pluralPropio,
    }),
  );

  // «Modelos de negocio» ya no va en el menú (21-10): el selector vive en Configuración →
  // Presentación, detrás del PIN del dueño general, igual en todos los modelos.

  const closeMobile = () => setMobileOpen(false);

  // DP-21 · Bloque 9: `plegada` lo dice quien lo pinta. La barra fija de escritorio, como la
  // tenga la persona; el cajón del teléfono y de la tableta, SIEMPRE con sus nombres.
  const SidebarContent = ({ plegada }) => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div
        className={`flex items-center gap-3 py-4 border-b border-sidebar-border ${plegada ? 'flex-col px-2' : 'flex-wrap px-3'}`}
      >
        <div className="w-10 h-10 rounded-full overflow-hidden bg-superficie/10 flex items-center justify-center shrink-0 ring-2 ring-borde/10">
          {config.logo_url ? (
            <img
              src={config.logo_url}
              alt={config.nombre_negocio}
              className="w-full h-full object-contain p-1"
            />
          ) : (
            <Sparkles className="w-5 h-5 text-info" />
          )}
        </div>
        {!plegada && (
          <div className="min-w-0 grow basis-32">
            <p className="text-sm font-heading font-bold line-clamp-2 break-words leading-tight tracking-wide">
              {nombreVisibleDelNegocio(config.nombre_negocio)}
            </p>
            <p className="text-[10px] text-sidebar-foreground/50 truncate">
              {marcaVisibleDePlataforma(config.platform_brand)}
            </p>
          </div>
        )}
        {/* DP-21 · Bloque 9 (O5/M3): un botón claro y grande, a la vista plegada y desplegada. Era un
            chevron de 16 px al 50 % de opacidad. 44 × 44 como mínimo, con el icono Y la palabra. Plegada,
            la palabra va debajo del icono (la barra mide 64 px). Abajo de `lg:` no hay barra fija: ahí
            está el botón «Menú» del cajón (más abajo), del mismo tamaño. */}
        <button
          type="button"
          onClick={onToggle}
          className={`hidden min-h-11 min-w-11 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-foreground transition-colors hover:bg-sidebar-accent/80 lg:flex ${plegada ? 'w-full flex-col gap-0.5 px-0.5 text-[10px] leading-tight font-medium' : 'w-full gap-2 px-3 text-sm font-medium'}`}
          aria-label={plegada ? 'Mostrar menú' : 'Ocultar menú'}
          style={{ touchAction: 'manipulation' }}
        >
          {plegada ? (
            <PanelLeftOpen className="w-5 h-5" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="w-5 h-5" aria-hidden="true" />
          )}
          <span>{plegada ? 'Mostrar' : 'Ocultar'}</span>
        </button>
      </div>

      {/* Nav */}
      {/* Con nombre: las pantallas de modelo tienen su propia navegación —las categorías del
          cobro— y un lector de pantalla tiene que poder distinguir la principal. */}
      {/* DP-22 · Hallazgo 5: en una pantalla baja la lista se desplaza; el degradado de abajo dice que hay más. */}
      <NavegacionConAviso etiqueta="Menú principal" className="py-4 space-y-0.5 px-2">
        {navItems.map((item) => {
          const Icon = ICON_MAP[item.icon] || Tag;
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={closeMobile}
              // Colapsada sólo queda el ícono: sin esto el enlace no tiene nombre y un
              // lector de pantalla —o quien no reconoce el dibujo— no sabe a dónde lleva.
              aria-label={plegada ? etiquetaDeNavegacion(item, vocabulario) : undefined}
              title={plegada ? etiquetaDeNavegacion(item, vocabulario) : undefined}
              aria-current={active ? 'page' : undefined}
              className={`relative flex items-center gap-3 px-3 py-2.5 any-pointer-coarse:min-h-(--altura-tactil) rounded-lg text-sm transition-all ${active ? 'text-primario-texto font-semibold' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}
              style={
                active
                  ? {
                      // Skeuomorphism premium: gradiente diagonal del primario al
                      // acento (con fallback al sidebar-primary actual para no
                      // cambiar nada con la paleta por defecto), borde superior
                      // luminoso, sombra interior profunda y resplandor exterior.
                      background:
                        'linear-gradient(135deg, var(--brand-primary, hsl(var(--sidebar-primary))) 0%, var(--brand-accent, hsl(var(--sidebar-primary))) 100%)',
                      boxShadow: [
                        // Highlight superior (luz que cae): efecto de relieve
                        'inset 0 1px 0 rgba(255,255,255,0.25)',
                        // Sombra interior inferior: da profundidad de botón hundido sutil
                        'inset 0 -2px 4px rgba(0,0,0,0.20)',
                        // Sombra exterior premium con tinte del acento
                        '0 2px 6px rgba(0,0,0,0.35)',
                        '0 0 12px var(--brand-accent-glow, rgba(59,130,246,0.25))',
                      ].join(', '),
                      border: '1px solid rgba(255,255,255,0.10)',
                    }
                  : undefined
              }
            >
              {/* Rayita lateral secundaria — refuerzo visual del item activo
                  sin ser el efecto principal. Solo aparece cuando es active. */}
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
                  style={{
                    background: 'rgba(255,255,255,0.55)',
                    boxShadow: '0 0 6px rgba(255,255,255,0.4)',
                  }}
                />
              )}
              <Icon
                className="w-5 h-5 shrink-0"
                style={
                  active
                    ? {
                        filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.35))',
                      }
                    : undefined
                }
              />
              {!plegada && (
                <span className="truncate">{etiquetaDeNavegacion(item, vocabulario)}</span>
              )}
            </Link>
          );
        })}
      </NavegacionConAviso>

      {/* Theme toggle — visible en todas las páginas internas */}
      <div className="px-2 pb-1">
        {plegada ? (
          <div className="flex justify-center pb-1">
            <ThemeToggle
              variant="icon"
              className="bg-transparent border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent"
            />
          </div>
        ) : (
          <ThemeToggle variant="sidebar" />
        )}
      </div>

      {/* User footer */}
      {posUser && (
        <div className="border-t border-sidebar-border p-3">
          <div
            className={`flex items-center gap-3 ${plegada ? 'flex-col justify-center' : ''}`}
          >
            <div className="w-8 h-8 bg-sidebar-accent rounded-full flex items-center justify-center text-xs font-bold shrink-0">
              {posUser.nombre?.charAt(0).toUpperCase()}
            </div>
            {!plegada && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium break-words leading-tight">{posUser.nombre}</p>
                <p className="text-[10px] text-sidebar-foreground/50">{posUser.etiqueta ?? ROLE_LABELS[posUser.rol]}</p>
              </div>
            )}
            {/* DP-13.3: el sonido de ESTE aparato, para cualquier puesto, sin entrar a Configuración. */}
            {/* DP-14.6-8: también con el menú colapsado (antes desaparecía). */}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                setSonidoAbierto(true);
              }}
              className="inline-flex items-center justify-center any-pointer-coarse:size-11 text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors p-1"
              aria-label="Sonido de este aparato"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            {/* DP-21: también plegada. La barra del mesero y de la cocina nace plegada en los POS, y
                quien comparte el aparato sale sin tener que abrir el menú. */}
            <button
              onClick={logout}
              className="inline-flex items-center justify-center any-pointer-coarse:size-11 text-sidebar-foreground/50 hover:text-peligro transition-colors p-1"
              aria-label="Salir"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* El botón del cajón, móvil/tablet (oculto en lg+). DP-21 · Bloque 9: del mismo tamaño que el de
          plegar de la barra fija (44 px como mínimo) y con la palabra «Menú», no sólo el dibujo. */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-[70] min-h-11 min-w-11 gap-2 px-3 bg-sidebar rounded-xl flex items-center justify-center text-sm font-medium text-sidebar-foreground shadow-lg active:scale-95 transition-transform"
        aria-label="Abrir menú"
        style={{ touchAction: 'manipulation' }}
      >
        <Menu className="w-5 h-5" aria-hidden="true" />
        <span>Menú</span>
      </button>

      {/* Drawer móvil/tablet */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-velo/60"
            onClick={closeMobile}
            aria-label="Cerrar menú"
          />
          {/* Panel */}
          <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] shadow-2xl bg-sidebar">
            {/* Botón cerrar grande, accesible */}
            <button
              type="button"
              onClick={closeMobile}
              className="absolute top-2 right-2 w-11 h-11 rounded-full bg-superficie/10 hover:bg-superficie/20 flex items-center justify-center text-sidebar-foreground z-10 active:scale-95 transition-transform"
              aria-label="Cerrar menú"
              style={{ touchAction: 'manipulation' }}
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent plegada={false} />
          </div>
        </div>
      )}

      {/* Sidebar escritorio */}
      <div
        className={`hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-30 transition-all duration-300 shadow-xl ${collapsed ? 'w-16' : 'w-60'}`}
      >
        <SidebarContent plegada={collapsed} />
      </div>

      <DialogoDelSonido abierto={sonidoAbierto} alCambiar={setSonidoAbierto} />
    </>
  );
}
