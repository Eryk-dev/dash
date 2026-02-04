import { useState, useMemo, useCallback, useEffect } from 'react';
import type { FaturamentoRecord, Filters, KPIs, GoalMetrics, RevenueLine } from '../types';
import { startOfWeek, startOfMonth, startOfYear, getDaysInMonth, differenceInCalendarDays, addDays } from 'date-fns';
import type { CompanyYearlyGoal } from '../data/goals';
import {
  buildCompanyMetaInfo,
  filterCompaniesByFilters,
  getTotalAdjustedDailyGoal,
  getTotalBaseDailyGoal,
  getTotalMonthlyGoal,
  getTotalYearlyGoal,
  sumAdjustedDailyGoalsForRange,
  buildDailyGoalMap,
} from '../utils/goalCalculator';

export type DatePreset = 'yesterday' | 'wtd' | 'mtd' | 'all';

export interface DailyDataPoint {
  date: Date;
  total: number;
  goal?: number;
  [key: string]: number | Date | undefined; // For dynamic company keys
}

interface GoalHelpers {
  yearlyGoals: CompanyYearlyGoal[];
  setSelectedMonth: (month: number) => void;
  lines: RevenueLine[];
}

export function useFilters(data: FaturamentoRecord[], goalHelpers: GoalHelpers) {
  const { yearlyGoals, setSelectedMonth, lines } = goalHelpers;
  const [filters, setFilters] = useState<Filters>({
    empresas: [],
    grupos: [],
    segmentos: [],
    dataInicio: null,
    dataFim: null,
  });

  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const lineSets = useMemo(() => {
    return {
      empresas: new Set(lines.map((l) => l.empresa)),
      grupos: new Set(lines.map((l) => l.grupo)),
      segmentos: new Set(lines.map((l) => l.segmento)),
    };
  }, [lines]);

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      empresas: prev.empresas.filter((e) => lineSets.empresas.has(e)),
      grupos: prev.grupos.filter((g) => lineSets.grupos.has(g)),
      segmentos: prev.segmentos.filter((s) => lineSets.segmentos.has(s)),
    }));
  }, [lineSets]);

  const companyMetaInfo = useMemo(
    () => buildCompanyMetaInfo(yearlyGoals, lines),
    [yearlyGoals, lines]
  );
  const selectedCompaniesForGoals = useMemo(
    () => filterCompaniesByFilters(companyMetaInfo, filters),
    [companyMetaInfo, filters]
  );

  // Extract unique values for dropdowns
  const options = useMemo(() => {
    const empresas = [...new Set(lines.map((c) => c.empresa))].sort();
    const grupos = [...new Set(lines.map((c) => c.grupo))].sort();
    const segmentos = [...new Set(lines.map((c) => c.segmento))].sort();

    const dates = data.map((d) => d.data.getTime());
    const minDate = dates.length > 0 ? new Date(Math.min(...dates)) : null;
    const maxDate = dates.length > 0 ? new Date(Math.max(...dates)) : null;

    return { empresas, grupos, segmentos, minDate, maxDate };
  }, [data, lines]);

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

  // Sempre usar o mês de D-1 como referência para metas
  useEffect(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    setSelectedMonth(yesterday.getMonth() + 1);
  }, [setSelectedMonth]);

  // Calculate goal metrics (metas)
  const goalMetrics = useMemo((): GoalMetrics => {
    const today = new Date();

    // D-1 (yesterday) is the reference for "where we should be"
    // because revenue can only be closed on D+1
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0); // noon to avoid timezone issues

    const isAllPreset = datePreset === 'all';
    const hasCustomRange = isAllPreset && !!effectiveDateRange.start && !!effectiveDateRange.end;

    // Determine the reference date based on filtered data
    let referenceDate = today;
    if (filteredData.length > 0) {
      referenceDate = filteredData.reduce((latest, r) =>
        r.data > latest ? r.data : latest, filteredData[0].data);
    } else if (effectiveDateRange.end) {
      referenceDate = effectiveDateRange.end;
    }

    const refMonth = yesterday.getMonth() + 1; // 1-12, use D-1 for month reference
    const refYear = yesterday.getFullYear();
    // diaAtual = D-1 for "expected" calculations (where we should be)
    const diaAtual = yesterday.getDate();
    const diasNoMes = getDaysInMonth(yesterday);

    const selectedCompanies = selectedCompaniesForGoals;
    const isArCondicionado = selectedCompanies.length > 0 && selectedCompanies.every(
      (c) => c.segmento === 'AR CONDICIONADO'
    );

    // Apply entity filters to all data
    const entityFilteredData = data.filter((record) => {
      if (filters.empresas.length > 0 && !filters.empresas.includes(record.empresa)) return false;
      if (filters.grupos.length > 0 && !filters.grupos.includes(record.grupo)) return false;
      if (filters.segmentos.length > 0 && !filters.segmentos.includes(record.segmento)) return false;
      return true;
    });

    // Get realized amount from filtered data
    const realizado = filteredData.reduce((sum, r) => sum + r.faturamento, 0);

    let metaMensal = 0;
    let metaProporcional = 0;
    const metaDia = getTotalBaseDailyGoal(selectedCompanies, yesterday);
    const metaDiaAjustada = getTotalAdjustedDailyGoal(selectedCompanies, yesterday);
    const metaAno = getTotalYearlyGoal(selectedCompanies);
    const metasMensais = Array.from({ length: 12 }, (_, index) =>
      getTotalMonthlyGoal(selectedCompanies, index + 1)
    );

    if (hasCustomRange && effectiveDateRange.start && effectiveDateRange.end) {
      metaMensal = sumAdjustedDailyGoalsForRange(
        selectedCompanies,
        effectiveDateRange.start,
        effectiveDateRange.end
      );
      metaProporcional = metaMensal;
    } else if (isAllPreset && filteredData.length > 0) {
      const uniqueDates = Array.from(
        new Set(filteredData.map((r) => r.data.toISOString().split('T')[0]))
      ).map((dateStr) => new Date(dateStr + 'T12:00:00'));

      const goalMap = buildDailyGoalMap(selectedCompanies, uniqueDates);
      metaMensal = uniqueDates.reduce((sum, date) => {
        const key = date.toISOString().split('T')[0];
        return sum + (goalMap.get(key) || 0);
      }, 0);
      metaProporcional = metaMensal;
    } else {
      metaMensal = getTotalMonthlyGoal(selectedCompanies, refMonth);
      metaProporcional = sumAdjustedDailyGoalsForRange(
        selectedCompanies,
        startOfMonth(yesterday),
        yesterday
      );
    }

    const gapProporcional = realizado - metaProporcional;
    const gapTotal = realizado - metaMensal;
    const percentualMeta = metaMensal > 0 ? (realizado / metaMensal) * 100 : 0;
    const percentualProporcional = metaProporcional > 0 ? (realizado / metaProporcional) * 100 : 0;

    // Week metrics
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const weekStart = startOfWeek(yesterday, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);
    const diasNaSemana = Math.max(
      Math.min(
        Math.floor((yesterdayEnd.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1,
        7
      ),
      0
    );

    const metaSemana = sumAdjustedDailyGoalsForRange(selectedCompanies, weekStart, weekEnd);
    const esperadoSemanal = sumAdjustedDailyGoalsForRange(selectedCompanies, weekStart, yesterday);

    // Realizado semanal = até D-1 (ontem)
    const realizadoSemana = entityFilteredData
      .filter((record) => record.data >= weekStart && record.data <= yesterdayEnd)
      .reduce((sum, r) => sum + r.faturamento, 0);

    const yesterdayStart = new Date(yesterday);
    yesterdayStart.setHours(0, 0, 0, 0);

    const realizadoDia = entityFilteredData
      .filter((record) => record.data >= yesterdayStart && record.data <= yesterdayEnd)
      .reduce((sum, r) => sum + r.faturamento, 0);

    // Month metrics - always full month until D-1, independent of date filter
    const monthStart = startOfMonth(yesterday);
    const realizadoMes = entityFilteredData
      .filter((record) => record.data >= monthStart && record.data <= yesterdayEnd)
      .reduce((sum, r) => sum + r.faturamento, 0);

    // Year metrics
    const mesAtual = refMonth;
    const mesesNoAno = 12;

    // Get all year data for the reference year until D-1
    const realizadoAno = entityFilteredData
      .filter((record) => record.data.getFullYear() === refYear && record.data <= yesterdayEnd)
      .reduce((sum, r) => sum + r.faturamento, 0);

    const coverage = (() => {
      const normalize = (d: Date) => {
        const nd = new Date(d);
        nd.setHours(0, 0, 0, 0);
        return nd;
      };
      const startDay = normalize(referenceDate);
      const endDay = normalize(referenceDate);
      const weekStartDate = normalize(weekStart);
      const monthStartDate = normalize(startOfMonth(referenceDate));
      const yearStartDate = normalize(startOfYear(referenceDate));

      const countDays = (records: FaturamentoRecord[], start: Date, end: Date) => {
        const unique = new Set<string>();
        records.forEach((r) => {
          const rd = normalize(r.data);
          if (rd >= start && rd <= end) {
            unique.add(rd.toISOString().split('T')[0]);
          }
        });
        return unique.size;
      };

      const build = (records: FaturamentoRecord[], start: Date, end: Date) => {
        const expected = Math.max(differenceInCalendarDays(end, start) + 1, 0);
        const observed = expected > 0 ? countDays(records, start, end) : 0;
        return {
          observed,
          expected,
          percent: expected > 0 ? observed / expected : 0,
        };
      };

      return {
        dia: build(entityFilteredData, startDay, endDay),
        semana: build(entityFilteredData, weekStartDate, endDay),
        mes: build(entityFilteredData, monthStartDate, endDay),
        ano: build(entityFilteredData, yearStartDate, endDay),
      };
    })();

    return {
      metaMensal,
      metaProporcional,
      realizado,
      realizadoMes,
      gapProporcional,
      gapTotal,
      percentualMeta,
      percentualProporcional,
      diasNoMes,
      diaAtual,
      metaSemana,
      realizadoSemana,
      diasNaSemana,
      esperadoSemanal,
      metaDia,
      metaDiaAjustada,
      realizadoDia,
      metaAno,
      metasMensais,
      realizadoAno,
      mesesNoAno,
      mesAtual,
      coverage,
      isArCondicionado,
    };
  }, [
    data,
    filteredData,
    datePreset,
    effectiveDateRange,
    filters.empresas,
    filters.grupos,
    filters.segmentos,
    selectedCompaniesForGoals,
  ]);

  // Company goal breakdown for table - uses reference month from filtered data
  const companyGoalData = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);

    const refMonth = yesterday.getMonth() + 1;
    const refYear = yesterday.getFullYear();
    const monthStart = startOfMonth(yesterday);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const allMonthData = data.filter((record) => {
      const recordMonth = record.data.getMonth() + 1;
      const recordYear = record.data.getFullYear();
      return recordMonth === refMonth && recordYear === refYear && record.data <= yesterdayEnd;
    });

    const byEmpresa = new Map<string, number>();
    allMonthData.forEach((record) => {
      byEmpresa.set(record.empresa, (byEmpresa.get(record.empresa) || 0) + record.faturamento);
    });

    return companyMetaInfo.map((company) => {
      const realizado = byEmpresa.get(company.empresa) || 0;
      const metaMensal = company.metas[refMonth] || 0;
      const metaProporcional = sumAdjustedDailyGoalsForRange([company], monthStart, yesterday);
      const percentualMeta = metaMensal > 0 ? (realizado / metaMensal) * 100 : 0;
      const gap = realizado - metaProporcional;

      return {
        empresa: company.empresa,
        grupo: company.grupo,
        segmento: company.segmento,
        realizado,
        metaMensal,
        metaProporcional,
        percentualMeta,
        gap,
      };
    }).filter((item) => item.metaMensal > 0 || item.realizado > 0);
  }, [data, companyMetaInfo]);

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

    const dates = Array.from(grouped.keys()).map((date) => new Date(date + 'T12:00:00'));
    const goalMap = buildDailyGoalMap(selectedCompaniesForGoals, dates);

    return Array.from(grouped.entries())
      .map(([date, { total, byCompany, byGroup }]) => {
        const point: DailyDataPoint = {
          date: new Date(date + 'T12:00:00'), // Use noon to avoid timezone issues
          total,
        };

        const goalValue = goalMap.get(date) || 0;
        if (goalValue > 0) {
          point.goal = goalValue;
        }

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
  }, [filteredData, selectedCompaniesForGoals]);

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
          date: new Date(date + 'T12:00:00'), // Use noon to avoid timezone issues
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

  const getGoalForDate = useCallback(
    (date: Date) => getTotalAdjustedDailyGoal(selectedCompaniesForGoals, date),
    [selectedCompaniesForGoals]
  );

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
    getGoalForDate,
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
