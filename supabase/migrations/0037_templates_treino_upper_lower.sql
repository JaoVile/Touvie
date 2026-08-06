-- 0037 — Sincroniza os templates de treino com o ciclo da 0036.
-- Aplique no SQL Editor do Supabase, depois da 0036.
--
-- POR QUE: o cron training-reminder lê notification_templates (banco) e só usa
-- lib/notification-defaults.ts como FALLBACK. As linhas de treino no banco ainda
-- descrevem o ciclo antigo (4×6-8, nomes em inglês, quarta = Box). seedTemplates()
-- não corrige: ele pula chaves que já existem. Daí este UPDATE explícito.
--
-- Conteúdo gerado a partir de TRAINING_DEFAULTS — não edite à mão; se mudar o
-- ciclo, mude o TS e gere de novo.
--
-- Idempotente: reexecutar não faz mal. Só toca as 7 chaves 'training:*';
-- is_active é preservado (se você desligou um dia, ele continua desligado).
-- =====================================================================

do $$
declare
  v_hit int;
begin
  with novo (key, name, content) as (values
    ('training:monday', 'Treino — Segunda (Superior A)', '🏋️‍♂️ <b>SEGUNDA · SUPERIOR A</b>
<i>2 séries de trabalho · reps é piso</i>
━━━━━━━━━━━━━━━━━━

<b>① Panturrilha em pé</b>
    ➜ <code>2 × 10</code>

<b>② Supino reto com barra</b>  ·  <i>força</i>
    ➜ <code>2 × 5</code>

<b>③ Remada curvada</b>
    ➜ <code>2 × 6</code>

<b>④ Supino inclinado com halteres</b>
    ➜ <code>2 × 8</code>

<b>⑤ Puxada alta pronada</b>
    ➜ <code>2 × 8</code>

<b>⑥ Elevação lateral</b>
    ➜ <code>2 × 12</code>

<b>⑦ Tríceps testa</b>
    ➜ <code>2 × 8</code>

<b>⑧ Rosca direta</b>
    ➜ <code>2 × 8</code>

💪 Bom treino!'),
    ('training:tuesday', 'Treino — Terça (Inferior A)', '🦵 <b>TERÇA · INFERIOR A</b>
<i>2 séries de trabalho · reps é piso</i>
━━━━━━━━━━━━━━━━━━

<b>① Panturrilha em pé</b>
    ➜ <code>2 × 10</code>

<b>② Agachamento livre</b>  ·  <i>força</i>
    ➜ <code>2 × 5</code>

<b>③ Leg press 45°</b>
    ➜ <code>2 × 10</code>

<b>④ Mesa flexora</b>
    ➜ <code>2 × 10</code>

<b>⑤ Cadeira extensora</b>
    ➜ <code>2 × 12</code>

<b>⑥ Abdominal (elevação de pernas)</b>
    ➜ <code>2 × 10</code>

💪 Bom treino!'),
    ('training:wednesday', 'Treino — Quarta (Leve)', '🌤️ <b>QUARTA · LEVE</b>
<i>ombro, core e cardio — não é dia de puxar carga</i>
━━━━━━━━━━━━━━━━━━

<b>① Panturrilha sentado</b>
    ➜ <code>2 × 12</code>

<b>② Elevação lateral</b>
    ➜ <code>2 × 12</code>

<b>③ Crucifixo inverso</b>
    ➜ <code>2 × 15</code>

<b>④ Pallof press</b>
    ➜ <code>2 × 10</code>  ·  <i>10 por lado</i>

<b>⑤ Rotação externa (manguito)</b>
    ➜ <code>2 × 15</code>

<b>⑥ Mobilidade quadril + torácica</b>
    ➜ <code>5 min</code>

<b>⑦ Cardio zona 2</b>
    ➜ <code>20-25 min</code>  ·  <i>ritmo de conversa</i>

⚙️ <b>RECOVERY</b>
• Hidrata mais que normal
• Proteína no jantar (1g/kg mínimo)
• Dormir cedo — quinta vem SUPERIOR B forte

🌤️ Bom treino!'),
    ('training:thursday', 'Treino — Quinta (Superior B)', '💪 <b>QUINTA · SUPERIOR B</b>
<i>2 séries de trabalho · reps é piso</i>
━━━━━━━━━━━━━━━━━━

<b>① Panturrilha sentado</b>
    ➜ <code>2 × 12</code>

<b>② Barra fixa</b>
    ➜ <code>2 × 6</code>
    <i>Se não fechar 6 na 1ª série, troca por puxada supinada na máquina</i>

<b>③ Supino inclinado com halteres</b>
    ➜ <code>2 × 8</code>

<b>④ Remada baixa na polia</b>
    ➜ <code>2 × 8</code>

<b>⑤ Crossover na polia</b>
    ➜ <code>2 × 12</code>

<b>⑥ Desenvolvimento com halteres</b>
    ➜ <code>2 × 8</code>

<b>⑦ Crucifixo inverso</b>
    ➜ <code>2 × 15</code>

<b>⑧ Rosca inclinada</b>
    ➜ <code>2 × 10</code>

<b>⑨ Tríceps na corda</b>
    ➜ <code>2 × 12</code>

💪 Bom treino!'),
    ('training:friday', 'Treino — Sexta (Inferior B)', '🍑 <b>SEXTA · INFERIOR B</b>
<i>2 séries de trabalho · reps é piso</i>
━━━━━━━━━━━━━━━━━━

<b>① Panturrilha em pé</b>
    ➜ <code>2 × 10</code>

<b>② Levantamento terra romeno</b>  ·  <i>força</i>
    ➜ <code>2 × 6</code>

<b>③ Agachamento búlgaro</b>
    ➜ <code>2 × 8</code>  ·  <i>cada perna</i>

<b>④ Mesa flexora</b>
    ➜ <code>2 × 10</code>

<b>⑤ Elevação pélvica (hip thrust)</b>
    ➜ <code>2 × 8</code>

<b>⑥ Cadeira extensora</b>
    ➜ <code>2 × 12</code>

<b>⑦ Abdominal na polia (rosca abdominal)</b>
    ➜ <code>2 × 10</code>

💪 Bom treino — fim de semana liberado!'),
    ('training:saturday', 'Treino — Sábado (Descanso)', '🛋️ <b>SÁBADO · DESCANSO</b>
━━━━━━━━━━━━━━━━━━

Recuperação ativa, não preguiça.

⚙️ <b>HOJE</b>
• 8h de sono &gt; qualquer suplemento
• Caminhada leve 20-30min (opcional)
• Refeições com proteína espalhadas no dia
• Mobilidade de quadril e ombro

<i>Próximo treino: segunda — SUPERIOR A.</i>'),
    ('training:sunday', 'Treino — Domingo (Descanso + Planning)', '🛋️ <b>DOMINGO · DESCANSO</b>
━━━━━━━━━━━━━━━━━━

Última recuperação antes da semana.

⚙️ <b>PLANEJA AGORA</b>
• Pesa hoje (em jejum, depois do banheiro)
• Confere progressão da semana — onde subiu carga?
• Prepara as marmitas
• Dorme cedo

<i>Próximo treino: segunda — SUPERIOR A.</i>')
  )
  update public.notification_templates t
     set name       = n.name,
         content    = n.content,
         updated_at = now()
    from novo n
   where t.key = n.key;

  get diagnostics v_hit = row_count;

  -- Chaves que ainda não existem no banco (ex.: base nova sem seed) entram agora.
  with novo (key, name, content) as (values
    ('training:monday', 'Treino — Segunda (Superior A)', '🏋️‍♂️ <b>SEGUNDA · SUPERIOR A</b>
<i>2 séries de trabalho · reps é piso</i>
━━━━━━━━━━━━━━━━━━

<b>① Panturrilha em pé</b>
    ➜ <code>2 × 10</code>

<b>② Supino reto com barra</b>  ·  <i>força</i>
    ➜ <code>2 × 5</code>

<b>③ Remada curvada</b>
    ➜ <code>2 × 6</code>

<b>④ Supino inclinado com halteres</b>
    ➜ <code>2 × 8</code>

<b>⑤ Puxada alta pronada</b>
    ➜ <code>2 × 8</code>

<b>⑥ Elevação lateral</b>
    ➜ <code>2 × 12</code>

<b>⑦ Tríceps testa</b>
    ➜ <code>2 × 8</code>

<b>⑧ Rosca direta</b>
    ➜ <code>2 × 8</code>

💪 Bom treino!'),
    ('training:tuesday', 'Treino — Terça (Inferior A)', '🦵 <b>TERÇA · INFERIOR A</b>
<i>2 séries de trabalho · reps é piso</i>
━━━━━━━━━━━━━━━━━━

<b>① Panturrilha em pé</b>
    ➜ <code>2 × 10</code>

<b>② Agachamento livre</b>  ·  <i>força</i>
    ➜ <code>2 × 5</code>

<b>③ Leg press 45°</b>
    ➜ <code>2 × 10</code>

<b>④ Mesa flexora</b>
    ➜ <code>2 × 10</code>

<b>⑤ Cadeira extensora</b>
    ➜ <code>2 × 12</code>

<b>⑥ Abdominal (elevação de pernas)</b>
    ➜ <code>2 × 10</code>

💪 Bom treino!'),
    ('training:wednesday', 'Treino — Quarta (Leve)', '🌤️ <b>QUARTA · LEVE</b>
<i>ombro, core e cardio — não é dia de puxar carga</i>
━━━━━━━━━━━━━━━━━━

<b>① Panturrilha sentado</b>
    ➜ <code>2 × 12</code>

<b>② Elevação lateral</b>
    ➜ <code>2 × 12</code>

<b>③ Crucifixo inverso</b>
    ➜ <code>2 × 15</code>

<b>④ Pallof press</b>
    ➜ <code>2 × 10</code>  ·  <i>10 por lado</i>

<b>⑤ Rotação externa (manguito)</b>
    ➜ <code>2 × 15</code>

<b>⑥ Mobilidade quadril + torácica</b>
    ➜ <code>5 min</code>

<b>⑦ Cardio zona 2</b>
    ➜ <code>20-25 min</code>  ·  <i>ritmo de conversa</i>

⚙️ <b>RECOVERY</b>
• Hidrata mais que normal
• Proteína no jantar (1g/kg mínimo)
• Dormir cedo — quinta vem SUPERIOR B forte

🌤️ Bom treino!'),
    ('training:thursday', 'Treino — Quinta (Superior B)', '💪 <b>QUINTA · SUPERIOR B</b>
<i>2 séries de trabalho · reps é piso</i>
━━━━━━━━━━━━━━━━━━

<b>① Panturrilha sentado</b>
    ➜ <code>2 × 12</code>

<b>② Barra fixa</b>
    ➜ <code>2 × 6</code>
    <i>Se não fechar 6 na 1ª série, troca por puxada supinada na máquina</i>

<b>③ Supino inclinado com halteres</b>
    ➜ <code>2 × 8</code>

<b>④ Remada baixa na polia</b>
    ➜ <code>2 × 8</code>

<b>⑤ Crossover na polia</b>
    ➜ <code>2 × 12</code>

<b>⑥ Desenvolvimento com halteres</b>
    ➜ <code>2 × 8</code>

<b>⑦ Crucifixo inverso</b>
    ➜ <code>2 × 15</code>

<b>⑧ Rosca inclinada</b>
    ➜ <code>2 × 10</code>

<b>⑨ Tríceps na corda</b>
    ➜ <code>2 × 12</code>

💪 Bom treino!'),
    ('training:friday', 'Treino — Sexta (Inferior B)', '🍑 <b>SEXTA · INFERIOR B</b>
<i>2 séries de trabalho · reps é piso</i>
━━━━━━━━━━━━━━━━━━

<b>① Panturrilha em pé</b>
    ➜ <code>2 × 10</code>

<b>② Levantamento terra romeno</b>  ·  <i>força</i>
    ➜ <code>2 × 6</code>

<b>③ Agachamento búlgaro</b>
    ➜ <code>2 × 8</code>  ·  <i>cada perna</i>

<b>④ Mesa flexora</b>
    ➜ <code>2 × 10</code>

<b>⑤ Elevação pélvica (hip thrust)</b>
    ➜ <code>2 × 8</code>

<b>⑥ Cadeira extensora</b>
    ➜ <code>2 × 12</code>

<b>⑦ Abdominal na polia (rosca abdominal)</b>
    ➜ <code>2 × 10</code>

💪 Bom treino — fim de semana liberado!'),
    ('training:saturday', 'Treino — Sábado (Descanso)', '🛋️ <b>SÁBADO · DESCANSO</b>
━━━━━━━━━━━━━━━━━━

Recuperação ativa, não preguiça.

⚙️ <b>HOJE</b>
• 8h de sono &gt; qualquer suplemento
• Caminhada leve 20-30min (opcional)
• Refeições com proteína espalhadas no dia
• Mobilidade de quadril e ombro

<i>Próximo treino: segunda — SUPERIOR A.</i>'),
    ('training:sunday', 'Treino — Domingo (Descanso + Planning)', '🛋️ <b>DOMINGO · DESCANSO</b>
━━━━━━━━━━━━━━━━━━

Última recuperação antes da semana.

⚙️ <b>PLANEJA AGORA</b>
• Pesa hoje (em jejum, depois do banheiro)
• Confere progressão da semana — onde subiu carga?
• Prepara as marmitas
• Dorme cedo

<i>Próximo treino: segunda — SUPERIOR A.</i>')
  )
  insert into public.notification_templates (key, name, content)
  select n.key, n.name, n.content
    from novo n
   where not exists (select 1 from public.notification_templates t where t.key = n.key);

  raise notice 'OK — % template(s) de treino atualizado(s).', v_hit;
end $$;
