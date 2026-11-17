import { describe, expect, it } from 'vitest';

import {
  anunciaEsteAparato,
  CLAVE_DEL_ANUNCIO,
  guardarAnuncioDelAparato,
  hayQuePreguntar,
  leerEleccionDelAparato,
  PUESTO_DE_COCINA,
  reglaDeEsteAparato,
  TELEFONO_DE_COCINA,
} from './anuncio-del-aparato';

const con = (texto: string | null) => ({ getItem: () => texto });

const OTROS_PUESTOS = ['dueno', 'administrador', 'gerente', 'cajero', 'mesero', 'almacen'];

describe('lo que este aparato eligió', () => {
  it('sin nada guardado, o sin almacén, no ha elegido (null)', () => {
    expect(leerEleccionDelAparato(con(null))).toBeNull();
    expect(leerEleccionDelAparato(null)).toBeNull();
  });

  it('lo guardado se lee tal cual, encendido o apagado', () => {
    expect(leerEleccionDelAparato(con(JSON.stringify({ anuncia: false })))).toBe(false);
    expect(leerEleccionDelAparato(con(JSON.stringify({ anuncia: true })))).toBe(true);
  });

  it('un valor roto o de otro tipo cuenta como «no ha elegido»', () => {
    expect(leerEleccionDelAparato(con('{no es json'))).toBeNull();
    expect(leerEleccionDelAparato(con('"no"'))).toBeNull();
    expect(leerEleccionDelAparato(con(JSON.stringify({ anuncia: 'no' })))).toBeNull();
  });

  it('si el navegador niega el almacén al leer, tampoco ha elegido', () => {
    const negado = {
      getItem: (): never => {
        throw new Error('SecurityError');
      },
    };
    expect(leerEleccionDelAparato(negado)).toBeNull();
  });

  it('guarda con su clave y avisa si el navegador no dejó', () => {
    const datos = new Map<string, string>();
    const bueno = { setItem: (c: string, v: string) => void datos.set(c, v) };
    expect(guardarAnuncioDelAparato(bueno, false)).toBe(true);
    expect(leerEleccionDelAparato({ getItem: (c) => datos.get(c) ?? null })).toBe(false);
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

describe('quién anuncia las comandas: lo elegido manda, y sin elegir manda el puesto', () => {
  it('quien entra con el puesto de cocina anuncia por omisión: una cocina que habla no se queda muda', () => {
    expect(anunciaEsteAparato({ puesto: PUESTO_DE_COCINA, elegido: null })).toBe(true);
  });

  it('cualquier otro puesto NO anuncia por omisión', () => {
    for (const puesto of OTROS_PUESTOS) {
      expect(anunciaEsteAparato({ puesto, elegido: null }), puesto).toBe(false);
    }
  });

  // Mientras el aparato no sabe su puesto (la lista de personas no ha llegado, o la red falló),
  // anuncia: una cocina nunca se queda muda. Oírse doble un instante en el aparato del dueño es
  // el mal menor; una comanda que nadie oyó, no.
  it('mientras el puesto todavía no se conoce, anuncia: la cocina nunca se queda muda', () => {
    expect(anunciaEsteAparato({ puesto: null, elegido: null })).toBe(true);
  });

  it('pero si en ese aparato se eligió que no, no anuncia aunque el puesto no se conozca', () => {
    expect(anunciaEsteAparato({ puesto: null, elegido: false })).toBe(false);
  });

  it('el teléfono de cocina, sin sesión de puesto, anuncia por omisión como siempre', () => {
    expect(anunciaEsteAparato({ puesto: TELEFONO_DE_COCINA, elegido: null })).toBe(true);
  });

  it('lo ya elegido se respeta tal cual, sea cual sea el puesto', () => {
    for (const puesto of [PUESTO_DE_COCINA, TELEFONO_DE_COCINA, null, ...OTROS_PUESTOS]) {
      expect(anunciaEsteAparato({ puesto, elegido: true }), `${String(puesto)} sí`).toBe(true);
      expect(anunciaEsteAparato({ puesto, elegido: false }), `${String(puesto)} no`).toBe(false);
    }
  });
});

describe('a quién se le pregunta (una sola vez)', () => {
  it('a quien entra con el puesto de cocina y nunca ha elegido', () => {
    expect(hayQuePreguntar({ puesto: PUESTO_DE_COCINA, elegido: null })).toBe(true);
  });

  it('ya no se vuelve a preguntar después de contestar, sea sí o no', () => {
    expect(hayQuePreguntar({ puesto: PUESTO_DE_COCINA, elegido: true })).toBe(false);
    expect(hayQuePreguntar({ puesto: PUESTO_DE_COCINA, elegido: false })).toBe(false);
  });

  it('a nadie más: ni a los demás puestos, ni a un puesto aún desconocido, ni al teléfono', () => {
    for (const puesto of [null, TELEFONO_DE_COCINA, ...OTROS_PUESTOS]) {
      expect(hayQuePreguntar({ puesto, elegido: null }), String(puesto)).toBe(false);
    }
  });
});

describe('lo que la tarjeta de Este aparato le dice a ESE aparato', () => {
  it('lo elegido se dice como elegido', () => {
    expect(reglaDeEsteAparato({ puesto: 'dueno', elegido: true })).toMatch(/elegiste/);
  });

  it('sin elegir, dice lo que vale por el puesto: anuncia en cocina y teléfono, no en los demás', () => {
    expect(reglaDeEsteAparato({ puesto: PUESTO_DE_COCINA, elegido: null })).toMatch(/ anuncia /);
    expect(reglaDeEsteAparato({ puesto: TELEFONO_DE_COCINA, elegido: null })).toMatch(/ anuncia /);
    expect(reglaDeEsteAparato({ puesto: 'dueno', elegido: null })).toMatch(/no anuncia/);
  });
});
