// Service worker do Touvie.
//
// Estratégia por tipo de request — a escolha central é NÃO cachear HTML:
//
//   navegação (HTML) → network-first, cai no /offline.html se a rede falhar.
//     HTML sempre fresco significa que um deploy novo aparece na hora, sem
//     ninguém preso em versão velha (a armadilha clássica de PWA).
//
//   /_next/static/* e /icons/* → cache-first.
//     Seguro porque o Next põe HASH DE CONTEÚDO no nome desses arquivos: build
//     novo = nome novo. Não existe "servir estático velho" — o HTML novo pede
//     outro arquivo. É daqui que vem o ganho de abrir rápido no celular.
//
//   /api/*, Supabase, qualquer outra origem → passa direto, sem tocar em cache.
//     Dado de usuário passando por cache é como se inventa bug de "vi saldo
//     errado". Fora de escopo de propósito.
//
// Bump o VERSION pra invalidar tudo de uma vez (o activate limpa os antigos).
const VERSION = "v2";
const CACHE = `touvie-${VERSION}`;
const OFFLINE = "/offline.html";

// Em dev os chunks do Next mudam SEM mudar de nome, então cache-first deixaria
// você olhando pra código velho e caçando um bug que já consertou. O precache
// do offline.html continua (é estático de verdade), o resto passa direto.
//
// A guarda é hostname + PORTA (o dev deste projeto é fixo em 3007) em vez de só
// hostname de propósito: assim dá pra rodar `next start -p 3100` na máquina e
// verificar o cache de verdade antes de subir. Só hostname tornaria o caminho
// de produção impossível de testar localmente — e cache não-testado é
// exatamente o tipo de coisa que quebra depois do deploy.
const DEV =
  ["localhost", "127.0.0.1"].includes(self.location.hostname) && self.location.port === "3007";

/** Arquivo com hash de conteúdo no nome — cachear pra sempre é seguro. */
function isImmutable(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll([OFFLINE]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  // POST/PUT/DELETE nunca entram em cache — e interceptá-los só adiciona risco.
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Outra origem (Supabase, Telegram, fontes): não é nosso, não mexemos.
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }

  if (DEV || !isImmutable(url)) return;

  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          // Só guarda resposta boa e completa: 206/opaque no cache viram bug
          // difícil de enxergar depois.
          if (res.ok && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

// ── Notificações próprias (Web Push) ────────────────────────────────────
// O payload vem de lib/push.ts como JSON { title, body, url, tag? }.

self.addEventListener("push", (e) => {
  // Sem payload não dá pra mostrar nada útil — mas ignorar em silêncio faria o
  // Chrome mostrar a notificação genérica dele ("Este site foi atualizado").
  let data = { title: "Touvie", body: "", url: "/", tag: undefined };
  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch {
    /* payload malformado: cai no default acima */
  }

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // Agrupa por URL por padrão: dois disparos do mesmo cron de horário não
      // empilham lixo. Quem manda `tag` próprio é quem PRECISA aparecer em
      // paralelo — o sweep, onde vários lembretes distintos dividem a mesma
      // "/notificacoes" e um sobrescreveria o outro na bandeja.
      tag: data.tag ?? data.url,
      renotify: true,
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(
    // Reaproveita uma aba do app se já houver uma — abrir uma segunda cópia do
    // Touvie a cada toque seria irritante.
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
      for (const c of cs) {
        if (c.url.includes(self.location.origin) && "focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
