import { describe, expect, it } from 'vitest';

import {
  CLAVE_DEL_ANUNCIO,
  guardarAnuncioDelAparato,
  leerAnuncioDelAparato,
} from './anuncio-del-aparato';

const con = (texto: string | null) => ({ getItem: () => texto });

describe('«Esta pantalla anuncia las comandas» · el interruptor de este aparato', () => {
  it('sin nada guardado está ENCENDIDO: una cocina que habla hoy no se queda muda', () => {
    expect(leerAnuncioDelAparato(con(null))).toBe(true);
    expect(leerAnuncioDelAparato(null)).toBe(true);
  });

  it('lo guardado se respeta, apagado o encendido', () => {
    expect(leerAnuncioDelAparato(con(JSON.stringify({ anuncia: false })))).toBe(false);
    expect(leerAnuncioDelAparato(con(JSON.stringify({ anuncia: true })))).toBe(true);
  });

  it('un valor roto o de otro tipo cae a lo de omisión', () => {
    expect(leerAnuncioDelAparato(con('{no es json'))).toBe(true);
    expect(leerAnuncioDelAparato(con('"no"'))).toBe(true);
    expect(leerAnuncioDelAparato(con(JSON.stringify({ anuncia: 'no' })))).toBe(true);
  });

  it('si el navegador niega el almacén al leer, sigue encendido', () => {
    const negado = {
      getItem: (): never => {
        throw new Error('SecurityError');
      },
    };
    expect(leerAnuncioDelAparato(negado)).toBe(true);
  });

  it('guarda con su clave y avisa si el navegador no dejó', () => {
    const datos = new Map<string, string>();
    const bueno = { setItem: (c: string, v: string) => void datos.set(c, v) };
    expect(guardarAnuncioDelAparato(bueno, false)).toBe(true);
    expect(leerAnuncioDelAparato({ getItem: (c) => datos.get(c) ?? null })).toBe(false);
    expect(datos.has(CLAVE_DEL_ANUNCIO)).toBe(true);

    const lleno = {
      setItem: (): never => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(guardarAnuncioDelAparato(lleno, true)).toBe(false);
    expect(guardarAnuncioDelAparato(null, true)).toBe(false);
  });
});
