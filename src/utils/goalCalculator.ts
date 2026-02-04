import { addDays, getDaysInMonth } from 'date-fns';
import type { Filters } from '../types';
import type { CompanyYearlyGoal } from '../data/goals';
import { COMPANIES } from '../data/fallbackData';
import type { RevenueLine } from '../types';

export interface CompanyMetaInfo extends CompanyYearlyGoal {
  segmento: string;
}

export function buildCompanyMetaInfo(
  yearlyGoals: CompanyYearlyGoal[],
  lines: RevenueLine[] = COMPANIES
): CompanyMetaInfo[] {
  return yearlyGoals.map((goal) => {
    const companyInfo = lines.find((c) => c.empresa === goal.empresa);
    return {
      ...goal,
      segmento: companyInfo?.segmento || 'OUTROS',
    };
  });
}

export function filterCompaniesByFilters(companies: CompanyMetaInfo[], filters: Filters): CompanyMetaInfo[] {
  return companies.filter((company) => {
    if (filters.empresas.length > 0 && !filters.empresas.includes(company.empresa)) return false;
    if (filters.grupos.length > 0 && !filters.grupos.includes(company.grupo)) return false;
    if (filters.segmentos.length > 0 && !filters.segmentos.includes(company.segmento)) return false;
    return true;
  });
}

function normalizeDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(12, 0, 0, 0);
  return normalized;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function getAdjustmentFactor(segmento: string, date: Date): number {
  if (segmento !== 'AR CONDICIONADO') return 1;
  return isWeekend(date) ? 0.5 : 1.2;
}

export function getCompanyDailyBaseGoal(company: CompanyMetaInfo, date: Date): number {
  const month = date.getMonth() + 1;
  const metaMensal = company.metas[month] || 0;
  const daysInMonth = getDaysInMonth(date);
  return daysInMonth > 0 ? metaMensal / daysInMonth : 0;
}

export function getCompanyAdjustedDailyGoal(company: CompanyMetaInfo, date: Date): number {
  const base = getCompanyDailyBaseGoal(company, date);
  return base * getAdjustmentFactor(company.segmento, date);
}

export function getTotalAdjustedDailyGoal(companies: CompanyMetaInfo[], date: Date): number {
  if (companies.length === 0) return 0;
  const normalized = normalizeDate(date);
  return companies.reduce((sum, company) => sum + getCompanyAdjustedDailyGoal(company, normalized), 0);
}

export function getTotalBaseDailyGoal(companies: CompanyMetaInfo[], date: Date): number {
  if (companies.length === 0) return 0;
  const normalized = normalizeDate(date);
  return companies.reduce((sum, company) => sum + getCompanyDailyBaseGoal(company, normalized), 0);
}

export function getTotalMonthlyGoal(companies: CompanyMetaInfo[], month: number): number {
  if (companies.length === 0) return 0;
  return companies.reduce((sum, company) => sum + (company.metas[month] || 0), 0);
}

export function getTotalYearlyGoal(companies: CompanyMetaInfo[]): number {
  if (companies.length === 0) return 0;
  return companies.reduce((sum, company) => {
    const yearly = Object.values(company.metas).reduce((acc, value) => acc + value, 0);
    return sum + yearly;
  }, 0);
}

export function sumAdjustedDailyGoalsForRange(
  companies: CompanyMetaInfo[],
  start: Date,
  end: Date
): number {
  if (companies.length === 0) return 0;
  const startDate = normalizeDate(start);
  const endDate = normalizeDate(end);
  if (startDate > endDate) return 0;

  let total = 0;
  let current = startDate;
  while (current <= endDate) {
    total += getTotalAdjustedDailyGoal(companies, current);
    current = addDays(current, 1);
  }
  return total;
}

export function buildDailyGoalMap(companies: CompanyMetaInfo[], dates: Date[]): Map<string, number> {
  const map = new Map<string, number>();
  dates.forEach((date) => {
    const normalized = normalizeDate(date);
    const key = normalized.toISOString().split('T')[0];
    map.set(key, getTotalAdjustedDailyGoal(companies, normalized));
  });
  return map;
}

export function getCompanyAdjustedDailyGoalForDate(
  companies: CompanyMetaInfo[],
  empresa: string,
  date: Date
): number {
  const company = companies.find((c) => c.empresa === empresa);
  if (!company) return 0;
  return getCompanyAdjustedDailyGoal(company, date);
}
