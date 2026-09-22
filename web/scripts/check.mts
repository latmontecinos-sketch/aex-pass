// Prueba de humo contra testnet: cuentas, despliegue, lecturas y un rechazo.
// No compra: la compra mueve XLM entre cuentas y se prueba desde la interfaz.
import * as s from "../src/lib/stellar.ts";

const host = await s.createFundedAccount();
const guest = await s.createFundedAccount();
console.log("anfitrión", s.short(host.publicKey()), "saldo", await s.getXlmBalance(host.publicKey()));
console.log("invitado ", s.short(guest.publicKey()), "saldo", await s.getXlmBalance(guest.publicKey()));

const deployed = await s.deployEvent(host, "Prueba de humo", s.xlmToStroops("1"));
console.log("deploy", deployed.contractId, deployed.outcome, "ledger", deployed.ledger);

console.log("pase", await s.getPassStatus(deployed.contractId, guest.publicKey()));
console.log("check-in sin pase", await s.checkIn(deployed.contractId, host, guest.publicKey()));
console.log("eventos", await s.getContractEvents(deployed.contractId, deployed.ledger ?? (await s.latestLedger()) - 100));
console.log("pase contrato original (asistente)", await s.getPassStatus(s.ORIGINAL_CONTRACT, "GA7KF4C26APK72OCBBEX23AM45GYYDYXCXRCAHI47APCLYWUHSEX2DJH"));
