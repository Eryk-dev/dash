import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatBRL } from '../utils/dataParser';
import { PeriodCards } from './PeriodCards';
import { PaceChart } from './PaceChart';
import { GroupRanking } from './GroupRanking';
import type { Filters } from '../types';
import type { DatePreset } from '../hooks/useFilters';
import styles from './GoalsDashboard.module.css';

interface CompanyGoalData {
  empresa: string;
  grupo: string;
  realizado: number;
  metaMensal: number;
  metaProporcional: number;
  percentualMeta: number;
  gap: number;
}

interface DailyDataPoint {
  date: Date;
  total: number;
}

interface GoalsDashboardProps {
  data: CompanyGoalData[];
  totalRealizado: number;
  totalMeta: number;
  metaProporcional: number;
  diaAtual: number;
  diasNoMes: number;
  filters?: Filters;
  datePreset?: DatePreset;
  // New props for charts
  dailyData?: DailyDataPoint[];
  realizadoHoje?: number;
  metaHoje?: number;
  realizadoSemana?: number;
  metaSemana?: number;
  diasNaSemana?: number;
  diaAtualSemana?: number;
  realizadoAno?: number;
  metaAno?: number;
}

type Status = 'ahead' | 'on-track' | 'behind';

function getStatus(gap: number, metaProporcional: number): Status {
  const tolerance = metaProporcional * 0.05;
  if (gap > tolerance) return 'ahead';
  if (gap < -tolerance) return 'behind';
  return 'on-track';
}

export function GoalsDashboard({
  data,
  totalRealizado,
  totalMeta,
  metaProporcional,
  diaAtual,
  diasNoMes,
  filters,
  datePreset = 'mtd',
  dailyData = [],
  realizadoHoje = 0,
  metaHoje = 0,
  realizadoSemana = 0,
  metaSemana = 0,
  diasNaSemana = 5,
  diaAtualSemana = 1,
  realizadoAno = 0,
  metaAno = 0,
}: GoalsDashboardProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Filter data based on filters
  const filteredData = useMemo(() => {
    if (!filters) return data;

    return data.filter((item) => {
      if (filters.grupos.length > 0 && !filters.grupos.includes(item.grupo)) return false;
      if (filters.empresas.length > 0 && !filters.empresas.includes(item.empresa)) return false;
      return true;
    });
  }, [data, filters]);

  // Calculate totals from filtered data
  const filteredTotals = useMemo(() => {
    const realizado = filteredData.reduce((sum, d) => sum + d.realizado, 0);
    const meta = filteredData.reduce((sum, d) => sum + d.metaMensal, 0);
    const metaProp = filteredData.reduce((sum, d) => sum + d.metaProporcional, 0);
    return { realizado, meta, metaProp };
  }, [filteredData]);

  const hasFilters = filters && (filters.grupos.length > 0 || filters.empresas.length > 0 || filters.segmentos.length > 0);

  const displayRealizado = hasFilters ? filteredTotals.realizado : totalRealizado;
  const displayMeta = hasFilters ? filteredTotals.meta : totalMeta;
  const displayMetaProp = hasFilters ? filteredTotals.metaProp : metaProporcional;

  // Group data for ranking
  const groupTotals = useMemo(() => {
    const grouped = filteredData.reduce((acc, item) => {
      if (!acc[item.grupo]) {
        acc[item.grupo] = { realizado: 0, meta: 0, metaProp: 0 };
      }
      acc[item.grupo].realizado += item.realizado;
      acc[item.grupo].meta += item.metaMensal;
      acc[item.grupo].metaProp += item.metaProporcional;
      return acc;
    }, {} as Record<string, { realizado: number; meta: number; metaProp: number }>);

    return Object.entries(grouped).map(([grupo, totals]) => ({
      grupo,
      realizado: totals.realizado,
      meta: totals.meta,
      metaProporcional: totals.metaProp,
    }));
  }, [filteredData]);

  // Period data for cards
  const periodData = useMemo(() => {
    const metaDiaria = displayMeta / diasNoMes;
    const metaSemanalCalc = metaSemana || metaDiaria * diasNaSemana;
    const metaPropHoje = metaDiaria;
    const metaPropSemana = metaDiaria * diaAtualSemana;

    return {
      hoje: {
        realizado: realizadoHoje,
        meta: metaDiaria,
        metaProporcional: metaPropHoje,
      },
      semana: {
        realizado: realizadoSemana,
        meta: metaSemanalCalc,
        metaProporcional: metaPropSemana,
      },
      mes: {
        realizado: displayRealizado,
        meta: displayMeta,
        metaProporcional: displayMetaProp,
      },
      ano: metaAno > 0 ? {
        realizado: realizadoAno,
        meta: metaAno,
        metaProporcional: metaAno * (new Date().getMonth() + 1) / 12,
      } : undefined,
    };
  }, [displayRealizado, displayMeta, displayMetaProp, diasNoMes, realizadoHoje, metaHoje, realizadoSemana, metaSemana, diasNaSemana, diaAtualSemana, realizadoAno, metaAno]);

  const toggleGroup = (grupo: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(grupo)) {
        next.delete(grupo);
      } else {
        next.add(grupo);
      }
      return next;
    });
  };

  // Group companies for detail view
  const groupedCompanies = useMemo(() => {
    return groupTotals.map(g => ({
      ...g,
      companies: filteredData
        .filter(c => c.grupo === g.grupo && (c.metaMensal > 0 || c.realizado > 0))
        .sort((a, b) => b.realizado - a.realizado),
    })).sort((a, b) => b.realizado - a.realizado);
  }, [groupTotals, filteredData]);

  return (
    <div className={styles.container}>
      {/* Period Cards */}
      <section className={styles.section}>
        <PeriodCards
          hoje={periodData.hoje}
          semana={periodData.semana}
          mes={periodData.mes}
          ano={periodData.ano}
          activePreset={datePreset}
        />
      </section>

      {/* Charts Row */}
      <section className={styles.chartsRow}>
        <div className={styles.chartMain}>
          <PaceChart
            dailyData={dailyData}
            metaMensal={displayMeta}
            diasNoMes={diasNoMes}
            diaAtual={diaAtual}
          />
        </div>
        <div className={styles.chartSide}>
          <GroupRanking groups={groupTotals} />
        </div>
      </section>

      {/* Detailed Groups */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Detalhamento por Grupo</span>
        </div>

        <div className={styles.groupList}>
          {groupedCompanies.map(({ grupo, realizado, meta, metaProporcional: metaProp, companies }) => {
            const isExpanded = expandedGroups.has(grupo);
            const gap = realizado - metaProp;
            const status = getStatus(gap, metaProp);
            const percent = meta > 0 ? Math.round((realizado / meta) * 100) : 0;

            return (
              <div key={grupo} className={styles.groupCard}>
                <button
                  className={styles.groupHeader}
                  onClick={() => toggleGroup(grupo)}
                >
                  <div className={styles.groupLeft}>
                    <span className={styles.groupName}>{grupo}</span>
                    <span className={`${styles.groupGap} ${styles[status]}`}>
                      {gap >= 0 ? '+' : ''}{formatBRL(gap)}
                    </span>
                  </div>
                  <div className={styles.groupCenter}>
                    <div className={styles.groupProgress}>
                      <div
                        className={`${styles.groupProgressFill} ${styles[status]}`}
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className={styles.groupRight}>
                    <span className={styles.groupValue}>{formatBRL(realizado)}</span>
                    <span className={styles.groupPercent}>{percent}%</span>
                  </div>
                  <div className={styles.groupChevron}>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {isExpanded && (
                  <div className={styles.groupCompanies}>
                    {companies.map((company) => {
                      const companyStatus = getStatus(company.gap, company.metaProporcional);
                      const companyPercent = company.metaMensal > 0
                        ? Math.round((company.realizado / company.metaMensal) * 100)
                        : 0;

                      return (
                        <div key={company.empresa} className={styles.companyRow}>
                          <div className={styles.companyInfo}>
                            <span className={styles.companyName}>{company.empresa}</span>
                            <span className={`${styles.companyGap} ${styles[companyStatus]}`}>
                              {company.gap >= 0 ? '+' : ''}{formatBRL(company.gap)}
                            </span>
                          </div>
                          <div className={styles.companyProgress}>
                            <div
                              className={`${styles.companyProgressFill} ${styles[companyStatus]}`}
                              style={{ width: `${Math.min(companyPercent, 100)}%` }}
                            />
                          </div>
                          <div className={styles.companyValues}>
                            <span>{formatBRL(company.realizado)}</span>
                            <span className={styles.companyMeta}>/ {formatBRL(company.metaMensal)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
