"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Keypair } from "@stellar/stellar-sdk";
import {
  CONTRACT_ERRORS,
  EXPLORER,
  WASM_HASH,
  XLM_CONTRACT,
  buyPass,
  checkIn,
  createFundedAccount,
  deployEvent,
  formatXlm,
  getContractEvents,
  getPassStatus,
  getXlmBalance,
  short,
  xlmToStroops,
  type ContractEvent,
  type PassStatus,
  type TxOutcome,
} from "@/lib/stellar";

// Lo que se recuerda entre visitas. Las llaves son de cuentas de prueba (testnet).
type Session = {
  hostSecret?: string;
  guestSecret?: string;
  contractId?: string;
  eventName?: string;
  priceStroops?: string;
  deployTx?: string;
  deployFee?: string | null;
  deployLedger?: number | null;
  buyTx?: string;
  buyFee?: string | null;
  checkInTx?: string;
  checkInFee?: string | null;
  retry?: { code: number | null; message: string };
};

type Live = {
  pass: PassStatus | null;
  hostBalance: string | null;
  guestBalance: string | null;
  events: ContractEvent[];
  updatedAt: Date | null;
};

const STORAGE_KEY = "aex-pass:sesion:v1";

function loadSession(): Session {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Session;
  } catch {
    return {};
  }
}

function saveSession(session: Session) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Sin almacenamiento la demo funciona igual; solo no se recuerda al recargar.
  }
}

function publicKeyOf(secret?: string): string | null {
  if (!secret) return null;
  try {
    return Keypair.fromSecret(secret).publicKey();
  } catch {
    return null;
  }
}

function failureText(outcome: Extract<TxOutcome, { ok: false }>): string {
  if (outcome.code && CONTRACT_ERRORS[outcome.code]) {
    const { name, meaning } = CONTRACT_ERRORS[outcome.code];
    return `El contrato lo rechazó: ${meaning} (error #${outcome.code}, ${name}).`;
  }
  return `No se pudo completar: ${outcome.message}`;
}

export function AexPass() {
  const [session, setSession] = useState<Session>({});
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [live, setLive] = useState<Live>({
    pass: null,
    hostBalance: null,
    guestBalance: null,
    events: [],
    updatedAt: null,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [eventName, setEventName] = useState("Meet de prueba");
  const [priceXlm, setPriceXlm] = useState("1");
  const stepRefs = useRef<Record<number, HTMLElement | null>>({});

  useEffect(() => {
    setSession(loadSession());
    setHydrated(true);
  }, []);

  const update = useCallback((patch: Session | null) => {
    setSession((prev) => {
      const next = patch === null ? {} : { ...prev, ...patch };
      saveSession(next);
      return next;
    });
  }, []);

  const host = publicKeyOf(session.hostSecret);
  const guest = publicKeyOf(session.guestSecret);
  const price = session.priceStroops ? BigInt(session.priceStroops) : null;

  const refresh = useCallback(async () => {
    if (!host || !guest) return;
    setRefreshing(true);
    const [hostBalance, guestBalance] = await Promise.all([getXlmBalance(host), getXlmBalance(guest)]);
    let pass: PassStatus | null = null;
    let events: ContractEvent[] = [];
    if (session.contractId) {
      [pass, events] = await Promise.all([
        getPassStatus(session.contractId, guest).catch(() => null),
        session.deployLedger ? getContractEvents(session.contractId, session.deployLedger) : Promise.resolve([]),
      ]);
    }
    setLive({ pass, hostBalance, guestBalance, events, updatedAt: new Date() });
    setRefreshing(false);
  }, [host, guest, session.contractId, session.deployLedger]);

  useEffect(() => {
    if (hydrated) void refresh();
  }, [hydrated, refresh, session.buyTx, session.checkInTx]);

  const focusStep = (n: number) =>
    setTimeout(() => stepRefs.current[n]?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);

  async function run(step: number, action: () => Promise<void>) {
    setBusy(step);
    setErrors((prev) => ({ ...prev, [step]: "" }));
    try {
      await action();
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        [step]: error instanceof Error ? error.message : "Algo salió mal. Intenta de nuevo.",
      }));
    } finally {
      setBusy(null);
    }
  }

  const createAccounts = () =>
    run(1, async () => {
      const [h, g] = await Promise.all([createFundedAccount(), createFundedAccount()]);
      update(null);
      update({ hostSecret: h.secret(), guestSecret: g.secret() });
      focusStep(2);
    });

  const createEvent = () =>
    run(2, async () => {
      const stroops = xlmToStroops(priceXlm);
      if (stroops <= 0n) throw new Error("El precio tiene que ser mayor a cero.");
      if (stroops > xlmToStroops("100")) throw new Error("Para la prueba, usa un precio de hasta 100 XLM.");
      const name = eventName.trim() || "Meet de prueba";
      const result = await deployEvent(Keypair.fromSecret(session.hostSecret!), name, stroops);
      if (!result.outcome.ok) throw new Error(failureText(result.outcome));
      update({
        contractId: result.contractId,
        eventName: name,
        priceStroops: stroops.toString(),
        deployTx: result.outcome.hash,
        deployFee: result.outcome.feeXlm,
        deployLedger: result.ledger,
      });
      focusStep(3);
    });

  const buy = () =>
    run(3, async () => {
      const outcome = await buyPass(session.contractId!, Keypair.fromSecret(session.guestSecret!));
      if (!outcome.ok) throw new Error(failureText(outcome));
      update({ buyTx: outcome.hash, buyFee: outcome.feeXlm });
      focusStep(4);
    });

  const letIn = () =>
    run(4, async () => {
      const outcome = await checkIn(session.contractId!, Keypair.fromSecret(session.hostSecret!), guest!);
      if (!outcome.ok) throw new Error(failureText(outcome));
      update({ checkInTx: outcome.hash, checkInFee: outcome.feeXlm });
      focusStep(5);
    });

  const tryAgain = () =>
    run(5, async () => {
      const outcome = await checkIn(session.contractId!, Keypair.fromSecret(session.hostSecret!), guest!);
      if (outcome.ok) {
        throw new Error("El contrato aceptó un segundo ingreso. Esto no debería pasar.");
      }
      update({ retry: { code: outcome.code, message: outcome.message } });
    });

  const reset = () => {
    if (window.confirm("¿Empezar de nuevo? Se olvidan las cuentas y el evento de esta prueba.")) {
      update(null);
      setErrors({});
      setLive({ pass: null, hostBalance: null, guestBalance: null, events: [], updatedAt: null });
      focusStep(1);
    }
  };

  const done = {
    1: Boolean(host && guest),
    2: Boolean(session.contractId),
    3: Boolean(session.buyTx),
    4: Boolean(session.checkInTx),
    5: Boolean(session.retry),
  };
  const statusOf = (n: 1 | 2 | 3 | 4 | 5): StepStatus => {
    if (done[n]) return "done";
    if (n === 1 || done[(n - 1) as 1 | 2 | 3 | 4]) return "ready";
    return "locked";
  };
  const priceLabel = price !== null ? `${formatXlm(price)} XLM` : `${priceXlm || "1"} XLM`;
  const who = { host: host ? short(host) : "G…", guest: guest ? short(guest) : "G…" };
  const contractShort = session.contractId ? short(session.contractId) : "C…";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <ol className="flex flex-col gap-5" aria-label="Pasos de la demo">
        <Step
          n={1}
          refCb={(el) => (stepRefs.current[1] = el)}
          title="Crear las cuentas de prueba"
          actor="Preparación"
          status={statusOf(1)}
          explanation={
            <>
              En Stellar, una <Term>cuenta</Term> es una dirección pública que empieza con G, más una llave
              secreta que sirve para <Term>firmar</Term>. Creamos dos: el <strong>anfitrión</strong>, que organiza
              el Meet, y el <strong>invitado</strong>, que quiere entrar. Friendbot, el servicio de la red de
              prueba, les regala 10.000 XLM a cada una.
            </>
          }
          action={
            <ActionButton onClick={createAccounts} busy={busy === 1} disabled={!hydrated || busy !== null}>
              {done[1] ? "Crear cuentas nuevas" : "Crear cuentas"}
            </ActionButton>
          }
          error={errors[1]}
          command={`stellar keys generate anfitrion --network testnet --fund\nstellar keys generate invitado --network testnet --fund`}
        >
          {done[1] && (
            <Result tone="ok">
              <p className="font-medium">Listo: dos cuentas con 10.000 XLM de prueba cada una.</p>
              <ul className="mt-2 space-y-1 text-sm">
                <li>
                  Anfitrión: <AccountLink address={host!} />
                </li>
                <li>
                  Invitado: <AccountLink address={guest!} />
                </li>
              </ul>
            </Result>
          )}
        </Step>

        <Step
          n={2}
          refCb={(el) => (stepRefs.current[2] = el)}
          title="Crear el evento"
          actor="Anfitrión"
          status={statusOf(2)}
          explanation={
            <>
              El anfitrión publica un <Term>contrato</Term> con las reglas de su evento: quién cobra, cuánto
              cuesta el pase y cómo se llama. Desde ese momento las reglas viven en la blockchain y nadie puede
              cambiarlas, ni siquiera él.
            </>
          }
          action={
            !done[2] && (
              <div className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-muted">Nombre del evento</span>
                    <input
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value.slice(0, 40))}
                      className="h-11 rounded-xl border border-border bg-bg px-3 text-text outline-none focus:border-accent"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-muted">Precio (XLM)</span>
                    <input
                      value={priceXlm}
                      inputMode="decimal"
                      onChange={(e) => setPriceXlm(e.target.value.replace(/[^\d.,]/g, "").slice(0, 8))}
                      className="h-11 rounded-xl border border-border bg-bg px-3 text-text outline-none focus:border-accent"
                    />
                  </label>
                </div>
                <ActionButton
                  onClick={createEvent}
                  busy={busy === 2}
                  disabled={statusOf(2) !== "ready" || busy !== null}
                >
                  Crear evento
                </ActionButton>
              </div>
            )
          }
          error={errors[2]}
          command={`stellar contract deploy --wasm-hash ${WASM_HASH.slice(0, 8)}… \\\n  --source-account anfitrion --network testnet \\\n  -- --host anfitrion --token ${short(XLM_CONTRACT)} \\\n  --price ${session.priceStroops ?? xlmToStroops(priceXlm || "1").toString()} --name "${session.eventName ?? eventName}"`}
          txHash={session.deployTx}
        >
          {done[2] && (
            <Result tone="ok">
              <p className="font-medium">
                Evento creado: «{session.eventName}», con pase de {priceLabel}.
              </p>
              <p className="mt-1 text-sm">
                Su contrato vive en la dirección{" "}
                <a
                  href={`${EXPLORER}/contract/${session.contractId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono underline decoration-dotted underline-offset-4"
                >
                  {contractShort}
                </a>
                . {session.deployFee && <>Comisión de la red: {session.deployFee} XLM.</>}
              </p>
            </Result>
          )}
        </Step>

        <Step
          n={3}
          refCb={(el) => (stepRefs.current[3] = el)}
          title="Comprar el pase"
          actor="Invitado"
          status={statusOf(3)}
          explanation={
            <>
              El invitado firma la compra. En una sola operación, el contrato le cobra {priceLabel}, se lo paga
              al anfitrión y anota que esta cuenta tiene pase. Si alguna parte falla, no pasa nada: ni se cobra
              ni se anota.
            </>
          }
          action={
            !done[3] && (
              <ActionButton onClick={buy} busy={busy === 3} disabled={statusOf(3) !== "ready" || busy !== null}>
                Comprar pase ({priceLabel})
              </ActionButton>
            )
          }
          error={errors[3]}
          command={`stellar contract invoke --id ${contractShort} --source-account invitado \\\n  --network testnet -- buy --buyer ${who.guest}`}
          txHash={session.buyTx}
        >
          {done[3] && (
            <Result tone="ok">
              <p className="font-medium">
                Pase comprado: {priceLabel} pasaron del invitado al anfitrión.
              </p>
              <p className="mt-1 text-sm">
                El contrato anotó el pase como <strong>Comprado</strong> y publicó el <Term>evento</Term>{" "}
                <code className="font-mono">bought</code>.
                {session.buyFee && (
                  <>
                    {" "}
                    Comisión de la red: {session.buyFee} XLM; incluye la renta por guardar el pase en la red
                    durante 120 días.
                  </>
                )}
              </p>
            </Result>
          )}
        </Step>

        <Step
          n={4}
          refCb={(el) => (stepRefs.current[4] = el)}
          title="Dejar entrar al Meet"
          actor="Anfitrión"
          status={statusOf(4)}
          explanation={
            <>
              En la puerta del Meet, el anfitrión marca el pase como usado. Solo él puede hacerlo: el contrato
              exige su firma, y su dirección la saca de sus propias reglas, así que nadie puede hacerse pasar por
              él.
            </>
          }
          action={
            !done[4] && (
              <ActionButton onClick={letIn} busy={busy === 4} disabled={statusOf(4) !== "ready" || busy !== null}>
                Dejar entrar
              </ActionButton>
            )
          }
          error={errors[4]}
          command={`stellar contract invoke --id ${contractShort} --source-account anfitrion \\\n  --network testnet -- check_in --buyer ${who.guest}`}
          txHash={session.checkInTx}
        >
          {done[4] && (
            <Result tone="ok">
              <p className="font-medium">Entrada registrada: el pase ahora figura como Usado.</p>
              <p className="mt-1 text-sm">
                El contrato publicó el evento <code className="font-mono">checked_in</code>.
              </p>
            </Result>
          )}
        </Step>

        <Step
          n={5}
          refCb={(el) => (stepRefs.current[5] = el)}
          title="Intentar entrar otra vez"
          actor="Anfitrión"
          status={statusOf(5)}
          explanation={
            <>
              ¿Y si alguien intenta reutilizar el mismo pase? Probemos exactamente el mismo check-in otra vez.
            </>
          }
          action={
            !done[5] && (
              <ActionButton
                onClick={tryAgain}
                busy={busy === 5}
                disabled={statusOf(5) !== "ready" || busy !== null}
              >
                Intentar entrar de nuevo
              </ActionButton>
            )
          }
          error={errors[5]}
          command={`stellar contract invoke --id ${contractShort} --source-account anfitrion \\\n  --network testnet -- check_in --buyer ${who.guest}`}
        >
          {done[5] && (
            <Result tone="bad">
              <p className="font-medium">
                Rechazado:{" "}
                {session.retry?.code && CONTRACT_ERRORS[session.retry.code]
                  ? `${CONTRACT_ERRORS[session.retry.code].meaning} (error #${session.retry.code}, ${CONTRACT_ERRORS[session.retry.code].name}).`
                  : session.retry?.message}
              </p>
              <p className="mt-1 text-sm">
                La red ni siquiera recibió la transacción: antes de enviarla se <Term>simula</Term>, y la
                simulación ya falló. Esa es la garantía: un pase se usa una sola vez, y lo asegura el contrato, no
                una persona.
              </p>
            </Result>
          )}
        </Step>

        {done[5] && (
          <li className="rounded-2xl border border-accent bg-accent-soft p-5">
            <p className="font-semibold">¡Terminaste la demo!</p>
            <p className="mt-1 text-sm text-muted">
              Viste las dos reglas del contrato en acción: solo entra quien compró su pase, y cada pase se usa una
              sola vez. Todo quedó registrado en la blockchain y cualquiera puede verificarlo en el explorador.
            </p>
          </li>
        )}

        {hydrated && done[1] && (
          <li className="list-none">
            <button
              type="button"
              onClick={reset}
              disabled={busy !== null}
              className="text-sm text-muted underline decoration-dotted underline-offset-4 hover:text-text disabled:opacity-50"
            >
              Empezar de nuevo con cuentas nuevas
            </button>
          </li>
        )}
      </ol>

      <LivePanel
        live={live}
        hasAccounts={done[1]}
        hasContract={done[2]}
        host={host}
        guest={guest}
        contractId={session.contractId}
        refreshing={refreshing}
        onRefresh={refresh}
      />
    </div>
  );
}

type StepStatus = "locked" | "ready" | "done";

function Step({
  n,
  refCb,
  title,
  actor,
  status,
  explanation,
  action,
  error,
  command,
  txHash,
  children,
}: {
  n: number;
  refCb: (el: HTMLElement | null) => void;
  title: string;
  actor: string;
  status: StepStatus;
  explanation: ReactNode;
  action?: ReactNode;
  error?: string;
  command: string;
  txHash?: string;
  children?: ReactNode;
}) {
  const locked = status === "locked";
  return (
    <li
      ref={refCb}
      className={`rounded-2xl border bg-surface p-5 transition-opacity sm:p-6 ${
        status === "ready" ? "border-accent shadow-sm" : "border-border"
      } ${locked ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            status === "done" ? "bg-ok text-surface" : status === "ready" ? "bg-accent text-surface" : "bg-surface-2 text-muted"
          }`}
        >
          {status === "done" ? "✓" : n}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-lg font-semibold">
              <span className="sr-only">Paso {n}: </span>
              {title}
            </h3>
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted">{actor}</span>
            {locked && <span className="text-xs text-muted">Completa el paso anterior</span>}
          </div>
          <p className="mt-2 leading-relaxed text-muted">{explanation}</p>

          {!locked && action && <div className="mt-4">{action}</div>}
          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">
              {error}
            </p>
          )}
          <div aria-live="polite">{children && <div className="mt-4">{children}</div>}</div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {txHash && (
              <a
                href={`${EXPLORER}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-accent underline-offset-4 hover:underline"
              >
                Ver la transacción en el explorador ↗
              </a>
            )}
          </div>
          <details className="group mt-3">
            <summary className="cursor-pointer list-none text-sm text-muted hover:text-text">
              <span className="inline-block transition-transform group-open:rotate-90">›</span> Ver como comando
              del Stellar CLI
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-code-bg p-4 font-mono text-xs leading-relaxed text-code-text">
              {command}
            </pre>
          </details>
        </div>
      </div>
    </li>
  );
}

function ActionButton({
  onClick,
  busy,
  disabled,
  children,
}: {
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-6 font-medium text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-surface border-t-transparent"
        />
      )}
      {busy ? "Enviando a la red…" : children}
    </button>
  );
}

function Result({ tone, children }: { tone: "ok" | "bad"; children: ReactNode }) {
  return (
    <div
      className={`rounded-xl px-4 py-3 ${tone === "ok" ? "bg-ok-soft text-text" : "bg-bad-soft text-text"}`}
    >
      <div className={`mb-1 text-xs font-semibold uppercase tracking-wide ${tone === "ok" ? "text-ok" : "text-bad"}`}>
        {tone === "ok" ? "Resultado" : "Resultado: rechazado"}
      </div>
      {children}
    </div>
  );
}

function Term({ children }: { children: ReactNode }) {
  return (
    <a href="#glosario" className="text-text underline decoration-dotted underline-offset-4">
      {children}
    </a>
  );
}

function AccountLink({ address }: { address: string }) {
  return (
    <a
      href={`${EXPLORER}/account/${address}`}
      target="_blank"
      rel="noreferrer"
      className="font-mono underline decoration-dotted underline-offset-4"
    >
      {short(address)}
    </a>
  );
}

const PASS_STAGES: { key: PassStatus; label: string }[] = [
  { key: "none", label: "Sin pase" },
  { key: "bought", label: "Comprado" },
  { key: "used", label: "Usado" },
];

function LivePanel({
  live,
  hasAccounts,
  hasContract,
  host,
  guest,
  contractId,
  refreshing,
  onRefresh,
}: {
  live: Live;
  hasAccounts: boolean;
  hasContract: boolean;
  host: string | null;
  guest: string | null;
  contractId?: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const stageIndex = live.pass ? PASS_STAGES.findIndex((s) => s.key === live.pass) : -1;
  return (
    <aside className="rounded-2xl border border-border bg-surface p-5 lg:sticky lg:top-6" aria-label="Estado en la blockchain">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">Lo que dice la blockchain</h3>
        <button
          type="button"
          onClick={onRefresh}
          disabled={!hasAccounts || refreshing}
          className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {refreshing ? "Leyendo…" : "Actualizar"}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">
        Esto no es la memoria de la página: se lee directo de la red en cada paso.
      </p>

      {!hasAccounts ? (
        <p className="mt-5 rounded-xl bg-surface-2 p-4 text-sm text-muted">
          Crea las cuentas en el paso 1 para empezar a ver el estado real.
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-6">
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Pase del invitado</h4>
            {hasContract ? (
              <ol className="mt-3 grid grid-cols-3 gap-2">
                {PASS_STAGES.map((stage, i) => (
                  <li
                    key={stage.key}
                    className={`rounded-xl px-2 py-2 text-center text-sm ${
                      i === stageIndex
                        ? stage.key === "used"
                          ? "bg-ok text-surface font-semibold"
                          : "bg-accent text-surface font-semibold"
                        : i < stageIndex
                          ? "bg-surface-2 text-muted line-through"
                          : "bg-surface-2 text-muted"
                    }`}
                    aria-current={i === stageIndex ? "step" : undefined}
                  >
                    {stage.label}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-muted">Todavía no hay evento.</p>
            )}
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Saldos</h4>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt>Anfitrión {host && <span className="font-mono text-xs text-muted">{short(host)}</span>}</dt>
                <dd className="font-mono">{live.hostBalance ? `${Number(live.hostBalance).toLocaleString("es-BO", { maximumFractionDigits: 4 })} XLM` : "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Invitado {guest && <span className="font-mono text-xs text-muted">{short(guest)}</span>}</dt>
                <dd className="font-mono">{live.guestBalance ? `${Number(live.guestBalance).toLocaleString("es-BO", { maximumFractionDigits: 4 })} XLM` : "—"}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted">
              El invitado baja un poco más que el precio: también paga la comisión de la red.
            </p>
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Eventos del contrato</h4>
            {live.events.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Aún no hay eventos.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {live.events.map((event) => (
                  <li key={event.id} className="rounded-xl bg-surface-2 px-3 py-2">
                    <code className="font-mono font-semibold">{event.name}</code>{" "}
                    <span className="text-muted">
                      {event.name === "bought"
                        ? `el invitado compró su pase${event.price !== null ? ` por ${formatXlm(event.price)} XLM` : ""}`
                        : event.name === "checked_in"
                          ? "el invitado entró al Meet"
                          : ""}
                    </span>
                    <a
                      href={`${EXPLORER}/tx/${event.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 block text-xs text-accent hover:underline"
                    >
                      bloque {event.ledger.toLocaleString("es-BO")} ↗
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {contractId && (
            <a
              href={`${EXPLORER}/contract/${contractId}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-accent hover:underline"
            >
              Ver el contrato en el explorador ↗
            </a>
          )}
          {live.updatedAt && (
            <p className="text-xs text-muted">
              Leído a las {live.updatedAt.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
