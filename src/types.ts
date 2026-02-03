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
  realizado: number;            // Faturamento realizado no período filtrado
  realizadoMes: number;         // Faturamento realizado no mês até D-1 (independente do filtro)
  gapProporcional: number;      // Diferença entre realizado e meta proporcional
  gapTotal: number;             // Diferença entre realizado e meta total
  percentualMeta: number;       // % da meta total atingido
  percentualProporcional: number; // % em relação ao esperado até hoje
  diasNoMes: number;
  diaAtual: number;             // Dia D-1 (ontem) para cálculo de esperado
  // Week metrics
  metaSemana: number;           // Meta da semana (7 dias completos)
  realizadoSemana: number;      // Faturamento realizado na semana até D-1
  diasNaSemana: number;         // Dias na semana até D-1
  // Day metrics
  metaDia: number;              // Meta do dia
  realizadoDia: number;         // Faturamento realizado no dia (D-1)
  // Year metrics
  metaAno: number;              // Meta do ano
  realizadoAno: number;         // Faturamento realizado no ano até D-1
  mesesNoAno: number;           // Meses no ano (12)
  mesAtual: number;             // Mês de D-1 (1-12)
  coverage: {
    dia: CoverageMetrics;
    semana: CoverageMetrics;
    mes: CoverageMetrics;
    ano: CoverageMetrics;
  };
}
