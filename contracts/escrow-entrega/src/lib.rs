#![no_std]
//! Pago condicionado a una entrega verificada (PROTOTIPO DE TESTNET, sin dinero real).
//! El pagador deja un monto en custodia; se libera al beneficiario solo si el contrato de registro de GALCOA+
//! tiene registrada la huella del lote. Si la huella nunca aparece y vence el plazo, el monto vuelve al pagador.
//! Reglas: el contrato de registro queda FIJO al crear el escrow; la clave del trato incluye al pagador (nadie
//! puede ocupar un trato ajeno); si la huella ya está verificada, el reembolso no corre: solo se puede liberar.
use soroban_sdk::{contract, contractclient, contracterror, contractevent, contractimpl, contracttype, token, Address, BytesN, Env, Vec};
use stellar_access::ownable;
use stellar_contract_utils::pausable;

const TTL_MAXIMO: u32 = 518_400; // ~30 días
const TTL_UMBRAL: u32 = 432_000;

/// Lo único que este contrato necesita saber del contrato de registro.
#[contractclient(name = "RegistroClient")]
pub trait Registro {
    fn existe(env: Env, huella: BytesN<32>) -> bool;
}

/// IMPORTANTE: estas claves son el formato en disco. Las variantes nuevas se agregan SIEMPRE AL FINAL;
/// insertar una en el medio renumera las siguientes y deja huérfanos los datos ya guardados.
#[contracttype]
enum Clave {
    Registro,
    Trato(BytesN<32>, Address), // (id del trato, pagador)
    Historial(BytesN<32>, Address),
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Accion {
    Depositado,
    Liberado,
    Reembolsado,
}

/// Línea del historial de un trato. Solo se agregan líneas, nunca se editan ni se borran.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Evento {
    pub accion: Accion,
    pub monto: i128,
    pub ledger: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Trato {
    pub pagador: Address,
    pub beneficiario: Address,
    pub token: Address,
    pub monto: i128,
    pub huella: BytesN<32>,
    pub vence_ledger: u32,
    pub liquidado: bool,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    YaExiste = 1,
    NoExiste = 2,
    NoVerificada = 3,
    NoVencio = 4,
    YaLiquidado = 5,
    MontoInvalido = 6,
    PlazoInvalido = 7,
    YaVerificada = 8,
    Pausado = 9,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Depositado {
    pub trato: BytesN<32>,
    pub pagador: Address,
    pub beneficiario: Address,
    pub monto: i128,
    pub huella: BytesN<32>,
}
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Liberado {
    pub trato: BytesN<32>,
    pub pagador: Address,
    pub beneficiario: Address,
    pub monto: i128,
    pub huella: BytesN<32>,
}
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Reembolsado {
    pub trato: BytesN<32>,
    pub pagador: Address,
    pub monto: i128,
    pub huella: BytesN<32>,
}

#[contract]
pub struct EscrowEntrega;

fn leer(env: &Env, id: &BytesN<32>, pagador: &Address) -> Result<Trato, Error> {
    env.storage().persistent().get(&Clave::Trato(id.clone(), pagador.clone())).ok_or(Error::NoExiste)
}
fn guardar(env: &Env, id: &BytesN<32>, pagador: &Address, t: &Trato) {
    let k = Clave::Trato(id.clone(), pagador.clone());
    env.storage().persistent().set(&k, t);
    env.storage().persistent().extend_ttl(&k, TTL_UMBRAL, TTL_MAXIMO);
}
fn anotar(env: &Env, id: &BytesN<32>, pagador: &Address, accion: Accion, monto: i128) {
    let k = Clave::Historial(id.clone(), pagador.clone());
    let mut h: Vec<Evento> = env.storage().persistent().get(&k).unwrap_or(Vec::new(env));
    h.push_back(Evento { accion, monto, ledger: env.ledger().sequence() });
    env.storage().persistent().set(&k, &h);
    env.storage().persistent().extend_ttl(&k, TTL_UMBRAL, TTL_MAXIMO);
}
fn esta_pausado(env: &Env) -> bool {
    pausable::paused(env)
}

#[contractimpl]
impl EscrowEntrega {
    /// Fija el contrato de registro y quién puede pausar depósitos nuevos. Nadie puede cambiar el registro después ni elegir otro al depositar.
    /// `admin` solo puede pausar y reanudar DEPÓSITOS NUEVOS: no puede mover ni retener dinero ya depositado, ni cambiar el código.
    /// Recomendación para mainnet: que `admin` sea una cuenta multifirma, no una clave sola.
    pub fn __constructor(env: Env, registro: Address, admin: Address) {
        env.storage().instance().set(&Clave::Registro, &registro);
        ownable::set_owner(&env, &admin);
        env.storage().instance().extend_ttl(TTL_UMBRAL, TTL_MAXIMO);
    }

    pub fn admin(env: Env) -> Address {
        ownable::get_owner(&env).unwrap()
    }

    /// Propone un nuevo administrador. El cambio NO se hace hasta que el nuevo lo acepte antes de `vence_ledger`
    /// (si no acepta a tiempo, la propuesta caduca). Evita dejar el control en una dirección equivocada. Firma el administrador actual.
    pub fn transferir_administracion(env: Env, nuevo: Address, vence_ledger: u32) {
        ownable::transfer_ownership(&env, &nuevo, vence_ledger);
    }

    /// El administrador propuesto acepta. Firma él.
    pub fn aceptar_administracion(env: Env) {
        ownable::accept_ownership(&env);
    }

    pub fn pausado(env: Env) -> bool {
        esta_pausado(&env)
    }

    /// Frena los depósitos nuevos (por ejemplo, ante un problema en el contrato de registro). Liberar y reembolsar SIGUEN funcionando:
    /// una pausa nunca deja plata atrapada.
    pub fn pausar(env: Env) {
        ownable::enforce_owner_auth(&env);
        pausable::pause(&env);
    }

    pub fn reanudar(env: Env) {
        ownable::enforce_owner_auth(&env);
        pausable::unpause(&env);
    }

    /// Historial de un trato (solo se agrega, nunca se edita).
    pub fn historial(env: Env, id: BytesN<32>, pagador: Address) -> Vec<Evento> {
        env.storage().persistent().get(&Clave::Historial(id, pagador)).unwrap_or(Vec::new(&env))
    }

    pub fn registro(env: Env) -> Address {
        env.storage().instance().get(&Clave::Registro).unwrap()
    }

    /// El pagador deja `monto` en custodia. Firma él. `vence_ledger` debe estar en el futuro.
    pub fn depositar(env: Env, id: BytesN<32>, pagador: Address, beneficiario: Address, token: Address, monto: i128, huella: BytesN<32>, vence_ledger: u32) -> Result<(), Error> {
        if esta_pausado(&env) {
            return Err(Error::Pausado);
        }
        if monto <= 0 {
            return Err(Error::MontoInvalido);
        }
        if vence_ledger <= env.ledger().sequence() {
            return Err(Error::PlazoInvalido);
        }
        pagador.require_auth();
        if env.storage().persistent().has(&Clave::Trato(id.clone(), pagador.clone())) {
            return Err(Error::YaExiste);
        }
        token::Client::new(&env, &token).transfer(&pagador, &env.current_contract_address(), &monto);
        let t = Trato { pagador: pagador.clone(), beneficiario: beneficiario.clone(), token, monto, huella: huella.clone(), vence_ledger, liquidado: false };
        guardar(&env, &id, &pagador, &t);
        anotar(&env, &id, &pagador, Accion::Depositado, monto);
        env.storage().instance().extend_ttl(TTL_UMBRAL, TTL_MAXIMO);
        Depositado { trato: id, pagador, beneficiario, monto, huella }.publish(&env);
        Ok(())
    }

    /// Libera al beneficiario si la huella está registrada. Cualquiera puede llamarla; el dinero solo va al beneficiario.
    pub fn liberar(env: Env, id: BytesN<32>, pagador: Address) -> Result<(), Error> {
        let mut t = leer(&env, &id, &pagador)?;
        if t.liquidado {
            return Err(Error::YaLiquidado);
        }
        let registro: Address = env.storage().instance().get(&Clave::Registro).unwrap();
        if !RegistroClient::new(&env, &registro).existe(&t.huella) {
            return Err(Error::NoVerificada);
        }
        t.liquidado = true; // se marca ANTES de mover el dinero
        guardar(&env, &id, &pagador, &t);
        anotar(&env, &id, &pagador, Accion::Liberado, t.monto);
        env.storage().instance().extend_ttl(TTL_UMBRAL, TTL_MAXIMO);
        token::Client::new(&env, &t.token).transfer(&env.current_contract_address(), &t.beneficiario, &t.monto);
        Liberado { trato: id, pagador, beneficiario: t.beneficiario, monto: t.monto, huella: t.huella }.publish(&env);
        Ok(())
    }

    /// Devuelve el monto al pagador cuando venció el plazo y la huella NUNCA se verificó. Cualquiera puede llamarla;
    /// el dinero solo vuelve al pagador. Si la huella ya está verificada, solo corresponde liberar.
    pub fn reembolsar(env: Env, id: BytesN<32>, pagador: Address) -> Result<(), Error> {
        let mut t = leer(&env, &id, &pagador)?;
        if t.liquidado {
            return Err(Error::YaLiquidado);
        }
        if env.ledger().sequence() <= t.vence_ledger {
            return Err(Error::NoVencio);
        }
        let registro: Address = env.storage().instance().get(&Clave::Registro).unwrap();
        if RegistroClient::new(&env, &registro).existe(&t.huella) {
            return Err(Error::YaVerificada);
        }
        t.liquidado = true;
        guardar(&env, &id, &pagador, &t);
        anotar(&env, &id, &pagador, Accion::Reembolsado, t.monto);
        env.storage().instance().extend_ttl(TTL_UMBRAL, TTL_MAXIMO);
        token::Client::new(&env, &t.token).transfer(&env.current_contract_address(), &t.pagador, &t.monto);
        Reembolsado { trato: id, pagador: t.pagador, monto: t.monto, huella: t.huella }.publish(&env);
        Ok(())
    }

    pub fn obtener(env: Env, id: BytesN<32>, pagador: Address) -> Result<Trato, Error> {
        leer(&env, &id, &pagador)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        token::{Client as Tok, StellarAssetClient},
    };

    /// Registro de mentira, solo para probar el escrow: `registrar` marca la huella.
    #[contract]
    pub struct RegistroFalso;
    #[contractimpl]
    impl RegistroFalso {
        pub fn existe(env: Env, huella: BytesN<32>) -> bool {
            env.storage().persistent().has(&huella)
        }
        pub fn registrar(env: Env, huella: BytesN<32>) {
            env.storage().persistent().set(&huella, &true);
        }
    }

    fn ir_al_ledger(env: &Env, n: u32) {
        env.ledger().with_mut(|l| l.sequence_number = n);
    }
    fn id(env: &Env, b: u8) -> BytesN<32> {
        BytesN::from_array(env, &[b; 32])
    }

    struct Mundo<'a> {
        env: Env,
        escrow: EscrowEntregaClient<'a>,
        registro: RegistroFalsoClient<'a>,
        token: Tok<'a>,
        pagador: Address,
        benef: Address,
        admin: Address,
    }

    fn mundo<'a>() -> Mundo<'a> {
        let env = Env::default();
        env.mock_all_auths();
        ir_al_ledger(&env, 100);
        env.ledger().with_mut(|l| l.min_persistent_entry_ttl = 1_000_000); // para poder "envejecer" sin que venzan los saldos
        let registro = RegistroFalsoClient::new(&env, &env.register(RegistroFalso, ()));
        let admin = Address::generate(&env);
        let escrow = EscrowEntregaClient::new(&env, &env.register(EscrowEntrega, (registro.address.clone(), admin.clone())));
        let sac = env.register_stellar_asset_contract_v2(Address::generate(&env));
        let (pagador, benef) = (Address::generate(&env), Address::generate(&env));
        StellarAssetClient::new(&env, &sac.address()).mint(&pagador, &1_000);
        let token = Tok::new(&env, &sac.address());
        Mundo { env, escrow, registro, token, pagador, benef, admin }
    }
    fn depositar(m: &Mundo, trato: u8, huella: u8, vence: u32) {
        m.escrow.depositar(&id(&m.env, trato), &m.pagador, &m.benef, &m.token.address, &100, &id(&m.env, huella), &vence);
    }

    fn vida_de_la_instancia(m: &Mundo) -> u32 {
        use soroban_sdk::testutils::Deployer as _;
        m.env.deployer().get_contract_instance_ttl(&m.escrow.address)
    }
    #[test]
    fn liberar_y_reembolsar_renuevan_la_vida_de_la_instancia() {
        let m = mundo();
        depositar(&m, 21, 22, 150);
        depositar(&m, 23, 24, 150);
        m.registro.registrar(&id(&m.env, 22));
        ir_al_ledger(&m.env, 100 + 700_000); // a la instancia le queda menos que el umbral
        assert!(vida_de_la_instancia(&m) < TTL_UMBRAL);
        m.escrow.liberar(&id(&m.env, 21), &m.pagador);
        assert_eq!(vida_de_la_instancia(&m), TTL_MAXIMO);
        ir_al_ledger(&m.env, 100 + 800_000);
        assert!(vida_de_la_instancia(&m) < TTL_UMBRAL);
        m.escrow.reembolsar(&id(&m.env, 23), &m.pagador);
        assert_eq!(vida_de_la_instancia(&m), TTL_MAXIMO);
    }
    #[test]
    fn sin_huella_registrada_no_se_libera() {
        let m = mundo();
        depositar(&m, 1, 2, 150);
        assert_eq!(m.escrow.try_liberar(&id(&m.env, 1), &m.pagador), Err(Ok(Error::NoVerificada)));
        assert_eq!(m.token.balance(&m.benef), 0);
        assert_eq!(m.token.balance(&m.pagador), 900); // el dinero sigue en custodia
    }
    #[test]
    fn con_huella_registrada_se_paga() {
        let m = mundo();
        depositar(&m, 3, 4, 150);
        m.registro.registrar(&id(&m.env, 4));
        m.escrow.liberar(&id(&m.env, 3), &m.pagador);
        assert_eq!(m.token.balance(&m.benef), 100);
        assert!(m.escrow.obtener(&id(&m.env, 3), &m.pagador).liquidado);
    }
    #[test]
    fn reembolso_solo_despues_del_vencimiento() {
        let m = mundo();
        depositar(&m, 5, 6, 150);
        assert_eq!(m.escrow.try_reembolsar(&id(&m.env, 5), &m.pagador), Err(Ok(Error::NoVencio)));
        ir_al_ledger(&m.env, 151);
        m.escrow.reembolsar(&id(&m.env, 5), &m.pagador);
        assert_eq!(m.token.balance(&m.pagador), 1_000);
    }
    #[test]
    fn no_se_liquida_dos_veces() {
        let m = mundo();
        depositar(&m, 7, 8, 150);
        m.registro.registrar(&id(&m.env, 8));
        m.escrow.liberar(&id(&m.env, 7), &m.pagador);
        assert_eq!(m.escrow.try_liberar(&id(&m.env, 7), &m.pagador), Err(Ok(Error::YaLiquidado)));
        ir_al_ledger(&m.env, 200);
        assert_eq!(m.escrow.try_reembolsar(&id(&m.env, 7), &m.pagador), Err(Ok(Error::YaLiquidado)));
        assert_eq!(m.token.balance(&m.benef), 100); // cobró una sola vez
    }
    #[test]
    fn sin_la_firma_del_pagador_no_se_deposita() {
        let env = Env::default(); // sin mock_all_auths
        let registro = env.register(RegistroFalso, ());
        let escrow = EscrowEntregaClient::new(&env, &env.register(EscrowEntrega, (registro, Address::generate(&env))));
        let sac = env.register_stellar_asset_contract_v2(Address::generate(&env));
        let (p, b) = (Address::generate(&env), Address::generate(&env));
        assert!(escrow.try_depositar(&id(&env, 9), &p, &b, &sac.address(), &100, &id(&env, 10), &150).is_err());
    }
    #[test]
    fn carrera_verificada_despues_del_vencimiento_gana_liberar() {
        // La huella aparece pasado el plazo pero antes de que alguien reembolse: corresponde pagar la entrega verificada.
        let m = mundo();
        depositar(&m, 11, 12, 150);
        ir_al_ledger(&m.env, 151);
        m.registro.registrar(&id(&m.env, 12));
        assert_eq!(m.escrow.try_reembolsar(&id(&m.env, 11), &m.pagador), Err(Ok(Error::YaVerificada)));
        m.escrow.liberar(&id(&m.env, 11), &m.pagador);
        assert_eq!(m.token.balance(&m.benef), 100);
    }
    #[test]
    fn nadie_ocupa_el_trato_de_otro() {
        // Otro pagador con el mismo id de trato y la misma huella no choca ni toca el dinero del primero.
        let m = mundo();
        depositar(&m, 13, 14, 150);
        let intruso = Address::generate(&m.env);
        StellarAssetClient::new(&m.env, &m.token.address).mint(&intruso, &50);
        m.escrow.depositar(&id(&m.env, 13), &intruso, &m.benef, &m.token.address, &50, &id(&m.env, 14), &150);
        assert_eq!(m.escrow.obtener(&id(&m.env, 13), &m.pagador).monto, 100);
        assert_eq!(m.escrow.obtener(&id(&m.env, 13), &intruso).monto, 50);
        assert_eq!(m.escrow.try_depositar(&id(&m.env, 13), &m.pagador, &m.benef, &m.token.address, &100, &id(&m.env, 14), &150), Err(Ok(Error::YaExiste)));
    }
    #[test]
    fn el_historial_registra_cada_paso() {
        let m = mundo();
        depositar(&m, 20, 21, 150);
        m.registro.registrar(&id(&m.env, 21));
        m.escrow.liberar(&id(&m.env, 20), &m.pagador);
        let h = m.escrow.historial(&id(&m.env, 20), &m.pagador);
        assert_eq!(h.len(), 2);
        assert_eq!(h.get(0).unwrap().accion, Accion::Depositado);
        assert_eq!(h.get(1).unwrap().accion, Accion::Liberado);
        assert_eq!(h.get(1).unwrap().monto, 100);
    }
    #[test]
    fn el_historial_de_un_reembolso() {
        let m = mundo();
        depositar(&m, 22, 23, 150);
        ir_al_ledger(&m.env, 151);
        m.escrow.reembolsar(&id(&m.env, 22), &m.pagador);
        let h = m.escrow.historial(&id(&m.env, 22), &m.pagador);
        assert_eq!(h.get(1).unwrap().accion, Accion::Reembolsado);
    }
    #[test]
    fn la_pausa_frena_depositos_nuevos_pero_no_atrapa_plata() {
        let m = mundo();
        depositar(&m, 24, 25, 150);
        m.escrow.pausar();
        assert!(m.escrow.pausado());
        assert_eq!(m.escrow.try_depositar(&id(&m.env, 26), &m.pagador, &m.benef, &m.token.address, &100, &id(&m.env, 27), &150), Err(Ok(Error::Pausado)));
        // el trato ya depositado se puede liberar aunque esté pausado
        m.registro.registrar(&id(&m.env, 25));
        m.escrow.liberar(&id(&m.env, 24), &m.pagador);
        assert_eq!(m.token.balance(&m.benef), 100);
        m.escrow.reanudar();
        depositar(&m, 28, 29, 150);
        ir_al_ledger(&m.env, 151);
        m.escrow.pausar();
        m.escrow.reembolsar(&id(&m.env, 28), &m.pagador); // y reembolsar también
        assert_eq!(m.token.balance(&m.pagador), 900);
    }
    #[test]
    fn solo_el_admin_pausa() {
        let env = Env::default(); // sin mock_all_auths
        let registro = env.register(RegistroFalso, ());
        let escrow = EscrowEntregaClient::new(&env, &env.register(EscrowEntrega, (registro, Address::generate(&env))));
        assert!(escrow.try_pausar().is_err());
        assert!(escrow.try_reanudar().is_err());
    }
    #[test]
    fn el_admin_se_transfiere_en_dos_pasos() {
        let m = mundo();
        let nuevo = Address::generate(&m.env);
        m.escrow.transferir_administracion(&nuevo, &500);
        assert_eq!(m.escrow.admin(), m.admin); // todavía manda el anterior: falta que el nuevo acepte
        m.escrow.aceptar_administracion();
        assert_eq!(m.escrow.admin(), nuevo);
    }
    #[test]
    fn la_propuesta_de_admin_caduca() {
        let m = mundo();
        let nuevo = Address::generate(&m.env);
        m.escrow.transferir_administracion(&nuevo, &150);
        ir_al_ledger(&m.env, 151);
        assert!(m.escrow.try_aceptar_administracion().is_err());
        assert_eq!(m.escrow.admin(), m.admin);
    }
    #[test]
    fn no_se_puede_proponer_un_vencimiento_en_el_pasado() {
        let m = mundo();
        let nuevo = Address::generate(&m.env);
        assert!(m.escrow.try_transferir_administracion(&nuevo, &50).is_err());
    }
    #[test]
    fn sin_propuesta_pendiente_nadie_acepta() {
        let m = mundo();
        assert!(m.escrow.try_aceptar_administracion().is_err());
    }
    #[test]
    fn reembolsar_lo_puede_ejecutar_cualquiera_sin_firma() {
        // Vencido el plazo, el reembolso no depende de nadie: sin ninguna autorización, la plata vuelve al pagador.
        let m = mundo();
        depositar(&m, 30, 31, 150);
        ir_al_ledger(&m.env, 151);
        m.env.set_auths(&[]);
        m.escrow.reembolsar(&id(&m.env, 30), &m.pagador);
        assert_eq!(m.token.balance(&m.pagador), 1_000);
        assert_eq!(m.escrow.admin(), m.admin);
    }
    #[test]
    fn montos_y_plazos_invalidos() {
        let m = mundo();
        assert_eq!(m.escrow.try_depositar(&id(&m.env, 15), &m.pagador, &m.benef, &m.token.address, &0, &id(&m.env, 16), &150), Err(Ok(Error::MontoInvalido)));
        assert_eq!(m.escrow.try_depositar(&id(&m.env, 15), &m.pagador, &m.benef, &m.token.address, &10, &id(&m.env, 16), &100), Err(Ok(Error::PlazoInvalido)));
    }
}
