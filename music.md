# Music — Som de fundo (ambiência + frequências)

> **Status:** IMPLEMENTADO (jun/2026). Controlado em **/config → card "Som de fundo"**.
> **Onde toca:** só no **app logado** — `SoundscapeLayer` mora no layout `(app)`,
> não no root. (O plano antigo previa landpage, mas tocar antes do login incomodou
> o usuário; ficou app-only.) Gateado pelo nível de qualidade visual: pad/texturas
> tocam normalmente; o cursor-fita é que depende do modo "Completo".

## Objetivo

Som ambiente **suave e bonito de escutar** (não só a frequência crua). A frequência
é a camada de baixo; a **textura agradável por cima** (chuva, instrumentos…) é o que
segura o ouvido. Ganho garantido = **ambiência + ritual**; o efeito de onda cerebral
é sutil/subjetivo.

## Arquitetura (3 camadas, em `lib/soundscape.ts` + `lib/soundscape-engine.ts`)

1. **Frequência (sintetizada).** 4 modos. Por padrão é um **pad QUENTE** (acorde
   sub·tônica·terça·quinta·oitava, lowpass, respiração + tremolo suave) — sem pulso.
   O **tom isócrono** (entrainment) virou **opt-in: "Modo profundo"** (`deepMode`,
   desligado por padrão), porque o pulso cru soava clínico/desconfortável.

   | Modo | Onda | beatHz | rootHz |
   | --- | --- | --- | --- |
   | **Calma** | Alpha | 10 | 196 |
   | **Foco** | Beta | 16 | 220 |
   | **Reflexão** | Theta | 6 | 174 |
   | **Soneca** | Delta | 2,5 | 146 (com aviso "antes de dormir") |

2. **Texturas (áudio REAL).** Loops baixados do Freesound (CC0/CC-BY) em
   `public/sounds/`. Ambiente: chuva, mar, floresta, vento + ruído-rosa, ruído-marrom.
   Instrumentos: violinos, violão, piano. Cada uma (menos os 2 ruídos) tem **3
   variações** que rodam sozinhas (crossfade ~42s). Curadas por `scripts/fetch-sounds.mjs`
   (`npm run fetch:sounds <key>` re-baixa). Créditos automáticos via `manifest.json`
   → `SoundCredits`.

3. **Composições prontas.** **Atmosferas** (`SCENES`, 12 presets de 1 clique que
   montam a mistura inteira) e **Guiadas** (`JOURNEYS`, 4 jornadas que migram a
   frequência no tempo — princípio ISO, "encontra e conduz").

## Config — layout "Híbrido" (o som ambiente é o core, fica de cara)

1. **Atmosferas** — linha compacta de chips (rolagem horizontal).
2. **Monte o seu** — chips de Ambiente + Instrumentos visíveis + um Volume.
3. **Avançado** (recolhido) — Frequência (+ volume) · Guiadas · Ruídos · Modo profundo.

## Decisões fechadas (eram "A definir")

- **Fonte:** misto — síntese pra frequência + arquivos reais pras texturas.
- **Persistência:** localStorage (`touvie:sound`), sticky, ao vivo via `SOUND_EVENT`
  (não em `profiles` — pode evoluir pra lá depois).
- **Player:** overlay global `SoundscapeLayer` no layout `(app)`.
- **Fone vs alto-falante:** **tom isócrono** (funciona sem fone), e só no Modo profundo.
- **Autoplay:** começa no 1º gesto do usuário (navegadores bloqueiam som automático).

## Em aberto / a avaliar de ouvido

- [ ] Confirmar se cada textura é **boa de ouvir** (ex.: `mar-2` veio mais "tempestade").
- [ ] Afinar o pad quente (corpo/tremolo) e os tempos de rotação/crossfade.
- [x] ~~Página `app/sons/` (preview temporário)~~ → removida.
