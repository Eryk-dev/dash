import { useState, useMemo, useRef, useCallback } from 'react';
import { Check, AlertCircle, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import type { FaturamentoRecord } from '../types';
import type { CompanyYearlyGoal } from '../data/goals';
import { formatBRL } from '../utils/dataParser';
import styles from './DataEntry.module.css';

function toDateInputValue(date: Date): string {
  return date.toISOString().split('T')[0];
}

interface DataEntryProps {
  data: FaturamentoRecord[];
  goals: CompanyYearlyGoal[];
  onSave: (empresa: string, date: string, valor: number) => Promise<{ success: boolean; error?: string }>;
}

interface DayColumn {
  date: Date;
  label: string;
  shortLabel: string;
  isToday: boolean;
  isYesterday: boolean;
}

function formatCompact(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  return `${(value / 1000).toFixed(1)}k`;
}

function getDayLabel(date: Date, today: Date): string {
  const diffDays = Math.round((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
}

function getShortLabel(date: Date): string {
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }).replace('.', '');
}

export function DataEntry({ data, goals, onSave }: DataEntryProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, 2=Tue...
  const isMonday = dayOfWeek === 1;

  // Custom date range state
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);

  // Calculate default days based on day of week
  const defaultDays = useMemo((): DayColumn[] => {
    const days: DayColumn[] = [];

    if (isMonday) {
      // Monday: show Friday, Saturday, Sunday
      for (let i = 3; i >= 1; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        days.push({
          date: d,
          label: getDayLabel(d, today),
          shortLabel: getShortLabel(d),
          isToday: false,
          isYesterday: i === 1,
        });
      }
    } else if (dayOfWeek === 0) {
      // Sunday: show just Saturday
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      days.push({
        date: d,
        label: 'Ontem',
        shortLabel: getShortLabel(d),
        isToday: false,
        isYesterday: true,
      });
    } else {
      // Tuesday-Saturday: show Monday through yesterday
      const daysFromMonday = dayOfWeek - 1;
      for (let i = daysFromMonday; i >= 1; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        days.push({
          date: d,
          label: getDayLabel(d, today),
          shortLabel: getShortLabel(d),
          isToday: false,
          isYesterday: i === 1,
        });
      }
    }

    return days;
  }, [today, dayOfWeek, isMonday]);

  // Calculate custom days from range (max 90 days)
  const customDays = useMemo((): DayColumn[] => {
    if (!customStart || !customEnd) return [];

    const days: DayColumn[] = [];
    const current = new Date(customStart);
    current.setHours(0, 0, 0, 0);
    const end = new Date(customEnd);
    end.setHours(0, 0, 0, 0);

    const maxDays = 90;
    let count = 0;

    while (current <= end && count < maxDays) {
      days.push({
        date: new Date(current),
        label: getDayLabel(current, today),
        shortLabel: getShortLabel(current),
        isToday: current.getTime() === today.getTime(),
        isYesterday: Math.round((today.getTime() - current.getTime()) / (1000 * 60 * 60 * 24)) === 1,
      });
      current.setDate(current.getDate() + 1);
      count++;
    }

    return days;
  }, [customStart, customEnd, today]);

  // Use custom or default days
  const daysToShow = useCustomRange && customDays.length > 0 ? customDays : defaultDays;

  const handleCustomStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? new Date(e.target.value + 'T00:00:00') : null;
    setCustomStart(date);
    if (date && !customEnd) {
      setCustomEnd(date);
    }
    setUseCustomRange(true);
  };

  const handleCustomEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? new Date(e.target.value + 'T00:00:00') : null;
    setCustomEnd(date);
    setUseCustomRange(true);
  };

  const resetToDefault = () => {
    setUseCustomRange(false);
    setCustomStart(null);
    setCustomEnd(null);
  };

  // Quick presets
  const setPreset = (preset: 'ontem' | 'semana' | 'mes') => {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (preset === 'ontem') {
      setCustomStart(yesterday);
      setCustomEnd(yesterday);
    } else if (preset === 'semana') {
      // Always show full current week: Monday to Sunday
      const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...
      const monday = new Date(today);
      const daysSinceMonday = (dayOfWeek + 6) % 7; // Convert to Mon=0, Sun=6
      monday.setDate(monday.getDate() - daysSinceMonday);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      setCustomStart(monday);
      setCustomEnd(sunday);
    } else if (preset === 'mes') {
      // Full month: first day to last day
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setCustomStart(firstDay);
      setCustomEnd(lastDay);
    }
    setUseCustomRange(true);
  };

  // Navigate to previous/next period based on active preset
  const navigatePeriod = (direction: 'prev' | 'next') => {
    if (!customStart || !customEnd) return;

    const offset = direction === 'prev' ? -1 : 1;

    if (activePreset === 'ontem') {
      // Move by 1 day
      const newDate = new Date(customStart);
      newDate.setDate(newDate.getDate() + offset);
      setCustomStart(newDate);
      setCustomEnd(new Date(newDate));
    } else if (activePreset === 'semana') {
      // Move by 1 week - show full week (Mon-Sun)
      const newMonday = new Date(customStart);
      newMonday.setDate(newMonday.getDate() + (offset * 7));
      const newSunday = new Date(newMonday);
      newSunday.setDate(newMonday.getDate() + 6);
      setCustomStart(newMonday);
      setCustomEnd(newSunday);
    } else if (activePreset === 'mes') {
      // Move by 1 month - show full month
      const newStart = new Date(customStart);
      newStart.setMonth(newStart.getMonth() + offset);
      newStart.setDate(1);
      const newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + 1, 0);
      setCustomStart(newStart);
      setCustomEnd(newEnd);
    } else {
      // Custom range - move by the number of days in the range
      const start = new Date(customStart);
      const end = new Date(customEnd);
      const daysDiff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const dayOffset = offset * daysDiff;
      start.setDate(start.getDate() + dayOffset);
      end.setDate(end.getDate() + dayOffset);
      setCustomStart(start);
      setCustomEnd(end);
    }

    setUseCustomRange(true);
  };

  // Determine active preset
  const activePreset = useMemo((): 'ontem' | 'semana' | 'mes' | null => {
    if (!useCustomRange || !customStart || !customEnd) return null;

    const startDate = new Date(customStart);
    const endDate = new Date(customEnd);
    const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Check mes FIRST - starts on 1st of month (regardless of how many days)
    const isFirstDay = startDate.getDate() === 1;
    if (isFirstDay) {
      const lastDayOfMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
      const isLastDay = endDate.getDate() === lastDayOfMonth;
      // Full month or current month (1st to any day in same month)
      if ((isLastDay && startDate.getMonth() === endDate.getMonth()) ||
        startDate.getMonth() === endDate.getMonth()) {
        return 'mes';
      }
    }

    // Check semana - starts on Monday (day 1)
    const startDay = startDate.getDay();
    const endDay = endDate.getDay();
    if (startDay === 1 && (endDay === 0 || daysDiff <= 6)) return 'semana';

    // Check ontem - single day (only if not caught by above)
    if (daysDiff === 0) return 'ontem';

    return null;
  }, [useCustomRange, customStart, customEnd, today]);

  // Values state: Map<"empresa:dateKey", number | null>
  const [values, setValues] = useState<Map<string, number | null>>(new Map());
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [savedFields, setSavedFields] = useState<Set<string>>(new Set());
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Use first day for month calculations
  const referenceDate = daysToShow[0]?.date || today;
  const currentMonth = referenceDate.getMonth() + 1;
  const daysInMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0).getDate();

  // Build company info from goals
  const companies = useMemo(() => {
    return goals.map(g => ({
      empresa: g.empresa,
      grupo: g.grupo,
      dailyGoal: (g.metas[currentMonth] || 0) / daysInMonth,
      segmento: data.find(d => d.empresa === g.empresa)?.segmento || 'OUTROS'
    }));
  }, [goals, currentMonth, daysInMonth, data]);

  // Get existing data for all days
  const existingData = useMemo(() => {
    const result = new Map<string, number>();

    daysToShow.forEach(day => {
      const dateKey = day.date.toISOString().split('T')[0];
      data.forEach(record => {
        const recordKey = record.data.toISOString().split('T')[0];
        if (recordKey === dateKey) {
          result.set(`${record.empresa}:${dateKey}`, record.faturamento);
        }
      });
    });

    return result;
  }, [data, daysToShow]);

  // Track days signature to detect changes
  const daysSignature = daysToShow.map(d => d.date.toISOString().split('T')[0]).join(',');
  const dataSignature = data.map(d => `${d.empresa}:${d.data.toISOString().split('T')[0]}:${d.faturamento}`).join(',');
  const [lastSignature, setLastSignature] = useState('');

  // Initialize/reset values when days or data change
  const currentSignature = `${daysSignature}|${dataSignature}`;
  if (currentSignature !== lastSignature && daysToShow.length > 0) {
    const newValues = new Map<string, number | null>();
    const newSavedFields = new Set<string>();

    daysToShow.forEach(day => {
      const dateKey = day.date.toISOString().split('T')[0];
      companies.forEach(c => {
        const key = `${c.empresa}:${dateKey}`;
        // Get value from Supabase data
        const existing = existingData.get(key);

        if (existing !== undefined && existing > 0) {
          newValues.set(key, existing);
          newSavedFields.add(key);
        } else {
          newValues.set(key, null);
        }
      });
    });
    setValues(newValues);
    setSavedFields(newSavedFields);
    setLastSignature(currentSignature);
  }

  // Calculate stats per day
  const dayStats = useMemo(() => {
    return daysToShow.map(day => {
      const dateKey = day.date.toISOString().split('T')[0];
      let total = 0;
      let filledCount = 0;
      let goalTotal = 0;

      companies.forEach(c => {
        const key = `${c.empresa}:${dateKey}`;
        const value = values.get(key);
        if (value != null && value > 0) {
          total += value;
          filledCount++;
        }
        goalTotal += c.dailyGoal;
      });

      return {
        date: day.date,
        dateKey,
        total,
        filledCount,
        totalCount: companies.length,
        goalTotal,
        percentFilled: Math.round((filledCount / companies.length) * 100),
        percentGoal: goalTotal > 0 ? Math.round((total / goalTotal) * 100) : 0,
      };
    });
  }, [daysToShow, companies, values]);

  // Group companies
  const groups = useMemo(() => {
    const grouped = new Map<string, typeof companies>();
    companies.forEach(c => {
      if (!grouped.has(c.grupo)) {
        grouped.set(c.grupo, []);
      }
      grouped.get(c.grupo)!.push(c);
    });
    return Array.from(grouped.entries());
  }, [companies]);

  // Local state for the input currently being edited to allow smooth typing with decimals
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const savingTimeoutRef = useRef<any>(null);

  const handleValueChange = useCallback(async (empresa: string, dateKey: string, rawValue: string) => {
    // Allow only digits and a single comma
    const sanitizedValue = rawValue.replace(/[^\d,]/g, '');

    // Check if there's more than one comma and keep only the first one
    const parts = sanitizedValue.split(',');
    const finalValue = parts.length > 2
      ? parts[0] + ',' + parts.slice(1).join('')
      : sanitizedValue;

    setEditingValue(finalValue);

    const cleanValue = finalValue.replace(',', '.');
    const numValue = cleanValue ? parseFloat(cleanValue) : 0;
    const key = `${empresa}:${dateKey}`;

    setValues(prev => {
      const next = new Map(prev);
      next.set(key, numValue || null);
      return next;
    });

    // Auto-save to Supabase with debounce
    if (savingTimeoutRef.current) clearTimeout(savingTimeoutRef.current);

    savingTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);

      const result = await onSave(empresa, dateKey, numValue);

      if (result.success) {
        setSavedFields(prev => {
          const next = new Set(prev);
          if (numValue > 0) {
            next.add(key);
          } else {
            next.delete(key);
          }
          return next;
        });
      } else {
        console.error('Error saving:', result.error);
      }

      setTimeout(() => setIsSaving(false), 500);
    }, 500);
  }, [onSave]);

  const handleFocus = useCallback((key: string, value: number | null) => {
    setFocusedField(key);
    setEditingKey(key);
    setEditingValue(value !== null ? formatBRL(value).replace('R$', '').trim() : '');
  }, []);

  const handleBlur = useCallback(() => {
    setFocusedField(null);
    setEditingKey(null);
    setEditingValue('');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, empresa: string, dateKey: string) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();

      // Build flat list of all inputs
      const allInputs: { empresa: string; dateKey: string }[] = [];
      groups.forEach(([, entries]) => {
        entries.forEach(entry => {
          daysToShow.forEach(day => {
            allInputs.push({ empresa: entry.empresa, dateKey: day.date.toISOString().split('T')[0] });
          });
        });
      });

      const currentKey = `${empresa}:${dateKey}`;
      const currentIndex = allInputs.findIndex(i => `${i.empresa}:${i.dateKey}` === currentKey);

      // Before moving, ensure we format the current value correctly if it's being edited
      if (editingKey === currentKey) {
        // The blur handler will clear editingKey, but we might want to force a save/format here
      }

      const nextIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;

      if (nextIndex >= 0 && nextIndex < allInputs.length) {
        const next = allInputs[nextIndex];
        const nextKey = `${next.empresa}:${next.dateKey}`;
        const nextInput = inputRefs.current.get(nextKey);
        nextInput?.focus();
        nextInput?.select();
      }
    }
  }, [groups, daysToShow]);

  // Calculate week total
  const weekTotal = dayStats.reduce((sum, d) => sum + d.total, 0);
  const weekGoal = dayStats.reduce((sum, d) => sum + d.goalTotal, 0);

  const dayCount = daysToShow.length;

  return (
    <div className={styles.container} style={{ '--day-count': dayCount } as React.CSSProperties}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerTitle}>
            <h2 className={styles.title}>
              {useCustomRange ? 'Período Personalizado' : isMonday ? 'Fim de Semana' : 'Semana'}
            </h2>
            <span className={styles.subtitle}>
              {daysToShow.length} {daysToShow.length === 1 ? 'dia' : 'dias'} para preencher
              {isSaving && <span className={styles.savingIndicator}> • Salvando...</span>}
            </span>
          </div>
          <div className={styles.weekSummary}>
            <span className={styles.weekTotal}>{formatBRL(weekTotal)}</span>
            <span className={styles.weekGoal}>
              de {formatCompact(weekGoal)} ({weekGoal > 0 ? Math.round((weekTotal / weekGoal) * 100) : 0}%)
            </span>
          </div>
        </div>

        {/* Date range filter */}
        <div className={styles.dateFilter}>
          <div className={styles.dateNavigation}>
            <button
              type="button"
              className={styles.navButton}
              onClick={() => navigatePeriod('prev')}
              title="Período anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <div className={styles.datePresets}>
              <button
                type="button"
                className={`${styles.presetButton} ${activePreset === 'ontem' ? styles.active : ''}`}
                onClick={() => setPreset('ontem')}
              >
                Ontem
              </button>
              <button
                type="button"
                className={`${styles.presetButton} ${activePreset === 'semana' ? styles.active : ''}`}
                onClick={() => setPreset('semana')}
              >
                Semana
              </button>
              <button
                type="button"
                className={`${styles.presetButton} ${activePreset === 'mes' ? styles.active : ''}`}
                onClick={() => setPreset('mes')}
              >
                Mês
              </button>
            </div>
            <button
              type="button"
              className={styles.navButton}
              onClick={() => navigatePeriod('next')}
              title="Próximo período"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className={styles.dateInputs}>
            <Calendar size={16} className={styles.calendarIcon} />
            <input
              type="date"
              className={styles.dateInput}
              value={customStart ? toDateInputValue(customStart) : ''}
              onChange={handleCustomStartChange}
              max={toDateInputValue(today)}
              placeholder="De"
            />
            <span className={styles.dateSeparator}>até</span>
            <input
              type="date"
              className={styles.dateInput}
              value={customEnd ? toDateInputValue(customEnd) : ''}
              onChange={handleCustomEndChange}
              min={customStart ? toDateInputValue(customStart) : undefined}
              max={toDateInputValue(today)}
              placeholder="Até"
            />
          </div>
          {useCustomRange && (
            <button
              type="button"
              className={styles.resetButton}
              onClick={resetToDefault}
            >
              Padrão
            </button>
          )}
        </div>

      </header>

      {/* Scrollable content */}
      <div className={styles.scrollWrapper}>
        {/* Days header */}
        <div className={styles.daysHeader}>
          <div className={styles.daysHeaderLabel}>Empresa</div>
          {daysToShow.map((day, i) => {
            const stats = dayStats[i];
            return (
              <div key={day.date.toISOString()} className={styles.dayHeader}>
                <span className={styles.dayName}>{day.label}</span>
                <span className={styles.dayDate}>
                  {day.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </span>
                <div className={styles.dayProgress}>
                  <div
                    className={styles.dayProgressBar}
                    style={{ width: `${stats.percentFilled}%` }}
                  />
                </div>
                <span className={styles.dayStats}>
                  {formatCompact(stats.total)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Entry groups */}
        <div className={styles.groups}>
          {groups.map(([grupo, entries]) => (
            <div key={grupo} className={styles.group}>
              <div className={styles.groupHeader}>
                <span className={styles.groupName}>{grupo}</span>
              </div>

              <div className={styles.entriesTable}>
                {entries.map((entry) => (
                  <div key={entry.empresa} className={styles.entryRow}>
                    <div className={styles.entryInfo}>
                      <span className={styles.entryName} title={entry.empresa}>{entry.empresa}</span>
                      <span className={styles.entryGoal}>meta: {formatBRL(entry.dailyGoal)}</span>
                    </div>

                    {daysToShow.map((day) => {
                      const dateKey = day.date.toISOString().split('T')[0];
                      const key = `${entry.empresa}:${dateKey}`;
                      const value = values.get(key) ?? null;
                      const isFocused = focusedField === key;
                      const isSaved = savedFields.has(key);
                      const hasValue = value !== null;

                      // Using a small epsilon or rounding for currency comparison to avoid float issues
                      const isAboveGoal = hasValue && (Math.round(value * 100) / 100) >= (Math.round(entry.dailyGoal * 100) / 100);
                      const isBelowGoal = hasValue && (Math.round(value * 100) / 100) < (Math.round(entry.dailyGoal * 100) / 100);

                      const displayValue = editingKey === key
                        ? editingValue
                        : value !== null
                          ? formatBRL(value).replace('R$', '').trim()
                          : '';

                      return (
                        <div
                          key={dateKey}
                          className={`${styles.entryCell} ${isFocused ? styles.focused : ''} ${hasValue ? styles.filled : ''} ${isBelowGoal ? styles.belowGoal : ''}`}
                        >
                          <input
                            ref={(el) => {
                              if (el) inputRefs.current.set(key, el);
                            }}
                            type="text"
                            inputMode="decimal"
                            className={styles.input}
                            value={displayValue}
                            placeholder="0"
                            onChange={(e) => handleValueChange(entry.empresa, dateKey, e.target.value)}
                            onFocus={() => handleFocus(key, value)}
                            onBlur={handleBlur}
                            onKeyDown={(e) => handleKeyDown(e, entry.empresa, dateKey)}
                          />
                          <div className={styles.cellStatus}>
                            {isSaved && hasValue && <Check size={12} className={styles.savedIcon} />}
                            {isAboveGoal && <span className={styles.aboveGoal}>+</span>}
                            {isBelowGoal && <AlertCircle size={12} className={styles.warningIcon} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <span className={styles.keyHint}>
          <kbd>Tab</kbd> / <kbd>Enter</kbd> próximo
        </span>
        <span className={styles.keyHint}>
          <kbd>Shift+Tab</kbd> anterior
        </span>
      </footer>
    </div>
  );
}
