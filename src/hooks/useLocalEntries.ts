import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FaturamentoRecord } from '../types';
import { COMPANIES } from '../data/fallbackData';

const STORAGE_KEY = 'faturamento-entries';

interface StoredEntries {
  [key: string]: number; // "empresa:YYYY-MM-DD" -> value
}

export function useLocalEntries(baseData: FaturamentoRecord[]): {
  mergedData: FaturamentoRecord[];
  refreshLocalData: () => void;
} {
  const [localEntries, setLocalEntries] = useState<StoredEntries>(() => {
    // Initialize from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error loading local entries:', e);
    }
    return {};
  });

  // Load from localStorage
  const loadFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setLocalEntries(stored ? JSON.parse(stored) : {});
    } catch (e) {
      console.error('Error loading local entries:', e);
    }
  }, []);

  // Listen for storage changes (from other tabs or DataEntry component)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        loadFromStorage();
      }
    };

    // Also listen for custom event from same tab
    const handleLocalUpdate = () => {
      loadFromStorage();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('localEntriesUpdated', handleLocalUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localEntriesUpdated', handleLocalUpdate);
    };
  }, [loadFromStorage]);

  // Merge local entries with base data using useMemo for reactivity
  const mergedData = useMemo(() => {
    // Create a map of existing records by empresa:date
    const recordMap = new Map<string, FaturamentoRecord>();

    // Add base records first
    baseData.forEach(record => {
      const dateKey = record.data.toISOString().split('T')[0];
      const key = `${record.empresa}:${dateKey}`;
      recordMap.set(key, record);
    });

    // Update or add records from localStorage
    Object.entries(localEntries).forEach(([key, value]) => {
      const [empresa, dateStr] = key.split(':');
      if (!empresa || !dateStr) return;

      const existingRecord = recordMap.get(key);

      if (existingRecord) {
        // Update existing record
        recordMap.set(key, {
          ...existingRecord,
          faturamento: value,
        });
      } else {
        // Find metadata from COMPANIES list
        const companyInfo = COMPANIES.find(c => c.empresa === empresa);

        if (companyInfo) {
          // Create new record
          recordMap.set(key, {
            empresa,
            grupo: companyInfo.grupo,
            segmento: companyInfo.segmento,
            data: new Date(dateStr + 'T12:00:00'), // Use noon to avoid timezone shift to previous day
            faturamento: value,
          });
        }
      }
    });

    return Array.from(recordMap.values());
  }, [baseData, localEntries]);

  return {
    mergedData,
    refreshLocalData: loadFromStorage,
  };
}
