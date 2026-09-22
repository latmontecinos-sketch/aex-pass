//! Aex Prueba Pass Stellar 01 — pase de acceso a un Meet (track Event Pass).
//!
//! El ledger verifica dos cosas: que una address compró su pase (pagando el
//! precio al anfitrión) y que ese pase se usó una sola vez. El link del Meet
//! no vive aquí: todo lo que está on-chain es público, así que el anfitrión lo
//! comparte fuera de la red y el contrato solo prueba quién pagó y quién entró.
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token::TokenClient,
    Address, Env, String,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const BUMP_TO: u32 = 120 * DAY_IN_LEDGERS;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Host,
    Token,
    Price,
    Name,
    Pass(Address),
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PassStatus {
    Bought,
    Used,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    InvalidPrice = 1,
    AlreadyBought = 2,
    NoPass = 3,
    AlreadyUsed = 4,
}

#[contractevent]
pub struct Bought {
    #[topic]
    pub buyer: Address,
    pub price: i128,
}

#[contractevent]
pub struct CheckedIn {
    #[topic]
    pub buyer: Address,
}

#[contract]
pub struct MeetPass;

#[contractimpl]
impl MeetPass {
    /// Corre una sola vez, al desplegar: fija anfitrión, activo de pago,
    /// precio (en la unidad mínima del activo) y nombre del evento.
    pub fn __constructor(
        env: Env,
        host: Address,
        token: Address,
        price: i128,
        name: String,
    ) -> Result<(), Error> {
        if price <= 0 {
            return Err(Error::InvalidPrice);
        }
        let store = env.storage().instance();
        store.set(&DataKey::Host, &host);
        store.set(&DataKey::Token, &token);
        store.set(&DataKey::Price, &price);
        store.set(&DataKey::Name, &name);
        Ok(())
    }

    /// El comprador paga el precio al anfitrión y queda con su pase.
    /// Una address solo puede comprar un pase.
    pub fn buy(env: Env, buyer: Address) -> Result<(), Error> {
        buyer.require_auth();
        bump_instance(&env);

        let key = DataKey::Pass(buyer.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::AlreadyBought);
        }
        env.storage().persistent().set(&key, &PassStatus::Bought);
        env.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);

        let host = host(&env);
        let price = price(&env);
        TokenClient::new(&env, &token(&env)).transfer(&buyer, &host, &price);

        Bought { buyer, price }.publish(&env);
        Ok(())
    }

    /// El anfitrión marca la entrada al admitir a la persona en el Meet.
    /// Un pase solo pasa de `Bought` a `Used` una vez.
    pub fn check_in(env: Env, buyer: Address) -> Result<(), Error> {
        host(&env).require_auth();
        bump_instance(&env);

        let key = DataKey::Pass(buyer.clone());
        match env.storage().persistent().get::<_, PassStatus>(&key) {
            None => Err(Error::NoPass),
            Some(PassStatus::Used) => Err(Error::AlreadyUsed),
            Some(PassStatus::Bought) => {
                env.storage().persistent().set(&key, &PassStatus::Used);
                env.storage()
                    .persistent()
                    .extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);
                CheckedIn { buyer }.publish(&env);
                Ok(())
            }
        }
    }

    /// Estado del pase de una address: `None`, `Bought` o `Used`.
    pub fn pass_of(env: Env, buyer: Address) -> Option<PassStatus> {
        env.storage().persistent().get(&DataKey::Pass(buyer))
    }

    pub fn name(env: Env) -> String {
        env.storage().instance().get(&DataKey::Name).unwrap()
    }

    pub fn price(env: Env) -> i128 {
        price(&env)
    }

    pub fn host(env: Env) -> Address {
        host(&env)
    }
}

fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
}

fn host(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Host).unwrap()
}

fn token(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Token).unwrap()
}

fn price(env: &Env) -> i128 {
    env.storage().instance().get(&DataKey::Price).unwrap()
}

#[cfg(test)]
mod test;
