'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@morphiqpos/ui/primitivas/alert-dialog';
import { Dinero } from '@morphiqpos/ui/sistema';

/**
 * «LA MESA 5 TIENE GENTE Y UN PEDIDO DE $480.00. ¿UNIR DE TODOS MODOS?» (DP-12.3). Unir una mesa
 * ocupada junta las cuentas (y su carrito del portal, y sus alergias y su celebración) en la que
 * queda: se pregunta antes. Sin el importe a la mano —el rol no lo lee—, se dice sin él.
 */

export interface MesaOcupada {
  readonly numero: number;
  /** `null`: la mesa tiene gente pero no se pudo leer (o no tiene) cuenta. */
  readonly totalCentavos: number | null;
}

export function AvisoDeMesasOcupadas({
  ocupadas,
  alCancelar,
  alUnir,
}: {
  readonly ocupadas: readonly MesaOcupada[] | null;
  readonly alCancelar: () => void;
  readonly alUnir: () => void;
}) {
  return (
    <AlertDialog
      open={ocupadas !== null}
      onOpenChange={(abierto) => {
        if (!abierto) alCancelar();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Unir de todos modos?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-(--espacio-1)">
              {(ocupadas ?? []).map((m) => (
                <p key={m.numero}>
                  La Mesa {m.numero} tiene gente
                  {m.totalCentavos === null ? null : (
                    <>
                      {' '}
                      y un pedido de <Dinero centavos={m.totalCentavos} />
                    </>
                  )}
                  .
                </p>
              ))}
              <p>Las cuentas se juntan en la mesa que quede, con sus alergias y su celebración.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              alUnir();
            }}
          >
            Unir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
