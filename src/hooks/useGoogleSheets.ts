import { useState, useEffect, useCallback, useRef } from 'react';
import type { FaturamentoRecord } from '../types';
import { parseCSVData } from '../utils/dataParser';

// Google Sheets public CSV export URL format
// Replace SPREADSHEET_ID with your actual spreadsheet ID
// The sheet must be published to the web (File > Share > Publish to web)
const GOOGLE_SHEETS_URL = import.meta.env.VITE_GOOGLE_SHEETS_URL || '';

// Polling interval in milliseconds (5 minutes)
const POLL_INTERVAL = 5 * 60 * 1000;

interface UseGoogleSheetsResult {
  data: FaturamentoRecord[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
  isConnected: boolean;
}

export function useGoogleSheets(fallbackData: FaturamentoRecord[]): UseGoogleSheetsResult {
  // If no Google Sheets URL, start with loading=false and use fallback immediately
  const hasGoogleSheets = Boolean(GOOGLE_SHEETS_URL);

  const [data, setData] = useState<FaturamentoRecord[]>(fallbackData);
  const [loading, setLoading] = useState(hasGoogleSheets);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const fallbackRef = useRef(fallbackData);
  fallbackRef.current = fallbackData;

  const fetchData = useCallback(async () => {
    if (!GOOGLE_SHEETS_URL) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(GOOGLE_SHEETS_URL);

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }

      const csvText = await response.text();
      const parsedData = parseCSVData(csvText);

      setData(parsedData);
      setLastUpdated(new Date());
      setIsConnected(true);
      setError(null);
    } catch (err) {
      console.error('Error fetching Google Sheets data:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
      setIsConnected(false);

      // Fall back to local data if available
      setData(fallbackRef.current);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch only if Google Sheets is configured
  useEffect(() => {
    if (hasGoogleSheets) {
      fetchData();
    }
  }, [fetchData, hasGoogleSheets]);

  // Polling for updates
  useEffect(() => {
    if (!GOOGLE_SHEETS_URL) return;

    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refresh: fetchData,
    isConnected,
  };
}
