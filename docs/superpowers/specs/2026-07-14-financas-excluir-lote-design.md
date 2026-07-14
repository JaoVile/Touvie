# Finanças — excluir lançamentos em lote — Design

> Deletar vários lançamentos de uma vez na aba Lançamentos, pra limpar lixo de
> import (ex.: o cluster de ~65k de abril: Pix recebidos + "Pagamento de fatura"
> que o usuário nunca fez e polui o gráfico de fluxo).

**Data:** 2026-07-14
**Escopo:** delete em lote na tabela de Lançamentos. Sem migration.

## Contexto / decisões (brainstorming)

- O 65k é dado ERRADO importado (o usuário confirmou "jamais fiz esses valores").
  Deletar é o certo — não é movimento real.
- Comportamento: **DELETAR de vez** (não soft-flag, não por categoria).
- Gatilho: **seleção em lote na aba Lançamentos** (os filtros de busca — descrição
  `ilike`, tipo, mês — já existem pra achar 'fatura'/'Pix').
- Saldo: a view `finance_account_balances` = base + Σ(transações não-recorrentes).
  Deletar desloca o saldo pelo LÍQUIDO do que sai; o rodapé mostra esse líquido.
  Deletar o cluster inteiro de abril (≈+58k Pix e −56k fatura) desloca ~R$2k.

## Componentes

- **`deleteTransactions(ids: string[])`** (novo em `app/(app)/financas/actions.ts`):
  valida cada id (uuid), limita o lote (≤200), apaga
  `.from("transactions").delete().in("id", validIds).eq("user_id", userId)`
  (RLS + escopo explícito), `revalidatePath("/financas")` + `revalidatePath("/")`.
  Retorna `{ ok?: true; error?: string; deleted?: number }`. O `deleteTransaction`
  de 1 continua existindo (a linha usa ele).
- **`SelectableLedger.tsx`** (novo, client): recebe `groups: { date; items: LedgerItem[] }[]`
  (montado no server pelo `LancamentosTab`). Estado: `selecting: boolean`,
  `selectedIds: Set<string>`. Renderiza:
  - botão **"Selecionar"** (vira "Cancelar" no modo) no topo;
  - no modo seleção: checkbox por linha (via `TransactionRow`) + um
    "selecionar todos (do filtro atual)";
  - rodapé fixo com **"Excluir N · R$ <líquido>"** → `confirm()` → `deleteTransactions`
    (useTransition); ao terminar, sai do modo e limpa a seleção (o revalidate
    recarrega a lista/gráfico/saldo).
- **`TransactionRow.tsx`** (modificar): props opcionais `selectable?`, `selected?`,
  `onToggle?`. Quando `selectable`, mostra um checkbox à esquerda e a linha inteira
  vira clicável pra marcar (o × de apagar-1 some no modo seleção pra não confundir).
- **`LancamentosTab.tsx`** (modificar): em vez de mapear os grupos direto, monta
  `groups` e passa pro `<SelectableLedger>`. Estado vazio/filtros seguem no server.

## Erros / bordas

- Nenhum id válido → não faz nada (botão desabilitado se seleção vazia).
- Falha do delete → mensagem no rodapé; nada apagado fica consistente (delete é atômico por query).
- Sair do modo seleção limpa a seleção.

## Fora do escopo (YAGNI)

Undo/lixeira, excluir direto pelo gráfico, soft-flag "não contar", seleção
cruzando meses (a aba já é por mês), i18n em `messages/` (o módulo Finanças usa
PT hardcoded — seguimos o padrão local).

## Portão

`pnpm exec tsc --noEmit` + `pnpm check` + `pnpm build` + E2E do
`deleteTransactions` (inserir 2 tx de teste via service_role, apagar em lote,
conferir que sumiram + escopo por user) + teste manual do usuário.

## Arquivos

- `app/(app)/financas/actions.ts` (+ `deleteTransactions`)
- `app/(app)/financas/SelectableLedger.tsx` (novo)
- `app/(app)/financas/TransactionRow.tsx` (props de seleção)
- `app/(app)/financas/LancamentosTab.tsx` (passa `groups` pro wrapper)
