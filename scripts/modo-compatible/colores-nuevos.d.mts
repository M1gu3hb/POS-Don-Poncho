export declare const SIN_COLORES_NUEVOS: string;
export declare function aRgb(texto: string): { rgb: [number, number, number]; alfa: number } | null;
export declare function valorSinColoresNuevos(valor: string): string | null;
export declare function tieneColoresNuevos(valor: string): boolean;
export declare function respaldarColoresNuevos(
  root: unknown,
  ayudas: unknown,
): { reglas: number; sinRespaldo: { selector: string; prop: string; valor: string }[] };
