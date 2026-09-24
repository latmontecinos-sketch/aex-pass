# Aex Pass

Un pase para entrar a un Meet, controlado por un contrato en Stellar. Proyecto del track **Event Pass** de Stellar Elite Bolivia.

El contrato hace cumplir dos reglas en el ledger:

1. solo tiene pase quien **lo compró**, pagando el precio al anfitrión, y
2. cada pase **se usa una sola vez**.

El repo tiene tres partes:

| Carpeta | Qué es |
|---|---|
| [`src/`](src) | El contrato **Aex Prueba Pass Stellar 01**, en Rust con `soroban-sdk` |
| `demo.ps1` · `DEMO.cmd` | La demo desde el Stellar CLI, con cada resultado traducido a lenguaje simple |
| [`web/`](web) | Solo un `vercel.json` que redirige `aex-pass.vercel.app` a la nueva casa de la plataforma |

## La plataforma

La explicación y la ejecución interactiva viven en **Aex Stellar Lab**, mi biblioteca de Stellar Elite:

- Resumen de la tarea: https://aex-stellar-lab.vercel.app/tareas/aex-pass
- Ejecución (los 11 pasos reales con el CLI y el flujo para ejecutarlo desde el navegador): https://aex-stellar-lab.vercel.app/tareas/aex-pass/ejecucion
- Cómo funciona: https://aex-stellar-lab.vercel.app/tareas/aex-pass/explicacion

Su código está en [latmontecinos-sketch/aex-stellar-lab](https://github.com/latmontecinos-sketch/aex-stellar-lab).

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

Los 14 tests cubren:

- **compra:** paga al anfitrión, el árbol de firmas exacto (el comprador autoriza `buy` y el `transfer` interno, y nada más), el evento `bought`, el TTL de 120 días del pase y de la instancia, la doble compra, que nadie más pueda comprar a nombre del comprador y que un pago fallido no deje pase;
- **check-in:** el uso único con el error `#4`, el evento `checked_in`, el check-in sin pase (`#3`), sin ninguna firma y con la firma del propio comprador;
- **configuración:** los datos del evento y el rechazo de precios `0` y negativos (`#1`).

El WASM compilado tiene el mismo hash que el desplegado.

## La demo del CLI

`DEMO.cmd` (o `pwsh -File demo.ps1`) recorre la consulta, la compra, el check-in y el rechazo, traduciendo cada resultado. Con `-Ensayo` la compra y los check-in solo se simulan (`--send=no`) y no se envía nada.

Necesita el Stellar CLI 28, PowerShell 7 y dos identidades del CLI: `anfitrion`, la cuenta que desplegó el contrato (`check_in` exige su firma), e `invitado`, cualquier cuenta con XLM de prueba. La llave del anfitrión de la primera instancia vive solo en mi computadora; para correr la demo en otra, despliega tu propia instancia con tu identidad `anfitrion` y pásala con `-Contrato <id>`:

```bash
stellar keys generate anfitrion --network testnet --fund
stellar keys generate invitado --network testnet --fund
stellar contract build
stellar contract deploy --wasm target/wasm32v1-none/release/aex_prueba_pass_stellar_01.wasm --source-account anfitrion --network testnet -- --host anfitrion --token CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC --price 10000000 --name "Mi evento"
pwsh -File demo.ps1 -Contrato <id que devolvió el deploy>
```

## Lo aprendido

La primera compra cobró 17,64 XLM de comisión, casi todo renta: `buy` extendió a 120 días el TTL del pase, de la instancia y del código. Ajustar esa ventana a la duración real del evento es lo siguiente por optimizar.

---

**Alejandro Tintaya Montecinos** — La Paz, Bolivia · [latmontecinos.vercel.app](https://latmontecinos.vercel.app)
