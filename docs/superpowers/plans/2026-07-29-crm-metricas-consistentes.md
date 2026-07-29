# CRM Metrics Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer dashboard, funil, agendamentos e histórico usarem o mesmo universo de dados e definições de conversão.

**Architecture:** Extrair regras puras de métricas para um módulo testável, fazer o dashboard carregar leads e agendamentos paginados e renderizar cards/gráficos a partir do mesmo resultado filtrado. Empurrar filtros do histórico para a consulta Supabase antes da paginação e preservar os fluxos atuais de movimentação.

**Tech Stack:** Next.js 14, TypeScript, Supabase JS, Node test runner.

## Global Constraints

- Não alterar RLS ou autenticação nesta entrega.
- Não excluir ou reclassificar dados existentes automaticamente.
- Preservar os nomes atuais das etapas persistidas.
- Toda correção comportamental deve começar por um teste que falha.

---

### Task 1: Regras canônicas de métricas

**Files:**
- Create: `lib/crm-metrics.ts`
- Test: `tests/crm-metrics.test.ts`
- Modify: `lib/dashboard-stats.ts`

**Interfaces:**
- Produces: `calculateCrmMetrics(leads, agendamentos)` e tipos de entrada/saída.
- Consumes: estágios atuais de leads e `estagio_agendamento`.

- [ ] **Step 1: Write failing tests**

Testar que vendas são agendamentos únicos em `sucesso`, que conversão não depende da etapa removida `fechado` e que o estágio lido é `estagio_agendamento`.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/crm-metrics.test.ts`
Expected: FAIL porque `lib/crm-metrics.ts` ainda não existe.

- [ ] **Step 3: Implement the minimal metrics module**

Agrupar leads, deduplicar agendamentos por `id_lead` usando o registro mais recente e calcular conversão usando sucessos.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/crm-metrics.test.ts`
Expected: PASS.

### Task 2: Um único resultado filtrado no dashboard

**Files:**
- Modify: `lib/dashboard-stats.ts`
- Modify: `components/dashboard-stats.tsx`
- Modify: `components/dashboard-charts.tsx`
- Modify: `app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `calculateCrmMetrics`.
- Produces: cards e gráficos derivados do mesmo `dashboardData`.

- [ ] **Step 1: Add a failing filter/cohort test**

Confirmar que somente agendamentos dos leads filtrados entram nas métricas.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/crm-metrics.test.ts`
Expected: FAIL na contagem do agendamento fora do conjunto de leads.

- [ ] **Step 3: Implement paginated appointment loading and shared cards**

Paginar `AGENDAMENTOS`, restringir pelos IDs dos leads filtrados, remover a leitura de `agendamento.estagio` e renderizar `DashboardStats` dentro de `DashboardCharts`.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/crm-metrics.test.ts`
Expected: PASS.

### Task 3: Filtros corretos no histórico

**Files:**
- Modify: `lib/agendamentos.ts`
- Modify: `app/historico-visitas/page.tsx`
- Test: `tests/agendamento-filters.test.ts`

**Interfaces:**
- Produces: `resolveHistoricoStages(status)` para traduzir filtros visuais em estágios persistidos.

- [ ] **Step 1: Write failing tests**

Testar inclusão explícita de `agendado` no conjunto geral e tradução do filtro de visita.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/agendamento-filters.test.ts`
Expected: FAIL porque o helper ainda não existe.

- [ ] **Step 3: Apply all server-side filters before pagination**

Enviar `status` para `getHistoricoVisitas`, aplicar o estágio no Supabase e manter no cliente apenas busca textual e flags que não possuem coluna própria.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/agendamento-filters.test.ts`
Expected: PASS.

### Task 4: Validation

**Files:**
- Modify only if verification exposes a regression.

- [ ] **Step 1: Run all tests**

Run: `node --test tests/*.test.ts`
Expected: PASS.

- [ ] **Step 2: Run TypeScript**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `cmd /c npm run build`
Expected: successful Next.js build.

- [ ] **Step 4: Review final diff**

Run: `git diff --check` and `git diff --stat`
Expected: no whitespace errors and only scoped files changed.
