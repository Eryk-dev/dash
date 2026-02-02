import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { formatBRL } from '../utils/dataParser';
import styles from './PaceChart.module.css';

interface PaceChartProps {
  dailyData: { date: Date; total: number }[];
  metaMensal: number;
  diasNoMes: number;
  diaAtual: number;
}

function formatCompact(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toString();
}

export function PaceChart({ dailyData, metaMensal, diasNoMes, diaAtual }: PaceChartProps) {
  // Data is entered next morning, so last complete day is yesterday
  const lastCompleteDay = Math.max(1, diaAtual - 1);

  const chartData = useMemo(() => {
    const metaDiaria = metaMensal / diasNoMes;
    const data: { dia: number; realizado: number; esperado: number; projecao?: number }[] = [];

    // Calculate cumulative realized
    let cumulative = 0;
    const dailyByDay = new Map<number, number>();

    dailyData.forEach((d) => {
      const day = d.date.getDate();
      dailyByDay.set(day, (dailyByDay.get(day) || 0) + d.total);
    });

    // Build chart data for each day of month
    for (let dia = 1; dia <= diasNoMes; dia++) {
      const dayValue = dailyByDay.get(dia) || 0;
      cumulative += dayValue;

      const esperado = metaDiaria * dia;

      if (dia <= lastCompleteDay) {
        data.push({
          dia,
          realizado: cumulative,
          esperado,
        });
      } else {
        // Future days - only show expected line
        data.push({
          dia,
          realizado: dia === lastCompleteDay + 1 ? cumulative : undefined as any,
          esperado,
        });
      }
    }

    // Add projection line from last complete day to end of month
    if (lastCompleteDay > 0 && lastCompleteDay < diasNoMes) {
      const avgDaily = cumulative / lastCompleteDay;

      // Update projection for remaining days
      for (let i = lastCompleteDay; i < data.length; i++) {
        data[i].projecao = cumulative + avgDaily * (data[i].dia - lastCompleteDay);
      }
    }

    return data;
  }, [dailyData, metaMensal, diasNoMes, lastCompleteDay]);

  const currentTotal = chartData[lastCompleteDay - 1]?.realizado || 0;
  const expectedTotal = chartData[lastCompleteDay - 1]?.esperado || 0;
  const gap = currentTotal - expectedTotal;
  const projectedEnd = chartData[chartData.length - 1]?.projecao || currentTotal;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    return (
      <div className={styles.tooltip}>
        <div className={styles.tooltipHeader}>Dia {label}</div>
        {payload.map((entry: any) => {
          if (entry.value === undefined) return null;
          const labels: Record<string, string> = {
            realizado: 'Realizado',
            esperado: 'Esperado',
            projecao: 'Projeção',
          };
          return (
            <div key={entry.dataKey} className={styles.tooltipRow}>
              <span
                className={styles.tooltipDot}
                style={{ background: entry.color }}
              />
              <span>{labels[entry.dataKey]}:</span>
              <span className={styles.tooltipValue}>{formatBRL(entry.value)}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>Ritmo do Mês</div>
        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Atual</span>
            <span className={styles.summaryValue}>{formatCompact(currentTotal)}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Projeção</span>
            <span className={`${styles.summaryValue} ${projectedEnd >= metaMensal ? styles.positive : styles.negative}`}>
              {formatCompact(projectedEnd)}
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Gap</span>
            <span className={`${styles.summaryValue} ${gap >= 0 ? styles.positive : styles.negative}`}>
              {gap >= 0 ? '+' : ''}{formatBRL(gap)}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="realizadoGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--ink)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="var(--ink)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="dia"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'var(--ink-faint)' }}
              tickFormatter={(v) => (v % 5 === 0 || v === 1 || v === diasNoMes) ? v : ''}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'var(--ink-faint)' }}
              tickFormatter={formatCompact}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine x={lastCompleteDay} stroke="var(--ink)" strokeDasharray="3 3" opacity={0.5} />
            <Area
              type="monotone"
              dataKey="esperado"
              stroke="var(--ink-faint)"
              strokeWidth={1}
              strokeDasharray="4 4"
              fill="none"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="projecao"
              stroke="var(--warning)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="none"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="realizado"
              stroke="var(--ink)"
              strokeWidth={2}
              fill="url(#realizadoGradient)"
              dot={false}
              connectNulls={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
