export interface FaturamentoRecord {
  data: Date;
  empresa: string;
  grupo: string;
  segmento: string;
  faturamento: number;
}

export interface Filters {
  empresas: string[];
  grupos: string[];
  segmentos: string[];
  dataInicio: Date | null;
  dataFim: Date | null;
}

export interface KPIs {
  faturamentoFiltrado: number;
  faturamentoTotal: number;
  percentualDoTotal: number;
}

export interface CoverageMetrics {
  observed: number;
  expected: number;
  percent: number;
}

export interface GoalMetrics {
  metaMensal: number;          // Meta do período selecionado
  metaProporcional: number;     // Meta proporcional até o dia atual
  realizado: number;            // Faturamento realizado no mês
  gapProporcional: number;      // Diferença entre realizado e meta proporcional
  gapTotal: number;             // Diferença entre realizado e meta total
  percentualMeta: number;       // % da meta total atingido
  percentualProporcional: number; // % em relação ao esperado até hoje
  diasNoMes: number;
  diaAtual: number;
  // Week metrics
  metaSemana: number;           // Meta da semana
  realizadoSemana: number;      // Faturamento realizado na semana
  diasNaSemana: number;         // Dias úteis na semana (até hoje)
  // Day metrics
  metaDia: number;              // Meta do dia (ontem)
  realizadoDia: number;         // Faturamento realizado no dia (ontem)
  // Year metrics
  metaAno: number;              // Meta do ano
  realizadoAno: number;         // Faturamento realizado no ano
  mesesNoAno: number;           // Meses no ano (12)
  mesAtual: number;             // Mês atual (1-12)
  coverage: {
    dia: CoverageMetrics;
    semana: CoverageMetrics;
    mes: CoverageMetrics;
    ano: CoverageMetrics;
  };
}
