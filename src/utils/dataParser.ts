import type { FaturamentoRecord } from '../types';
import { parse } from 'date-fns';

/**
 * Parse Brazilian currency format to number
 * "R$ 20.715,00" -> 20715.00
 */
export function parseBRLCurrency(value: string): number {
  if (!value) return 0;

  // Remove "R$", spaces, and handle Brazilian number format
  const cleaned = value
    .replace('R$', '')
    .replace(/\s/g, '')
    .replace(/\./g, '') // Remove thousand separators
    .replace(',', '.'); // Convert decimal separator

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse date in DD/MM/YYYY format
 */
export function parseBRDate(dateStr: string): Date {
  return parse(dateStr.trim(), 'dd/MM/yyyy', new Date());
}

/**
 * Parse CSV data into FaturamentoRecord array
 */
export function parseCSVData(csvText: string): FaturamentoRecord[] {
  const lines = csvText.trim().split('\n');

  // Skip header row
  const dataLines = lines.slice(1);

  return dataLines
    .map((line) => {
      // Handle quoted CSV fields (faturamento has commas)
      const matches = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);

      if (!matches || matches.length < 5) return null;

      const [dataStr, empresa, grupo, segmento, faturamentoStr] = matches.map(
        (field) => field.replace(/^"|"$/g, '').trim()
      );

      return {
        data: parseBRDate(dataStr),
        empresa,
        grupo,
        segmento,
        faturamento: parseBRLCurrency(faturamentoStr),
      };
    })
    .filter((record): record is FaturamentoRecord => record !== null);
}

/**
 * Format number as Brazilian currency
 */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format percentage
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

/**
 * Format date for input
 */
export function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
