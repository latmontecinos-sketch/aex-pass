# Reglas del proyecto

Aex Pass: contrato Soroban (`soroban-sdk` 28, Rust) desplegado en Stellar testnet, más la demo del CLI (`demo.ps1`). La web vive en el repo `aex-stellar-lab`.

Estas reglas salen de la auditoría del 2026-09-23. Casi todo el código lo escribe Claude Code y estas reglas evitan que se repitan los problemas que encontró.

## Antes de cada commit
- `cargo fmt --check`, `cargo clippy --all-targets` sin avisos y `cargo test` en verde.
- Si cambia `src/lib.rs`, cambia el hash del WASM: la instancia desplegada (`CCGI…P6NW`, hash `bbc3d152…`) ya no corresponde al código. En ese caso es una versión nueva del contrato: desplegarla, actualizar el README y, en `aex-stellar-lab`, regenerar `src/lib/aex-pass-contract.ts` y actualizar `src/lib/deployment.ts`.

## Contrato
- Cada función que cambia estado lleva `require_auth` sobre la dirección correcta y un test negativo con `mock_auths` del firmante equivocado, que verifica que el estado no cambió.
- Todo lo que el README promete tiene su test: eventos (`env.events().all()`), TTL (`get_ttl`), árbol de firmas exacto (`assert_eq!(env.auths(), vec![...])`, no solo el primer elemento).
- `should_panic` siempre con `expected = "Error(Contract, #N)"`; para errores del contrato, `try_*` comparando el error exacto.
- Antes de cambiar el contrato, comprobar que los tests detectan el cambio (una mutación rápida que los haga fallar).

## Demo del CLI
- `demo.ps1` corre con `Set-StrictMode` y `$ErrorActionPreference = 'Stop'`, y revisa `$LASTEXITCODE` después de cada llamada a `stellar`. Nada de `catch { }` vacíos.
- Probar cambios con `pwsh -File demo.ps1 -Ensayo`: simula la compra y los check-in sin enviar nada.

## Repo
- Los borradores personales (`GUION.*`, `Claude outputs/`) y los secretos (`.env*`, `.stellar/`, `.soroban/`) están en `.gitignore`; no se versionan.
- `web/` es solo un `vercel.json` con el redirect de `aex-pass.vercel.app`.
