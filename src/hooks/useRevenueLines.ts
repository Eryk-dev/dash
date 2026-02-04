import { useState, useEffect, useCallback, useMemo } from 'react';
import type { CompanyYearlyGoal } from '../data/goals';
import type { RevenueLine } from '../types';
import { COMPANIES } from '../data/fallbackData';

const STORAGE_KEY = 'faturamento-dashboard-revenue-lines';

function normalizeLine(line: RevenueLine): RevenueLine {
  return {
    empresa: line.empresa.trim(),
    grupo: line.grupo.trim(),
    segmento: line.segmento.trim(),
  };
}

function dedupeLines(lines: RevenueLine[]): RevenueLine[] {
  const map = new Map<string, RevenueLine>();
  lines.forEach((line) => {
    if (!line.empresa) return;
    map.set(line.empresa, line);
  });
  return Array.from(map.values());
}

export function useRevenueLines(yearlyGoals: CompanyYearlyGoal[]) {
  const [lines, setLines] = useState<RevenueLine[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RevenueLine[];
        return dedupeLines(parsed.map(normalizeLine));
      }
    } catch (e) {
      console.error('Failed to load revenue lines from localStorage:', e);
    }
    return COMPANIES.map((line) => ({ ...line }));
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch (e) {
      console.error('Failed to save revenue lines to localStorage:', e);
    }
  }, [lines]);

  // Ensure any goal entries exist in the line list
  useEffect(() => {
    if (yearlyGoals.length === 0) return;
    setLines((prev) => {
      const map = new Map(prev.map((line) => [line.empresa, line]));
      yearlyGoals.forEach((goal) => {
        if (!map.has(goal.empresa)) {
          map.set(goal.empresa, {
            empresa: goal.empresa,
            grupo: goal.grupo || 'OUTROS',
            segmento: 'OUTROS',
          });
        }
      });
      return Array.from(map.values());
    });
  }, [yearlyGoals]);

  const addLine = useCallback((line: RevenueLine) => {
    const normalized = normalizeLine(line);
    if (!normalized.empresa) return;
    setLines((prev) => {
      if (prev.some((l) => l.empresa === normalized.empresa)) return prev;
      return [...prev, normalized].sort((a, b) => a.empresa.localeCompare(b.empresa));
    });
  }, []);

  const updateLine = useCallback((empresa: string, updates: Partial<RevenueLine>) => {
    setLines((prev) =>
      prev.map((line) =>
        line.empresa === empresa
          ? normalizeLine({ ...line, ...updates } as RevenueLine)
          : line
      )
    );
  }, []);

  const removeLine = useCallback((empresa: string) => {
    setLines((prev) => prev.filter((line) => line.empresa !== empresa));
  }, []);

  const lineMap = useMemo(() => new Map(lines.map((line) => [line.empresa, line])), [lines]);

  return {
    lines,
    lineMap,
    addLine,
    updateLine,
    removeLine,
    setLines,
  };
}
