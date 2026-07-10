# Runbook — Curadoria de som (texturas do soundscape)

Guia pra curar uma textura do fundo sonoro. Pensado pra rodar em **várias janelas
Claude em paralelo** sem se atropelarem. Leia a REGRA DE COORDENAÇÃO antes de tudo.

## Objetivo
Cada textura (`piano`, `violao`, `violinos`, `chuva`, `mar`, `floresta`, `vento`, …)
"alterna" entre N takes. Meta por textura: **≥10 min de áudio distinto**, validado
por ouvido humano e **creditado** (CC0 / CC-BY do Freesound).

## Por que a DURAÇÃO importa (engine)
`lib/soundscape-engine.ts`: a cada `ROTATE_MS` (42s) troca pra outro take aleatório
(crossfade 3s), começando num **offset aleatório** do buffer. Ou seja, material
distinto ≈ **soma das durações** dos arquivos. Pra 10 min → somar ≥ 600s. Prefira
takes longos (≥40s); os curtos loopam dentro da janela de 42s e enjoam.

## Scripts (rodar do root com `node`)
| Script | O que faz |
|---|---|
| `search-freesound.mjs "q1" "q2"` | Busca no Freesound → imprime JSON de metadados (sem baixar). Os agentes usam isto. |
| `add-candidates.mjs <key>` (JSON no stdin) | Baixa os previews escolhidos, dedup por md5 (vs produção + staging), mescla em `_staging/<key>/candidates.json`, gera `audition.html`. |
| `stage-current.mjs <key>` | Monta `_staging/<key>-atual/audition.html` com os takes ATUAIS (pra comparar). |
| `apply-candidates.mjs <key> <slot>=<id> …` | Copia o cand pro `<key>-<slot>.mp3` de produção **e** grava o crédito no `manifest.json`. |
| `fetch-candidates.mjs <key> <n>` | Alternativa automática (busca+baixa por query usando `TARGETS` do fetch-sounds). |
| `verify-credits.mjs [key]` | Re-baixa o preview de cada crédito e compara md5 com o arquivo local — **pega crédito DESSINCRONIZADO** (áudio trocado, crédito velho). |
| `measure-loudness.py` | Mede RMS+pico de todos os mp3 (gstreamer→numpy) e **gera `lib/soundscape-loudness.ts`** (ganho por variante, alvo −28 dBFS). |

## Servidor de audição (porta 4444)
Serve `public/sounds/_staging/`. Se não estiver no ar (uma janela só precisa subir):
```
cd public/sounds/_staging && python3 -m http.server 4444 --bind 127.0.0.1 &
```
Links: `http://127.0.0.1:4444/<key>/audition.html` e `…/<key>-atual/audition.html`.
**Não** suba dois servidores na 4444 (conflito de porta) — reutilize o que já roda.

## ⚠️ REGRA DE COORDENAÇÃO (várias janelas, mesmo diretório)
- **FASE 1 — paralela e segura:** `search-freesound`, agentes, `add-candidates`,
  `stage-current`. Mexe só em `_staging/<key>/` (por-key). Rode à vontade.
- **FASE 2 — SERIAL, uma janela por vez:** `apply-candidates` + editar `variants:`
  no `soundscape.ts`. Escrevem `manifest.json`/`soundscape.ts` (compartilhados).
  Termine o apply de um tema **inteiro** antes de outra janela aplicar o dela.
- **Commit:** só no fim, com TODOS os temas aplicados (o working tree é compartilhado
  entre as janelas — um commit leva tudo).

## Fluxo por tema
1. (opcional) Melhore `queries`/`avoid` da textura em `scripts/fetch-sounds.mjs`.
2. **Fase 1** — descubra candidatos com **2 agentes Haiku** (ângulos diferentes do
   tema). Cada agente roda `node scripts/search-freesound.mjs "…"` e devolve **só JSON**
   `[{id,name,author,license,duration,preview}]` com os bons: calmos, ≥40s (prefira
   longos), CC0/CC-BY, SEM os ruídos indesejados do tema. Junte os 2, dedup por id.
3. Salve o JSON e baixe: `cat picks.json | node scripts/add-candidates.mjs <key>`.
4. `node scripts/stage-current.mjs <key>` (comparar com os atuais).
5. Dê os **links** ao humano; ele ouve e escolhe os `#IDs`. **Pare aqui na fase 1.**
6. **Fase 2 (serial)** — aplique: `node scripts/apply-candidates.mjs <key> 1=<id> 4=<id> …`
   (troque os ruins, mantenha os bons, use slots novos pra expandir).
7. Ajuste `variants:` e `desc:` da textura em `lib/soundscape.ts`.
8. Verifique: durações + sem md5 duplicado + N/N creditado + **`node scripts/verify-credits.mjs <key>`** (md5 bate com a fonte) + `pnpm exec tsc --noEmit`.
9. **Loudness:** `python3 scripts/measure-loudness.py` regenera `lib/soundscape-loudness.ts`
   (normaliza o volume por variante). **Rode sempre que trocar/adicionar um take.**

## ⚠️ Armadilha de crédito (aprendida na marra)
Curadoria manual antiga trocava o ÁUDIO mas mantinha o CRÉDITO velho → md5 não bate
(aconteceu com piano-1/2 e violão 1-5). **Sempre** rode `verify-credits.mjs` após aplicar.
Pra recuperar a fonte real de um arquivo órfão/dessincronizado: cross-match do md5 (ou do
tamanho, via HEAD `content-length`) contra os previews do autor/queries. md5 diferente NÃO
é crédito errado se o arquivo foi só transcodificado (ex.: volume reduzido) — é o mesmo som.

## Adicionar uma textura NOVA (ex.: fogueira)
Além do fluxo acima, o scaffolding (FASE 2, serial):
- `lib/soundscape.ts`: adicione a chave em `TextureKey`, o ícone em `IconName`
  (ex.: `"flame"`), e uma entrada em `TEXTURES` (`{ key, name, icon, group:"ambiente",
  desc, variants }`).
- `app/(app)/config/SoundscapePicker.tsx`: importe o ícone de `lucide-react`
  (ex.: `Flame`) e mapeie em `ICONS` (`flame: Flame`). Sem isto o `Record<IconName,…>`
  quebra no tsc.
- (opcional) `scripts/fetch-sounds.mjs`: adicione um `TARGET` pra reprodutibilidade.
- (opcional) uma cena em `SCENES` usando a textura nova.

## Medir duração (node puro, sem ffprobe)
```js
import { readFileSync } from "node:fs";
const BR={1:[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0],2:[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,0]};
const SR={3:[44100,48000,32000],2:[22050,24000,16000],0:[11025,12000,8000]};
export function dur(p){const b=readFileSync(p);let i=0;if(b.slice(0,3).toString("latin1")==="ID3"){const s=((b[6]&127)<<21)|((b[7]&127)<<14)|((b[8]&127)<<7)|(b[9]&127);i=10+s;}while(i<b.length-4&&!(b[i]===255&&(b[i+1]&224)===224))i++;const h2=b[i+2],vb=(b[i+1]>>3)&3,v=vb===3?1:2,br=BR[v][(h2>>4)&15]*1000,sr=SR[vb][(h2>>2)&3],spf=vb===3?1152:576,xo=i+(vb===3?36:21),tag=b.slice(xo,xo+4).toString("latin1");if((tag==="Xing"||tag==="Info")&&b.readUInt32BE(xo+4)&1)return b.readUInt32BE(xo+8)*spf/sr;return (b.length-i)*8/br;}
```
(⚠️ super-estima um pouco em VBR sem header Xing; pra o alvo de 10 min tá de bom tamanho.)
