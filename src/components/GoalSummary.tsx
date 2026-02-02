import { formatBRL, formatPercent } from '../utils/dataParser';
import type { DatePreset } from '../hooks/useFilters';
import styles from './GoalSummary.module.css';

interface GoalSummaryProps {
  realizado: number;
  meta: number;
  metaProporcional: number;
  diaAtual: number;
  datePreset: DatePreset;
  // Week metrics
  metaSemana: number;
  realizadoSemana: number;
  diasNaSemana: number;
  // Day metrics
  metaDia: number;
  realizadoDia: number;
  // Year metrics
  metaAno: number;
  realizadoAno: number;
  mesAtual: number;
}

interface ProgressBarProps {
  label: string;
  realizado: number;
  meta: number;
  expected?: number;
  expectedLabel?: string;
}

function ProgressBar({ label, realizado, meta, expected, expectedLabel }: ProgressBarProps) {
  if (meta === 0) return null;

  const percentual = (realizado / meta) * 100;
  const expectedPercent = expected !== undefined ? (expected / meta) * 100 : null;
  const gap = expected !== undefined ? realizado - expected : realizado - meta;
  const isAhead = gap >= 0;

  return (
    <div className={styles.progressBlock}>
      <div className={styles.progressHeader}>
        <span className={styles.label}>{label}</span>
        <span className={styles.percentage}>{formatPercent(percentual)}</span>
      </div>
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${Math.min(percentual, 100)}%` }}
        />
        {expectedPercent !== null && (
          <div
            className={styles.expectedMarker}
            style={{ left: `${Math.min(expectedPercent, 100)}%` }}
          />
        )}
      </div>
      <div className={styles.progressFooter}>
        <span>{formatBRL(realizado)}</span>
        <span className={styles.metaValue}>de {formatBRL(meta)}</span>
      </div>
      {expectedLabel && (
        <div className={styles.gapRow}>
          <span className={styles.gapLabel}>{expectedLabel}</span>
          <span className={`${styles.gapValue} ${isAhead ? styles.positive : styles.negative}`}>
            {isAhead ? '+' : ''}{formatBRL(gap)}
          </span>
        </div>
      )}
    </div>
  );
}

export function GoalSummary({
  realizado,
  meta,
  metaProporcional,
  diaAtual,
  datePreset,
  metaSemana,
  realizadoSemana,
  diasNaSemana,
  metaDia,
  realizadoDia,
  metaAno,
  realizadoAno,
  mesAtual,
}: GoalSummaryProps) {
  if (meta === 0) return null;

  // Determine which levels to show based on datePreset
  // Ontem: Diária → Semana
  // Semana: Semana → Mês
  // Mês/Tudo: Mês → Ano
  const isYesterday = datePreset === 'yesterday';
  const isWeek = datePreset === 'wtd';
  const isMonthOrAll = datePreset === 'mtd' || datePreset === 'all';

  // Expected value for year (proportional to current month)
  const metaAnoProporcional = (metaAno / 12) * mesAtual;

  return (
    <div className={styles.container}>
      {/* Ontem: Diária → Semana */}
      {isYesterday && (
        <>
          <ProgressBar
            label="Meta Diária"
            realizado={realizadoDia}
            meta={metaDia}
          />
          <div className={styles.divider} />
          <ProgressBar
            label="Meta da Semana"
            realizado={realizadoSemana}
            meta={metaSemana}
            expected={(metaSemana / 7) * diasNaSemana}
            expectedLabel={`vs esperado (${diasNaSemana} dias)`}
          />
        </>
      )}

      {/* Semana: Semana → Mês */}
      {isWeek && (
        <>
          <ProgressBar
            label="Meta da Semana"
            realizado={realizadoSemana}
            meta={metaSemana}
            expected={(metaSemana / 7) * diasNaSemana}
            expectedLabel={`vs esperado (${diasNaSemana} dias)`}
          />
          <div className={styles.divider} />
          <ProgressBar
            label="Meta do Mês"
            realizado={realizado}
            meta={meta}
            expected={metaProporcional}
            expectedLabel={`vs esperado (dia ${diaAtual})`}
          />
        </>
      )}

      {/* Mês/Tudo: Mês → Ano */}
      {isMonthOrAll && (
        <>
          <ProgressBar
            label="Meta do Mês"
            realizado={realizado}
            meta={meta}
            expected={metaProporcional}
            expectedLabel={`vs esperado (dia ${diaAtual})`}
          />
          <div className={styles.divider} />
          <ProgressBar
            label="Meta do Ano"
            realizado={realizadoAno}
            meta={metaAno}
            expected={metaAnoProporcional}
            expectedLabel={`vs esperado (mês ${mesAtual})`}
          />
        </>
      )}
    </div>
  );
}
