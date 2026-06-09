import { Reveal } from "@/components/Reveal";
import { ChevronDown } from "lucide-react";

/**
 * Seção de perguntas — <details>/<summary> nativo (acessível por teclado e
 * leitor de tela, sem JS). Respostas só com o que o app realmente faz: PIN
 * duplo + trava server-side no diário, lembretes pelo Telegram, PWA. Sem cravar
 * preço (fora de escopo) e sem prometer o que não existe.
 *
 * O chevron gira via `group-open:` (variante do <details aberto>); se a variante
 * faltar, ele só não anima — o accordion continua funcionando.
 */
const FAQS: { q: string; a: string }[] = [
  {
    q: "Preciso usar todos os módulos?",
    a: "Não. Use só o que faz sentido pra você — a rotina hoje, as finanças quando quiser, o diário quando der vontade. O Touvie não cobra presença; ele se molda ao que você de fato usa.",
  },
  {
    q: "Meu diário é mesmo privado?",
    a: "É. O diário tem PIN separado pra leitura e pra escrita, e a trava roda no servidor — não é só esconder o texto na tela. Você ainda marca quais dispositivos são confiáveis e pode deixar o celular em modo só-leitura.",
  },
  {
    q: "Como funcionam os lembretes?",
    a: "Por um bot no Telegram. Um de manhã com a sua rotina e o foco do dia, um à noite com o que vence amanhã, e o fechamento do mês — tudo sem você precisar abrir o app.",
  },
  {
    q: "Funciona no celular?",
    a: "Sim. O Touvie é um PWA: dá pra instalar na tela inicial e abrir como um app de verdade, respeitando notch e área segura. A mesma conta te acompanha no celular e no computador.",
  },
  {
    q: "Meus dados são meus?",
    a: "Inteiramente. Tudo fica guardado na sua conta — o Touvie não vende nem cruza o que é seu com ninguém. O sistema é pessoal: feito pra te servir, não pra te perfilar.",
  },
  {
    q: "O Touvie já está pronto?",
    a: 'Está vivo e crescendo. É um sistema pessoal que ganha módulo e capricho a cada semana — do jeito que um "life OS" deve ser: nunca terminado, sempre mais seu.',
  },
];

export function FAQ() {
  return (
    <section id="faq" className="mx-auto w-full max-w-3xl px-6 py-24 sm:py-28">
      <Reveal>
        <p className="eyebrow flex items-center gap-3" style={{ color: "var(--color-fg-subtle)" }}>
          <span
            aria-hidden="true"
            className="h-px w-7"
            style={{ background: "color-mix(in srgb, var(--color-accent) 60%, transparent)" }}
          />
          Perguntas
        </p>
      </Reveal>
      <Reveal delay={120}>
        <h2 className="display mt-4 text-h2 sm:text-display" style={{ color: "var(--color-fg)" }}>
          Antes de <span className="display-i gradient-text">entrar</span>.
        </h2>
      </Reveal>

      <div className="mt-12">
        {FAQS.map((f, i) => (
          <Reveal key={f.q} delay={i * 70}>
            <details
              className="group border-b"
              style={{ borderColor: "var(--color-border)" }}
              open={i === 0}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 [&::-webkit-details-marker]:hidden">
                <span className="text-base sm:text-lg" style={{ color: "var(--color-fg)" }}>
                  {f.q}
                </span>
                <ChevronDown
                  size={18}
                  strokeWidth={1.75}
                  className="shrink-0 transition-transform duration-300 group-open:rotate-180"
                  style={{ color: "var(--color-accent)" }}
                />
              </summary>
              <p
                className="max-w-2xl pb-5 text-sm leading-relaxed sm:text-base"
                style={{ color: "var(--color-fg-muted)" }}
              >
                {f.a}
              </p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
