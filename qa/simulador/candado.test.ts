import { describe, expect, it } from 'vitest';

import { exigirCopiaLocal } from './candado.ts';

const COPIA = 'postgres://morphiqpos@localhost:5460/qa_dp18_sim';

describe('el candado del simulador', () => {
  it('deja pasar la app local contra una copia local qa_…', () => {
    expect(() => {
      exigirCopiaLocal({ appUrl: 'http://localhost:32800', databaseUrl: COPIA, entorno: {} });
    }).not.toThrow();
    expect(() => {
      exigirCopiaLocal({ appUrl: 'http://127.0.0.1:32800/qr/x' });
    }).not.toThrow();
  });

  it('aborta con la URL de producción y con cualquier dominio que no sea esta máquina', () => {
    expect(() => {
      exigirCopiaLocal({ appUrl: 'https://pos-don-poncho.vercel.app/login-pos' });
    }).toThrow(/PRODUCCIÓN/);
    expect(() => {
      exigirCopiaLocal({ appUrl: 'https://POS-DON-PONCHO.vercel.app' });
    }).toThrow(/PRODUCCIÓN/);
    expect(() => {
      exigirCopiaLocal({ appUrl: 'https://pos-don-poncho-git-x.vercel.app' });
    }).toThrow(/no es esta máquina/);
    expect(() => {
      exigirCopiaLocal({ appUrl: 'https://donponcho.mx' });
    }).toThrow(/no es esta máquina/);
  });

  it('aborta si la base es la de producción, aunque venga por un túnel local', () => {
    expect(() => {
      exigirCopiaLocal({
        databaseUrl:
          'postgres://postgres.mqlcusxwqrefpfttjjks:x@aws-0-us-east-2.pooler.supabase.com:5432/postgres',
      });
    }).toThrow(/mqlcusxwqrefpfttjjks/);
    expect(() => {
      exigirCopiaLocal({ databaseUrl: 'postgres://u@localhost:5432/qa_mqlcusxwqrefpfttjjks' });
    }).toThrow(/proyecto real/);
    expect(() => {
      exigirCopiaLocal({
        databaseUrl: 'postgres://u@db.wyqmzhliurwyxuyxznpb.supabase.co:5432/postgres',
      });
    }).toThrow(/proyecto real/);
  });

  it('aborta con una base remota o que no es una copia de QA', () => {
    expect(() => {
      exigirCopiaLocal({ databaseUrl: 'postgres://u@10.0.0.5:5432/qa_x' });
    }).toThrow(/no en esta máquina/);
    expect(() => {
      exigirCopiaLocal({ databaseUrl: 'postgres://u@localhost:55433/dp_verify' });
    }).toThrow(/no es una copia de QA/);
    expect(() => {
      exigirCopiaLocal({ databaseUrl: 'no es url' });
    }).toThrow(/no es una URL/);
  });

  it('aborta dentro de Vercel', () => {
    expect(() => {
      exigirCopiaLocal({ databaseUrl: COPIA, entorno: { VERCEL: '1' } });
    }).toThrow(/Vercel/);
    expect(() => {
      exigirCopiaLocal({ databaseUrl: COPIA, entorno: { VERCEL_ENV: 'production' } });
    }).toThrow(/Vercel/);
  });
});
