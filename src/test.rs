extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{
        storage::{Instance as _, Persistent as _},
        Address as _, AuthorizedFunction, AuthorizedInvocation, Events as _, MockAuth,
        MockAuthInvoke,
    },
    token::{StellarAssetClient, TokenClient},
    Event, IntoVal, Symbol,
};

const PRICE: i128 = 10_000_000; // 1 XLM en stroops

struct Setup {
    env: Env,
    host: Address,
    buyer: Address,
    token: TokenClient<'static>,
    pass: MeetPassClient<'static>,
}

fn setup() -> Setup {
    let env = Env::default();
    env.mock_all_auths();

    let host = Address::generate(&env);
    let buyer = Address::generate(&env);

    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    StellarAssetClient::new(&env, &sac.address()).mint(&buyer, &(5 * PRICE));

    let contract_id = env.register(
        MeetPass,
        (
            host.clone(),
            sac.address(),
            PRICE,
            String::from_str(&env, "Aex Prueba Pass Stellar 01"),
        ),
    );

    Setup {
        token: TokenClient::new(&env, &sac.address()),
        pass: MeetPassClient::new(&env, &contract_id),
        env,
        host,
        buyer,
    }
}

/// Autoriza solo a `signer` para llamar `function(buyer)`, sin sub-invocaciones.
fn only_signer(s: &Setup, signer: &Address, function: &'static str) {
    s.env.mock_auths(&[MockAuth {
        address: signer,
        invoke: &MockAuthInvoke {
            contract: &s.pass.address,
            fn_name: function,
            args: (s.buyer.clone(),).into_val(&s.env),
            sub_invokes: &[],
        },
    }]);
}

#[test]
fn stores_event_config() {
    let s = setup();
    assert_eq!(
        s.pass.name(),
        String::from_str(&s.env, "Aex Prueba Pass Stellar 01")
    );
    assert_eq!(s.pass.price(), PRICE);
    assert_eq!(s.pass.host(), s.host);
    assert_eq!(s.pass.pass_of(&s.buyer), None);
}

#[test]
fn buy_pays_host_and_requires_buyer_auth() {
    let s = setup();
    s.pass.buy(&s.buyer);

    // La firma del comprador cubre buy y, dentro, el transfer del token, y no
    // se pide ninguna otra. env.auths() refleja la última invocación.
    assert_eq!(
        s.env.auths(),
        std::vec![(
            s.buyer.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    s.pass.address.clone(),
                    Symbol::new(&s.env, "buy"),
                    (s.buyer.clone(),).into_val(&s.env),
                )),
                sub_invocations: std::vec![AuthorizedInvocation {
                    function: AuthorizedFunction::Contract((
                        s.token.address.clone(),
                        Symbol::new(&s.env, "transfer"),
                        (s.buyer.clone(), s.host.clone(), PRICE).into_val(&s.env),
                    )),
                    sub_invocations: std::vec![],
                }],
            }
        )]
    );

    assert_eq!(s.pass.pass_of(&s.buyer), Some(PassStatus::Bought));
    assert_eq!(s.token.balance(&s.host), PRICE);
    assert_eq!(s.token.balance(&s.buyer), 4 * PRICE);
}

#[test]
fn buy_publishes_bought_event() {
    let s = setup();
    s.pass.buy(&s.buyer);
    let expected = Bought {
        buyer: s.buyer.clone(),
        price: PRICE,
    };
    assert_eq!(
        s.env.events().all().filter_by_contract(&s.pass.address),
        [expected.to_xdr(&s.env, &s.pass.address)]
    );
}

#[test]
fn buy_extends_ttl_of_pass_and_instance() {
    let s = setup();
    s.pass.buy(&s.buyer);
    s.env.as_contract(&s.pass.address, || {
        let pass_ttl = s
            .env
            .storage()
            .persistent()
            .get_ttl(&DataKey::Pass(s.buyer.clone()));
        assert_eq!(pass_ttl, BUMP_TO);
        assert_eq!(s.env.storage().instance().get_ttl(), BUMP_TO);
    });
}

#[test]
fn cannot_buy_twice() {
    let s = setup();
    s.pass.buy(&s.buyer);
    assert_eq!(s.pass.try_buy(&s.buyer), Err(Ok(Error::AlreadyBought)));
    // El segundo intento no cobra nada.
    assert_eq!(s.token.balance(&s.host), PRICE);
    assert_eq!(s.token.balance(&s.buyer), 4 * PRICE);
}

#[test]
fn nobody_else_can_buy_for_the_buyer() {
    let s = setup();
    let stranger = Address::generate(&s.env);
    only_signer(&s, &stranger, "buy");
    assert!(matches!(s.pass.try_buy(&s.buyer), Err(Err(_))));
    assert_eq!(s.pass.pass_of(&s.buyer), None);
    assert_eq!(s.token.balance(&s.host), 0);
}

#[test]
fn failed_payment_leaves_no_pass() {
    let s = setup();
    let broke = Address::generate(&s.env); // sin saldo del token
    assert!(s.pass.try_buy(&broke).is_err());
    assert_eq!(s.pass.pass_of(&broke), None);
    assert_eq!(s.token.balance(&s.host), 0);
}

#[test]
fn check_in_once_then_already_used() {
    let s = setup();
    s.pass.buy(&s.buyer);

    s.pass.check_in(&s.buyer);

    // Solo el anfitrión autoriza el check-in.
    assert_eq!(
        s.env.auths(),
        std::vec![(
            s.host.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    s.pass.address.clone(),
                    Symbol::new(&s.env, "check_in"),
                    (s.buyer.clone(),).into_val(&s.env),
                )),
                sub_invocations: std::vec![],
            }
        )]
    );
    assert_eq!(s.pass.pass_of(&s.buyer), Some(PassStatus::Used));

    assert_eq!(s.pass.try_check_in(&s.buyer), Err(Ok(Error::AlreadyUsed)));
}

#[test]
fn check_in_publishes_checked_in_event() {
    let s = setup();
    s.pass.buy(&s.buyer);
    s.pass.check_in(&s.buyer);
    let expected = CheckedIn {
        buyer: s.buyer.clone(),
    };
    assert_eq!(
        s.env.events().all().filter_by_contract(&s.pass.address),
        [expected.to_xdr(&s.env, &s.pass.address)]
    );
}

#[test]
fn check_in_without_pass_fails() {
    let s = setup();
    let stranger = Address::generate(&s.env);
    assert_eq!(s.pass.try_check_in(&stranger), Err(Ok(Error::NoPass)));
}

#[test]
fn check_in_needs_host_signature() {
    let s = setup();
    s.pass.buy(&s.buyer);
    // Nadie firma: la llamada falla por autorización, no por una regla del contrato.
    s.env.set_auths(&[]);
    assert!(matches!(s.pass.try_check_in(&s.buyer), Err(Err(_))));
    assert_eq!(s.pass.pass_of(&s.buyer), Some(PassStatus::Bought));
}

#[test]
fn buyer_cannot_check_in_own_pass() {
    let s = setup();
    s.pass.buy(&s.buyer);
    // El comprador firma el check-in de su propio pase: no alcanza.
    only_signer(&s, &s.buyer, "check_in");
    assert!(matches!(s.pass.try_check_in(&s.buyer), Err(Err(_))));
    assert_eq!(s.pass.pass_of(&s.buyer), Some(PassStatus::Bought));
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn rejects_zero_price() {
    let env = Env::default();
    let host = Address::generate(&env);
    let token = Address::generate(&env);
    env.register(MeetPass, (host, token, 0_i128, String::from_str(&env, "x")));
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn rejects_negative_price() {
    let env = Env::default();
    let host = Address::generate(&env);
    let token = Address::generate(&env);
    env.register(
        MeetPass,
        (host, token, -1_i128, String::from_str(&env, "x")),
    );
}
