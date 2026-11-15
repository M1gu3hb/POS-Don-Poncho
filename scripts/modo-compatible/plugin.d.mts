import type { PluginCreator } from 'postcss';

/** El plugin del modo compatible (DP-20.1). Va después de `@tailwindcss/postcss`. */
declare const modoCompatible: PluginCreator<void>;
export default modoCompatible;

export declare const NOMBRE: string;
