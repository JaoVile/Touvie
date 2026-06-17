# Music — Som de fundo (ambiência + frequências)

> **Status:** planejado / referência. Não implementar ainda — o usuário vai
> **procurar e testar os sons** ("ruídos") e achar o ideal; provavelmente vai
> pedir uma **lib de sons** ou **previews gerados** (Web Audio) pra testar.
> **Onde toca:** app logado **+ landpage**.

## Objetivo

Som ambiente **suave e bonito de escutar** (não só a frequência crua) pra
acompanhar o uso do Touvie. A frequência é a camada de baixo; a música/textura
agradável por cima é o que segura o ouvido.

## Frequências (ondas cerebrais) — veredito pro Touvie

| Onda | Faixa | Estado / uso | No Touvie |
| --- | --- | --- | --- |
| **Alpha** | 8–12 Hz | Relaxamento consciente, foco relaxado, anti-estresse | ⭐ **PADRÃO** (modo Calma) |
| **Beta** | 12–30 Hz (usar ~14–18) | Alerta, raciocínio, resolução de problemas | ✅ modo **Foco** (com moderação) |
| **Theta** | 4–8 Hz | Meditação, introspecção, criatividade | ✅ modo **Reflexão** (sonolento p/ tarefa) |
| **Delta** | 0,5–4 Hz | Sono profundo, regeneração | ⚠️ com **aviso**: "melhor só antes de dormir" |
| **Gamma** | 30–100 Hz | Alta performance, "eureca" | ❌ **fora** (intenso, difícil soar bem) |

## Modos (empacotar Hz em nomes amigáveis — usuário não vê "hertz")

- 🌊 **Calma** — Alpha — **padrão, ligado por default**
- 🎯 **Foco** — Beta baixo — combina com a Quest de Foco (ver [Quests.md](Quests.md))
- 🌙 **Reflexão** — Theta — diário / respiro
- 😴 **Soneca** — Delta — **com aviso**: "melhor só pra momentos antes do sono"

## Config (`/config`)

- **Explicação breve** do que é a música/frequência (1–2 linhas, sem jargão).
- **Controles:** volume (aumentar/abaixar) e **mutar**.
- **Trocar o fundo** (escolher o modo acima).
- Toggle on/off; **Alpha ligado por padrão**.

## Restrições técnicas (IMPORTANTES)

- **Autoplay é bloqueado pelos navegadores** → o som **não arranca sozinho**.
  "Ligado por padrão" = começa no **1º gesto** (clique/toque) na página. Na
  landpage é ainda mais restrito (sempre só após interação).
- **Binaural beats só funcionam com FONE** (o batimento nasce da diferença entre
  os dois ouvidos). Pra alto-falante (celular), usar **tons isócronos** (pulsos
  no mesmo canal) — funcionam sem fone.
- O efeito das ondas é **sutil/subjetivo** (ciência mista). O ganho garantido é
  **ambiência + ritual** → investir na faixa ser **boa de ouvir**.

## Fonte do som (a decidir — usuário vai testar)

1. **Síntese via Web Audio** — gero pad/drone suave + a frequência, **sem
   arquivo**; ótimo pra **previews** rápidos de cada modo pra você testar.
2. **Arquivos `.mp3`** — música por cima + frequência embutida por baixo; melhor
   qualidade, depende de ter/criar as faixas (ou uma lib).
3. **Misto** — síntese como base agora, troca por `.mp3` depois.

> Próxima ação provável do usuário: pedir **previews** (eu gero via Web Audio um
> de cada modo) OU indicar uma **lib/biblioteca de sons** pra eu plugar.

## A definir na implementação

- [ ] Lib de sons vs síntese vs mp3 (usuário testa e decide).
- [ ] Persistência da preferência: localStorage (como `StarsToggle`) vs `profiles`.
- [ ] Onde plugar o player: provável overlay global (app layout) + landpage layout.
- [ ] Faixa/preview por modo + crossfade ao trocar.
- [ ] Fone vs alto-falante: detectar/avisar, ou usar isócrono por padrão.
