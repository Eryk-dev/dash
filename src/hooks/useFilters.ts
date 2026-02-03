import { useState, useMemo, useCallback, useEffect } from 'react';
import type { FaturamentoRecord, Filters, KPIs, GoalMetrics } from '../types';
import { startOfWeek, startOfMonth, startOfYear, getDaysInMonth, differenceInCalendarDays } from 'date-fns';
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
  getCompanyGoal: (empresa: string, month?: number) => number;
  getGroupGoal: (grupo: string, month?: number) => number;
  setSelectedMonth: (month: number) => void;
}

export function useFilters(data: FaturamentoRecord[], goalHelpers: GoalHelpers) {
  const { goals, totalGoal, totalYearGoal, getCompanyGoal, getGroupGoal, setSelectedMonth } = goalHelpers;
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

  // Detect reference month from filtered data
  const referenceMonth = useMemo(() => {
    // Priority: filtered data dates > date range filter > today
    if (filteredData.length > 0) {
      // Use the most recent date in filtered data
      const latestDate = filteredData.reduce((latest, r) =>
        r.data > latest ? r.data : latest, filteredData[0].data);
      return latestDate.getMonth() + 1; // 1-12
    }
    if (effectiveDateRange.end) {
      return effectiveDateRange.end.getMonth() + 1;
    }
    return new Date().getMonth() + 1;
  }, [filteredData, effectiveDateRange.end]);

  // Update selected month in goals when reference month changes
  useEffect(() => {
    setSelectedMonth(referenceMonth);
  }, [referenceMonth, setSelectedMonth]);

  // Calculate goal metrics (metas)
  const goalMetrics = useMemo((): GoalMetrics => {
    const today = new Date();

    // D-1 (yesterday) is the reference for "where we should be"
    // because revenue can only be closed on D+1
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0); // noon to avoid timezone issues

    // Check if we're viewing all data (no date filter)
    const isViewingAll = datePreset === 'all' && !effectiveDateRange.start && !effectiveDateRange.end;

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

    // Apply entity filters to all data
    const entityFilteredData = data.filter((record) => {
      if (filters.empresas.length > 0 && !filters.empresas.includes(record.empresa)) return false;
      if (filters.grupos.length > 0 && !filters.grupos.includes(record.grupo)) return false;
      if (filters.segmentos.length > 0 && !filters.segmentos.includes(record.segmento)) return false;
      return true;
    });

    // Get realized amount from filtered data
    const realizado = filteredData.reduce((sum, r) => sum + r.faturamento, 0);

    let metaMensal: number;
    let metaProporcional: number;
    let metaDia: number;
    let metaAno: number;

    // Calculate segment proportion for goal adjustment
    // When filtering by segment, we proportionalize the goal based on historical revenue share
    let segmentProportion = 1;
    if (filters.segmentos.length > 0 && filters.empresas.length === 0 && filters.grupos.length === 0) {
      // Calculate total revenue and segment revenue from all data
      const totalRevenue = data.reduce((sum, r) => sum + r.faturamento, 0);
      const segmentRevenue = data
        .filter((r) => filters.segmentos.includes(r.segmento))
        .reduce((sum, r) => sum + r.faturamento, 0);

      segmentProportion = totalRevenue > 0 ? segmentRevenue / totalRevenue : 0;
    }

    // Calculate annual goal based on filters (sum of all 12 months for filtered entities)
    if (filters.empresas.length > 0) {
      // Sum yearly goals for selected companies
      metaAno = filters.empresas.reduce((sum, empresa) => {
        let yearTotal = 0;
        for (let month = 1; month <= 12; month++) {
          yearTotal += getCompanyGoal(empresa, month);
        }
        return sum + yearTotal;
      }, 0);
    } else if (filters.grupos.length > 0) {
      // Sum yearly goals for selected groups
      metaAno = filters.grupos.reduce((sum, grupo) => {
        let yearTotal = 0;
        for (let month = 1; month <= 12; month++) {
          yearTotal += getGroupGoal(grupo, month);
        }
        return sum + yearTotal;
      }, 0);
    } else if (filters.segmentos.length > 0) {
      // Proportionalize yearly goal based on segment's historical revenue share
      metaAno = totalYearGoal * segmentProportion;
    } else {
      // Total yearly goal for all companies
      metaAno = totalYearGoal;
    }

    if (isViewingAll && filteredData.length > 0) {
      // VIEWING ALL: Calculate meta as sum of daily goals for each day in the period
      // Group data by unique dates to count actual days
      const uniqueDates = new Set<string>();
      filteredData.forEach(r => {
        uniqueDates.add(r.data.toISOString().split('T')[0]);
      });

      // Calculate total meta for the period by summing daily goals for each day
      let totalMetaForPeriod = 0;
      uniqueDates.forEach(dateStr => {
        const date = new Date(dateStr + 'T12:00:00');
        const month = date.getMonth() + 1;
        const daysInThatMonth = getDaysInMonth(date);

        // Get monthly goal for that month
        let monthlyGoal = 0;
        if (filters.empresas.length > 0) {
          monthlyGoal = filters.empresas.reduce((sum, empresa) => sum + getCompanyGoal(empresa, month), 0);
        } else if (filters.grupos.length > 0) {
          monthlyGoal = filters.grupos.reduce((sum, grupo) => sum + getGroupGoal(grupo, month), 0);
        } else if (filters.segmentos.length > 0) {
          // Proportionalize monthly goal based on segment's historical revenue share
          const totalMonthlyGoal = goals.reduce((sum, g) => {
            const companyGoal = getCompanyGoal(g.empresa, month);
            return sum + companyGoal;
          }, 0);
          monthlyGoal = totalMonthlyGoal * segmentProportion;
        } else {
          // Sum all company goals for that month
          monthlyGoal = goals.reduce((sum, g) => {
            const companyGoal = getCompanyGoal(g.empresa, month);
            return sum + companyGoal;
          }, 0);
        }

        // Daily goal for that day
        const dailyGoal = daysInThatMonth > 0 ? monthlyGoal / daysInThatMonth : 0;
        totalMetaForPeriod += dailyGoal;
      });

      metaProporcional = totalMetaForPeriod;
      metaMensal = totalMetaForPeriod; // For "all" view, meta mensal = meta do período
      metaDia = uniqueDates.size > 0 ? totalMetaForPeriod / uniqueDates.size : 0;
    } else {
      // SPECIFIC PERIOD: Use the reference month's goal
      if (filters.empresas.length > 0) {
        metaMensal = filters.empresas.reduce((sum, empresa) => sum + getCompanyGoal(empresa, refMonth), 0);
      } else if (filters.grupos.length > 0) {
        metaMensal = filters.grupos.reduce((sum, grupo) => sum + getGroupGoal(grupo, refMonth), 0);
      } else if (filters.segmentos.length > 0) {
        // Proportionalize monthly goal based on segment's historical revenue share
        metaMensal = totalGoal * segmentProportion;
      } else {
        metaMensal = totalGoal;
      }

      metaDia = diasNoMes > 0 ? metaMensal / diasNoMes : 0;
      metaProporcional = metaDia * diaAtual;
    }

    const gapProporcional = realizado - metaProporcional;
    const gapTotal = realizado - metaMensal;
    const percentualMeta = metaMensal > 0 ? (realizado / metaMensal) * 100 : 0;
    const percentualProporcional = metaProporcional > 0 ? (realizado / metaProporcional) * 100 : 0;

    // Week metrics
    // META SEMANAL = always full week (7 days)
    // diasNaSemana = days until D-1 (yesterday) for "expected" calculation
    // This is because we can only close revenue on D+1
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const diasNaSemana = Math.max(
      Math.min(
        Math.floor((yesterdayEnd.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1,
        7
      ),
      0
    );

    // META SEMANAL = meta diária × 7 (semana completa)
    const metaSemana = metaDia * 7;

    // Realizado semanal = até D-1 (ontem)
    const realizadoSemana = entityFilteredData
      .filter((record) => record.data >= weekStart && record.data <= yesterdayEnd)
      .reduce((sum, r) => sum + r.faturamento, 0);

    // Day metrics (last day with data)
    const lastDayWithData = filteredData.length > 0
      ? filteredData.reduce((latest, r) => r.data > latest ? r.data : latest, filteredData[0].data)
      : new Date(referenceDate.getTime() - 24 * 60 * 60 * 1000);

    const lastDayStart = new Date(lastDayWithData);
    lastDayStart.setHours(0, 0, 0, 0);

    const realizadoDia = filteredData
      .filter((record) => {
        const recordDate = new Date(record.data);
        recordDate.setHours(0, 0, 0, 0);
        return recordDate.getTime() === lastDayStart.getTime();
      })
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
      metaDia,
      realizadoDia,
      metaAno,
      realizadoAno,
      mesesNoAno,
      mesAtual,
      coverage,
    };
  }, [data, filteredData, datePreset, effectiveDateRange, filters.empresas, filters.grupos, filters.segmentos, totalGoal, totalYearGoal, getCompanyGoal, getGroupGoal, goals]);

  // Company goal breakdown for table - uses reference month from filtered data
  const companyGoalData = useMemo(() => {
    // Determine reference date from filtered data
    let referenceDate = new Date();
    if (filteredData.length > 0) {
      referenceDate = filteredData.reduce((latest, r) =>
        r.data > latest ? r.data : latest, filteredData[0].data);
    } else if (effectiveDateRange.end) {
      referenceDate = effectiveDateRange.end;
    }

    const refMonth = referenceDate.getMonth() + 1; // 1-12
    const refYear = referenceDate.getFullYear();
    const diaAtual = referenceDate.getDate();
    const diasNoMes = getDaysInMonth(referenceDate);

    // Get all month data for reference month
    const allMonthData = data.filter((record) => {
      const recordMonth = record.data.getMonth() + 1;
      const recordYear = record.data.getFullYear();
      return recordMonth === refMonth && recordYear === refYear;
    });

    // Group by empresa
    const byEmpresa = new Map<string, number>();
    allMonthData.forEach((record) => {
      byEmpresa.set(record.empresa, (byEmpresa.get(record.empresa) || 0) + record.faturamento);
    });

    // Combine with goals - use reference month for goals
    return goals.map((goal) => {
      const realizado = byEmpresa.get(goal.empresa) || 0;
      // Get goal for this specific month
      const metaMensal = getCompanyGoal(goal.empresa, refMonth);
      const metaDiaria = diasNoMes > 0 ? metaMensal / diasNoMes : 0;
      const metaProporcional = metaDiaria * diaAtual;
      const percentualMeta = metaMensal > 0 ? (realizado / metaMensal) * 100 : 0;
      const gap = realizado - metaProporcional;

      return {
        empresa: goal.empresa,
        grupo: goal.grupo,
        realizado,
        metaMensal,
        metaProporcional,
        percentualMeta,
        gap,
      };
    }).filter((item) => item.metaMensal > 0 || item.realizado > 0);
  }, [data, goals, filteredData, effectiveDateRange.end, getCompanyGoal]);

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
