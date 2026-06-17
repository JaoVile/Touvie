/**
 * Cortina de entrada — duas metades cobrem a tela no PRIMEIRO paint; o
 * wordmark surge e recua, e as metades DESLIZAM pros lados (abrindo ao meio),
 * revelando o conteúdo do centro pra fora.
 *
 * Robustez por design (sem experiência ruim pra ninguém):
 *  - CSS PURO, sem JS: o conteúdo é renderizado ATRÁS (SSR) e carrega/hidrata
 *    durante a intro — a cortina não bloqueia nada.
 *  - `animation … forwards` garante que as metades SEMPRE terminam fora da
 *    tela; nunca travam, mesmo se o JS quebrar ou a hidratação atrasar.
 *  - As metades carregam o MESMO gradiente do fundo (var(--gradient-bg),
 *    posicionado por metade) → cortina fechada idêntica ao fundo, sem emenda.
 *  - `pointer-events: none` não rouba clique; `prefers-reduced-motion` vira
 *    um fade curto sem deslize (acessível). Anima só `transform`/`opacity`.
 *
 * Usado na landpage e no login — NUNCA no app logado (lá seria atrito).
 */
export function IntroVeil() {
  return (
    <div className="intro-veil" aria-hidden="true">
      <span className="intro-veil__half intro-veil__half--left" />
      <span className="intro-veil__half intro-veil__half--right" />
      <span className="intro-veil__mark">Touvie</span>
    </div>
  );
}
