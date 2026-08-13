/**
 * Captura e compartilha o convite de instalação do PWA.
 *
 * Existe como módulo (e não dentro do banner) por causa de um detalhe do
 * browser: o `beforeinstallprompt` é disparado UMA vez por carregamento. Se o
 * banner só registrasse o listener quando fosse aparecer, quem dispensou o
 * banner perderia o evento pra sempre — e o botão de instalar no /config não
 * teria o que disparar.
 *
 * Então a captura é incondicional e mora aqui; quem decide *mostrar* é o
 * componente. Dispensa é assunto de exibição, não de captura.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: BeforeInstallPromptEvent | null = null;
let started = false;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

/** Liga a captura. Idempotente — pode ser chamado por vários componentes. */
export function startInstallCapture() {
  if (started || typeof window === "undefined") return;
  started = true;

  window.addEventListener("beforeinstallprompt", (e) => {
    // Sem o preventDefault o Chrome mostra o próprio mini-infobar, e aí temos
    // dois convites competindo.
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });

  // Instalou por fora (menu do browser): o convite deixa de fazer sentido.
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
}

export function canInstall(): boolean {
  return deferred !== null;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Dispara o diálogo nativo. Devolve `true` se havia convite pra disparar —
 * o resultado da escolha da pessoa o browser não entrega de forma confiável em
 * todos os casos, então não prometemos isso.
 */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const evt = deferred;
  // O evento é de uso único: depois de usado, o browser só manda outro numa
  // visita futura. Zera antes de esperar a escolha pra não reusar por engano.
  deferred = null;
  emit();
  await evt.prompt();
  await evt.userChoice.catch(() => null);
  return true;
}

/** Já está rodando instalado? Aí não há o que convidar. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari no iOS não implementa display-mode; expõe esta flag não-padrão.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * iOS é heurística de user-agent, e é assim porque a Apple não oferece
 * alternativa: o Safari NÃO dispara `beforeinstallprompt` nem expõe qualquer
 * API de instalação. Sem detectar o sistema, quem usa iPhone simplesmente nunca
 * descobre que dá pra instalar.
 * Frágil por natureza — se a Apple mexer na string do UA isto para de casar, e
 * o convite some no iOS (falha silenciosa, não quebra nada).
 */
export function isIOSSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ se apresenta como Macintosh; o toque é o que separa.
    (ua.includes("Macintosh") && "ontouchend" in document);
  if (!iOS) return false;
  // Chrome/Firefox no iOS (crios/fxios) usam o mesmo motor mas não têm o fluxo
  // de "Adicionar à Tela de Início" — só o Safari tem.
  return !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}
