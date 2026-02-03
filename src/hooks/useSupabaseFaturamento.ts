import { useState, useEffect, useCallback } from 'react';
import { supabase, type FaturamentoRow } from '../lib/supabase';
import type { FaturamentoRecord } from '../types';
import { COMPANIES } from '../data/fallbackData';

interface UseSupabaseOptions {
  includeZero?: boolean;
}

export function useSupabaseFaturamento(options: UseSupabaseOptions = {}) {
  const includeZero = options.includeZero ?? false;
  const [data, setData] = useState<FaturamentoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all data from Supabase
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: rows, error: fetchError } = await supabase
        .from('faturamento')
        .select('*')
        .order('data', { ascending: false });

      if (fetchError) throw fetchError;

      // Convert to FaturamentoRecord format
      const records: FaturamentoRecord[] = (rows || [])
        .filter((row: FaturamentoRow) => {
          const value = Number(row.valor);
          return Number.isFinite(value) && value >= 0;
        })
        .map((row: FaturamentoRow) => {
          const companyInfo = COMPANIES.find(c => c.empresa === row.empresa);
          return {
            empresa: row.empresa,
            grupo: companyInfo?.grupo || 'OUTROS',
            segmento: companyInfo?.segmento || 'OUTROS',
            data: new Date(row.data + 'T12:00:00'),
            faturamento: Number(row.valor),
          };
        });

      setData(records);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [includeZero]);

  // Delete an entry
  const deleteEntry = useCallback(async (empresa: string, date: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('faturamento')
        .delete()
        .eq('empresa', empresa)
        .eq('data', date);

      if (deleteError) throw deleteError;

      // Update local state
      setData(prev => prev.filter(
        r => !(r.empresa === empresa && r.data.toISOString().split('T')[0] === date)
      ));

      return { success: true };
    } catch (err) {
      console.error('Error deleting entry:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Erro ao deletar' };
    }
  }, []);

  // Upsert a single entry
  const upsertEntry = useCallback(async (empresa: string, date: string, valor: number) => {
    try {
      const { error: upsertError } = await supabase
        .from('faturamento')
        .upsert(
          { empresa, data: date, valor },
          { onConflict: 'empresa,data' }
        );

      if (upsertError) throw upsertError;

      // Update local state
      setData(prev => {
        const companyInfo = COMPANIES.find(c => c.empresa === empresa);
        const newRecord: FaturamentoRecord = {
          empresa,
          grupo: companyInfo?.grupo || 'OUTROS',
          segmento: companyInfo?.segmento || 'OUTROS',
          data: new Date(date + 'T12:00:00'),
          faturamento: valor,
        };

        // Remove existing record for same empresa/date if exists
        const filtered = prev.filter(
          r => !(r.empresa === empresa && r.data.toISOString().split('T')[0] === date)
        );

        // Add new record when allowed
        if (valor >= 0) {
          return [...filtered, newRecord];
        }
        return filtered;
      });

      return { success: true };
    } catch (err) {
      console.error('Error upserting entry:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Erro ao salvar' };
    }
  }, [deleteEntry, includeZero]);

  // Get value for specific empresa/date
  const getValue = useCallback((empresa: string, date: string): number | null => {
    const record = data.find(
      r => r.empresa === empresa && r.data.toISOString().split('T')[0] === date
    );
    return record?.faturamento ?? null;
  }, [data]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel('faturamento_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'faturamento' },
        () => {
          // Refetch on any change
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refresh: fetchData,
    upsertEntry,
    deleteEntry,
    getValue,
  };
}
