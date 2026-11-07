/**
 * Una cola de uno en uno (DP-14, ronda 2).
 *
 * El mesero toca dos platillos con opciones casi a la vez. Cada uno abre su diálogo de
 * personalización, pero la pantalla sólo tiene UNO: el segundo sustituía al primero y el primer
 * platillo se perdía sin que nadie lo notara. Aquí el que llega mientras otro se atiende espera su
 * turno; al terminar el actual, el siguiente se abre. Nada se pisa y nada se pierde.
 */
export class ColaDeUnoEnUno<T> {
  /** El que se está atendiendo ahora, o `null`. */
  actual: T | null = null;
  private pendientes: T[] = [];

  /** Llega uno. `true` si es el actual (hay que abrirlo ya); `false` si quedó esperando. */
  llegar(elemento: T): boolean {
    if (this.actual !== null) {
      this.pendientes.push(elemento);
      return false;
    }
    this.actual = elemento;
    return true;
  }

  /** Termina el actual (confirmado o cerrado). Devuelve el siguiente, o `null` si no hay. */
  terminar(): T | null {
    this.actual = this.pendientes.shift() ?? null;
    return this.actual;
  }
}
