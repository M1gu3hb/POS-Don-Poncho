'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

import {
  CONSULTA_DEL_SISTEMA,
  leerPreferenciaDeModo,
  resolverModo,
} from '~/proveedores/preferencia-de-modo';

/**
 * ThemeContext — modo claro / oscuro global.
 *
 * - 100% estético: solo toggle de la clase `.dark` en <html>.
 * - Persistencia por dispositivo en localStorage (key: `mh_theme`).
 * - Funciona con shadcn/Tailwind: tailwind.config.js usa `darkMode: ["class"]`
 *   y el index.css ya define todas las variables HSL para `.dark`.
 * - Animación: una clase temporal `.theme-anim` se aplica al <html> para que
 *   transiciones CSS de fondo/borde/color tomen efecto solo durante el cambio
 *   y no permanentemente (evita reflows costosos en móvil).
 *
 * NO toca lógica de negocio, datos, entidades ni queries.
 *
 * DP-11.4 · la PREFERENCIA (`light`, `dark` o automático) es lo guardado; el tema que se pinta
 * sale de ella y del sistema, y en automático lo sigue en vivo. `setTheme`/`toggle` siguen
 * eligiendo a mano (el «Modo oscuro» de la barra lateral); `setPreference` es el selector de
 * Apariencia (Automático / Claro / Oscuro).
 */

const STORAGE_KEY = 'mh_theme';
const ANIM_CLASS = 'theme-anim';
const ANIM_MS = 500;

function readStored() {
  try {
    return leerPreferenciaDeModo(localStorage.getItem(STORAGE_KEY));
  } catch {
    return 'auto';
  }
}

function systemIsDark() {
  try {
    return window.matchMedia(CONSULTA_DEL_SISTEMA).matches;
  } catch {
    return false;
  }
}

function applyThemeToRoot(theme) {
  try {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    // Marca el color-scheme nativo para inputs/scrollbars.
    root.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  } catch {}
}

function pulseAnimClass() {
  try {
    const root = document.documentElement;
    root.classList.add(ANIM_CLASS);
    window.setTimeout(() => {
      try {
        root.classList.remove(ANIM_CLASS);
      } catch {}
    }, ANIM_MS + 50);
  } catch {}
}

const ThemeContext = createContext({
  theme: 'light',
  isDark: false,
  preference: 'auto',
  toggle: () => {},
  setTheme: () => {},
  /** @type {(siguiente: string) => void} */
  setPreference: () => {},
});

export function ThemeProvider({ children }) {
  // Inicialización síncrona — antes del primer paint — para evitar flash.
  const [preference, setPreferenceState] = useState(() =>
    typeof window === 'undefined' ? 'auto' : readStored(),
  );
  const [systemDark, setSystemDark] = useState(() =>
    typeof window === 'undefined' ? false : systemIsDark(),
  );
  const theme = resolverModo(preference, systemDark);

  // En cliente, garantizamos que el <html> tenga la clase correcta.
  useEffect(() => {
    applyThemeToRoot(theme);
  }, [theme]);

  // En automático el tema sigue al sistema en vivo (el atardecer del teléfono, por ejemplo).
  useEffect(() => {
    let consulta;
    try {
      consulta = window.matchMedia(CONSULTA_DEL_SISTEMA);
    } catch {
      return undefined;
    }
    const alCambiar = (evento) => setSystemDark(evento.matches);
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);

  // Lo elegido en otra pestaña del mismo aparato.
  useEffect(() => {
    const alGuardar = (evento) => {
      if (evento.key === STORAGE_KEY) setPreferenceState(readStored());
    };
    window.addEventListener('storage', alGuardar);
    return () => window.removeEventListener('storage', alGuardar);
  }, []);

  const setPreference = useCallback((next) => {
    const value = leerPreferenciaDeModo(next);
    pulseAnimClass();
    setPreferenceState(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {}
  }, []);

  const setTheme = useCallback(
    (next) => setPreference(next === 'dark' ? 'dark' : 'light'),
    [setPreference],
  );

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider
      value={{ theme, isDark: theme === 'dark', preference, toggle, setTheme, setPreference }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Hook ligero para componentes que sólo quieren saber si está oscuro.
 * Evita re-render innecesario fuera del provider.
 */
export function useIsDark() {
  return useContext(ThemeContext).isDark;
}
