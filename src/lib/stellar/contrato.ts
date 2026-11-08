import { Account, Address, BASE_FEE, Contract, Keypair, Networks, Operation, StrKey, Transaction, TransactionBuilder, authorizeEntry, nativeToScVal, rpc, scValToNative } from "@stellar/stellar-sdk";
import { conCache } from "../servidor/cache-corto";
import { ESCROW_ID, ESCROW_DESDE_LEDGER, RPC_URL } from "../config/contratos";

/**
 * Contrato `registro-lotes` (Soroban, testnet): guarda la huella de cada lote con quién lo cargó y quién lo aprobó.
 * La red exige la autorización de DOS direcciones distintas para registrar. Aquí se lee (para el verificador) y,
 * solo en modo demostración, se registra con claves de prueba del servidor.
 */
const servidor = () => new rpc.Server(RPC_URL);

export const contratoId = (): string | null => {
  const c = process.env.CONTRATO_REGISTRO_ID?.trim();
  return c && StrKey.isValidContract(c) ? c : null;
};

/** `registrado` = alguna vez se registró (vigente o revocado). `archivado`: el dato existe pero venció su vida en la red y hay que restaurarlo. */
export type EstadoRegistro = "vigente" | "revocado" | "archivado" | "no-figura";
export type RegistroContrato = {
  registrado: boolean; estado: EstadoRegistro; cargador?: string; aprobador?: string; ledger?: number; contrato: string;
  motivoHash?: string; revocadoPor?: string; ledgerRevocacion?: number;
};

const hex = (b: unknown) => Buffer.from(b as Uint8Array).toString("hex");

/**
 * Traduce el resultado de simular `obtener`. Distingue cuatro cosas que NO son lo mismo:
 * vigente, revocado, archivado (venció y se puede restaurar) y no figura (error #3 del contrato).
 * Cualquier otro fallo devuelve null ("no se pudo consultar"): nunca se convierte en un falso "no figura".
 */
export function interpretarSimulacion(sim: rpc.Api.SimulateTransactionResponse, contrato: string): RegistroContrato | null {
  // La red avisa que hay que restaurar con `restorePreamble` (puede venir junto con un error): eso gana sobre cualquier otro resultado.
  if ((sim as { restorePreamble?: { transactionData?: unknown } }).restorePreamble?.transactionData) return { registrado: true, estado: "archivado", contrato };
  if (rpc.Api.isSimulationError(sim)) return /Error\(Contract, #3\)/.test(String(sim.error)) ? { registrado: false, estado: "no-figura", contrato } : null;
  if (!sim.result) return null;
  const r = scValToNative(sim.result.retval) as { cargador: string; aprobador: string; ledger: number; estado: string | string[]; motivo_hash: Uint8Array; revocado_por?: string | null; ledger_revocacion: number };
  const revocado = (Array.isArray(r.estado) ? r.estado[0] : r.estado) === "Revocado";
  return {
    registrado: true, estado: revocado ? "revocado" : "vigente", cargador: r.cargador, aprobador: r.aprobador, ledger: r.ledger, contrato,
    ...(revocado ? { motivoHash: hex(r.motivo_hash), revocadoPor: r.revocado_por ?? undefined, ledgerRevocacion: r.ledger_revocacion } : {}),
  };
}

/** Cuenta que existe en la red, usada solo como origen para simular lecturas (no firma ni paga nada). */
function origenDeLectura(): string | null {
  const g = process.env.CUENTA_SELLADORA_2DE2?.trim();
  if (g && StrKey.isValidEd25519PublicKey(g)) return g;
  const s = process.env.SELLADOR_STELLAR_SECRETO;
  try { return s ? Keypair.fromSecret(s).publicKey() : null; } catch { return null; }
}

const bytes32 = (hex: string) => nativeToScVal(Buffer.from(hex, "hex"), { type: "bytes" });

/** Consulta el contrato (solo lectura). Devuelve null si el contrato no está configurado o no se pudo consultar. */
export async function consultarRegistro(memoHex: string): Promise<RegistroContrato | null> {
  const id = contratoId(), origen = origenDeLectura();
  if (!id || !origen || !/^[0-9a-f]{64}$/.test(memoHex)) return null;
  try {
    const s = servidor();
    const tx = new TransactionBuilder(await s.getAccount(origen), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
      .addOperation(new Contract(id).call("obtener", bytes32(memoHex))).setTimeout(30).build();
    const sim = await s.simulateTransaction(tx);
    return interpretarSimulacion(sim, id);
  } catch {
    return null;
  }
}

/** MODO DEMOSTRACIÓN: registra el lote en el contrato firmando las dos autorizaciones con las claves de prueba del servidor. */
export async function registrarConClavesDeDemo(memoHex: string): Promise<{ txHash: string; ledger: number; comisionStroops: number }> {
  const id = contratoId();
  const c = process.env.DEMO_SECRETO_CARGADOR, a = process.env.DEMO_SECRETO_APROBADOR;
  if (!id || !c || !a) throw new Error("Falta configurar el contrato o las claves de demostración");
  const cargador = Keypair.fromSecret(c), aprobador = Keypair.fromSecret(a);
  const s = servidor();
  const servicio = pagador(); // el contrato exige la autorización del servicio: como es el origen de la transacción, la da su firma
  const base = new TransactionBuilder(await s.getAccount(servicio.publicKey()), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(id).call("registrar", bytes32(memoHex), new Address(cargador.publicKey()).toScVal(), new Address(aprobador.publicKey()).toScVal()))
    .setTimeout(120).build();
  const sim = await s.simulateTransaction(base);
  if (!rpc.Api.isSimulationSuccess(sim)) throw new Error("El contrato rechazó el registro (¿ya estaba registrado?)");
  const armada = rpc.assembleTransaction(base, sim).build();
  const hasta = (await s.getLatestLedger()).sequence + 100;
  const op = armada.operations[0] as unknown as { func: never; auth?: Parameters<typeof authorizeEntry>[0][] };
  const firmadas = [];
  for (const e of op.auth ?? []) {
    if (e.credentials.type === "sorobanCredentialsSourceAccount") { firmadas.push(e); continue; }
    const quien = Address.fromScAddress((e.credentials as unknown as { value: { address: never } }).value.address).toString();
    firmadas.push(await authorizeEntry(e, quien === aprobador.publicKey() ? aprobador : cargador, hasta, Networks.TESTNET));
  }
  const final = new TransactionBuilder(await s.getAccount(servicio.publicKey()), { fee: armada.fee, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.invokeHostFunction({ func: op.func, auth: firmadas }))
    .setSorobanData(sim.transactionData.build()).setTimeout(120).build();
  final.sign(servicio);
  const envio = await s.sendTransaction(final);
  if (envio.status === "ERROR") throw new Error("Stellar rechazó el registro");
  for (let i = 0; i < 30; i++) {
    const r = await s.getTransaction(envio.hash);
    if (r.status === "SUCCESS") return { txHash: envio.hash, ledger: r.ledger, comisionStroops: Number(r.resultXdr.toXdrObject().feeCharged) };
    if (r.status === "FAILED") throw new Error("El contrato rechazó el registro");
    await new Promise((ok) => setTimeout(ok, 1500));
  }
  throw new Error("La red no confirmó a tiempo");
}

// ---- Registro con la firma de cada persona (billetera): el servidor arma, cada persona firma su autorización, el servidor envía ----

export type DatosRegistro = { txXdr: string; hasta: number; memo: string; cargador: string; aprobador: string };
export type PorFirmar = { cuenta: string; preimage: string };
type Entrada = Parameters<typeof authorizeEntry>[0];
const CAPTURADO = "texto-a-firmar-capturado";

/** Cuenta que paga la comisión y envía (el servicio). Nunca firma por las personas. */
function pagador(): Keypair {
  const s = process.env.SELLADOR_STELLAR_SECRETO;
  if (!s) throw new Error("Falta configurar la cuenta del servicio");
  return Keypair.fromSecret(s);
}
const cuentaDe = (e: Entrada): string => Address.fromScAddress((e.credentials as unknown as { value: { address: never } }).value.address).toString();

/** Simula el registro y devuelve, para cada persona, el texto exacto que su billetera debe firmar. */
export async function prepararRegistro(memoHex: string, cargador: string, aprobador: string): Promise<{ datos: DatosRegistro; porFirmar: PorFirmar[] }> {
  const id = contratoId();
  if (!id) throw new Error("Falta configurar el contrato");
  if (!StrKey.isValidEd25519PublicKey(cargador) || !StrKey.isValidEd25519PublicKey(aprobador) || cargador === aprobador) throw new Error("Hacen falta dos cuentas distintas");
  const s = servidor();
  const base = new TransactionBuilder(await s.getAccount(pagador().publicKey()), { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(id).call("registrar", bytes32(memoHex), new Address(cargador).toScVal(), new Address(aprobador).toScVal()))
    .setTimeout(900).build();
  const sim = await s.simulateTransaction(base);
  if (!rpc.Api.isSimulationSuccess(sim)) throw new Error("El contrato rechazó el registro (¿ya estaba registrado?)");
  const armada = rpc.assembleTransaction(base, sim).build();
  const hasta = (await s.getLatestLedger()).sequence + 300; // unos 25 minutos para juntar las firmas
  const porFirmar: PorFirmar[] = [];
  const op = armada.operations[0] as unknown as { auth?: Entrada[] };
  for (const e of op.auth ?? []) {
    if (e.credentials.type === "sorobanCredentialsSourceAccount") continue;
    const cuenta = cuentaDe(e);
    try {
      await authorizeEntry(e, async (preimage) => {
        porFirmar.push({ cuenta, preimage: preimage.toXdr("base64") });
        throw new Error(CAPTURADO); // solo se necesita el texto a firmar: se corta aquí
      }, hasta, Networks.TESTNET, cuenta);
    } catch (err) {
      if (!(err instanceof Error) || !err.message.includes(CAPTURADO)) throw err;
    }
  }
  return { datos: { txXdr: armada.toXDR(), hasta, memo: memoHex, cargador, aprobador }, porFirmar };
}

/** Pone las firmas de las personas en sus autorizaciones, firma como servicio (origen y comisión) y envía. */
export async function enviarRegistro(d: DatosRegistro, firmas: { cuenta: string; firma: string }[]): Promise<{ txHash: string; ledger: number; comisionStroops: number }> {
  const s = servidor();
  const original = TransactionBuilder.fromXDR(d.txXdr, Networks.TESTNET) as Transaction;
  const op = original.operations[0] as unknown as { func: never; auth?: Entrada[] };
  const firmadas: Entrada[] = [];
  for (const e of op.auth ?? []) {
    if (e.credentials.type === "sorobanCredentialsSourceAccount") { firmadas.push(e); continue; }
    const cuenta = cuentaDe(e);
    const dada = firmas.find((f) => f.cuenta === cuenta);
    if (!dada) throw new Error(`Falta la firma de ${cuenta.slice(0, 6)}…`);
    firmadas.push(await authorizeEntry(e, async (_pre, payload) => {
      const bytes = Buffer.from(dada.firma, "base64");
      if (bytes.length !== 64 || !Keypair.fromPublicKey(cuenta).verify(Buffer.from(payload), bytes)) throw new Error(`La firma de ${cuenta.slice(0, 6)}… no es válida`);
      return { signature: bytes, publicKey: cuenta };
    }, d.hasta, Networks.TESTNET, cuenta));
  }
  const ext = (original.toEnvelope() as unknown as { value: { tx: { ext: { type: string; value: { resourceFee: bigint } } } } }).value.tx.ext;
  if (ext.type !== "sorobanData") throw new Error("La transacción preparada no tiene los recursos del contrato");
  const inclusion = Math.max(Number(BASE_FEE), Number(original.fee) - Number(ext.value.resourceFee)); // la comisión de inclusión original; el constructor suma los recursos
  const final = new TransactionBuilder(new Account(original.source, (BigInt(original.sequence) - 1n).toString()), { fee: String(inclusion), networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.invokeHostFunction({ func: op.func, auth: firmadas }))
    .setSorobanData(ext.value as unknown as Parameters<TransactionBuilder["setSorobanData"]>[0]).setTimeout(900).build();
  final.sign(pagador());
  const envio = await s.sendTransaction(final);
  if (envio.status === "ERROR") {
    console.error("sendTransaction:", JSON.stringify(envio.errorResult?.toXdrObject(), (_k, v) => (typeof v === "bigint" ? String(v) : v)));
    throw new Error("Stellar rechazó el registro");
  }
  for (let i = 0; i < 30; i++) {
    const r = await s.getTransaction(envio.hash);
    if (r.status === "SUCCESS") return { txHash: envio.hash, ledger: r.ledger, comisionStroops: Number(r.resultXdr.toXdrObject().feeCharged) };
    if (r.status === "FAILED") throw new Error("El contrato rechazó el registro");
    await new Promise((ok) => setTimeout(ok, 1500));
  }
  throw new Error("La red no confirmó a tiempo");
}

/**
 * ¿Este lote ya fue "consumido" por un pago de la custodia? Se lee de los eventos `liberado` / `reembolsado` del escrow
 * (la red conserva unos 7 días de eventos). Devuelve null si no se pudo consultar: nunca se inventa un "no consumido".
 */
export type ConsumoEscrow = { estado: "liberado" | "reembolsado" | "sin-pagos-recientes"; ledger?: number };
let cacheConsumo: { t: number; eventos: { accion: string; huella: string; ledger: number }[] } | null = null;
/** La custodia v3 se creó cerca de este ledger: antes no hay eventos suyos, así que no se escanea más atrás. */

/** Nunca demora la verificación: si la red tarda, se responde "no se pudo consultar" y la verificación sigue. */
export function consultarConsumo(memoHex: string): Promise<ConsumoEscrow | null> {
  return Promise.race([leerConsumo(memoHex), new Promise<null>((r) => setTimeout(() => r(null), 6000))]);
}
async function leerConsumo(memoHex: string): Promise<ConsumoEscrow | null> {
  const escrow = ESCROW_ID; // solo la constante de config/contratos.ts: una variable de entorno vieja no puede apuntar a otra custodia
  if (!/^[0-9a-f]{64}$/.test(memoHex)) return null;
  try {
    if (!cacheConsumo || Date.now() - cacheConsumo.t > 60_000) {
      const s = servidor();
      const ult = (await s.getLatestLedger()).sequence;
      const eventos: { accion: string; huella: string; ledger: number }[] = [];
      let cursor: string | undefined;
      for (let pagina = 0; pagina < 20; pagina++) {
        const r = await s.getEvents(cursor
          ? { cursor, filters: [{ type: "contract", contractIds: [escrow] }], limit: 200 }
          : { startLedger: Math.max(ult - 120_000, ESCROW_DESDE_LEDGER), filters: [{ type: "contract", contractIds: [escrow] }], limit: 200 });
        for (const e of r.events) {
          const nombre = String(scValToNative(e.topic[0]));
          if (nombre !== "liberado" && nombre !== "reembolsado") continue;
          const d = scValToNative(e.value) as { huella?: Uint8Array };
          if (d?.huella) eventos.push({ accion: nombre, huella: hex(d.huella), ledger: e.ledger });
        }
        if (r.events.length === 0 && r.cursor === cursor) break;
        if (r.latestLedger && e_fin(r, ult)) break;
        cursor = r.cursor;
      }
      cacheConsumo = { t: Date.now(), eventos };
    }
    const hit = cacheConsumo.eventos.find((e) => e.huella === memoHex);
    return hit ? { estado: hit.accion as "liberado" | "reembolsado", ledger: hit.ledger } : { estado: "sin-pagos-recientes" };
  } catch {
    return null;
  }
}
// Termina de paginar cuando el cursor ya pasó el último ledger conocido.
function e_fin(r: { cursor: string; latestLedger: number }, _ult: number): boolean {
  const ledgerDelCursor = Number(BigInt(r.cursor.split("-")[0]) >> BigInt(32));
  return ledgerDelCursor >= r.latestLedger;
}

/** Historial de la custodia leído de sus eventos (solo lectura, con tope de tiempo). Para la pantalla /custodia. */
export type EventoCustodia = { accion: "depositado" | "liberado" | "reembolsado"; ledger: number; cierre: string; huella: string; monto: string; tx: string };
export const listarEventosCustodia = (): Promise<EventoCustodia[] | null> => conCache("eventos-custodia", 30_000, 300_000, listarEventosDeLaRed);
async function listarEventosDeLaRed(): Promise<EventoCustodia[] | null> {
  const escrow = ESCROW_ID; // solo la constante de config/contratos.ts: una variable de entorno vieja no puede apuntar a otra custodia
  const leer = async (): Promise<EventoCustodia[]> => {
    const s = servidor();
    const ult = (await s.getLatestLedger()).sequence;
    const out: EventoCustodia[] = [];
    let cursor: string | undefined;
    for (let pagina = 0; pagina < 20; pagina++) {
      const filtros = [{ type: "contract" as const, contractIds: [escrow] }];
      const r = await s.getEvents(cursor ? { cursor, filters: filtros, limit: 200 } : { startLedger: Math.max(ult - 120_000, ESCROW_DESDE_LEDGER), filters: filtros, limit: 200 });
      for (const e of r.events) {
        const n = String(scValToNative(e.topic[0]));
        if (n !== "depositado" && n !== "liberado" && n !== "reembolsado") continue;
        const d = scValToNative(e.value) as { huella?: Uint8Array; monto?: bigint | number };
        if (d?.huella) out.push({ accion: n, ledger: e.ledger, cierre: e.ledgerClosedAt, huella: hex(d.huella), monto: String(d.monto ?? ""), tx: e.txHash });
      }
      if (e_fin(r, ult) || (r.events.length === 0 && r.cursor === cursor)) break;
      cursor = r.cursor;
    }
    return out;
  };
  try { return await Promise.race([leer(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("tiempo")), 8000))]); } catch { return null; }
}
