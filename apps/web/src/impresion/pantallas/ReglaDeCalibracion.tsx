'use client';

import type { CSSProperties, ReactElement } from 'react';

import type { AnchoDelPapel } from '../papel.ts';
import {
  estiloDelLienzo,
  LETRA_MINIMA,
  letraTermica,
  LINEA_GRUESA,
  RELLENO_TERMICO,
  TINTA,
} from '../termico/estilo.ts';
import {
  bordesDeLaRegla,
  LADO_DEL_CUADRO,
  marcasDeLaRegla,
  TEXTO_DEL_CUADRO,
  type LargoDeLaMarca,
} from './regla-de-calibracion.ts';

const ALTO_DE_LA_MARCA: Readonly<Record<LargoDeLaMarca, number>> = {
  corta: 14,
  media: 26,
  larga: 40,
};
const ANCHO_DE_LA_RAYA = 2;
const ANCHO_DEL_ROTULO = 44;
const ALTO_DE_LA_REGLA = 72;
const ANCHO_DEL_BORDE = 6;
const ANCHO_DEL_ROTULO_DE_BORDE = 70;

const px = (n: number): string => `${String(n)}px`;
const acotar = (n: number, minimo: number, maximo: number): number =>
  Math.max(minimo, Math.min(maximo, n));

const RAYA: CSSProperties = { position: 'absolute', top: 0, background: TINTA };
const ROTULO: CSSProperties = {
  position: 'absolute',
  textAlign: 'center',
  fontSize: px(LETRA_MINIMA),
  lineHeight: 1,
};

/**
 * LA REGLA DE CALIBRACIÓN (DP-20 · laboratorio). Un documento térmico más: negro puro, medido en
 * PUNTOS (1 px = 1 punto), sin margen, para que cada número sea el punto de la impresora. Se
 * imprime y se lee en el papel hasta dónde llega: la primera raya que falta es el borde real.
 */
export function ReglaDeCalibracion({
  puntos,
  papelMm,
}: {
  readonly puntos: number;
  readonly papelMm: AnchoDelPapel;
}): ReactElement {
  const letra = letraTermica(papelMm);
  const marcas = marcasDeLaRegla(puntos);
  const bordes = bordesDeLaRegla(puntos);
  return (
    <div
      data-regla-de-calibracion
      style={{
        ...estiloDelLienzo(papelMm, puntos),
        padding: 0,
        paddingBottom: px(RELLENO_TERMICO),
      }}
    >
      <p
        style={{
          textAlign: 'center',
          fontWeight: 900,
          fontSize: px(letra.fuerte),
          margin: '8px 0 0',
        }}
      >
        REGLA DE CALIBRACIÓN
      </p>
      <p style={{ textAlign: 'center', fontSize: px(letra.chica), margin: '2px 0 12px' }}>
        {`${String(puntos)} puntos · cada raya es 1 mm`}
      </p>

      <div style={{ position: 'relative', width: px(puntos), height: px(ALTO_DE_LA_REGLA) }}>
        {marcas.map((marca) => (
          <span
            key={marca.x}
            style={{
              ...RAYA,
              left: px(Math.min(marca.x, puntos - ANCHO_DE_LA_RAYA)),
              width: px(ANCHO_DE_LA_RAYA),
              height: px(ALTO_DE_LA_MARCA[marca.largo]),
            }}
          />
        ))}
        {marcas.map((marca) =>
          marca.rotulo === null ? null : (
            <span
              key={`rotulo-${String(marca.x)}`}
              style={{
                ...ROTULO,
                top: px(ALTO_DE_LA_MARCA.larga + 6),
                left: px(acotar(marca.x - ANCHO_DEL_ROTULO / 2, 0, puntos - ANCHO_DEL_ROTULO)),
                width: px(ANCHO_DEL_ROTULO),
              }}
            >
              {marca.rotulo}
            </span>
          ),
        )}
      </div>

      <div style={{ position: 'relative', width: px(puntos), height: '70px', marginTop: '8px' }}>
        {bordes.map((borde) => (
          <span key={`borde-${String(borde)}`}>
            <span
              style={{
                ...RAYA,
                left: px(borde - ANCHO_DEL_BORDE),
                width: px(ANCHO_DEL_BORDE),
                height: '40px',
              }}
            />
            <span
              style={{
                ...ROTULO,
                textAlign: 'right',
                fontWeight: 900,
                top: '46px',
                left: px(borde - ANCHO_DEL_ROTULO_DE_BORDE),
                width: px(ANCHO_DEL_ROTULO_DE_BORDE),
              }}
            >
              {borde}
            </span>
          </span>
        ))}
      </div>
      <p style={{ fontSize: px(letra.chica), margin: '4px 8px 0' }}>
        Barras gruesas: el último punto de los anchos comunes (384, 512 y 576).
      </p>

      <div
        style={{
          width: px(LADO_DEL_CUADRO),
          height: px(LADO_DEL_CUADRO),
          border: LINEA_GRUESA,
          boxSizing: 'border-box',
          margin: '14px auto 6px',
        }}
      />
      <p style={{ textAlign: 'center', fontSize: px(letra.chica), margin: '0 8px' }}>
        {TEXTO_DEL_CUADRO}
      </p>
      <p style={{ textAlign: 'center', fontSize: px(letra.chica), margin: '10px 8px 0' }}>
        Lee hasta qué número llega la regla en el papel: ese es el ancho que imprime.
      </p>
    </div>
  );
}
