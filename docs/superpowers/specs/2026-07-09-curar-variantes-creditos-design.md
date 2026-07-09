# Curar variantes nos créditos — design

**Data:** 2026-07-09
**Status:** aprovado (brainstorming), aguardando plano de implementação

## Propósito

Dar ao usuário o poder de **curar quais takes de cada textura entram no shuffle**, direto
no card "Créditos de áudio" das configurações. Cada som na lista ganha:

1. **Preview** — ouvir aquele take isolado, com o loudness real (normalizado).
2. **Liga/desliga** — um take desligado **sai da rotação** do engine e nunca mais toca.

Caso de uso concreto: "tem um violino que não gostei → acho ele na lista, desligo, e ele
não toca mais na alternância."

## Escopo

**Dentro:** preview por variante + habilitar/desabilitar por variante (persistente).
**Fora (YAGNI):** desligar textura inteira pelos créditos (já existe o seletor de texturas),
reordenar takes, preview por-tipo, slider de volume por variante.

## Decisões de design (aprovadas)

- **Preview toca pelo engine** (não `<audio>` cru) — reusa `loadBuffer` + `LOUDNESS_GAIN`,
  então você julga o take com o mesmo loudness que toca de verdade.
- **Estado de "desligado" em chave própria** do `localStorage` (`touvie:sound-disabled`),
  ortogonal ao `SoundState` (que é a mix do momento e muda a cada clique).
- **Impedir desligar a última** variante habilitada de cada textura (toda textura
  selecionada sempre tem ≥1 take pra tocar).

## Arquitetura

### 1. Estado — `lib/sound-disabled.ts` (novo)

Módulo isolado, uma responsabilidade: persistir a curadoria. Espelha o padrão do
`SoundState` em `lib/soundscape.ts`.

- Constantes: `DISABLED_KEY = "touvie:sound-disabled"`, `DISABLED_EVENT = "touvie:sound-disabled"`.
- `variantId(key: TextureKey, variant?: number): string` — `"<key>-<n>"` p/ multi-variante,
  `"<key>"` p/ arquivo único. (Mesma convenção do manifest / `LOUDNESS_GAIN`.)
- `readDisabled(): Set<string>` — lê o array do `localStorage` (vazio se ausente/ inválido).
- `isDisabled(id: string): boolean`.
- `writeDisabled(set: Set<string>): void` — persiste como array + dispara `DISABLED_EVENT`
  com `detail` = array atualizado.
- `toggleDisabled(id: string, siblingIds: string[]): boolean` — inverte o estado de `id`.
  Ao DESLIGAR, se isso zeraria as habilitadas entre `siblingIds`, **não faz nada e retorna
  `false`** (impede-a-última). Retorna `true` quando aplicou.

Sem import de React nem de áudio.

### 2. Engine — `lib/soundscape-engine.ts`

- O engine mantém `private disabled: Set<string>`, carregado no boot (`readDisabled()`).
- `pickVariant` passa a receber a `key` e sortear **apenas entre variantes habilitadas**
  daquela textura (`1..count` menos as que estão em `disabled`). Se — por segurança — todas
  estiverem desabilitadas (não deveria acontecer por causa do impede-a-última), cai no
  comportamento atual (sorteia entre todas) pra nunca ficar mudo por bug.
- **Reconciliação ao vivo:** um método `setDisabled(set)` atualiza o Set e, pra cada textura
  tocando cuja variante atual virou desabilitada, dispara um `rotateClip` imediato (crossfade
  normal) pra uma habilitada.
- **Preview:** `preview(key: TextureKey, variant: number): Promise<void>` — carrega o buffer
  (`loadBuffer` + ganho de `LOUDNESS_GAIN` × `TEXTURE_GAIN`), se a mix de texturas estiver
  audível dá um **duck** temporário no bus de texturas (rampa suave pra ~0.3 e volta), toca
  o buffer uma vez (sem loop) e restaura o bus ao terminar. Falha silenciosa se o áudio
  estiver indisponível.

### 3. UI + fluxo de dados

- `app/(app)/config/SoundCredits.tsx` (server component) continua lendo o `manifest.json`
  e montando a lista. Cada linha passa a embutir **`SoundCreditControls`** (client, novo)
  recebendo `id`, `key`, `variant` e `siblingIds` (os ids das outras variantes da mesma
  textura, calculados no server a partir do manifest).
- `SoundCreditControls` renderiza:
  - **▶ preview:** dispara `PREVIEW_EVENT` (`touvie:sound-preview`) com `detail = {key, variant}`.
    O `SoundscapeLayer` (dono do engine) escuta e chama `engine.preview(...)`. Sem
    prop-drilling do engine — segue o padrão de eventos do app (`SOUND_EVENT`, eventos do cursor).
  - **switch liga/desliga:** chama `toggleDisabled(id, siblingIds)`. Estado local escuta
    `DISABLED_EVENT` pra re-renderizar (esmaecer a linha + rótulo "fora do shuffle").
    Só aparece quando a textura tem `variants > 1` (arquivo único não tem o que curar).
- `SoundscapeLayer.tsx`: além do `SOUND_EVENT` que já escuta, passa a escutar
  `PREVIEW_EVENT` → `engine.preview` e `DISABLED_EVENT` → `engine.setDisabled`.

### Fluxo

- **Toggle:** clique → `toggleDisabled` → grava `localStorage` + dispara `DISABLED_EVENT`
  → (a) engine reconcilia a rotação ao vivo; (b) a linha re-renderiza esmaecida.
- **Preview:** clique → `PREVIEW_EVENT` → `SoundscapeLayer` → `engine.preview` → duck + toca 1×.

## Erros / edge cases

- **Impede-a-última:** `toggleDisabled` barra e a UI mostra o switch travado com tooltip
  ("pelo menos 1 take por textura").
- **Arquivo único** (ruído rosa/marrom): sem switch; só preview.
- **Autoplay policy:** preview nasce de clique (gesto) → `AudioContext.resume()` ok.
- **Arquivo faltando / áudio bloqueado:** falha silenciosa (try/catch, como o resto do engine).
- **`localStorage` inválido:** `readDisabled` retorna Set vazio.

## Verificação

Projeto **sem suíte automatizada** — portão é `pnpm check` + `pnpm exec tsc --noEmit` + `pnpm build`,
mais verificação manual (dirigida no fim da implementação):

1. Desligar um take → confirmar que some da rotação (e reconcilia se estava tocando).
2. Tentar desligar a última variante de uma textura → barrado.
3. Preview toca o take com o loudness normalizado; dá duck na mix se estiver tocando.
4. Estado persiste após reload; arquivo único não mostra switch.

## Fora de escopo (próximo ciclo)

Família "som de UI atmosférico" (features B+C): timbre do cursor por atmosfera e sino de
notificação afinado. Specs/planos próprios, depois desta.
