#![no_std]
//! Registro de lotes de GALCOA+: guarda la huella (memo de 32 bytes) de un lote junto con quién lo cargó y quién lo aprobó.
//! La regla de cuatro ojos la hace cumplir la RED: `registrar` exige la autorización del servicio y de DOS direcciones
//! distintas, y rechaza una huella ya registrada. Un lote registrado nunca se borra: si resulta erróneo se REVOCA
//! (queda el motivo, quién lo revocó y cuándo). No guarda datos de documentos ni de personas: solo huellas y direcciones.
use soroban_sdk::{contract, contracterror, contractevent, contractimpl, contracttype, Address, BytesN, Env};

/// Cuánto dura el dato antes de necesitar renovación (aprox. 30 días a 5 s por ledger) y a partir de cuándo se renueva.
const TTL_MAXIMO: u32 = 518_400;
const TTL_UMBRAL: u32 = 432_000;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    /// Cargador y aprobador son la misma dirección: no hay cuatro ojos.
    MismaPersona = 1,
    /// Esa huella ya fue registrada.
    YaRegistrado = 2,
    /// No existe un registro con esa huella.
    NoExiste = 3,
    /// Solo quien cargó o quien aprobó el lote puede revocarlo.
    NoAutorizado = 4,
    /// El lote ya estaba revocado.
    YaRevocado = 5,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Estado {
    Vigente,
    Revocado,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Registro {
    pub cargador: Address,
    pub aprobador: Address,
    pub ledger: u32,
    pub estado: Estado,
    /// Huella del motivo de la revocación (el texto queda fuera de la red); ceros si el lote está vigente.
    pub motivo_hash: BytesN<32>,
    pub revocado_por: Option<Address>,
    pub ledger_revocacion: u32,
}

#[contracttype]
enum Clave {
    Lote(BytesN<32>),
    Servicio,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LoteRegistrado {
    #[topic]
    pub huella: BytesN<32>,
    pub cargador: Address,
    pub aprobador: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LoteRevocado {
    #[topic]
    pub huella: BytesN<32>,
    pub revocado_por: Address,
    pub motivo_hash: BytesN<32>,
}

#[contract]
pub struct RegistroLotes;

fn servicio(env: &Env) -> Address {
    env.storage().instance().get(&Clave::Servicio).unwrap()
}

#[contractimpl]
impl RegistroLotes {
    /// Al crear el contrato se fija la cuenta del servicio. Sin su autorización nadie puede registrar ni revocar:
    /// así nadie puede registrar antes una huella con cuentas propias.
    pub fn __constructor(env: Env, servicio: Address) {
        env.storage().instance().set(&Clave::Servicio, &servicio);
        env.storage().instance().extend_ttl(TTL_UMBRAL, TTL_MAXIMO);
    }

    /// La cuenta del servicio que autoriza los registros.
    pub fn servicio(env: Env) -> Address {
        servicio(&env)
    }

    /// Registra un lote. Exige la firma del servicio, del cargador Y del aprobador, que deben ser distintos.
    pub fn registrar(env: Env, huella: BytesN<32>, cargador: Address, aprobador: Address) -> Result<(), Error> {
        if cargador == aprobador {
            return Err(Error::MismaPersona);
        }
        servicio(&env).require_auth();
        cargador.require_auth();
        aprobador.require_auth();
        let clave = Clave::Lote(huella.clone());
        if env.storage().persistent().has(&clave) {
            return Err(Error::YaRegistrado);
        }
        let registro = Registro {
            cargador: cargador.clone(),
            aprobador: aprobador.clone(),
            ledger: env.ledger().sequence(),
            estado: Estado::Vigente,
            motivo_hash: BytesN::from_array(&env, &[0u8; 32]),
            revocado_por: None,
            ledger_revocacion: 0,
        };
        env.storage().persistent().set(&clave, &registro);
        env.storage().persistent().extend_ttl(&clave, TTL_UMBRAL, TTL_MAXIMO);
        env.storage().instance().extend_ttl(TTL_UMBRAL, TTL_MAXIMO);
        LoteRegistrado { huella, cargador, aprobador }.publish(&env);
        Ok(())
    }

    /// Revoca un lote registrado. No lo borra: queda el motivo (su huella), quién lo revocó y en qué ledger.
    /// Exige la firma del servicio y de quien cargó o quien aprobó el lote.
    pub fn revocar(env: Env, huella: BytesN<32>, motivo_hash: BytesN<32>, revocador: Address) -> Result<(), Error> {
        servicio(&env).require_auth();
        revocador.require_auth();
        let clave = Clave::Lote(huella.clone());
        let mut r: Registro = env.storage().persistent().get(&clave).ok_or(Error::NoExiste)?;
        if r.estado == Estado::Revocado {
            return Err(Error::YaRevocado);
        }
        if revocador != r.cargador && revocador != r.aprobador {
            return Err(Error::NoAutorizado);
        }
        r.estado = Estado::Revocado;
        r.motivo_hash = motivo_hash.clone();
        r.revocado_por = Some(revocador.clone());
        r.ledger_revocacion = env.ledger().sequence();
        env.storage().persistent().set(&clave, &r);
        env.storage().persistent().extend_ttl(&clave, TTL_UMBRAL, TTL_MAXIMO);
        env.storage().instance().extend_ttl(TTL_UMBRAL, TTL_MAXIMO);
        LoteRevocado { huella, revocado_por: revocador, motivo_hash }.publish(&env);
        Ok(())
    }

    /// ¿Está registrada Y vigente esta huella? (un lote revocado da falso: así un pago condicionado no se libera por él).
    pub fn existe(env: Env, huella: BytesN<32>) -> bool {
        match env.storage().persistent().get::<Clave, Registro>(&Clave::Lote(huella)) {
            Some(r) => r.estado == Estado::Vigente,
            None => false,
        }
    }

    /// Devuelve todo lo que se sabe del lote: quién cargó, quién aprobó, cuándo, y si fue revocado.
    pub fn obtener(env: Env, huella: BytesN<32>) -> Result<Registro, Error> {
        env.storage().persistent().get(&Clave::Lote(huella)).ok_or(Error::NoExiste)
    }

    /// Cualquiera puede renovar la vida del dato (paga quien lo pide). No cambia su contenido.
    /// También renueva la vida de la instancia del contrato (donde está la cuenta del servicio).
    pub fn renovar(env: Env, huella: BytesN<32>) -> Result<(), Error> {
        let clave = Clave::Lote(huella);
        if !env.storage().persistent().has(&clave) {
            return Err(Error::NoExiste);
        }
        env.storage().persistent().extend_ttl(&clave, TTL_UMBRAL, TTL_MAXIMO);
        env.storage().instance().extend_ttl(TTL_UMBRAL, TTL_MAXIMO);
        Ok(())
    }

    /// Mantenimiento: cualquiera puede renovar la vida de la instancia del contrato sin tocar ningún lote.
    pub fn renovar_instancia(env: Env) {
        env.storage().instance().extend_ttl(TTL_UMBRAL, TTL_MAXIMO);
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    fn preparar() -> (Env, RegistroLotesClient<'static>, Address, Address, BytesN<32>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(RegistroLotes, (Address::generate(&env),));
        let cliente = RegistroLotesClient::new(&env, &id);
        let (a, b) = (Address::generate(&env), Address::generate(&env));
        let huella = BytesN::from_array(&env, &[7u8; 32]);
        (env, cliente, a, b, huella)
    }

    #[test]
    fn registra_y_consulta() {
        let (_e, c, a, b, h) = preparar();
        assert!(!c.existe(&h));
        c.registrar(&h, &a, &b);
        assert!(c.existe(&h));
        let r = c.obtener(&h);
        assert_eq!(r.cargador, a);
        assert_eq!(r.aprobador, b);
        assert_eq!(r.estado, Estado::Vigente);
    }

    #[test]
    fn exige_la_autorizacion_del_servicio_y_de_las_dos_personas() {
        let (env, c, a, b, h) = preparar();
        c.registrar(&h, &a, &b);
        let auths = env.auths();
        let firmantes: soroban_sdk::Vec<Address> = soroban_sdk::Vec::from_array(&env, [auths[0].0.clone(), auths[1].0.clone(), auths[2].0.clone()]);
        assert!(firmantes.contains(&a) && firmantes.contains(&b) && firmantes.contains(&c.servicio()));
    }

    #[test]
    fn sin_la_autorizacion_del_servicio_no_se_registra() {
        let env = Env::default(); // sin mock_all_auths: nadie autorizó nada
        let id = env.register(RegistroLotes, (Address::generate(&env),));
        let c = RegistroLotesClient::new(&env, &id);
        let (a, b) = (Address::generate(&env), Address::generate(&env));
        let h = BytesN::from_array(&env, &[5u8; 32]);
        assert!(c.try_registrar(&h, &a, &b).is_err());
        assert!(!c.existe(&h));
    }

    #[test]
    fn rechaza_la_misma_persona() {
        let (_e, c, a, _b, h) = preparar();
        assert_eq!(c.try_registrar(&h, &a, &a), Err(Ok(Error::MismaPersona)));
        assert!(!c.existe(&h));
    }

    #[test]
    fn rechaza_una_huella_repetida() {
        let (_e, c, a, b, h) = preparar();
        c.registrar(&h, &a, &b);
        assert_eq!(c.try_registrar(&h, &a, &b), Err(Ok(Error::YaRegistrado)));
    }

    #[test]
    fn consulta_de_algo_que_no_existe() {
        let (env, c, _a, _b, _h) = preparar();
        let otra = BytesN::from_array(&env, &[9u8; 32]);
        assert_eq!(c.try_obtener(&otra), Err(Ok(Error::NoExiste)));
        assert_eq!(c.try_renovar(&otra), Err(Ok(Error::NoExiste)));
    }

    #[test]
    fn revocar_deja_historia_y_apaga_existe() {
        let (env, c, a, b, h) = preparar();
        c.registrar(&h, &a, &b);
        let motivo = BytesN::from_array(&env, &[3u8; 32]);
        c.revocar(&h, &motivo, &b);
        assert!(!c.existe(&h)); // un pago condicionado ya no se libera por este lote
        let r = c.obtener(&h); // pero el registro NO se borró
        assert_eq!(r.estado, Estado::Revocado);
        assert_eq!(r.motivo_hash, motivo);
        assert_eq!(r.revocado_por, Some(b));
        assert_eq!(r.cargador, a);
    }

    #[test]
    fn solo_quien_cargo_o_aprobo_puede_revocar() {
        let (env, c, a, b, h) = preparar();
        c.registrar(&h, &a, &b);
        let ajeno = Address::generate(&env);
        let motivo = BytesN::from_array(&env, &[3u8; 32]);
        assert_eq!(c.try_revocar(&h, &motivo, &ajeno), Err(Ok(Error::NoAutorizado)));
        assert!(c.existe(&h));
        c.revocar(&h, &motivo, &a); // el cargador también puede
        assert_eq!(c.try_revocar(&h, &motivo, &a), Err(Ok(Error::YaRevocado)));
    }

    #[test]
    fn revocar_sin_la_autorizacion_del_servicio_falla_y_lo_inexistente_no_se_revoca() {
        let (env, c, a, _b, _h) = preparar();
        let otra = BytesN::from_array(&env, &[8u8; 32]);
        let motivo = BytesN::from_array(&env, &[3u8; 32]);
        assert_eq!(c.try_revocar(&otra, &motivo, &a), Err(Ok(Error::NoExiste)));
        let env2 = Env::default(); // sin mock_all_auths
        let id = env2.register(RegistroLotes, (Address::generate(&env2),));
        let c2 = RegistroLotesClient::new(&env2, &id);
        assert!(c2.try_revocar(&BytesN::from_array(&env2, &[1u8; 32]), &BytesN::from_array(&env2, &[3u8; 32]), &Address::generate(&env2)).is_err());
        let _ = env;
    }

    #[test]
    fn revocar_exige_exactamente_al_servicio_y_al_revocador() {
        let (env, c, a, b, h) = preparar();
        c.registrar(&h, &a, &b);
        c.revocar(&h, &BytesN::from_array(&env, &[3u8; 32]), &b);
        let auths = env.auths();
        assert_eq!(auths.len(), 2);
        let firmantes: soroban_sdk::Vec<Address> = soroban_sdk::Vec::from_array(&env, [auths[0].0.clone(), auths[1].0.clone()]);
        assert!(firmantes.contains(&b) && firmantes.contains(&c.servicio()));
        assert!(!firmantes.contains(&a));
    }

    #[test]
    fn renovar_no_cambia_el_estado() {
        let (_e, c, a, b, h) = preparar();
        c.registrar(&h, &a, &b);
        let antes = c.obtener(&h);
        c.renovar(&h);
        assert_eq!(c.obtener(&h), antes);
        assert!(c.existe(&h));
    }

    /// Avanza el tiempo hasta que a la instancia le quede menos que el umbral y devuelve lo que le queda.
    fn vida_de_la_instancia(env: &Env, id: &Address) -> u32 {
        use soroban_sdk::testutils::Deployer as _;
        env.deployer().get_contract_instance_ttl(id)
    }
    fn envejecer(env: &Env) {
        use soroban_sdk::testutils::Ledger;
        env.ledger().with_mut(|l| l.sequence_number += 200_000);
    }

    #[test]
    fn revocar_renueva_la_vida_de_la_instancia() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(RegistroLotes, (Address::generate(&env),));
        let c = RegistroLotesClient::new(&env, &id);
        let (a, b) = (Address::generate(&env), Address::generate(&env));
        let h = BytesN::from_array(&env, &[7u8; 32]);
        c.registrar(&h, &a, &b);
        envejecer(&env);
        assert!(vida_de_la_instancia(&env, &id) < TTL_UMBRAL);
        c.revocar(&h, &BytesN::from_array(&env, &[3u8; 32]), &a);
        assert_eq!(vida_de_la_instancia(&env, &id), TTL_MAXIMO);
    }

    #[test]
    fn renovar_y_renovar_instancia_renuevan_la_instancia() {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register(RegistroLotes, (Address::generate(&env),));
        let c = RegistroLotesClient::new(&env, &id);
        let (a, b) = (Address::generate(&env), Address::generate(&env));
        let h = BytesN::from_array(&env, &[7u8; 32]);
        c.registrar(&h, &a, &b);
        envejecer(&env);
        c.renovar(&h);
        assert_eq!(vida_de_la_instancia(&env, &id), TTL_MAXIMO);
        envejecer(&env);
        assert!(vida_de_la_instancia(&env, &id) < TTL_UMBRAL);
        c.renovar_instancia();
        assert_eq!(vida_de_la_instancia(&env, &id), TTL_MAXIMO);
    }

    #[test]
    fn un_lote_revocado_no_se_puede_volver_a_registrar() {
        let (env, c, a, b, h) = preparar();
        c.registrar(&h, &a, &b);
        c.revocar(&h, &BytesN::from_array(&env, &[3u8; 32]), &a);
        assert_eq!(c.try_registrar(&h, &a, &b), Err(Ok(Error::YaRegistrado)));
    }
}
