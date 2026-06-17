/**
 * Cortina de entrada — duas metades cobrem a tela no PRIMEIRO paint e se
 * dissolvem deslizando pros lados, revelando o conteúdo enquanto o wordmark
 * surge e recua.
 *
 * Robustez por design (sem experiência ruim pra ninguém):
 *  - A animação é CSS PURO: o conteúdo é renderizado ATRÁS (SSR) e carrega/
 *    hidrata durante a intro; `animation … forwards` garante que as metades
 *    SEMPRE terminam fora da tela (nunca trava). pointer-events:none não rouba
 *    clique; reduced-motion vira um fade curto.
 *  - Gate 1×/sessão: um script inline mínimo roda ANTES do véu pintar e, se a
 *    intro já tocou nesta sessão do navegador, marca `<html data-intro-seen>` —
 *    o CSS esconde o véu na hora, sem flash. Assim a cortina não repete a cada
 *    reload em produção (ex.: errar a senha no login recarrega a página).
 *
 * Usado na landpage e no login — NUNCA no app logado (lá seria atrito).
 */
export function IntroVeil() {
  return (
    <>
      {/* Gate anti-flash: precede o véu no DOM pra rodar antes do 1º paint. */}
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: boot script mínimo, sem dado dinâmico
        dangerouslySetInnerHTML={{
          __html:
            "try{if(sessionStorage.getItem('touvie:intro')){document.documentElement.setAttribute('data-intro-seen','')}else{sessionStorage.setItem('touvie:intro','1')}}catch(e){}",
        }}
      />
      <div className="intro-veil" aria-hidden="true">
        <span className="intro-veil__half intro-veil__half--left" />
        <span className="intro-veil__half intro-veil__half--right" />
        <span className="intro-veil__mark">Touvie</span>
      </div>
    </>
  );
}
