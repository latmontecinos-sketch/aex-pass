# Aex Pass

Un pase para entrar a un Meet, controlado por un contrato en Stellar. Proyecto del track **Event Pass** de Stellar Elite Bolivia.

El contrato hace cumplir dos reglas en el ledger:

1. solo tiene pase quien **lo compró**, pagando el precio al anfitrión, y
2. cada pase **se usa una sola vez**.

El repo tiene tres partes:

| Carpeta | Qué es |
|---|---|
| [`src/`](src) | El contrato **Aex Prueba Pass Stellar 01**, en Rust con `soroban-sdk` |
| [`web/`](web) | La plataforma **Aex Pass**: una página que explica y ejecuta el flujo paso a paso, en español, para quien nunca usó una blockchain |
| `demo.ps1` · `DEMO.cmd` | La misma demo desde el Stellar CLI, con cada resultado traducido a lenguaje simple |

## La plataforma

Cada visitante crea sus propias cuentas de prueba (Friendbot) y su propio evento: la página despliega una instancia nueva del contrato ya subido a la red. Después compra el pase, deja entrar al invitado e intenta entrar de nuevo, y ve cómo el contrato lo rechaza. Un panel lee en vivo el estado del pase, los saldos y los eventos del contrato; cada paso enlaza su transacción en stellar.expert y muestra el comando equivalente del Stellar CLI.

Todo corre en el navegador contra testnet, con `@stellar/stellar-sdk`: no hay servidor ni base de datos. Las llaves de las cuentas de prueba quedan en el `localStorage` del navegador y solo sirven en testnet.

```bash
cd web
pnpm install
pnpm dev
```

`node scripts/check.mts` corre una prueba de humo contra testnet: crea cuentas, despliega un evento, lee el pase y verifica que un check-in sin pase se rechace con el error `#3`.

## El contrato

| Función | Firma | Qué hace |
|---|---|---|
| `__constructor(host, token, price, name)` | al desplegar | Fija anfitrión, activo de pago, precio y nombre del evento. Rechaza precios ≤ 0 |
| `buy(buyer)` | el comprador | Transfiere `price` del comprador al anfitrión y guarda el pase como `Bought`. Una address compra un solo pase |
| `check_in(buyer)` | el anfitrión | Al admitir a la persona en el Meet, pasa el pase de `Bought` a `Used` y emite `checked_in` |
| `pass_of(buyer)` | nadie | Estado del pase: `null`, `Bought` o `Used` |
| `name()` · `price()` · `host()` | nadie | Configuración del evento |

**Eventos:** `bought` (topic: comprador · data: precio) y `checked_in` (topic: comprador).

**Errores:**

| Código | Error | Cuándo |
|---|---|---|
| `#1` | `InvalidPrice` | Precio ≤ 0 al desplegar |
| `#2` | `AlreadyBought` | La address ya tiene pase |
| `#3` | `NoPass` | Check-in de alguien que no compró |
| `#4` | `AlreadyUsed` | Segundo check-in con el mismo pase |

El link del Meet no vive en el contrato: todo lo que está on-chain es público, así que el anfitrión lo comparte fuera de la red.

### Primera instancia en testnet

Desplegada e invocada desde el Stellar CLI.

| | |
|---|---|
| Contrato | [`CCGIRQW6WUR4WT46DTL2EZMQBCY4SNRF622DN2VODMOYGMSFHMDPP6NW`](https://stellar.expert/explorer/testnet/contract/CCGIRQW6WUR4WT46DTL2EZMQBCY4SNRF622DN2VODMOYGMSFHMDPP6NW) |
| Código (WASM) | hash `bbc3d152adfe968892e0c7b96625617443c81694bef47d04b569665205967379` |
| Activo | XLM nativo (SAC `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`) |
| Precio | 1 XLM (`10000000` stroops) |
| Compra | [tx `768aab93…`](https://stellar.expert/explorer/testnet/tx/768aab930342ef4dc68fe35d15903768e7ec9eec90812e2c924a29d0070d3645) |
| Check-in | [tx `1cfcb96f…`](https://stellar.expert/explorer/testnet/tx/1cfcb96f7c1c5d91d4510d8a22045d14cc6be39e79078d55d27878e37c09d367) |

### Compilar y probar

Requiere Rust con el target `wasm32v1-none` y el [Stellar CLI](https://developers.stellar.org/docs/tools/cli/stellar-cli):

```bash
cargo test
stellar contract build
```

Los tests cubren la compra (incluido el árbol de firmas: el comprador autoriza `buy` y el `transfer` interno), la doble compra, el check-in único, el check-in sin pase, el check-in sin firma del anfitrión y el precio inválido. El WASM compilado tiene el mismo hash que el desplegado.

### Lo aprendido

La primera compra cobró 17,6 XLM de comisión, casi todo renta: `buy` extendió a 120 días el TTL del pase, de la instancia y del código. Ajustar esa ventana a la duración real del evento es lo siguiente por optimizar.

---

**Alejandro Tintaya Montecinos** — La Paz, Bolivia · [latmontecinos.vercel.app](https://latmontecinos.vercel.app)
