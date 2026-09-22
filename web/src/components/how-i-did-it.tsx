import type { ReactNode } from "react";
import { EXPLORER, ORIGINAL_CONTRACT, WASM_HASH, XLM_CONTRACT, short } from "@/lib/stellar";
import { OriginalLiveStatus } from "@/components/original-live-status";

// Datos reales de la primera instancia, desplegada e invocada desde el Stellar CLI
// el 22 de septiembre de 2026 (hora de Bolivia).
const HOST = "GAAAGOVI3UD4E3BF4YG5EKEP7B36UG26YN6M2FOSC3LM5W37QFNN6SKK";
const GUEST = "GA7KF4C26APK72OCBBEX23AM45GYYDYXCXRCAHI47APCLYWUHSEX2DJH";
const TX = {
  deploy: "de2cf14fa6a1548b1e4640f79287a6dffc919a346cd28f909ff15bbb4cc9ca56",
  buy: "768aab930342ef4dc68fe35d15903768e7ec9eec90812e2c924a29d0070d3645",
  checkIn: "1cfcb96f7c1c5d91d4510d8a22045d14cc6be39e79078d55d27878e37c09d367",
};
const CLI = "stellar contract invoke --id aex-prueba-pass-stellar-01";

const CONTRACT_SNIPPET = `pub fn buy(env: Env, buyer: Address) -> Result<(), Error> {
    buyer.require_auth();                          // firma del comprador
    if ya_tiene_pase(&buyer) {
        return Err(Error::AlreadyBought);          // un pase por cuenta
    }
    guardar_pase(&buyer, PassStatus::Bought);
    xlm.transfer(&buyer, &anfitrion, &precio);     // cobra y paga al anfitrión
    Bought { buyer, price }.publish(&env);         // evento "bought"
    Ok(())
}

pub fn check_in(env: Env, buyer: Address) -> Result<(), Error> {
    anfitrion.require_auth();                      // firma del anfitrión
    match pase_de(&buyer) {
        None => Err(Error::NoPass),                // error #3
        Some(PassStatus::Used) => Err(Error::AlreadyUsed), // error #4
        Some(PassStatus::Bought) => {
            guardar_pase(&buyer, PassStatus::Used);
            CheckedIn { buyer }.publish(&env);     // evento "checked_in"
            Ok(())
        }
    }
}`;

type Tone = "ok" | "bad" | "info";

function Step({
  n,
  title,
  children,
  command,
  result,
  tone = "ok",
  commandLabel = "Comando",
}: {
  n: number;
  title: string;
  children: ReactNode;
  command?: string;
  result?: ReactNode;
  tone?: Tone;
  commandLabel?: string;
}) {
  const toneClass =
    tone === "ok" ? "bg-ok-soft" : tone === "bad" ? "bg-bad-soft" : "bg-surface-2";
  const labelClass = tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : "text-muted";
  return (
    <li className="relative rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent"
        >
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-lg font-semibold">
            <span className="sr-only">Paso {n}: </span>
            {title}
          </h4>
          <div className="mt-2 leading-relaxed text-muted">{children}</div>
          {command && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{commandLabel}</p>
              <pre className="overflow-x-auto rounded-xl bg-code-bg p-4 font-mono text-xs leading-relaxed text-code-text">
                {command}
              </pre>
            </div>
          )}
          {result && (
            <div className={`mt-3 rounded-xl px-4 py-3 text-sm ${toneClass}`}>
              <p className={`mb-1 text-xs font-semibold uppercase tracking-wide ${labelClass}`}>
                {tone === "bad" ? "Resultado: rechazado" : "Resultado"}
              </p>
              <div className="leading-relaxed">{result}</div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function TxLink({ hash, children }: { hash: string; children?: ReactNode }) {
  return (
    <a
      href={`${EXPLORER}/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-accent underline-offset-4 hover:underline"
    >
      {children ?? `tx ${hash.slice(0, 8)}…`} ↗
    </a>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[0.9em]">{children}</code>;
}

function Phase({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="mt-10 first:mt-0">
      <h3 className="text-xl font-bold tracking-tight">{title}</h3>
      <p className="mt-1 text-muted">{text}</p>
      <ol className="mt-5 flex flex-col gap-4">{children}</ol>
    </div>
  );
}

export function HowIDidIt() {
  return (
    <div className="max-w-4xl">
      <Phase
        title="1 · Preparar y escribir el contrato"
        text="Todo en mi computadora, antes de tocar la red."
      >
        <Step
          n={1}
          title="Instalar las herramientas"
          command={`winget install Rustlang.Rustup
rustup target add wasm32v1-none
winget install Stellar.StellarCLI`}
          result={<>Rust y el Stellar CLI 28 instalados.</>}
        >
          Los contratos de Stellar se escriben en <strong className="text-text">Rust</strong> y se compilan a
          WebAssembly, el formato que ejecuta la red (eso es <Mono>wasm32v1-none</Mono>). El{" "}
          <strong className="text-text">Stellar CLI</strong> es la herramienta oficial para compilar, publicar y
          usar contratos desde la terminal.
        </Step>

        <Step
          n={2}
          title="Escribir el contrato"
          command={CONTRACT_SNIPPET}
          commandLabel="Código (simplificado)"
          result={
            <>
              Un contrato de unas 160 líneas en Rust con <Mono>soroban-sdk</Mono>. El fragmento de arriba está
              simplificado; el código completo está en{" "}
              <a
                href="https://github.com/latmontecinos-sketch/aex-pass/blob/main/src/lib.rs"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-accent underline-offset-4 hover:underline"
              >
                GitHub ↗
              </a>
              .
            </>
          }
          tone="info"
        >
          Dos funciones hacen el trabajo. <Mono>buy</Mono> exige la firma del comprador, no deja comprar dos
          veces, guarda el pase como <em>Bought</em> y cobra. <Mono>check_in</Mono> exige la firma del
          anfitrión y solo acepta un pase en <em>Bought</em>: si no existe devuelve el error 3, y si ya se usó,
          el error 4.
        </Step>

        <Step
          n={3}
          title="Probarlo sin gastar nada"
          command="cargo test"
          result={
            <>
              <strong>7 pruebas pasaron:</strong> compra, doble compra, check-in único, check-in sin pase,
              check-in sin firma del anfitrión, precio inválido y datos del evento.
            </>
          }
        >
          Antes de publicar, las pruebas simulan una red completa en la computadora: crean cuentas, un XLM de
          mentira y el contrato, y verifican que cada regla se cumpla.
        </Step>

        <Step
          n={4}
          title="Compilarlo"
          command="stellar contract build"
          result={
            <>
              Un archivo WASM de <strong>4.281 bytes</strong> con 7 funciones. Su huella digital (hash) es{" "}
              <Mono>{WASM_HASH.slice(0, 8)}…</Mono>, la misma que muestra el explorador para el código publicado:
              así se comprueba que lo que corre en la red es este código.
            </>
          }
        >
          Convierte el código Rust en el archivo que se sube a la blockchain.
        </Step>
      </Phase>

      <Phase title="2 · Publicarlo en la red de prueba" text="Desde aquí, todo queda registrado en Stellar testnet.">
        <Step
          n={5}
          title="Crear las cuentas"
          command={`stellar keys generate anfitrion --network testnet --fund
stellar keys generate asistente --network testnet --fund`}
          result={
            <>
              Anfitrión{" "}
              <a href={`${EXPLORER}/account/${HOST}`} target="_blank" rel="noreferrer" className="font-mono underline decoration-dotted underline-offset-4">
                {short(HOST)}
              </a>{" "}
              y asistente{" "}
              <a href={`${EXPLORER}/account/${GUEST}`} target="_blank" rel="noreferrer" className="font-mono underline decoration-dotted underline-offset-4">
                {short(GUEST)}
              </a>
              , con 10.000 XLM de prueba cada una.
            </>
          }
        >
          Cada cuenta es una dirección pública y una llave secreta, que el CLI guarda en la computadora. Con{" "}
          <Mono>--fund</Mono>, Friendbot les regala XLM de prueba.
        </Step>

        <Step
          n={6}
          title="Desplegar el contrato"
          command={`stellar contract deploy \\
  --wasm target/wasm32v1-none/release/aex_prueba_pass_stellar_01.wasm \\
  --source-account anfitrion --network testnet \\
  --alias aex-prueba-pass-stellar-01 \\
  -- --host anfitrion --token ${XLM_CONTRACT} \\
  --price 10000000 --name "Aex Prueba Pass Stellar 01"`}
          result={
            <>
              Contrato{" "}
              <a
                href={`${EXPLORER}/contract/${ORIGINAL_CONTRACT}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono underline decoration-dotted underline-offset-4"
              >
                {short(ORIGINAL_CONTRACT)}
              </a>{" "}
              publicado a las 13:48. Comisión: 0,011 XLM. <TxLink hash={TX.deploy} />
            </>
          }
        >
          Sube el código y crea el contrato. Lo que va después de <Mono>--</Mono> se guarda una sola vez, al
          nacer: el anfitrión, el activo con que se paga (XLM), el precio (1 XLM, que son 10.000.000 stroops) y
          el nombre. Esas reglas ya no se pueden cambiar.
        </Step>
      </Phase>

      <Phase
        title="3 · Usarlo: las invocaciones"
        text="Invocar es llamar a una función del contrato. Estas son las que ejecuté, en orden."
      >
        <Step
          n={7}
          title="¿El asistente tiene pase?"
          command={`${CLI} \\
  --source-account asistente --network testnet -- pass_of --buyer asistente`}
          result={
            <>
              <Mono>null</Mono>: todavía no tiene pase.
            </>
          }
        >
          Es una lectura: el CLI la simula contra la red y no envía ninguna transacción, así que no cuesta nada.
        </Step>

        <Step
          n={8}
          title="Comprar el pase"
          command={`${CLI} \\
  --source-account asistente --network testnet -- buy --buyer asistente`}
          result={
            <>
              Compra confirmada a las 16:40:17. <strong>1 XLM</strong> pasó del asistente al anfitrión, el pase
              quedó en <em>Bought</em> y el contrato publicó el evento <Mono>bought</Mono>.{" "}
              <TxLink hash={TX.buy} />
              <span className="mt-2 block">
                La comisión fue de <strong>17,64 XLM</strong>: casi todo es renta por guardar datos en la red
                durante 120 días (el pase, el contrato y su código). Es XLM de prueba, pero me enseñó que ese plazo
                hay que ajustarlo a la duración real del evento.
              </span>
            </>
          }
        >
          El asistente firma. En una sola operación, el contrato le cobra 1 XLM, se lo paga al anfitrión y anota
          su pase. En el explorador, al abrir el detalle de la transacción (la flecha ⇊), se ven la transferencia
          de 1 XLM, el evento <Mono>bought</Mono> y el dato guardado <Mono>Pass = Bought</Mono>.
        </Step>

        <Step
          n={9}
          title="Dejar entrar al Meet"
          command={`${CLI} \\
  --source-account anfitrion --network testnet -- check_in --buyer asistente`}
          result={
            <>
              Check-in confirmado a las 16:40:27, diez segundos después. El pase pasó a <em>Used</em> y el
              contrato publicó el evento <Mono>checked_in</Mono>. Comisión: 0,00076 XLM.{" "}
              <TxLink hash={TX.checkIn} />
            </>
          }
        >
          Ahora firma el anfitrión. El contrato no recibe su dirección como dato: la lee de las reglas que
          guardó al nacer, así que nadie más puede hacer el check-in.
        </Step>

        <Step
          n={10}
          title="Intentar entrar otra vez"
          tone="bad"
          command={`${CLI} \\
  --source-account anfitrion --network testnet -- check_in --buyer asistente`}
          result={
            <>
              <Mono>Error(Contract, #4)</Mono>: <strong>AlreadyUsed</strong>, este pase ya se usó. La
              transacción nunca llegó a la red: el CLI la simula antes de enviarla, y la simulación ya falló. Por
              eso este intento no aparece en el explorador.
            </>
          }
        >
          El mismo comando, exactamente igual. Es la prueba de la regla principal: un pase se usa una sola vez,
          y lo garantiza el contrato, incluso frente al propio anfitrión.
        </Step>

        <Step
          n={11}
          title="Ver el estado final"
          command={`${CLI} \\
  --source-account asistente --network testnet -- pass_of --buyer asistente`}
          result={
            <>
              <Mono>&quot;Used&quot;</Mono>: el pase está usado. También se ve en el{" "}
              <a
                href={`${EXPLORER}/contract/${ORIGINAL_CONTRACT}/storage`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-accent underline-offset-4 hover:underline"
              >
                storage del contrato ↗
              </a>
              : una fila con las reglas del evento y otra con el pase del asistente en <em>Used</em>.
            </>
          }
        >
          Una última lectura para confirmar cómo quedó todo.
        </Step>
      </Phase>

      <OriginalLiveStatus guest={GUEST} />
    </div>
  );
}
