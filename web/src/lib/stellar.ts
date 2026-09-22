import {
  Horizon,
  Keypair,
  Networks,
  contract,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";

// Todo corre contra testnet: las cuentas y el XLM son de prueba.
export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const HORIZON_URL = "https://horizon-testnet.stellar.org";
export const EXPLORER = "https://stellar.expert/explorer/testnet";

// Código del contrato Aex Prueba Pass Stellar 01, ya subido a la red. Cada
// evento que se crea aquí es una instancia nueva de este mismo código.
export const WASM_HASH =
  "bbc3d152adfe968892e0c7b96625617443c81694bef47d04b569665205967379";
// El XLM nativo expuesto como contrato (Stellar Asset Contract).
export const XLM_CONTRACT =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
// La primera instancia, desplegada e invocada desde el Stellar CLI.
export const ORIGINAL_CONTRACT =
  "CCGIRQW6WUR4WT46DTL2EZMQBCY4SNRF622DN2VODMOYGMSFHMDPP6NW";

export const STROOPS_PER_XLM = 10_000_000n;

export const CONTRACT_ERRORS: Record<number, { name: string; meaning: string }> = {
  1: { name: "InvalidPrice", meaning: "el precio tiene que ser mayor a cero" },
  2: { name: "AlreadyBought", meaning: "esta cuenta ya compró su pase" },
  3: { name: "NoPass", meaning: "esta cuenta no tiene pase" },
  4: { name: "AlreadyUsed", meaning: "este pase ya se usó" },
};

export type PassStatus = "none" | "bought" | "used";

export type TxOutcome =
  | { ok: true; hash: string; feeXlm: string | null }
  | { ok: false; code: number | null; message: string };

export type ContractEvent = {
  id: string;
  name: string;
  buyer: string;
  price: bigint | null;
  ledger: number;
  txHash: string;
};

const server = new rpc.Server(RPC_URL);
const horizon = new Horizon.Server(HORIZON_URL);

export function short(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function formatXlm(stroops: bigint | string | number): string {
  const value = BigInt(stroops);
  const whole = value / STROOPS_PER_XLM;
  const fraction = (value % STROOPS_PER_XLM).toString().padStart(7, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

export function xlmToStroops(xlm: string): bigint {
  const [whole, fraction = ""] = xlm.trim().replace(",", ".").split(".");
  return BigInt(whole || "0") * STROOPS_PER_XLM + BigInt(fraction.padEnd(7, "0").slice(0, 7) || "0");
}

/** Crea una cuenta nueva y le pide XLM de prueba a Friendbot. */
export async function createFundedAccount(): Promise<Keypair> {
  const keypair = Keypair.random();
  const res = await fetch(`https://friendbot.stellar.org/?addr=${keypair.publicKey()}`);
  if (!res.ok) throw new Error("Friendbot no pudo fondear la cuenta. Intenta de nuevo en unos segundos.");
  return keypair;
}

export async function getXlmBalance(address: string): Promise<string | null> {
  try {
    const account = await horizon.loadAccount(address);
    const native = account.balances.find((b) => b.asset_type === "native");
    return native ? native.balance : null;
  } catch {
    return null;
  }
}

function clientOptions(contractId: string, signer?: Keypair): contract.ClientOptions {
  return {
    contractId,
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK_PASSPHRASE,
    ...(signer
      ? { publicKey: signer.publicKey(), ...contract.basicNodeSigner(signer, NETWORK_PASSPHRASE) }
      : {}),
  };
}

// La interfaz del contrato se lee de la red una sola vez.
let specCache: contract.Spec | null = null;
async function getClient(contractId: string, signer?: Keypair) {
  if (!specCache) {
    const probe = await contract.Client.fromWasmHash(WASM_HASH, clientOptions(contractId));
    specCache = probe.spec;
  }
  // Los métodos se generan desde el spec; se tipan a mano abajo.
  return new contract.Client(specCache, clientOptions(contractId, signer)) as contract.Client &
    Record<string, (args?: Record<string, unknown>) => Promise<contract.AssembledTransaction<unknown>>>;
}

function contractErrorCode(text: string): number | null {
  const match = /Error\(Contract, #(\d+)\)/.exec(text);
  return match ? Number(match[1]) : null;
}

function describeFailure(error: unknown): TxOutcome {
  const text = error instanceof Error ? error.message : String(error);
  const code = contractErrorCode(text);
  return { ok: false, code, message: code ? CONTRACT_ERRORS[code]?.meaning ?? text : text };
}

async function feeOf(hash: string): Promise<string | null> {
  try {
    const tx = await horizon.transactions().transaction(hash).call();
    return formatXlm(tx.fee_charged);
  } catch {
    return null;
  }
}

async function send(tx: contract.AssembledTransaction<unknown>): Promise<TxOutcome> {
  // Si la simulación falla, la transacción nunca se envía a la red.
  if (tx.simulation && rpc.Api.isSimulationError(tx.simulation)) {
    return describeFailure(tx.simulation.error);
  }
  try {
    const sent = await tx.signAndSend();
    const hash =
      sent.getTransactionResponse?.txHash ?? sent.sendTransactionResponse?.hash ?? "";
    return { ok: true, hash, feeXlm: hash ? await feeOf(hash) : null };
  } catch (error) {
    return describeFailure(error);
  }
}

/** Despliega una instancia nueva del contrato: un evento con su anfitrión, precio y nombre. */
export async function deployEvent(
  host: Keypair,
  name: string,
  priceStroops: bigint,
): Promise<{ contractId: string; outcome: TxOutcome; ledger: number | null }> {
  const tx = await contract.Client.deploy(
    { host: host.publicKey(), token: XLM_CONTRACT, price: priceStroops, name },
    {
      wasmHash: WASM_HASH,
      rpcUrl: RPC_URL,
      networkPassphrase: NETWORK_PASSPHRASE,
      publicKey: host.publicKey(),
      ...contract.basicNodeSigner(host, NETWORK_PASSPHRASE),
    },
  );
  if (tx.simulation && rpc.Api.isSimulationError(tx.simulation)) {
    return { contractId: "", outcome: describeFailure(tx.simulation.error), ledger: null };
  }
  try {
    const sent = await tx.signAndSend();
    const deployed = sent.result as contract.Client;
    const response = sent.getTransactionResponse;
    const hash = response?.txHash ?? sent.sendTransactionResponse?.hash ?? "";
    const ledger = response && "ledger" in response ? (response.ledger as number) : null;
    return {
      contractId: deployed.options.contractId,
      outcome: { ok: true, hash, feeXlm: hash ? await feeOf(hash) : null },
      ledger,
    };
  } catch (error) {
    return { contractId: "", outcome: describeFailure(error), ledger: null };
  }
}

export async function buyPass(contractId: string, buyer: Keypair): Promise<TxOutcome> {
  const client = await getClient(contractId, buyer);
  return send(await client.buy({ buyer: buyer.publicKey() }));
}

export async function checkIn(contractId: string, host: Keypair, buyer: string): Promise<TxOutcome> {
  const client = await getClient(contractId, host);
  return send(await client.check_in({ buyer }));
}

export async function getPassStatus(contractId: string, buyer: string): Promise<PassStatus> {
  const client = await getClient(contractId);
  const tx = await client.pass_of({ buyer });
  const value = tx.result as unknown;
  // Option<PassStatus>: undefined/null si no hay pase; si hay, { tag: "Bought" | "Used" }.
  const tag =
    value && typeof value === "object" && "tag" in value ? (value as { tag: string }).tag : value;
  if (tag === "Bought") return "bought";
  if (tag === "Used") return "used";
  return "none";
}

/** Eventos publicados por el contrato: `bought` y `checked_in`. */
export async function getContractEvents(contractId: string, fromLedger: number): Promise<ContractEvent[]> {
  try {
    const res = await server.getEvents({
      startLedger: fromLedger,
      filters: [{ type: "contract", contractIds: [contractId] }],
      limit: 50,
    });
    return res.events.map((event) => {
      const topics = event.topic.map((t) => scValToNative(t));
      const data = scValToNative(event.value) as Record<string, unknown> | null;
      const price = data && typeof data === "object" && "price" in data ? BigInt(data.price as bigint) : null;
      return {
        id: event.id,
        name: String(topics[0]),
        buyer: String(topics[1] ?? ""),
        price,
        ledger: event.ledger,
        txHash: event.txHash,
      };
    });
  } catch {
    return [];
  }
}

export async function latestLedger(): Promise<number> {
  return (await server.getLatestLedger()).sequence;
}
