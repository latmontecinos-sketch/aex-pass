import { AexPass } from "@/components/aex-pass";
import { HowIDidIt } from "@/components/how-i-did-it";

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
    term: "Stellar CLI",
    text: "La herramienta oficial de Stellar para la terminal: compila, publica y usa contratos con comandos.",
  },
  {
    term: "Invocar",
    text: "Llamar a una función de un contrato, como buy (comprar) o check_in (dejar entrar).",
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

const nav = [
  { href: "#como-lo-hice", label: "Cómo lo hice" },
  { href: "#pruebalo", label: "Pruébalo" },
  { href: "#glosario", label: "Glosario" },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-6">
        <span className="text-lg font-bold tracking-tight">
          Aex <span className="text-accent">Pass</span>
        </span>
        <nav aria-label="Secciones" className="order-last w-full sm:order-none sm:w-auto">
          <ul className="flex gap-5 text-sm text-muted">
            {nav.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="hover:text-text">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
          Red de prueba · Stellar testnet
        </span>
      </header>

      <section className="py-8 sm:py-12">
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Un pase que no se puede usar dos veces.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
          Aex Pass controla la entrada a un Meet con un contrato en la blockchain de Stellar. Aquí ves cómo lo
          construí y lo usé desde el Stellar CLI, paso a paso y con las transacciones reales. Después puedes
          probarlo tú, sin instalar nada.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="#como-lo-hice"
            className="inline-flex h-11 items-center rounded-full bg-accent px-6 font-medium text-surface hover:opacity-90"
          >
            Ver cómo lo hice
          </a>
          <a
            href="#pruebalo"
            className="inline-flex h-11 items-center rounded-full border border-border bg-surface px-6 font-medium hover:border-accent hover:text-accent"
          >
            Probarlo
          </a>
        </div>
        <p className="mt-6 max-w-2xl rounded-xl bg-warn-soft px-4 py-3 text-sm">
          Todo ocurre en la red de prueba de Stellar: el XLM no tiene valor real.
        </p>
      </section>

      <section aria-labelledby="personajes" className="pb-12">
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

      <section id="como-lo-hice" aria-labelledby="como-lo-hice-titulo" className="scroll-mt-6">
        <h2 id="como-lo-hice-titulo" className="text-3xl font-bold tracking-tight">
          Cómo lo hice, paso a paso
        </h2>
        <p className="mt-2 max-w-3xl leading-relaxed text-muted">
          Primero hice todo desde la terminal con el Stellar CLI, la herramienta oficial de Stellar. Estos son los
          11 pasos reales: el comando que usé, qué hace y qué quedó registrado en la blockchain.
        </p>
        <div className="mt-8">
          <HowIDidIt />
        </div>
      </section>

      <section id="pruebalo" aria-labelledby="pruebalo-titulo" className="scroll-mt-6 pt-20">
        <h2 id="pruebalo-titulo" className="text-3xl font-bold tracking-tight">
          Pruébalo tú
        </h2>
        <p className="mt-2 mb-6 max-w-3xl leading-relaxed text-muted">
          El mismo flujo, con botones. La página crea tus propias cuentas de prueba y tu propio evento (una copia
          nueva del contrato), así que puedes hacerlo de principio a fin sin instalar nada.
        </p>
        <AexPass />
      </section>

      <section id="glosario" aria-labelledby="glosario-titulo" className="scroll-mt-6 pt-20">
        <h2 id="glosario-titulo" className="text-3xl font-bold tracking-tight">
          Glosario
        </h2>
        <p className="mt-2 text-muted">Las palabras de esta página, en simple.</p>
        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          {glossary.map((g) => (
            <div key={g.term} className="rounded-2xl border border-border bg-surface p-4">
              <dt className="font-semibold">{g.term}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">{g.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="mt-16 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-sm text-muted">
        <span>
          Hecho por{" "}
          <a href="https://latmontecinos.vercel.app" className="text-text hover:text-accent">
            Alejandro Tintaya Montecinos
          </a>{" "}
          · Stellar Elite Bolivia
        </span>
        <a
          href="https://github.com/latmontecinos-sketch/aex-pass"
          target="_blank"
          rel="noreferrer"
          className="hover:text-accent"
        >
          Código en GitHub ↗
        </a>
      </footer>
    </div>
  );
}
