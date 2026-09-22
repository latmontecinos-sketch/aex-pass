import { AexPass } from "@/components/aex-pass";
import { EXPLORER, ORIGINAL_CONTRACT, short } from "@/lib/stellar";

const characters = [
  {
    icon: "🎤",
    name: "Anfitrión",
    text: "Organiza el Meet, cobra el pase y deja entrar a la gente.",
  },
  {
    icon: "🙋",
    name: "Invitado",
    text: "Compra su pase y lo usa para entrar.",
  },
  {
    icon: "📜",
    name: "Contrato",
    text: "Las reglas del evento, guardadas en la blockchain. Nadie se las puede saltar.",
  },
];

const glossary = [
  {
    term: "Blockchain",
    text: "Un registro público y compartido que nadie puede editar a escondidas. Stellar es una blockchain.",
  },
  {
    term: "Testnet (red de prueba)",
    text: "Una copia de Stellar para practicar. Funciona igual que la real, pero el XLM no vale dinero.",
  },
  {
    term: "Contrato",
    text: "Un programa que vive en la blockchain y aplica reglas por sí solo. El de Aex Pass tiene dos: solo entra quien compró, y cada pase se usa una vez.",
  },
  {
    term: "Cuenta",
    text: "Una dirección pública (empieza con G) y una llave secreta. La dirección se puede compartir; la llave no.",
  },
  {
    term: "Firmar",
    text: "Aprobar una operación con la llave secreta. El contrato comprueba que firmó la persona correcta: el invitado para comprar, el anfitrión para dejar entrar.",
  },
  {
    term: "Transacción",
    text: "Un pedido enviado a la red, como «comprar pase». Queda registrado para siempre y se puede ver en el explorador.",
  },
  {
    term: "Simular",
    text: "Probar una transacción antes de enviarla. Si la simulación falla, la transacción no se envía y no se cobra nada.",
  },
  {
    term: "Evento",
    text: "Un aviso público que deja el contrato cuando pasa algo: bought (compró) y checked_in (entró).",
  },
  {
    term: "Storage (almacenamiento)",
    text: "Los datos que guarda el contrato en la red, como el estado de cada pase. Guardarlos tiene un costo: la renta.",
  },
  {
    term: "XLM y stroops",
    text: "XLM es la moneda de Stellar. Un stroop es su unidad mínima: 1 XLM son 10.000.000 stroops.",
  },
  {
    term: "Explorador",
    text: "Una página que muestra todo lo que pasa en la blockchain. Aquí usamos stellar.expert.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-8">
      <header className="flex items-center justify-between gap-4 py-6">
        <span className="text-lg font-bold tracking-tight">
          Aex <span className="text-accent">Pass</span>
        </span>
        <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
          Red de prueba · Stellar testnet
        </span>
      </header>

      <section className="py-8 sm:py-12">
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Un pase que no se puede usar dos veces.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
          Aex Pass controla la entrada a un Meet con un contrato en la blockchain de Stellar. Pruébalo en 5
          pasos: creas un evento, compras un pase y ves cómo el contrato frena a quien intenta entrar dos veces.
        </p>
        <p className="mt-4 max-w-2xl rounded-xl bg-warn-soft px-4 py-3 text-sm">
          Todo ocurre en la red de prueba: el XLM no tiene valor real y no necesitas instalar nada.
        </p>
      </section>

      <section aria-labelledby="personajes" className="pb-10">
        <h2 id="personajes" className="sr-only">
          Quién participa
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {characters.map((c) => (
            <li key={c.name} className="flex gap-3 rounded-2xl border border-border bg-surface p-4">
              <span aria-hidden className="text-2xl">
                {c.icon}
              </span>
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="mt-0.5 text-sm text-muted">{c.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="demo" className="scroll-mt-6">
        <h2 id="demo" className="mb-5 text-2xl font-bold tracking-tight">
          Pruébalo
        </h2>
        <AexPass />
      </section>

      <section id="glosario" aria-labelledby="glosario-titulo" className="scroll-mt-6 pt-16">
        <h2 id="glosario-titulo" className="text-2xl font-bold tracking-tight">
          Glosario
        </h2>
        <p className="mt-2 text-muted">Las palabras de la demo, en simple.</p>
        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          {glossary.map((g) => (
            <div key={g.term} className="rounded-2xl border border-border bg-surface p-4">
              <dt className="font-semibold">{g.term}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">{g.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="original" className="pt-16">
        <h2 id="original" className="text-2xl font-bold tracking-tight">
          El contrato original
        </h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-muted">
          Aex Pass usa el contrato <strong className="text-text">Aex Prueba Pass Stellar 01</strong>, escrito en
          Rust con Soroban. Su primera instancia se desplegó e invocó desde el Stellar CLI: ahí están la compra y
          el check-in reales, y el pase en estado Usado.
        </p>
        <a
          href={`${EXPLORER}/contract/${ORIGINAL_CONTRACT}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-accent hover:text-accent"
        >
          Ver {short(ORIGINAL_CONTRACT)} en el explorador ↗
        </a>
      </section>

      <footer className="mt-16 border-t border-border pt-6 text-sm text-muted">
        Hecho por{" "}
        <a href="https://latmontecinos.vercel.app" className="text-text hover:text-accent">
          Alejandro Tintaya Montecinos
        </a>{" "}
        · Stellar Elite Bolivia
      </footer>
    </div>
  );
}
