import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-15 · CAMBIAR DE MESA, UNIR Y DIVIDIR SE ALCANZAN DESDE EL MAPA (M6 de la auditoría 1).
 *
 * Esas acciones viven en «Mesa activa» (`/restaurante/mesa-activa`), y al gerente y al dueño sólo se
 * llegaba tecleando la dirección: su menú abre `/mesero`, sin esos botones. El panel de la mesa del
 * mapa tiene ahora el enlace, sólo para quien la ruta deja pasar (al mesero y a la cajera los regresa).
 *
 * DP-21 · Bloque 10 (M24): «Cambiar de mesa» ya no saca del mapa: abre ahí mismo el panel de las
 * mesas libres (`CambiarDeMesaAqui`) y avisa «La cuenta pasó a la mesa 7». A «Mesa activa» sólo
 * lleva el enlace «Unir o dividir la cuenta», y sólo lo ve quien ahí puede hacerlo.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');

describe('DP-15 · mover la cuenta desde el mapa', () => {
  it('el panel de la mesa ofrece «Cambiar de mesa» a quien la regla de puede-mover-la-cuenta deja, sin salir del mapa', () => {
    const c = readFileSync(join(RAIZ_WEB, 'heredado', 'pages', 'Mesero.jsx'), 'utf8')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\s+/g, '');
    // DP-15.1: la lista fija de tres puestos se fue; ahora decide la función pura, que además
    // abre el enlace al mesero en las mesas que él atiende.
    expect(c).not.toContain('PUEDEN_MOVER_LA_CUENTA');
    // DP-22: la regla se calcula UNA vez (`puedeCambiarDeMesaAqui`) y la usan el panel de la tableta y la
    // hoja del teléfono (`MeseroCartFAB`).
    expect(c).toContain(
      'constpuedeCambiarDeMesaAqui=Boolean(ventaActiva&&mesaActiva?.id&&puedeMoverLaCuenta({puesto:miPuesto,yoId:posUser?.id,atiendeId:resolverMeseroResponsable(mesaActiva,config)?.id,unida:Boolean(mesaActiva.unida_a_mesa_id)||(mesas||[]).some((m)=>m.unida_a_mesa_id===mesaActiva.id),}),);',
    );
    expect(c).toContain('{puedeCambiarDeMesaAqui&&(');
    // DP-21 · Bloque 10: el botón abre el panel AQUÍ; no es un enlace a otra pantalla.
    expect(c).toContain(
      '<Buttonvariant="outline"className="w-full"onClick={()=>setCambiandoDeMesa(true)}><ArrowLeftRightclassName="w-4h-4mr-1"/>Cambiardemesa</Button>',
    );
    // Y el panel usa el comando de siempre con ESTA cuenta y ESTA mesa, avisa y cierra sin navegar.
    expect(c).toContain(
      '{cambiandoDeMesa&&ventaActiva?.id&&mesaActiva?.id&&(<CambiarDeMesaAquimesa={{id:mesaActiva.id,numero:Number(mesaActiva.numero),zona:mesaActiva.zona??null,}}ordenId={ventaActiva.id}',
    );
    expect(c).toContain(
      "setCambiandoDeMesa(false);toast.success(avisoDelCambio(destino.numero));cerrarDialog();queryClient.invalidateQueries({queryKey:['mesas']});",
    );
  });

  it('unir y dividir siguen en «Mesa activa», con un enlace que dice lo que hace y sólo para la dirección', () => {
    const c = readFileSync(join(RAIZ_WEB, 'heredado', 'pages', 'Mesero.jsx'), 'utf8')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\/[^\n]*\n/g, '')
      .replace(/\s+/g, '');
    // DP-18 (A15): un solo control. El botón ES el enlace (`asChild`), ya no un botón dentro de él.
    expect(c).toContain(
      '{puedeUnirODividir(miPuesto)&&(<ButtonasChildvariant="link"className="w-full"><Linkto={`/restaurante/mesa-activa?mesa=${mesaActiva.id}`}>Unirodividirlacuenta</Link></Button>)}',
    );
    // El único camino a «Mesa activa» desde el panel es ése.
    expect(c.split('/restaurante/mesa-activa?mesa=').length - 1).toBe(1);
  });

  it('el panel pregunta antes de pasar y manda la cuenta por `restaurante.cambiar_mesa`', () => {
    const panel = readFileSync(
      join(RAIZ_WEB, 'src', 'restaurante', 'CambiarDeMesaAqui.tsx'),
      'utf8',
    ).replace(/\s+/g, '');
    expect(panel).toContain(
      "invocarComando('/api/restaurante/cambiar-mesa',{ordenId,mesaDestinoId:destino.id,mesaOrigenId:mesa.id,})",
    );
    expect(panel).toContain('preguntaDelCambio(mesa.numero,elegida.numero)');
    // Sin la pregunta no se pasa: tocar una mesa sólo la elige.
    const toques = panel.split('alTocar={').length - 1;
    expect(toques).toBeGreaterThanOrEqual(2);
    expect(panel.split('alTocar={setElegida}').length - 1).toBe(toques);
    // «Pasar» es el único que manda la cuenta: su definición y una sola llamada.
    expect(panel.split('pasar(').length - 1).toBe(2);
    // Y no navega: quien decide a dónde ir es la pantalla que lo abrió.
    expect(panel).not.toContain('useRouter');
  });
});
