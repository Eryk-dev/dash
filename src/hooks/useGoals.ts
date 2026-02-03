import { useState, useEffect, useCallback, useMemo } from 'react';
import { DEFAULT_YEARLY_GOALS, toMonthlyGoals, type CompanyYearlyGoal, type CompanyGoal } from '../data/goals';

const STORAGE_KEY = 'faturamento-dashboard-yearly-goals';

export function useGoals() {
  const [yearlyGoals, setYearlyGoals] = useState<CompanyYearlyGoal[]>(() => {
    // Try to load from localStorage on init
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load goals from localStorage:', e);
    }
    return DEFAULT_YEARLY_GOALS;
  });

  // Save to localStorage whenever goals change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(yearlyGoals));
    } catch (e) {
      console.error('Failed to save goals to localStorage:', e);
    }
  }, [yearlyGoals]);

  // Default to current month, but can be overridden
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1);

  const goals = useMemo((): CompanyGoal[] => {
    return toMonthlyGoals(yearlyGoals, selectedMonth);
  }, [yearlyGoals, selectedMonth]);

  const updateYearlyGoals = useCallback((newGoals: CompanyYearlyGoal[]) => {
    setYearlyGoals(newGoals);
  }, []);

  const updateGoalForMonth = useCallback((empresa: string, month: number, value: number) => {
    setYearlyGoals(prev => prev.map(g => {
      if (g.empresa === empresa) {
        return {
          ...g,
          metas: { ...g.metas, [month]: value }
        };
      }
      return g;
    }));
  }, []);

  const resetGoals = useCallback(() => {
    setYearlyGoals(DEFAULT_YEARLY_GOALS);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const getCompanyGoal = useCallback((empresa: string, month?: number): number => {
    const m = month ?? selectedMonth;
    const goal = yearlyGoals.find((g) => g.empresa === empresa);
    return goal?.metas[m] ?? 0;
  }, [yearlyGoals, selectedMonth]);

  const getGroupGoal = useCallback((grupo: string, month?: number): number => {
    const m = month ?? selectedMonth;
    return yearlyGoals
      .filter((g) => g.grupo === grupo)
      .reduce((sum, g) => sum + (g.metas[m] ?? 0), 0);
  }, [yearlyGoals, selectedMonth]);

  const totalGoal = useMemo(() => {
    return yearlyGoals.reduce((sum, g) => sum + (g.metas[selectedMonth] ?? 0), 0);
  }, [yearlyGoals, selectedMonth]);

  // Total goal for year
  const totalYearGoal = useMemo(() => {
    return yearlyGoals.reduce((sum, g) => {
      const yearTotal = Object.values(g.metas).reduce((s, v) => s + v, 0);
      return sum + yearTotal;
    }, 0);
  }, [yearlyGoals]);

  // Backward compatibility - update using old format
  const updateGoals = useCallback((newGoals: CompanyGoal[]) => {
    setYearlyGoals(prev => prev.map(g => {
      const updated = newGoals.find(ng => ng.empresa === g.empresa);
      if (updated) {
        return {
          ...g,
          metas: { ...g.metas, [selectedMonth]: updated.metaMensal }
        };
      }
      return g;
    }));
  }, [selectedMonth]);

  return {
    goals,
    yearlyGoals,
    totalGoal,
    totalYearGoal,
    selectedMonth,
    setSelectedMonth,
    updateGoals,
    updateYearlyGoals,
    updateGoalForMonth,
    resetGoals,
    getCompanyGoal,
    getGroupGoal,
  };
}
