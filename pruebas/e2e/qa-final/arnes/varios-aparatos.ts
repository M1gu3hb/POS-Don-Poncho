import { join } from 'node:path';

import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
  type TestInfo,
} from '@playwright/test';

import { contextoDe, personaDe, type RolDePrueba } from '../../ayudantes/roles.ts';

import { aparatoPorId, motorDe, opcionesDeContexto, type Aparato } from './aparatos.ts';
import { navegadorDe, prepararContexto } from './ligero.ts';
import type { MotorId } from './motores.ts';

/**
 * VARIOS APARATOS A LA VEZ sobre el mismo servidor (DP-22): la Caja, el mesero, la cocina y el
 * portal del comensal, cada uno en su contexto separado, con SU perfil (tamaño, tacto, motor) y SU
 * sesión. Es lo que hacen falta las carreras: propina, cobrar mientras el mesero agrega, dos cajas,
 * traer la caja.
 *
 * Cada aparato abre su propio navegador cuando su motor no es el del proyecto (un iMin con Chromium
 * 99 junto a una PC con el Chrome 156). Las sesiones de las personas se guardan POR PUESTO
 * (`pruebas/e2e/.sesiones/…-<puesto>.json`, fuera de git): dos puestos de la misma persona son dos
 * terminales distintas, que es lo que necesitan las pruebas de «dos cajas».
 *
 * Cuidado con el límite de entradas con PIN (20 por origen cada 5 min): cada puesto entra UNA vez y
 * su sesión se reusa en las corridas siguientes mientras el servidor la reconozca.
 */

export interface PedidoDeAparato {
  /** El nombre del puesto: «caja», «caja-2», «mesero»… Es la llave de la sesión guardada. */
  readonly puesto: string;
  readonly aparato: string;
  /** Quién entra con PIN. Sin rol, es un aparato sin sesión (el teléfono del comensal). */
  readonly rol?: RolDePrueba;
  readonly persona?: string;
  /** A dónde va después de entrar (`/caja`, `/mesero`, `/cocina`, o la ruta del portal). */
  readonly ruta?: string;
}

export interface AparatoAbierto {
  readonly puesto: string;
  readonly aparato: Aparato;
  readonly page: Page;
  readonly context: BrowserContext;
}

const CARPETA_DE_SESIONES = join('pruebas', 'e2e', '.sesiones');

const limpio = (texto: string): string => texto.replaceAll(/[^A-Za-z0-9]/g, '').toLowerCase();

export class VariosAparatos {
  readonly #navegadores = new Map<MotorId, Browser>();
  readonly #contextos: BrowserContext[] = [];

  constructor(
    private readonly info: TestInfo,
    private readonly slug: string,
  ) {}

  async #navegadorDe(aparato: Aparato): Promise<Browser> {
    const motor = motorDe(aparato);
    if (!motor.disponible) {
      throw new Error(`${aparato.id}: ${motor.aviso ?? 'motor no disponible'}`);
    }
    const guardado = this.#navegadores.get(aparato.motor);
    if (guardado !== undefined) return guardado;
    const nuevo = await chromium.launch(
      motor.ejecutable === undefined ? {} : { executablePath: motor.ejecutable },
    );
    this.#navegadores.set(aparato.motor, nuevo);
    return nuevo;
  }

  /** Abre un aparato: entra con su persona (si la hay) y va a su ruta. */
  async abrir(pedido: PedidoDeAparato): Promise<AparatoAbierto> {
    const aparato = aparatoPorId(pedido.aparato);
    const navegador = navegadorDe(await this.#navegadorDe(aparato), aparato);
    const base = this.info.project.use;
    const propias = {
      ...(base.baseURL === undefined ? {} : { baseURL: base.baseURL }),
      ...(base.locale === undefined ? {} : { locale: base.locale }),
      ...(base.timezoneId === undefined ? {} : { timezoneId: base.timezoneId }),
      ...opcionesDeContexto(aparato, motorDe(aparato)),
    };
    let context: BrowserContext;
    if (pedido.rol === undefined) {
      context = await navegador.newContext(propias);
    } else {
      const persona = personaDe(this.slug, pedido.rol, pedido.persona);
      const archivo = join(
        CARPETA_DE_SESIONES,
        `${this.slug}-${pedido.rol}-${limpio(persona.nombre)}-${limpio(pedido.puesto)}.json`,
      );
      // `contextoDe` sólo lee `info.project.use`: el del aparato, no el del proyecto en curso.
      const infoDelAparato = { ...this.info, project: { ...this.info.project, use: propias } };
      context = await contextoDe(navegador, infoDelAparato, persona, archivo);
    }
    await prepararContexto(context, aparato);
    this.#contextos.push(context);
    const page = context.pages()[0] ?? (await context.newPage());
    if (pedido.ruta !== undefined) await page.goto(pedido.ruta);
    return { puesto: pedido.puesto, aparato, page, context };
  }

  async abrirTodos(pedidos: readonly PedidoDeAparato[]): Promise<AparatoAbierto[]> {
    // Una entrada tras otra: veinte PIN a la vez ahogan al servidor (lo aprendió el simulador).
    const abiertos: AparatoAbierto[] = [];
    for (const pedido of pedidos) abiertos.push(await this.abrir(pedido));
    return abiertos;
  }

  async cerrar(): Promise<void> {
    for (const contexto of this.#contextos) await contexto.close();
    this.#contextos.length = 0;
    for (const navegador of this.#navegadores.values()) await navegador.close();
    this.#navegadores.clear();
  }
}
