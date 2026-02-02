# Faturamento Dashboard - Documentação Técnica

## Visão Geral

Dashboard de acompanhamento de faturamento para múltiplas empresas organizadas em grupos e segmentos. Permite visualizar receitas, comparar com metas, analisar tendências e entrada manual de dados.

**Stack:** React 19 + TypeScript + Vite + Recharts + date-fns + Lucide Icons

---

## Arquitetura

```
src/
├── App.tsx                    # Componente principal com 3 views
├── types.ts                   # Interfaces TypeScript
├── main.tsx                   # Entry point
├── hooks/
│   ├── useGoogleSheets.ts     # Fetch de dados CSV do Google Sheets
│   ├── useLocalEntries.ts     # Merge dados locais (localStorage)
│   ├── useFilters.ts          # Filtros, KPIs, métricas de metas
│   └── useGoals.ts            # Gestão de metas anuais
├── data/
│   ├── fallbackData.ts        # Lista de empresas (COMPANIES)
│   └── goals.ts               # Metas anuais por empresa/mês
├── components/
│   ├── [Visualização]         # KPICard, RevenueChart, etc.
│   ├── [Filtros]              # DatePicker, MultiSelect, etc.
│   └── [Entrada]              # DataEntry, GoalEditor
└── utils/
    └── dataParser.ts          # Funções de parse e formatação
```

---

## Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────────┐
│                         FONTES DE DADOS                         │
├─────────────────────────────────────────────────────────────────┤
│  Google Sheets CSV          localStorage                        │
│  (VITE_GOOGLE_SHEETS_URL)   (faturamento-entries)               │
│         │                          │                            │
│         ▼                          ▼                            │
│   useGoogleSheets ────────► useLocalEntries                     │
│   (fetch + polling)         (merge + sync)                      │
│         │                          │                            │
│         └──────────┬───────────────┘                            │
│                    ▼                                            │
│              data: FaturamentoRecord[]                          │
│                    │                                            │
│                    ▼                                            │
│              useFilters                                         │
│              - Aplica filtros (empresa, grupo, segmento, data)  │
│              - Calcula KPIs (faturamentoFiltrado, percentual)   │
│              - Calcula GoalMetrics (dia, semana, mês, ano)      │
│              - Gera breakdowns e dados para gráficos            │
│                    │                                            │
│                    ▼                                            │
│               App.tsx                                           │
│              ┌─────┴─────┐                                      │
│         ┌────┴────┐ ┌────┴────┐ ┌────┴────┐                     │
│         │ GERAL   │ │ METAS   │ │ ENTRADA │                     │
│         └─────────┘ └─────────┘ └─────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tipos Principais

### FaturamentoRecord
```typescript
interface FaturamentoRecord {
  data: Date;           // Data do registro
  empresa: string;      // Nome da empresa
  grupo: string;        // Grupo (NETAIR, ACA, EASY, BELLATOR, UNIQUE)
  segmento: string;     // Segmento (AR CONDICIONADO, UTILIDADES, etc.)
  faturamento: number;  // Valor em R$
}
```

### Filters
```typescript
interface Filters {
  empresas: string[];      // Filtro multi-select de empresas
  grupos: string[];        // Filtro multi-select de grupos
  segmentos: string[];     // Filtro multi-select de segmentos
  dataInicio: Date | null; // Data inicial
  dataFim: Date | null;    // Data final
}
```

### GoalMetrics
```typescript
interface GoalMetrics {
  metaMensal: number;           // Meta total do mês
  metaProporcional: number;     // Meta proporcional até dia atual
  realizado: number;            // Faturamento realizado no mês
  gapProporcional: number;      // realizado - metaProporcional
  gapTotal: number;             // realizado - metaMensal
  percentualMeta: number;       // % da meta total atingido
  percentualProporcional: number; // % relativo ao esperado
  diasNoMes: number;
  diaAtual: number;
  // Semana
  metaSemana: number;
  realizadoSemana: number;
  diasNaSemana: number;
  // Dia (ontem)
  metaDia: number;
  realizadoDia: number;
  // Ano
  metaAno: number;
  realizadoAno: number;
  mesAtual: number;
}
```

---

## Hooks

### useGoogleSheets
**Arquivo:** `src/hooks/useGoogleSheets.ts`

Busca dados de faturamento de uma planilha Google Sheets publicada como CSV.

**Configuração:**
- Variável de ambiente: `VITE_GOOGLE_SHEETS_URL`
- Polling: 5 minutos
- Fallback para dados locais em caso de erro

**Retorna:**
```typescript
{
  data: FaturamentoRecord[];
  loading: boolean;
  isConnected: boolean;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}
```

### useLocalEntries
**Arquivo:** `src/hooks/useLocalEntries.ts`

Mescla entradas manuais do localStorage com dados do Google Sheets.

**Storage key:** `faturamento-entries`
**Formato:** `{ "empresa:YYYY-MM-DD": number }`

**Eventos:**
- `storage` - sincroniza entre abas
- `localEntriesUpdated` - evento custom para mesma aba

### useFilters
**Arquivo:** `src/hooks/useFilters.ts`

Hook central que gerencia toda a lógica de filtros, cálculos e transformações.

**Date Presets:**
- `yesterday` - dia anterior
- `wtd` - Week to Date (semana até hoje)
- `mtd` - Month to Date (mês até hoje)
- `all` - período completo

**Outputs principais:**
- `filteredData` - dados filtrados
- `kpis` - faturamentoFiltrado, percentualDoTotal
- `goalMetrics` - métricas de metas
- `dailyData` - dados agrupados por dia (para gráficos)
- `comparisonDailyData` - dados do período de comparação
- Breakdowns: `groupBreakdown`, `segmentBreakdown`, `empresaBreakdown`
- Pie data: `segmentPieData`

**Comparação de Períodos:**
Quando habilitado, compara período atual com período anterior de mesma duração.

### useGoals
**Arquivo:** `src/hooks/useGoals.ts`

Gerencia metas anuais por empresa/mês.

**Storage key:** `faturamento-dashboard-yearly-goals`

**Funções:**
- `getCompanyGoal(empresa, month?)` - meta de uma empresa
- `getGroupGoal(grupo, month?)` - meta somada do grupo
- `updateGoalForMonth(empresa, month, value)` - atualiza meta
- `resetGoals()` - volta aos valores default

---

## Views (App.tsx)

### 1. View Geral (`currentView === 'geral'`)

Visão principal com KPIs, gráficos e breakdowns.

**Componentes:**
- **Filtros:** MultiSelect (Grupo, Segmento, Empresa), DatePicker, DatePresets, ComparisonToggle
- **KPIs:** Faturamento filtrado, % do Total
- **GoalSummary:** Progresso da meta mensal/semanal/diária
- **RevenueChart:** Gráfico de linha do faturamento diário
- **SharePieChart:** Pizza por segmento
- **GroupStackedBars:** Barras empilhadas por grupo/dia
- **BreakdownBars:** Rankings por Empresa, Grupo, Segmento

### 2. View Metas (`currentView === 'metas'`)

Acompanhamento detalhado de metas por empresa e grupo.

**Componentes:**
- **Filtros:** Grupo, Segmento, Empresa, DatePresets
- **PeriodCards:** Cards de Hoje, Semana, Mês, Ano
- **PaceChart:** Gráfico de ritmo vs meta linear
- **GroupRanking:** Ranking de grupos por performance
- **Detalhamento:** Lista expansível de grupos → empresas

**Status de Meta:**
- `ahead` - acima da meta proporcional (+5%)
- `on-track` - dentro da tolerância (±5%)
- `behind` - abaixo da meta proporcional (-5%)

### 3. View Entrada (`currentView === 'entrada'`)

Entrada manual de dados de faturamento.

**Componentes:**
- **DataEntry:** Grid de entrada por empresa × dias

**Funcionalidades:**
- Presets: Ontem, Semana, Mês
- Navegação: ← → entre períodos
- Range personalizado (máx 90 dias)
- Auto-save em localStorage
- Navegação por Tab/Enter
- Indicadores visuais: ✓ salvo, ! abaixo meta

**Comportamento por dia da semana:**
- Segunda: mostra Sex, Sáb, Dom
- Domingo: mostra Sábado
- Outros: mostra Segunda até ontem

---

## Componentes de Visualização

### KPICard
Card simples com label e valor formatado.

### GoalSummary
Mostra progresso da meta com:
- Barra de progresso (realizado/meta)
- Gap em R$ (positivo/negativo)
- Percentuais

### RevenueChart
Gráfico de linha com Recharts:
- Múltiplas linhas por empresa (quando filtrado)
- Linha de comparação pontilhada
- ReferenceLine para meta diária
- Tooltip com valores e delta %

### GroupStackedBars
Barras empilhadas por grupo/dia:
- Cores por grupo
- Hover mostra valores
- Linha de meta diária

### SharePieChart
Pizza com legenda para distribuição por segmento.

### BreakdownBars
Barras horizontais rankeadas com limite de itens.

### PaceChart
Gráfico de área mostrando:
- Realizado acumulado
- Meta linear (linha pontilhada)
- Projeção futura

---

## Dados de Metas (goals.ts)

### Estrutura
```typescript
interface CompanyYearlyGoal {
  empresa: string;
  grupo: string;
  metas: { [month: number]: number }; // 1-12 para Jan-Dez
}
```

### Empresas Cadastradas

**NETAIR (8 empresas):**
NETAIR, NETPARTS, 141AIR, SHOPEE NETAIR, VITAO, VINICIUS, ARTHUR, JONATHAN

**ACA (3 empresas):**
AUTOFY (CONDENSADORES ), AUTOMY, SHOPEE ACA

**EASY (3 empresas):**
EASYPEASY SP, EASYPEASY CWB, SHOPEE EASY

**BELLATOR (3 empresas):**
BELLATOR CWB, BELLATOR - JUNIOR, BELLATOR - SITE

**UNIQUE (7 empresas):**
ML 1 - UNIQUE, ML 2 - UNIQUE, UNIQUEKIDS, UNIQUEBOX, MANU, REPRESENTANTES, SITE TERCEIROS

---

## Parser de Dados (dataParser.ts)

### Funções

**parseBRLCurrency(value: string): number**
```
"R$ 20.715,00" → 20715.00
```

**parseBRDate(dateStr: string): Date**
```
"01/02/2026" → Date
```

**parseCSVData(csvText: string): FaturamentoRecord[]**
Espera CSV com colunas: data, empresa, grupo, segmento, faturamento

**formatBRL(value: number): string**
```
20715 → "R$ 20.715,00"
```

**formatPercent(value: number): string**
```
85.5 → "85.5%"
```

---

## Configuração

### Variáveis de Ambiente (.env)
```
VITE_GOOGLE_SHEETS_URL=https://docs.google.com/spreadsheets/.../pub?output=csv
```

### localStorage Keys
- `faturamento-entries` - Entradas manuais de faturamento
- `faturamento-dashboard-yearly-goals` - Metas editadas pelo usuário

---

## Fluxo de Atualização de Dados

1. **Google Sheets → Dashboard**
   - Polling automático a cada 5 minutos
   - Botão refresh manual
   - Indicador de conexão no header

2. **Entrada Manual → Dashboard**
   - DataEntry salva em localStorage
   - Evento `localEntriesUpdated` dispara re-render
   - useLocalEntries faz merge com dados do Sheets

3. **Metas → Dashboard**
   - GoalEditor atualiza metas
   - Salva em localStorage
   - useGoals recalcula totais

---

## Responsividade

- Mobile: < 768px
- Gráficos ajustam altura
- Labels simplificados
- Grid columns adaptativo

---

## Observações de Implementação

1. **Datas:** Sempre usar noon (12:00) para evitar problemas de timezone
2. **Merge de dados:** localStorage tem prioridade sobre Google Sheets
3. **Comparação:** Alinha por índice (dia 0 = dia 0), não por data
4. **Metas:** Proporcional = (metaMensal / diasNoMes) × diaAtual
5. **Status:** Tolerância de ±5% da meta proporcional
