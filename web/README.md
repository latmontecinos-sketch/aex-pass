# Aex Pass · web

La plataforma de Aex Pass: Next.js 16, React 19, Tailwind 4 y `@stellar/stellar-sdk`, todo en el navegador contra Stellar testnet.

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build
node scripts/check.mts   # prueba de humo contra testnet
```

- `src/lib/stellar.ts`: cuentas de prueba, despliegue de eventos, compra, check-in y lecturas (pase, saldos, eventos).
- `src/components/aex-pass.tsx`: los cinco pasos y el panel en vivo.

Más contexto en el [README del proyecto](../README.md).
