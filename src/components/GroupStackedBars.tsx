import { useMemo, useState } from 'react';
import { formatDate, formatBRL } from '../utils/dataParser';
import type { DailyDataPoint } from '../hooks/useFilters';
import styles from './GroupStackedBars.module.css';

interface GroupStackedBarsProps {
  data: DailyDataPoint[];
  groups: string[];
  title?: string;
  dailyGoal?: number;
  comparisonData?: DailyDataPoint[] | null;
  comparisonLabel?: string | null;
}

// Muted, cohesive palette — no saturated colors
const GROUP_COLORS: Record<string, string> = {
  'NETAIR': '#1a1a1a',
  'ACA': '#525252',
  'EASY': '#737373',
  'BELLATOR': '#a3a3a3',
  'UNIQUE': '#d4d4d4',
};

function getGroupColor(grupo: string, index: number): string {
  if (GROUP_COLORS[grupo]) return GROUP_COLORS[grupo];
  // Fallback: grayscale progression
  const grays = ['#1a1a1a', '#404040', '#666666', '#8c8c8c', '#b3b3b3', '#d9d9d9'];
  return grays[index % grays.length];
}

function formatCompact(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toString();
}

export function GroupStackedBars({
  data,
  groups,
  title = 'Contribuição por Grupo',
  dailyGoal,
  comparisonData,
  comparisonLabel,
}: GroupStackedBarsProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const chartData = useMemo(() => {
    return data.map((d, index) => {
      const segments: { grupo: string; value: number; color: string }[] = [];
      let total = 0;

      groups.forEach((grupo, groupIndex) => {
        const value = (d[`group_${grupo}`] as number) || 0;
        if (value > 0) {
          segments.push({
            grupo,
            value,
            color: getGroupColor(grupo, groupIndex),
          });
          total += value;
        }
      });

      // Get comparison total for this index (aligned by day index)
      const comparisonTotal = comparisonData && comparisonData[index]
        ? comparisonData[index].total
        : null;

      return {
        date: d.date,
        dateLabel: formatDate(d.date),
        segments,
        total,
        comparisonTotal,
      };
    });
  }, [data, groups, comparisonData]);

  const maxValue = useMemo(() => {
    const dataMax = Math.max(...chartData.map((d) => d.total), 0);
    if (dailyGoal && dailyGoal > dataMax) return dailyGoal;
    return dataMax;
  }, [chartData, dailyGoal]);

  if (data.length === 0 || groups.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
        </div>
        <div className={styles.empty}>Nenhum dado para exibir</div>
      </div>
    );
  }

  const goalPercent = dailyGoal && maxValue > 0 ? (dailyGoal / maxValue) * 100 : null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <div className={styles.legend}>
          {groups.map((grupo, index) => (
            <div key={grupo} className={styles.legendItem}>
              <span
                className={styles.legendDot}
                style={{ background: getGroupColor(grupo, index) }}
              />
              <span className={styles.legendLabel}>{grupo}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.chart}>
        {/* Y-axis labels */}
        <div className={styles.yAxis}>
          <span className={styles.yLabel}>{formatCompact(maxValue)}</span>
          <span className={styles.yLabel}>{formatCompact(maxValue / 2)}</span>
          <span className={styles.yLabel}>0</span>
        </div>

        {/* Chart area with drawing area and x-axis labels */}
        <div className={styles.chartArea}>
          <div className={styles.drawingArea}>
            {/* Goal line */}
            {goalPercent !== null && (
              <div
                className={styles.goalLine}
                style={{ bottom: `${goalPercent}%` }}
              >
                <span className={styles.goalLabel}>{formatCompact(dailyGoal!)}</span>
              </div>
            )}

            {/* Grid lines */}
            <div className={styles.gridLine} style={{ bottom: '50%' }} />
            <div className={styles.gridLine} style={{ bottom: '0%' }} />

            {/* Bars */}
            <div className={styles.bars}>
              {chartData.map((day, dayIndex) => {
                const comparisonHeightPercent = day.comparisonTotal && maxValue > 0
                  ? (day.comparisonTotal / maxValue) * 100
                  : null;

                return (
                  <div
                    key={dayIndex}
                    className={styles.barColumn}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                      setHoveredIndex(dayIndex);
                    }}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    <div className={styles.barStack}>
                      {/* Comparison outline */}
                      {comparisonHeightPercent !== null && (
                        <div
                          className={styles.comparisonOutline}
                          style={{
                            height: `${comparisonHeightPercent}%`,
                          }}
                        />
                      )}
                      {day.segments.map((seg) => {
                        const heightPercent = maxValue > 0 ? (seg.value / maxValue) * 100 : 0;
                        return (
                          <div
                            key={seg.grupo}
                            className={styles.barSegment}
                            style={{
                              height: `${heightPercent}%`,
                              background: seg.color,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* X-axis labels container */}
          <div className={styles.xAxis}>
            {chartData.map((day, dayIndex) => (
              <div key={dayIndex} className={styles.xLabelWrapper}>
                <span className={styles.xLabel}>{day.dateLabel}</span>
              </div>
            ))}
          </div>

          {/* Tooltip */}
          {hoveredIndex !== null && chartData[hoveredIndex] && (
            <div
              className={styles.tooltip}
              style={{
                left: tooltipPos.x,
                top: tooltipPos.y,
              }}
            >
              <span className={styles.tooltipDate}>{chartData[hoveredIndex].dateLabel}</span>
              <div className={styles.tooltipItems}>
                {chartData[hoveredIndex].segments.map((seg) => {
                  const percent = chartData[hoveredIndex].total > 0
                    ? ((seg.value / chartData[hoveredIndex].total) * 100).toFixed(0)
                    : 0;
                  return (
                    <div key={seg.grupo} className={styles.tooltipItem}>
                      <span className={styles.tooltipDot} style={{ background: seg.color }} />
                      <span className={styles.tooltipLabel}>{seg.grupo}</span>
                      <span className={styles.tooltipPercent}>{percent}%</span>
                      <span className={styles.tooltipValue}>{formatBRL(seg.value)}</span>
                    </div>
                  );
                })}
              </div>
              <div className={styles.tooltipTotal}>
                <span>Total</span>
                <span>{formatBRL(chartData[hoveredIndex].total)}</span>
              </div>
              {chartData[hoveredIndex].comparisonTotal !== null && (
                <>
                  <div className={styles.tooltipComparison}>
                    <span>{comparisonLabel || 'Anterior'}</span>
                    <span>{formatBRL(chartData[hoveredIndex].comparisonTotal!)}</span>
                  </div>
                  <div
                    className={styles.tooltipDelta}
                    style={{
                      color: chartData[hoveredIndex].total >= chartData[hoveredIndex].comparisonTotal!
                        ? 'var(--success)'
                        : 'var(--danger)',
                    }}
                  >
                    {(() => {
                      const delta = ((chartData[hoveredIndex].total - chartData[hoveredIndex].comparisonTotal!) / chartData[hoveredIndex].comparisonTotal!) * 100;
                      return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
                    })()}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
