/**
 * Memoria corta para lecturas a la red de prueba (solo lectura, datos públicos): cada visita a la portada o a /custodia
 * tardaba 5 a 9 segundos porque leía la red desde cero. Con esto, dentro de `ttl` se reutiliza la lectura; pasado `ttl`
 * se entrega lo guardado al instante y se actualiza por detrás; pasado `maxEdad` se espera una lectura nueva.
 * Un fallo (null) no se guarda. Es memoria de cada instancia del servidor: sirve para repeticiones, no reemplaza la red.
 */
import "server-only";
const memoria = new Map<string, { t: number; v: unknown }>();
const enCurso = new Map<string, Promise<unknown>>();

export const vaciarCache = () => { memoria.clear(); enCurso.clear(); };

export async function conCache<T>(clave: string, ttl: number, maxEdad: number, leer: () => Promise<T>): Promise<T> {
  const refrescar = (): Promise<T> => {
    let p = enCurso.get(clave) as Promise<T> | undefined;
    if (!p) {
      p = leer().then((v) => { if (v !== null && v !== undefined) memoria.set(clave, { t: Date.now(), v }); return v; }).finally(() => enCurso.delete(clave));
      enCurso.set(clave, p);
    }
    return p;
  };
  const guardado = memoria.get(clave);
  if (guardado) {
    const edad = Date.now() - guardado.t;
    if (edad <= ttl) return guardado.v as T;
    if (edad <= maxEdad) { refrescar().catch(() => {}); return guardado.v as T; }
  }
  return refrescar();
}
