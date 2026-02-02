import { useState, useMemo, useCallback } from 'react';
import type { FaturamentoRecord, Filters, KPIs, GoalMetrics } from '../types';
import { startOfWeek, startOfMonth, getDaysInMonth } from 'date-fns';
import type { CompanyGoal } from '../data/goals';
import { COMPANIES } from '../data/fallbackData';

export type DatePreset = 'yesterday' | 'wtd' | 'mtd' | 'all';

export interface DailyDataPoint {
  date: Date;
  total: number;
  [key: string]: number | Date; // For dynamic company keys
}

interface GoalHelpers {
  goals: CompanyGoal[];
  totalGoal: number;
  totalYearGoal: number;
  getCompanyGoal: (empresa: string) => number;
  getGroupGoal: (grupo: string) => number;
}

export function useFilters(data: FaturamentoRecord[], goalHelpers: GoalHelpers) {
  const { goals, totalGoal, totalYearGoal, getCompanyGoal, getGroupGoal } = goalHelpers;
  const [filters, setFilters] = useState<Filters>({
    empresas: [],
    grupos: [],
    segmentos: [],
    dataInicio: null,
    dataFim: null,
  });

  const [datePreset, setDatePreset] = useState<DatePreset>('all');

  // Extract unique values for dropdowns
  const options = useMemo(() => {
    const empresas = data.length > 0
      ? [...new Set(data.map((d) => d.empresa))].sort()
      : [...new Set(COMPANIES.map((c) => c.empresa))].sort();

    const grupos = data.length > 0
      ? [...new Set(data.map((d) => d.grupo))].sort()
      : [...new Set(COMPANIES.map((c) => c.grupo))].sort();

    const segmentos = data.length > 0
      ? [...new Set(data.map((d) => d.segmento))].sort()
      : [...new Set(COMPANIES.map((c) => c.segmento))].sort();

    const dates = data.map((d) => d.data.getTime());
    const minDate = dates.length > 0 ? new Date(Math.min(...dates)) : null;
    const maxDate = dates.length > 0 ? new Date(Math.max(...dates)) : null;

    return { empresas, grupos, segmentos, minDate, maxDate };
  }, [data]);

  // Calculate effective date range based on preset or custom dates
  const effectiveDateRange = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    switch (datePreset) {
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const start = new Date(yesterday);
        start.setHours(0, 0, 0, 0);
        const end = new Date(yesterday);
        end.setHours(23, 59, 59, 999);
        return { start, end };
      }
      case 'wtd': {
        const start = startOfWeek(today, { weekStartsOn: 1 });
        return { start, end: today };
      }
      case 'mtd': {
        const start = startOfMonth(today);
        return { start, end: today };
      }
      case 'all':
      default:
        return {
          start: filters.dataInicio,
          end: filters.dataFim,
        };
    }
  }, [datePreset, filters.dataInicio, filters.dataFim]);

  // Apply filters to data
  const filteredData = useMemo(() => {
    return data.filter((record) => {
      if (filters.empresas.length > 0 && !filters.empresas.includes(record.empresa)) return false;
      if (filters.grupos.length > 0 && !filters.grupos.includes(record.grupo)) return false;
      if (filters.segmentos.length > 0 && !filters.segmentos.includes(record.segmento)) return false;
      if (effectiveDateRange.start && record.data < effectiveDateRange.start) return false;
      if (effectiveDateRange.end && record.data > effectiveDateRange.end) return false;
      return true;
    });
  }, [data, filters, effectiveDateRange]);

  // Data filtered only by date (for total calculations)
  const dateFilteredData = useMemo(() => {
    return data.filter((record) => {
      if (effectiveDateRange.start && record.data < effectiveDateRange.start) return false;
      if (effectiveDateRange.end && record.data > effectiveDateRange.end) return false;
      return true;
    });
  }, [data, effectiveDateRange]);

  // Calculate KPIs
  const kpis = useMemo((): KPIs => {
    const faturamentoTotal = dateFilteredData.reduce((sum, r) => sum + r.faturamento, 0);
    const faturamentoFiltrado = filteredData.reduce((sum, r) => sum + r.faturamento, 0);

    const percentualDoTotal =
      faturamentoTotal > 0 ? (faturamentoFiltrado / faturamentoTotal) * 100 : 0;

    return {
      faturamentoFiltrado,
      faturamentoTotal,
      percentualDoTotal,
    };
  }, [filteredData, dateFilteredData]);

  // Calculate goal metrics (metas)
  const goalMetrics = useMemo((): GoalMetrics => {
    const today = new Date();
    const diaAtual = today.getDate();
    const diasNoMes = getDaysInMonth(today);

    // Calculate meta based on filters
    let metaMensal = 0;

    if (filters.empresas.length > 0) {
      // Sum goals for selected companies
      metaMensal = filters.empresas.reduce((sum, empresa) => sum + getCompanyGoal(empresa), 0);
    } else if (filters.grupos.length > 0) {
      // Sum goals for selected groups
      metaMensal = filters.grupos.reduce((sum, grupo) => sum + getGroupGoal(grupo), 0);
    } else {
      // Total goal
      metaMensal = totalGoal;
    }

    // Get realized amount from all data (not date filtered) for MTD comparison
    const allMonthData = data.filter((record) => {
      const recordMonth = record.data.getMonth();
      const recordYear = record.data.getFullYear();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      return recordMonth === currentMonth && recordYear === currentYear;
    });

    // Apply entity filters to month data
    const filteredMonthData = allMonthData.filter((record) => {
      if (filters.empresas.length > 0 && !filters.empresas.includes(record.empresa)) return false;
      if (filters.grupos.length > 0 && !filters.grupos.includes(record.grupo)) return false;
      if (filters.segmentos.length > 0 && !filters.segmentos.includes(record.segmento)) return false;
      return true;
    });

    const realizado = filteredMonthData.reduce((sum, r) => sum + r.faturamento, 0);
    const metaProporcional = (metaMensal / diasNoMes) * diaAtual;
    const gapProporcional = realizado - metaProporcional;
    const gapTotal = realizado - metaMensal;
    const percentualMeta = metaMensal > 0 ? (realizado / metaMensal) * 100 : 0;
    const percentualProporcional = metaProporcional > 0 ? (realizado / metaProporcional) * 100 : 0;

    // Week metrics
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const diasNaSemana = Math.floor((today.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const metaSemana = (metaMensal / diasNoMes) * 7; // Weekly goal based on daily rate
    const realizadoSemana = filteredMonthData
      .filter((record) => record.data >= weekStart && record.data <= today)
      .reduce((sum, r) => sum + r.faturamento, 0);

    // Day metrics (yesterday)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const metaDia = metaMensal / diasNoMes;
    const realizadoDia = filteredMonthData
      .filter((record) => {
        const recordDate = new Date(record.data);
        recordDate.setHours(0, 0, 0, 0);
        return recordDate.getTime() === yesterday.getTime();
      })
      .reduce((sum, r) => sum + r.faturamento, 0);

    // Year metrics
    const mesAtual = today.getMonth() + 1; // 1-12
    const mesesNoAno = 12;
    const metaAno = totalYearGoal; // Use actual yearly goal sum

    // Get all year data
    const allYearData = data.filter((record) => {
      const recordYear = record.data.getFullYear();
      const currentYear = today.getFullYear();
      return recordYear === currentYear;
    });

    // Apply entity filters to year data
    const filteredYearData = allYearData.filter((record) => {
      if (filters.empresas.length > 0 && !filters.empresas.includes(record.empresa)) return false;
      if (filters.grupos.length > 0 && !filters.grupos.includes(record.grupo)) return false;
      if (filters.segmentos.length > 0 && !filters.segmentos.includes(record.segmento)) return false;
      return true;
    });

    const realizadoAno = filteredYearData.reduce((sum, r) => sum + r.faturamento, 0);

    return {
      metaMensal,
      metaProporcional,
      realizado,
      gapProporcional,
      gapTotal,
      percentualMeta,
      percentualProporcional,
      diasNoMes,
      diaAtual,
      metaSemana,
      realizadoSemana,
      diasNaSemana,
      metaDia,
      realizadoDia,
      metaAno,
      realizadoAno,
      mesesNoAno,
      mesAtual,
    };
  }, [data, filters.empresas, filters.grupos, filters.segmentos, totalGoal, getCompanyGoal, getGroupGoal]);

  // Company goal breakdown for table
  const companyGoalData = useMemo(() => {
    const today = new Date();
    const diaAtual = today.getDate();
    const diasNoMes = getDaysInMonth(today);

    // Get all month data
    const allMonthData = data.filter((record) => {
      const recordMonth = record.data.getMonth();
      const recordYear = record.data.getFullYear();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      return recordMonth === currentMonth && recordYear === currentYear;
    });

    // Group by empresa
    const byEmpresa = new Map<string, number>();
    allMonthData.forEach((record) => {
      byEmpresa.set(record.empresa, (byEmpresa.get(record.empresa) || 0) + record.faturamento);
    });

    // Combine with goals
    return goals.map((goal) => {
      const realizado = byEmpresa.get(goal.empresa) || 0;
      const metaProporcional = (goal.metaMensal / diasNoMes) * diaAtual;
      const percentualMeta = goal.metaMensal > 0 ? (realizado / goal.metaMensal) * 100 : 0;
      const gap = realizado - metaProporcional;

      return {
        empresa: goal.empresa,
        grupo: goal.grupo,
        realizado,
        metaMensal: goal.metaMensal,
        metaProporcional,
        percentualMeta,
        gap,
      };
    }).filter((item) => item.metaMensal > 0 || item.realizado > 0);
  }, [data, goals]);

  // Daily totals for chart - with breakdown by company and group
  const dailyData = useMemo(() => {
    const grouped = new Map<string, { total: number; byCompany: Map<string, number>; byGroup: Map<string, number> }>();

    filteredData.forEach((record) => {
      const dateKey = record.data.toISOString().split('T')[0];

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, { total: 0, byCompany: new Map(), byGroup: new Map() });
      }

      const dayData = grouped.get(dateKey)!;
      dayData.total += record.faturamento;

      // Track by company
      const currentCompanyTotal = dayData.byCompany.get(record.empresa) || 0;
      dayData.byCompany.set(record.empresa, currentCompanyTotal + record.faturamento);

      // Track by group
      const currentGroupTotal = dayData.byGroup.get(record.grupo) || 0;
      dayData.byGroup.set(record.grupo, currentGroupTotal + record.faturamento);
    });

    return Array.from(grouped.entries())
      .map(([date, { total, byCompany, byGroup }]) => {
        const point: DailyDataPoint = {
          date: new Date(date),
          total,
        };

        // Add company-specific values
        byCompany.forEach((value, empresa) => {
          point[empresa] = value;
        });

        // Add group-specific values (prefixed to avoid collision)
        byGroup.forEach((value, grupo) => {
          point[`group_${grupo}`] = value;
        });

        return point;
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [filteredData]);

  // Comparison state
  const [comparisonEnabled, setComparisonEnabled] = useState(false);
  const [customComparisonStart, setCustomComparisonStart] = useState<Date | null>(null);
  const [customComparisonEnd, setCustomComparisonEnd] = useState<Date | null>(null);

  // Calculate comparison date range based on current period duration
  const comparisonDateRange = useMemo(() => {
    if (!comparisonEnabled) return null;

    // If custom comparison dates are set, use them
    if (customComparisonStart && customComparisonEnd) {
      return {
        start: customComparisonStart,
        end: customComparisonEnd,
        label: 'Período Personalizado',
      };
    }

    // Calculate based on effective date range
    const { start: currentStart, end: currentEnd } = effectiveDateRange;

    // If no date range is set (all data), skip comparison
    if (!currentStart || !currentEnd) return null;

    // Calculate duration in days
    const durationMs = currentEnd.getTime() - currentStart.getTime();
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24)) + 1;

    // Comparison period is immediately before current period
    const compEnd = new Date(currentStart);
    compEnd.setDate(compEnd.getDate() - 1);
    compEnd.setHours(23, 59, 59, 999);

    const compStart = new Date(compEnd);
    compStart.setDate(compStart.getDate() - durationDays + 1);
    compStart.setHours(0, 0, 0, 0);

    // Generate label based on duration
    let label: string;
    if (durationDays === 1) {
      label = 'Dia Anterior';
    } else if (durationDays <= 7) {
      label = `${durationDays} dias anteriores`;
    } else {
      label = 'Período Anterior';
    }

    return { start: compStart, end: compEnd, label };
  }, [comparisonEnabled, customComparisonStart, customComparisonEnd, effectiveDateRange]);

  // Filter data for comparison period
  const comparisonFilteredData = useMemo(() => {
    if (!comparisonDateRange) return null;

    return data.filter((record) => {
      if (filters.empresas.length > 0 && !filters.empresas.includes(record.empresa)) return false;
      if (filters.grupos.length > 0 && !filters.grupos.includes(record.grupo)) return false;
      if (filters.segmentos.length > 0 && !filters.segmentos.includes(record.segmento)) return false;
      if (record.data < comparisonDateRange.start) return false;
      if (record.data > comparisonDateRange.end) return false;
      return true;
    });
  }, [data, filters, comparisonDateRange]);

  // Daily totals for comparison data
  const comparisonDailyData = useMemo(() => {
    if (!comparisonFilteredData) return null;

    const grouped = new Map<string, { total: number; byCompany: Map<string, number>; byGroup: Map<string, number> }>();

    comparisonFilteredData.forEach((record) => {
      const dateKey = record.data.toISOString().split('T')[0];

      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, { total: 0, byCompany: new Map(), byGroup: new Map() });
      }

      const dayData = grouped.get(dateKey)!;
      dayData.total += record.faturamento;

      // Track by company
      const currentCompanyTotal = dayData.byCompany.get(record.empresa) || 0;
      dayData.byCompany.set(record.empresa, currentCompanyTotal + record.faturamento);

      // Track by group
      const currentGroupTotal = dayData.byGroup.get(record.grupo) || 0;
      dayData.byGroup.set(record.grupo, currentGroupTotal + record.faturamento);
    });

    return Array.from(grouped.entries())
      .map(([date, { total, byCompany, byGroup }]) => {
        const point: DailyDataPoint = {
          date: new Date(date),
          total,
        };

        // Add company-specific values
        byCompany.forEach((value, empresa) => {
          point[empresa] = value;
        });

        // Add group-specific values (prefixed to avoid collision)
        byGroup.forEach((value, grupo) => {
          point[`group_${grupo}`] = value;
        });

        return point;
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [comparisonFilteredData]);

  const comparisonLabel = comparisonDateRange?.label ?? null;

  // Get list of companies in the chart data (for line chart)
  const chartCompanies = useMemo(() => {
    if (filters.empresas.length <= 1) return [];
    return filters.empresas;
  }, [filters.empresas]);

  // Get all unique companies from filtered data (for stacked bar chart)
  const allCompaniesInData = useMemo(() => {
    const companyTotals = new Map<string, number>();
    filteredData.forEach((record) => {
      companyTotals.set(record.empresa, (companyTotals.get(record.empresa) || 0) + record.faturamento);
    });
    return Array.from(companyTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([empresa]) => empresa);
  }, [filteredData]);

  // Get all unique groups from filtered data (sorted by total revenue)
  const allGroupsInData = useMemo(() => {
    const groupTotals = new Map<string, number>();
    filteredData.forEach((record) => {
      groupTotals.set(record.grupo, (groupTotals.get(record.grupo) || 0) + record.faturamento);
    });
    return Array.from(groupTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([grupo]) => grupo);
  }, [filteredData]);

  // Group breakdown
  const groupBreakdown = useMemo(() => {
    const grouped = new Map<string, number>();

    filteredData.forEach((record) => {
      grouped.set(record.grupo, (grouped.get(record.grupo) || 0) + record.faturamento);
    });

    return Array.from(grouped.entries())
      .map(([grupo, total]) => ({ grupo, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredData]);

  // Segment breakdown
  const segmentBreakdown = useMemo(() => {
    const grouped = new Map<string, number>();

    filteredData.forEach((record) => {
      grouped.set(record.segmento, (grouped.get(record.segmento) || 0) + record.faturamento);
    });

    return Array.from(grouped.entries())
      .map(([segmento, total]) => ({ segmento, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredData]);

  // Empresa breakdown
  const empresaBreakdown = useMemo(() => {
    const grouped = new Map<string, number>();

    filteredData.forEach((record) => {
      grouped.set(record.empresa, (grouped.get(record.empresa) || 0) + record.faturamento);
    });

    return Array.from(grouped.entries())
      .map(([empresa, total]) => ({ empresa, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredData]);

  // Pie chart data - filtered vs rest
  const pieData = useMemo(() => {
    const filtrado = kpis.faturamentoFiltrado;
    const resto = kpis.faturamentoTotal - filtrado;

    return [
      { name: 'Selecionado', value: filtrado },
      { name: 'Outros', value: resto },
    ];
  }, [kpis]);

  // Segment pie chart data
  const segmentPieData = useMemo(() => {
    const grouped = new Map<string, number>();

    dateFilteredData.forEach((record) => {
      grouped.set(record.segmento, (grouped.get(record.segmento) || 0) + record.faturamento);
    });

    return Array.from(grouped.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [dateFilteredData]);

  const updateFilter = useCallback(
    <K extends keyof Filters>(key: K, value: Filters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      if (key === 'dataInicio' || key === 'dataFim') {
        setDatePreset('all');
      }
    },
    []
  );

  const toggleFilterValue = useCallback(
    (key: 'empresas' | 'grupos' | 'segmentos', value: string) => {
      setFilters((prev) => {
        const current = prev[key];
        const updated = current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value];
        return { ...prev, [key]: updated };
      });
    },
    []
  );

  const setDatePresetHandler = useCallback((preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== 'all') {
      setFilters((prev) => ({ ...prev, dataInicio: null, dataFim: null }));
    }
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      empresas: [],
      grupos: [],
      segmentos: [],
      dataInicio: null,
      dataFim: null,
    });
    setDatePreset('all');
    setComparisonEnabled(false);
    setCustomComparisonStart(null);
    setCustomComparisonEnd(null);
  }, []);

  const toggleComparison = useCallback(() => {
    setComparisonEnabled((prev) => !prev);
  }, []);

  const setCustomComparisonRange = useCallback((start: Date | null, end: Date | null) => {
    setCustomComparisonStart(start);
    setCustomComparisonEnd(end);
  }, []);

  const clearCustomComparison = useCallback(() => {
    setCustomComparisonStart(null);
    setCustomComparisonEnd(null);
  }, []);

  const hasActiveFilters =
    filters.empresas.length > 0 ||
    filters.grupos.length > 0 ||
    filters.segmentos.length > 0 ||
    filters.dataInicio !== null ||
    filters.dataFim !== null ||
    datePreset !== 'all' ||
    comparisonEnabled;

  return {
    filters,
    options,
    filteredData,
    kpis,
    goalMetrics,
    companyGoalData,
    dailyData,
    comparisonDailyData,
    comparisonLabel,
    comparisonEnabled,
    comparisonDateRange,
    customComparisonStart,
    customComparisonEnd,
    chartCompanies,
    allCompaniesInData,
    allGroupsInData,
    groupBreakdown,
    segmentBreakdown,
    empresaBreakdown,
    pieData,
    segmentPieData,
    datePreset,
    effectiveDateRange,
    updateFilter,
    toggleFilterValue,
    setDatePreset: setDatePresetHandler,
    clearFilters,
    hasActiveFilters,
    toggleComparison,
    setCustomComparisonRange,
    clearCustomComparison,
  };
}
