'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from '@/enrutado';
import { api } from '@/api/cliente';
import { usePOSAuth } from '@/lib/POSAuthContext';
import { useConfig } from '@/lib/ConfigContext';
import { ROLE_LABELS } from '@/lib/constants';
import { inicioDeLaSesion } from '@/lib/packageConfig';
import { hasPermission } from '@/lib/permissions';
import { Delete, User, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import LoginBrandColors from '@/components/common/LoginBrandColors';
import { CreditoDeMorphiq } from '~/marca/CreditoDeMorphiq';
import { nombreVisibleDelNegocio, nombreVisibleDelSistema } from '~/marca/nombre-visible';

export default function POSLogin() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  // 6A.3: distinguir "todavía cargando" de "ya cargó y está vacío" para
  // no mostrar "Sin usuarios activos" antes del primer fetch en móvil.
  const [usuariosCargando, setUsuariosCargando] = useState(true);
  const [usuariosError, setUsuariosError] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const { login, posUser } = usePOSAuth();
  const { config } = useConfig();
  const navigate = useNavigate();
  const hiddenInputRef = useRef(null);

  // Cada negocio abre donde le toca: el mapa de mesas en un restaurante, el
  // cobro en una tiendita, la agenda en una estética. Lo decide la plantilla y
  // el rol, no una tabla aparte que no conoce los modelos.
  //
  // Esto es para quien llega aquí CON la sesión abierta. Al teclear el PIN manda
  // `tryLogin`, que recarga la página entera; si este efecto navegaba también, lo hacía
  // con la configuración de la pantalla de acceso —sin sesión es la de omisión, `tienda`—
  // y la cocina, la caja y la mesera del restaurante rebotaban entre `/abarrotes/cobrar` y
  // el mapa de mesas mientras llegaba la recarga; con la red del preview, la cocina se
  // quedó en abarrotes (cierre del 21-10). La plantilla es la de la sesión, del servidor.
  const entrandoConPin = useRef(false);
  useEffect(() => {
    if (!posUser || entrandoConPin.current) return;
    navigate(inicioDeLaSesion(posUser.rol, posUser.paquete ?? config?.paquete_modo, hasPermission), {
      replace: true,
    });
  }, [posUser, navigate, config?.paquete_modo]);

  // Carga la lista de usuarios activos para el panel inferior.
  // 6A.3: reintento ligero si la primera carga falla (móvil con red lenta).
  //
  // Aquí NO se llama a `ensureDefaultAdmin()`. Creaba un administrador con PIN
  // `1234` desde el navegador si la plantilla estaba vacía: un alta de
  // credenciales que puede disparar cualquiera que abra la página. El primer
  // acceso lo da `pnpm db:bootstrap`, del lado del servidor (E2-3).
  const cargarUsuarios = useCallback(async () => {
    setUsuariosCargando(true);
    setUsuariosError(false);
    try {
      const list = await api.auth.usuarios();
      const disponibles = Array.isArray(list) ? list : [];
      setUsuarios(disponibles);
      setUsuariosError(false);
    } catch (err) {
      console.error('[POSLogin] cargar usuarios:', err);
      setUsuariosError(true);
    } finally {
      setUsuariosCargando(false);
    }
  }, []);

  useEffect(() => {
    // Con la sesión ya puesta la pantalla va de salida (el efecto de arriba navega): pedir otra
    // vez la lista sólo gasta el cupo de `/api/auth/empleados`, que es por red y lo comparten
    // todos los aparatos del restaurante (21-10).
    if (posUser) return undefined;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await cargarUsuarios();
    })();
    return () => {
      cancelled = true;
    };
  }, [cargarUsuarios]);

  // El aviso de «sigues usando el PIN 1234» desaparece: dependía de leer los
  // PIN desde el cliente. Con el hash en la base el navegador no puede saberlo,
  // y mandarle una pista sobre la credencial sería reabrir el mismo agujero.
  const usingDefaultPin = false;

  // Foco persistente
  useEffect(() => {
    hiddenInputRef.current?.focus();
  }, [selectedUser]);

  // ── LO ÚNICO QUE CAMBIA DE ESTA PANTALLA, Y NO SE NEGOCIA ────────────────
  // Antes esto era `usuarios.find(u => u.pin === pinToUse)`: los PIN de toda
  // la plantilla descargados al navegador y comparados ahí. Es el defecto
  // D-01. Ahora el PIN viaja al servidor, que lo verifica con Argon2id y
  // pimienta contra un hash que no sale de la base, cuenta los intentos
  // fallidos y bloquea.
  //
  // Consecuencia visible, y hay que decirla: el servidor necesita saber DE
  // QUIÉN es el PIN. Probarlo contra cada empleado sería el barrido que el
  // límite por IP existe para frenar, así que hay que tocar el nombre antes de
  // teclear. Cuando el negocio tiene una sola persona dada de alta, se
  // selecciona sola y el flujo queda idéntico al suyo.
  const tryLogin = async (pinToUse) => {
    if (!pinToUse || pinToUse.length < 4) return;
    const quien = selectedUser ?? (usuarios.length === 1 ? usuarios[0] : null);
    if (!quien) {
      toast.error('Toca tu nombre para entrar');
      setPin('');
      return;
    }
    setLoading(true);
    try {
      await api.auth.entrar({ id: quien.id, pin: pinToUse });
      const entrado = await api.auth.me();
      entrandoConPin.current = true;
      login(entrado);
      toast.success(`Bienvenido, ${entrado.nombre}`);
      // Recarga el árbol del servidor con la cookie recién emitida; sus proveedores
      // y su configuración no deben conservar la versión anterior al PIN.
      window.location.replace(inicioDeLaSesion(entrado.rol, entrado.paquete ?? config?.paquete_modo, hasPermission));
    } catch (err) {
      entrandoConPin.current = false;
      // El servidor ya decidió qué se puede decir: PIN incorrecto, demasiados
      // intentos, o el bloqueo con sus minutos. Aquí no se reinterpreta.
      toast.error(err?.message || 'PIN incorrecto');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pin.length === 4) tryLogin(pin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const handleKey = (key) => {
    if (loading) return;
    if (pin.length < 4) setPin((p) => p + key);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (loading) return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        if (pin.length < 4) setPin((p) => p + e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setPin((p) => p.slice(0, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (pin.length >= 4) tryLogin(pin);
      } else if (e.key === 'Escape') {
        setPin('');
        setSelectedUser(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, loading, usuarios, selectedUser]);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  const sistema = nombreVisibleDelSistema(config.nombre_sistema);

  // Un despliegue, un negocio (POS Don Poncho, DP-2): el servidor manda sólo a SU gente.
  const visibles = usuarios;
  // El nombre se IMPRIME sin el prefijo con que nace una demostración («Demo del acople · …»):
  // el dato queda como está en la base, lo que se lee en pantalla no.
  // Sin nombre en la base, el de la casa: «Don Poncho» (`nombreVisibleDelNegocio`).
  const negocio = nombreVisibleDelNegocio(usuarios[0]?.negocio || config.nombre_negocio);

  return (
    // DP-3: plano, sin degradado ni resplandores (guía de recomposición §7). Es la barra
    // lateral del estilo —en `don-poncho`, la pizarra negra del menú con letra crema—.
    <div className="min-h-screen flex flex-col bg-lateral-fondo text-lateral-texto relative overflow-hidden">
      {/* Aplica color_primario/color_acento como CSS vars en <html>. */}
      <LoginBrandColors />

      {/* La marca de agua, sólo si el negocio la configuró. */}
      <div className="pointer-events-none absolute inset-0">
        {config.background_logo_url && (
          /* Marca de agua decorativa: más visible que antes (0.04 → 0.10)
             con un leve drop-shadow tintado de la marca para que se note
             como elemento premium sin competir con el logo principal. */
          <img
            src={config.background_logo_url}
            alt=""
            aria-hidden
            className="absolute right-[-10%] bottom-[-10%] w-[55vw] max-w-[700px] select-none brand-watermark"
            style={{
              opacity: 0.1,
              filter: 'drop-shadow(0 0 30px var(--brand-primary-glow, rgba(59,130,246,0.35)))',
              mixBlendMode: 'screen',
            }}
          />
        )}
      </div>

      {/* Hidden input */}
      <input
        ref={hiddenInputRef}
        type="password"
        inputMode="numeric"
        autoFocus
        value={pin}
        onChange={(e) => {
          if (!loading) setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
        }}
        className="sr-only"
        aria-label="PIN"
      />

      {/* HEADER central: logo + nombre + PIN + keypad */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 relative z-10">
        {/* El logo de la casa, grande y sin caja ni sombra. */}
        {config.logo_url ? (
          <img
            src={config.logo_url}
            alt={negocio}
            className="w-32 h-32 sm:w-40 sm:h-40 md:w-44 md:h-44 object-contain mb-4"
          />
        ) : (
          <div
            className="w-28 h-28 mb-4 rounded-2xl flex items-center justify-center text-5xl font-bold text-lateral-texto/80"
            style={{ background: 'var(--brand-primary-soft, rgba(37,99,235,0.20))' }}
          >
            {negocio.charAt(0)}
          </div>
        )}

        <h1 className="text-3xl sm:text-4xl font-heading font-black text-lateral-texto tracking-wide text-center">
          {negocio}
        </h1>
        <p className="text-lateral-texto/60 text-sm mt-1 tracking-wider uppercase">{sistema}</p>

        {selectedUser && (
          <p
            className="mt-3 px-3 py-1 rounded-full border text-lateral-texto/90 text-xs font-medium"
            style={{
              background: 'var(--brand-accent-soft, rgba(56,189,248,0.15))',
              borderColor: 'var(--brand-accent, rgba(96,165,250,0.4))',
            }}
          >
            Iniciando como: {selectedUser.nombre}
          </p>
        )}

        {/* PIN dots — usa color de acento dinámico */}
        <div className="flex justify-center gap-3 mt-6 mb-5">
          {[0, 1, 2, 3].map((i) => {
            const filled = i < pin.length;
            return (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${filled ? 'scale-110' : ''}`}
                style={
                  filled
                    ? {
                        background: 'var(--brand-accent, #60a5fa)',
                        borderColor: 'var(--brand-accent, #60a5fa)',
                      }
                    : {
                        borderColor: 'rgba(255,255,255,0.2)',
                        background: 'transparent',
                      }
                }
              />
            );
          })}
        </div>

        {/* Keypad — hover/border usan acento dinámico */}
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[280px]">
          {keys.map((key, idx) =>
            key === '' ? (
              <div key={idx} />
            ) : key === '⌫' ? (
              <button
                key={idx}
                onClick={() => setPin((p) => p.slice(0, -1))}
                disabled={loading}
                className="keypad-btn h-14 sm:h-16 rounded-xl bg-lateral-texto/5 border border-lateral-texto/10 text-lateral-texto active:scale-95 transition-all flex items-center justify-center"
              >
                <Delete className="w-5 h-5" />
              </button>
            ) : (
              <button
                key={idx}
                onClick={() => handleKey(key)}
                disabled={loading}
                className="keypad-btn h-14 sm:h-16 rounded-xl bg-lateral-texto/5 border border-lateral-texto/10 text-lateral-texto text-xl sm:text-2xl font-heading font-medium active:scale-95 transition-all"
              >
                {key}
              </button>
            ),
          )}
        </div>
        {/* Hover dinámico para keypad sin necesidad de Tailwind plugin */}
        <style>{`
          .keypad-btn:hover {
            background: var(--brand-accent-soft, rgba(59,130,246,0.18));
            border-color: var(--brand-accent, rgba(96,165,250,0.4));
          }
        `}</style>

        <p className="text-center text-lateral-texto/40 text-[11px] mt-4">
          Selecciona tu nombre e ingresa tu PIN
        </p>

        {/* El único crédito de la plataforma en todo el sistema (DP-3). */}
        <CreditoDeMorphiq />

        {/* Banner discreto: el admin sigue usando PIN default. */}
        {usingDefaultPin && (
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-advertencia/40 bg-advertencia/10 text-advertencia text-[11px]">
            <ShieldAlert className="w-3.5 h-3.5" />
            Por seguridad, cambia el PIN del administrador inicial (1234) en Configuración.
          </div>
        )}
      </div>

      {/* USUARIOS abajo, full-width */}
      <div className="relative z-10 border-t border-lateral-texto/10 bg-lateral-hover">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <p className="text-lateral-texto/60 text-[10px] uppercase tracking-widest mb-2 text-center sm:text-left">
            Usuarios disponibles
          </p>
          {usuariosCargando ? (
            <div className="flex items-center justify-center gap-2 py-6 text-lateral-texto/60 text-sm">
              <div className="w-4 h-4 border-2 border-lateral-texto/20 border-t-lateral-texto/80 rounded-full animate-spin" />
              <span>Cargando usuarios…</span>
            </div>
          ) : usuariosError ? (
            <div className="flex flex-col items-center gap-2 py-5 text-lateral-texto/60 text-sm">
              <p>No pudimos cargar los usuarios.</p>
              <button
                type="button"
                onClick={cargarUsuarios}
                className="px-3 py-1.5 rounded-lg bg-lateral-texto/10 border border-lateral-texto/20 text-lateral-texto text-xs hover:bg-lateral-texto/20"
              >
                Reintentar
              </button>
            </div>
          ) : !Array.isArray(usuarios) || usuarios.length === 0 ? (
            <div className="text-center py-6 text-lateral-texto/40 text-sm">
              Sin usuarios activos. Crea uno desde Configuración.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2.5">
              {visibles.map((u) => {
                const active = selectedUser?.id === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      setSelectedUser(u);
                      setPin('');
                      hiddenInputRef.current?.focus();
                    }}
                    className="user-tile group flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all bg-lateral-texto/5 border-lateral-texto/10"
                    data-active={active ? 'true' : 'false'}
                    style={
                      active
                        ? {
                            background: 'var(--brand-accent-soft, rgba(59,130,246,0.2))',
                            borderColor: 'var(--brand-accent, #60a5fa)',
                            boxShadow: '0 0 0 2px var(--brand-accent-soft, rgba(96,165,250,0.4))',
                          }
                        : undefined
                    }
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-lateral-texto"
                      // El activo, en el par «activo» de la barra (dorado con letra negra en
                      // `don-poncho`): crema sobre el dorado no llegaba a AA.
                      style={
                        active
                          ? {
                              background: 'hsl(var(--lateral-activo))',
                              color: 'hsl(var(--lateral-activo-texto))',
                            }
                          : { background: 'hsl(var(--lateral-texto) / 0.1)' }
                      }
                    >
                      {u.nombre?.charAt(0).toUpperCase() || <User className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 w-full text-center">
                      <p className="text-lateral-texto text-xs font-medium truncate">{u.nombre}</p>
                      <p className="text-lateral-texto/50 text-[10px] truncate">
                        {/* El rol como lo llama SU giro —la estilista no es «Mesero»—;
                            lo rotula el servidor con el vocabulario del negocio. */}
                        {u.etiqueta || ROLE_LABELS[u.rol]}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <style>{`
          .user-tile[data-active="false"]:hover {
            background: var(--brand-accent-soft, rgba(59,130,246,0.12));
            border-color: var(--brand-accent, rgba(96,165,250,0.3));
          }
        `}</style>
      </div>
    </div>
  );
}
