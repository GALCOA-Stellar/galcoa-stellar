import type { Idioma } from "./idioma-compartido";

/** Textos de la interfaz que existen en español e inglés (menú, portada y página para desarrolladores). */
export type Textos = {
  nav: { inicio: string; remito: string; palabras: string; prueba: string; verificar: string; guia: string; menu: string; saltar: string };
  siguiente: Record<string, string>;
  tema: { claro: string; oscuro: string };
  idioma: { etiqueta: string };
  portada: {
    sello: string; demo: string; h1: string; sub1: string; sub2: string;
    acciones: [string, string, string, string];
    cifras: [string, string, string, string];
    enVivo: string; registro: string; contrato: string; loteEjemplo: string; vigente: string; sinDato: string; verificarAhora: string; avisoDatos: string;
    h2Tercero: string; pTercero: string; btnTercero: [string, string, string, string];
    h2Como: string; pasos: [string, string][]; avisoPasos: string;
    h2NoBase: string; pNoBase: string; avisoNoBase: string;
    h2Vivo: string; avisoVivo: string; red: string; verAfuera: string; contratoExplorador: string; txRegistro: string; guiaNodo: string; pantallaCustodia: string;
    estado: string; estadoVigente: string; estadoRevocado: string; estadoArchivado: string; estadoNoFigura: string; estadoNoConsulta: string;
    quien: string; cuentasDistintas: string; custodia: string; custodiaApunta: string; custodiaNoApunta: string; depPausados: string; depHabilitados: string; desbloquea: string; desbloqueaTexto: string; noRed: string;
    h2Verificar: string; pasosVerificar: [string, string][]; btnGuia: string;
    h2Limites: string; limites: string[];
    pie: string; privacidad: string; terminos: string;
  };
  dev: {
    titulo: string; h1: string; lema: string; etiqueta: string;
    h2Da: string; da: string[]; h2Prueba: string; prueba: string[]; h2Estado: string; estado: string; inicio: string;
  };
};

const es: Textos = {
  nav: { inicio: "Inicio", remito: "Confirmar un remito", palabras: "Cargar con palabras", prueba: "Dejar la prueba", verificar: "Verificar", guia: "Guía", menu: "Menú principal", saltar: "Saltar al contenido" },
  siguiente: {
    "/agentes": "Siguiente: dejar la prueba en Stellar",
    "/demo": "Siguiente: verificar el comprobante",
    "/verificar": "Siguiente: ver cómo se usa para un pago de prueba",
    "/custodia": "Siguiente: la guía para verificarlo vos mismo",
  },
  tema: { claro: "Tema claro", oscuro: "Tema oscuro" },
  idioma: { etiqueta: "Idioma" },
  portada: {
    sello: "Construido sobre Stellar", demo: "Demo",
    h1: "El remito confirmado por quien lo recibe, con prueba que nadie puede alterar.",
    sub1: "Cargás el remito, el comercio que recibe lo confirma desde un enlace (por WhatsApp, sin crear cuenta) y queda una prueba que cualquiera puede verificar. Si hay diferencias, se avisa en el momento.",
    sub2: "Pensado para marcas y distribuidoras que hoy pagan reposición por mercadería que no pueden demostrar que entregaron. Reglas fijas revisan los datos (la IA no decide) y no se publican documentos ni datos personales. Es una demostración en red de prueba, sin dinero real.",
    acciones: ["Confirmar un remito", "Cargar con palabras", "Ver un lote ya verificado", "Verificar un comprobante"],
    cifras: ["contratos en la red de prueba", "lotes registrados", "verificaciones con el verificador independiente", "flujos de custodia de prueba"],
    enVivo: "En vivo:", registro: "registro n.º", contrato: "contrato", loteEjemplo: "lote de ejemplo:", vigente: "✔ vigente", sinDato: "sin dato", verificarAhora: "Verificar ahora",
    avisoDatos: "Datos de prueba medidos por GALCOA+ al 06/11/2026. Stellar Testnet, sin dinero real.",
    h2Tercero: "Qué puede comprobar hoy un tercero",
    pTercero: "Un tercero puede comprobar el estado del comprobante, verificar que su huella coincide y leer los eventos del contrato. Con el verificador público y cualquier nodo de Stellar no se usa infraestructura de GALCOA+; la página de verificación web es una comodidad que sí pasa por nuestro servidor.",
    btnTercero: ["Probar verificación", "Ver contrato", "Ver eventos", "Ver la custodia de prueba"],
    h2Como: "Cómo funciona",
    pasos: [
      ["Se valida fuera de cadena", "El sistema prepara el comprobante y una persona decide si aprobarlo. La IA no decide el veredicto: lo deciden reglas fijas y una persona."],
      ["Queda registrado en Stellar (red de prueba)", "El contrato exige la autorización de dos cuentas distintas (quien carga y quien aprueba) y guarda la huella y el estado del lote."],
      ["Un tercero lo verifica", "Un tercero puede verificar el comprobante sin depender de nuestro servidor, consultando a la red con la huella esperada."],
      ["La custodia de prueba reacciona al estado", "La custodia de prueba consulta ese estado y solo permite ejecutar un pago de prueba si el lote figura verificado; si se revoca, la ejecución no corresponde."],
    ],
    avisoPasos: "Esto detecta cambios en el contenido; no prueba que la mercadería exista.",
    h2NoBase: "Por qué no es una base de datos",
    pNoBase: "No usamos Stellar para guardar documentos. Usamos Stellar para publicar un estado verificable por terceros y para que otro contrato pueda tomar una acción económica de prueba basada en ese estado.",
    avisoNoBase: "En la red quedan solo huellas digitales, estados, cuentas y eventos; nunca documentos ni datos personales. En una frase: GALCOA+ convierte una validación comercial en una condición económica verificable sobre Stellar.",
    h2Vivo: "Estado en vivo, leído de la red",
    avisoVivo: "Estado leído de la red al cargar la página: red y número de registro actuales, lote de ejemplo, estado, cuentas intervinientes, custodia asociada y enlaces al explorador, la transacción y la guía de verificación.",
    red: "Red", verAfuera: "Verificarlo afuera", contratoExplorador: "contrato en el explorador", txRegistro: "transacción del registro", guiaNodo: "guía para leerlo con tu propio nodo", pantallaCustodia: "pantalla de la custodia del pago",
    estado: "Estado", estadoVigente: "✔ vigente en el registro", estadoRevocado: "revocado", estadoArchivado: "archivado: hay que restaurarlo", estadoNoFigura: "no figura (la red de prueba pudo reiniciarse)", estadoNoConsulta: "no se pudo consultar ahora",
    quien: "Quién cargó / quién aprobó", cuentasDistintas: "cuentas distintas", custodia: "Custodia de prueba", custodiaApunta: "consulta a este registro antes de pagar", custodiaNoApunta: "no apunta a este registro", depPausados: " · depósitos pausados", depHabilitados: " · depósitos habilitados",
    desbloquea: "Qué se desbloquea", desbloqueaTexto: "con el lote vigente, la custodia puede liberar un pago de prueba; si se revoca, no se paga y el dinero vuelve al pagador al vencer el plazo",
    noRed: "No pudimos consultar la red en este momento. Mirá los contratos directamente en el explorador (abajo).",
    h2Verificar: "Cómo verificarlo vos",
    pasosVerificar: [["Descargá el comprobante", "Un archivo con el contenido y su huella digital."], ["Corré el verificador público", "Si cambia un solo dato, deja de coincidir."], ["Consultá a la red", "Si el lote sigue vigente y qué cuentas intervinieron."]],
    btnGuia: "Ver la guía y descargar el ejemplo",
    h2Limites: "Estado actual y límites",
    limites: [
      "Prototipo en validación: todavía no hay clientes ni pilotos, y eso es lo que vamos a medir en el próximo sprint.",
      "Prototipo en Testnet: pagos de prueba, sin Mainnet y sin auditoría externa.",
      "La demo incluye un modo demostración avisado en pantalla con cuentas de prueba; no reemplaza la validación con dos personas reales y dos billeteras, que es el siguiente hito.",
      "Firmar y registrar un lote requiere una billetera de Stellar en una computadora; desde el celular podés probar los agentes, ver lotes ya verificados y verificar comprobantes.",
      "No reemplaza una auditoría ni dice que algo “cumple” una norma.",
    ],
    pie: "Proyecto independiente que usa la red Stellar; no cuenta con respaldo oficial de la Stellar Development Foundation.", privacidad: "Privacidad", terminos: "Términos",
  },
  dev: {
    titulo: "Para desarrolladores · GALCOA+ en Stellar",
    h1: "Verificación de datos para quienes construyen en Stellar",
    lema: "Antes de que un dato llegue a la red, que pase por reglas en código y por agentes que solo pueden frenar.",
    etiqueta: "Testnet · prototipo",
    h2Da: "Qué te da",
    da: [
      "Reglas con identificador (ALC-…) que deciden verde, amarillo o rojo. Lo rojo no se ancla nunca.",
      "Agentes con harness: instrucciones en Markdown portable; solo proponen o frenan, nunca aprueban.",
      "Defensa contra órdenes escondidas en el texto, más un chequeo cruzado en código de cada cantidad que propone el modelo.",
      "Evaluación de los agentes con casos de respuesta conocida y etiquetas congeladas.",
      "Comprobantes que cualquiera verifica sin confiar en nosotros: paquete galcoa-comprobante (sin dependencias, MIT) y guía pública.",
      "A Stellar va solo una huella de 32 bytes por lote, nunca datos personales.",
    ],
    h2Prueba: "Probalo en 10 minutos",
    prueba: [
      "Cargá una entrega con tus palabras y mirá qué proponen los agentes y qué deciden las reglas.",
      "Revisá una foto o un audio con los peritos de IA.",
      "Dejá la prueba en Stellar Testnet y verificala.",
      "Mirá el código y la guía de integración en el repositorio (docs/desarrolladores/GUIA-10-MINUTOS.md).",
    ],
    h2Estado: "Estado real",
    estado: "Prototipo en Stellar Testnet, con reglas de demostración, sin auditoría externa y sin dinero real. El paquete todavía no está publicado en npm. Pensamos esta capa para desarrolladores y builders de Stellar, y para quien suba datos a la red: es una hipótesis que estamos evaluando, todavía no validada. El primer caso de uso con el que se probó todo es el de las entregas entre empresas. Proyecto independiente, sin respaldo de la Stellar Development Foundation.",
    inicio: "Inicio",
  },
};

const en: Textos = {
  nav: { inicio: "Home", remito: "Confirm a delivery note", palabras: "Enter in plain words", prueba: "Anchor the proof", verificar: "Verify", guia: "Guide", menu: "Main menu", saltar: "Skip to content" },
  siguiente: {
    "/agentes": "Next: anchor the proof on Stellar",
    "/demo": "Next: verify the receipt",
    "/verificar": "Next: see how it is used for a test payment",
    "/custodia": "Next: the guide to verify it yourself",
  },
  tema: { claro: "Light theme", oscuro: "Dark theme" },
  idioma: { etiqueta: "Language" },
  portada: {
    sello: "Built on Stellar", demo: "Demo",
    h1: "The delivery note confirmed by whoever receives it, with proof nobody can alter.",
    sub1: "You enter the delivery note, the merchant who receives the goods confirms it from a link (sent by WhatsApp, no account needed) and a proof is left that anyone can verify. If quantities differ, you are alerted right away.",
    sub2: "Built for brands and distributors that today pay replacement costs for goods they cannot prove they delivered. Fixed rules check the data (AI does not decide), and no documents or personal data are published. This is a demonstration on a test network, with no real money.",
    acciones: ["Confirm a delivery note", "Enter in plain words", "See an already verified batch", "Verify a receipt"],
    cifras: ["contracts on the test network", "batches registered", "checks with the independent verifier", "test custody flows"],
    enVivo: "Live:", registro: "ledger no.", contrato: "contract", loteEjemplo: "sample batch:", vigente: "✔ active", sinDato: "no data", verificarAhora: "Verify now",
    avisoDatos: "Test data measured by GALCOA+ on 06/11/2026. Stellar Testnet, no real money.",
    h2Tercero: "What a third party can check today",
    pTercero: "A third party can check the receipt's status, verify that its fingerprint matches and read the contract events. With the public verifier and any Stellar node, no GALCOA+ infrastructure is used; the web verification page is a convenience that does go through our server.",
    btnTercero: ["Try verification", "View contract", "View events", "View the test custody"],
    h2Como: "How it works",
    pasos: [
      ["It is validated off-chain", "The system prepares the receipt and a person decides whether to approve it. AI does not decide the verdict: fixed rules and a person do."],
      ["It is recorded on Stellar (test network)", "The contract requires authorization from two different accounts (the loader and the approver) and stores the batch fingerprint and status."],
      ["A third party verifies it", "A third party can verify the receipt without relying on our server, by querying the network with the expected fingerprint."],
      ["The test custody reacts to the status", "The test custody reads that status and only allows a test payment if the batch is shown as verified; if it is revoked, the release is refused."],
    ],
    avisoPasos: "This detects changes in the content; it does not prove that the goods exist.",
    h2NoBase: "Why this is not a database",
    pNoBase: "We do not use Stellar to store documents. We use Stellar to publish a state that third parties can verify, and so that another contract can take a test economic action based on that state.",
    avisoNoBase: "Only fingerprints, statuses, accounts and events stay on the network; never documents or personal data. In one sentence: GALCOA+ turns a commercial validation into a verifiable economic condition on Stellar.",
    h2Vivo: "Live status, read from the network",
    avisoVivo: "Status read from the network when the page loads: current network and ledger number, sample batch, status, accounts involved, linked custody, and links to the explorer, the transaction and the verification guide.",
    red: "Network", verAfuera: "Verify it outside", contratoExplorador: "contract in the explorer", txRegistro: "registration transaction", guiaNodo: "guide to read it with your own node", pantallaCustodia: "custody payment screen",
    estado: "Status", estadoVigente: "✔ active in the registry", estadoRevocado: "revoked", estadoArchivado: "archived: it must be restored", estadoNoFigura: "not found (the test network may have been reset)", estadoNoConsulta: "could not be queried right now",
    quien: "Who loaded / who approved", cuentasDistintas: "different accounts", custodia: "Test custody", custodiaApunta: "reads this registry before paying", custodiaNoApunta: "does not point to this registry", depPausados: " · deposits paused", depHabilitados: " · deposits enabled",
    desbloquea: "What it unlocks", desbloqueaTexto: "with the batch active, the custody can release a test payment; if it is revoked, nothing is paid and the money returns to the payer when the deadline passes",
    noRed: "We could not query the network right now. Look at the contracts directly in the explorer (below).",
    h2Verificar: "How to verify it yourself",
    pasosVerificar: [["Download the receipt", "A file with the content and its fingerprint."], ["Run the public verifier", "If a single piece of data changes, it stops matching."], ["Query the network", "Whether the batch is still active and which accounts took part."]],
    btnGuia: "See the guide and download the example",
    h2Limites: "Current status and limits",
    limites: [
      "Prototype under validation: there are no customers or pilots yet, and that is what we will measure in the next sprint.",
      "Testnet prototype: test payments, no Mainnet and no external audit.",
      "The demo includes a demonstration mode, flagged on screen, with test accounts; it does not replace validation with two real people and two wallets, which is the next milestone.",
      "Signing and registering a batch requires a Stellar wallet on a computer; from a phone you can try the agents, view already verified batches and verify receipts.",
      "It does not replace an audit and does not claim that anything “complies” with a standard.",
    ],
    pie: "Independent project that uses the Stellar network; it is not officially endorsed by the Stellar Development Foundation.", privacidad: "Privacy", terminos: "Terms",
  },
  dev: {
    titulo: "For developers · GALCOA+ on Stellar",
    h1: "Data verification for people building on Stellar",
    lema: "Before data reaches the network, it goes through rules in code and agents that can only stop it.",
    etiqueta: "Testnet · prototype",
    h2Da: "What you get",
    da: [
      "Rules with an identifier (ALC-…) that decide green, yellow or red. Red is never anchored.",
      "Agents with a harness: instructions in portable Markdown; they only propose or stop, never approve.",
      "Defense against hidden instructions in the text, plus a cross-check in code of every quantity the model proposes.",
      "Evaluation of the agents with known-answer cases and frozen labels.",
      "Receipts that anyone verifies without trusting us: the galcoa-comprobante package (no dependencies, MIT) and a public guide.",
      "Only a 32-byte fingerprint per batch goes to Stellar, never personal data.",
    ],
    h2Prueba: "Try it in 10 minutes",
    prueba: [
      "Enter a delivery in your own words and see what the agents propose and what the rules decide.",
      "Check a photo or an audio recording with the AI experts.",
      "Anchor the proof on Stellar Testnet and verify it.",
      "Read the code and the integration guide in the repository (docs/desarrolladores/GUIA-10-MINUTOS.md).",
    ],
    h2Estado: "Real status",
    estado: "Prototype on Stellar Testnet, with demonstration rules, no external audit and no real money. The package is not published on npm yet. We think of this layer for developers and builders on Stellar, and for anyone who uploads data to the network: this is a hypothesis we are evaluating and have not validated. The first use case we tested everything on is deliveries between companies. Independent project, not endorsed by the Stellar Development Foundation.",
    inicio: "Home",
  },
};

export const TEXTOS: Record<Idioma, Textos> = { es, en };
