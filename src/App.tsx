import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSupabaseFaturamento } from './hooks/useSupabaseFaturamento';
import { useFilters } from './hooks/useFilters';
import { useGoals } from './hooks/useGoals';
import { useRevenueLines } from './hooks/useRevenueLines';
import { formatBRL, formatPercent } from './utils/dataParser';
import { ViewToggle, type ViewType } from './components/ViewToggle';
import { MultiSelect } from './components/MultiSelect';
import { DatePicker } from './components/DatePicker';
import { DatePresets } from './components/DatePresets';
import { KPICard } from './components/KPICard';
import { GoalsDashboard } from './components/GoalsDashboard';
import { GoalSummary } from './components/GoalSummary';
import { GoalEditor } from './components/GoalEditor';
import { RevenueChart } from './components/RevenueChart';
import { GroupStackedBars } from './components/GroupStackedBars';
import { ComparisonToggle } from './components/ComparisonToggle';
import { DataEntry } from './components/DataEntry';
import { BreakdownBars } from './components/BreakdownBars';
import { SharePieChart } from './components/SharePieChart';
import { RevenueLinesManager } from './components/RevenueLinesManager';
import { RotateCcw, Settings2 } from 'lucide-react';
import logo from './assets/logo.svg';
import styles from './App.module.css';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('geral');
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [pieMode, setPieMode] = useState<'segmento' | 'grupo' | 'empresa'>('segmento');
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  const { yearlyGoals, updateYearlyGoals, setSelectedMonth } = useGoals();
  const { lines, addLine, updateLine, removeLine } = useRevenueLines(yearlyGoals);

  // All data comes from Supabase
  const { data, upsertEntry, deleteEntry } = useSupabaseFaturamento({ includeZero: true, lines });

  const {
    filters,
    options,
    kpis,
    goalMetrics,
    companyGoalData,
    dailyData,
    comparisonDailyData,
    comparisonLabel,
    comparisonEnabled,
    customComparisonStart,
    customComparisonEnd,
    getGoalForDate,
    chartCompanies,
    allGroupsInData,
    groupBreakdown,
    segmentBreakdown,
    empresaBreakdown,
    segmentPieData,
    datePreset,
    updateFilter,
    toggleFilterValue,
    setDatePreset,
    clearFilters,
    hasActiveFilters,
    toggleComparison,
    setCustomComparisonRange,
    clearCustomComparison,
  } = useFilters(data, { yearlyGoals, setSelectedMonth, lines });

  const hasEntityFilter =
    filters.empresas.length > 0 ||
    filters.grupos.length > 0 ||
    filters.segmentos.length > 0;

  // Aggregate all data by date for historical projections
  const allHistoricalDailyData = useMemo(() => {
    const filtered = data.filter((record) => {
      if (filters.empresas.length > 0 && !filters.empresas.includes(record.empresa)) return false;
      if (filters.grupos.length > 0 && !filters.grupos.includes(record.grupo)) return false;
      if (filters.segmentos.length > 0 && !filters.segmentos.includes(record.segmento)) return false;
      return true;
    });

    const byDate = new Map<string, { date: Date; total: number }>();
    filtered.forEach((record) => {
      const key = record.data.toISOString().split('T')[0];
      const existing = byDate.get(key);
      if (existing) {
        existing.total += record.faturamento;
      } else {
        byDate.set(key, { date: record.data, total: record.faturamento });
      }
    });
    return Array.from(byDate.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [data, filters.empresas, filters.grupos, filters.segmentos]);

  // Raw data with empresa/grupo for seasonality calculations
  const rawDataForSeasonality = useMemo(() => {
    return data.map(record => ({
      date: record.data,
      value: record.faturamento,
      empresa: record.empresa,
      grupo: record.grupo,
    }));
  }, [data]);

  const groupPieData = useMemo(() => {
    return groupBreakdown.map((item) => ({
      name: item.grupo,
      value: item.total,
    }));
  }, [groupBreakdown]);

  const empresaPieData = useMemo(() => {
    const limit = 6;
    const top = empresaBreakdown.slice(0, limit);
    const rest = empresaBreakdown.slice(limit);
    const restTotal = rest.reduce((sum, item) => sum + item.total, 0);
    const base = top.map((item) => ({ name: item.empresa, value: item.total }));
    if (restTotal > 0) {
      base.push({ name: 'Outros', value: restTotal });
    }
    return base;
  }, [empresaBreakdown]);

  const pieConfig = useMemo(() => {
    switch (pieMode) {
      case 'grupo':
        return { title: 'Por Grupo', data: groupPieData };
      case 'empresa':
        return { title: 'Por Linha', data: empresaPieData };
      case 'segmento':
      default:
        return { title: 'Por Segmento', data: segmentPieData };
    }
  }, [pieMode, groupPieData, empresaPieData, segmentPieData]);

  const handleAddLine = useCallback((line: { empresa: string; grupo: string; segmento: string }) => {
    addLine(line);
    const metas: Record<number, number> = {};
    for (let m = 1; m <= 12; m += 1) {
      metas[m] = 0;
    }
    if (!yearlyGoals.some((g) => g.empresa === line.empresa)) {
      updateYearlyGoals([
        ...yearlyGoals,
        {
          empresa: line.empresa,
          grupo: line.grupo,
          metas,
        },
      ]);
    }
  }, [addLine, updateYearlyGoals, yearlyGoals]);

  const handleUpdateLine = useCallback((empresa: string, updates: { grupo?: string; segmento?: string }) => {
    updateLine(empresa, updates);
    if (updates.grupo) {
      updateYearlyGoals(yearlyGoals.map((g) =>
        g.empresa === empresa ? { ...g, grupo: updates.grupo! } : g
      ));
    }
  }, [updateLine, updateYearlyGoals, yearlyGoals]);

  const handleRemoveLine = useCallback((empresa: string) => {
    removeLine(empresa);
    updateYearlyGoals(yearlyGoals.filter((g) => g.empresa !== empresa));
  }, [removeLine, updateYearlyGoals, yearlyGoals]);

  const handleSaveEntry = useCallback(async (empresa: string, date: string, valor: number | null) => {
    if (valor === null) {
      return deleteEntry(empresa, date);
    }
    return upsertEntry(empresa, date, valor);
  }, [deleteEntry, upsertEntry]);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    const onInstalled = () => setInstallPromptEvent(null);
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone;
    setShowIosHint(isIos && !isStandalone);
  }, []);

  const handleInstallClick = async () => {
    if (!installPromptEvent) return;
    await installPromptEvent.prompt();
    await installPromptEvent.userChoice;
    setInstallPromptEvent(null);
  };

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <img src={logo} alt="Lever Money" className={styles.logo} />
        </div>
        <div className={styles.headerRight}>
          {currentView === 'metas' && (
            <button
              type="button"
              className={styles.editMetasButton}
              onClick={() => setShowGoalEditor(true)}
            >
              <Settings2 size={16} />
              Editar Metas
            </button>
          )}
          {installPromptEvent && (
            <button
              type="button"
              className={styles.installButton}
              onClick={handleInstallClick}
            >
              Instalar
            </button>
          )}
          {showIosHint && !installPromptEvent && (
            <span className={styles.installHint}>No iOS: Compartilhar → Adicionar à Tela</span>
          )}
          <ViewToggle value={currentView} onChange={setCurrentView} />
        </div>
      </header>

      {currentView === 'geral' && (
        <>
          <section className={styles.filters}>
            <MultiSelect
              label="Grupo"
              values={filters.grupos}
              options={options.grupos}
              onChange={(v) => toggleFilterValue('grupos', v)}
              onClear={() => updateFilter('grupos', [])}
            />
            <MultiSelect
              label="Segmento"
              values={filters.segmentos}
              options={options.segmentos}
              onChange={(v) => toggleFilterValue('segmentos', v)}
              onClear={() => updateFilter('segmentos', [])}
            />
            <MultiSelect
              label="Linha"
              values={filters.empresas}
              options={options.empresas}
              onChange={(v) => toggleFilterValue('empresas', v)}
              onClear={() => updateFilter('empresas', [])}
            />
            <div className={styles.filtersDivider} />
            <DatePresets value={datePreset} onChange={setDatePreset} />
            <DatePicker
              label="De"
              value={filters.dataInicio}
              onChange={(v) => updateFilter('dataInicio', v)}
              min={options.minDate}
              max={filters.dataFim || options.maxDate}
            />
            <DatePicker
              label="Até"
              value={filters.dataFim}
              onChange={(v) => updateFilter('dataFim', v)}
              min={filters.dataInicio || options.minDate}
              max={options.maxDate}
            />
            <div className={styles.filtersDivider} />
            <ComparisonToggle
              enabled={comparisonEnabled}
              onToggle={toggleComparison}
              customStart={customComparisonStart}
              customEnd={customComparisonEnd}
              onCustomRangeChange={setCustomComparisonRange}
              onClearCustom={clearCustomComparison}
              comparisonLabel={comparisonLabel}
              minDate={options.minDate}
              maxDate={options.maxDate}
            />
            <button
              type="button"
              className={styles.clearButton}
              onClick={clearFilters}
              title="Limpar filtros"
              disabled={!hasActiveFilters}
            >
              <RotateCcw size={14} />
            </button>
          </section>

          <section className={styles.kpiRow}>
            <div className={styles.kpiCards}>
              <KPICard
                label="Faturamento"
                value={formatBRL(kpis.faturamentoFiltrado)}
              />
              <div className={styles.kpiDivider} />
              <KPICard
                label="% do Total"
                value={formatPercent(hasEntityFilter ? kpis.percentualDoTotal : 100)}
                sublabel={hasEntityFilter ? `de ${formatBRL(kpis.faturamentoTotal)}` : undefined}
              />
            </div>
            <GoalSummary
              realizado={goalMetrics.realizado}
              realizadoMes={goalMetrics.realizadoMes}
              meta={goalMetrics.metaMensal}
              metaProporcional={goalMetrics.metaProporcional}
              diaAtual={goalMetrics.diaAtual}
              datePreset={datePreset}
              metaSemana={goalMetrics.metaSemana}
              realizadoSemana={goalMetrics.realizadoSemana}
              diasNaSemana={goalMetrics.diasNaSemana}
              esperadoSemanal={goalMetrics.esperadoSemanal}
              metaDia={goalMetrics.metaDia}
              metaDiaAjustada={goalMetrics.metaDiaAjustada}
              realizadoDia={goalMetrics.realizadoDia}
              metaAno={goalMetrics.metaAno}
              realizadoAno={goalMetrics.realizadoAno}
              mesAtual={goalMetrics.mesAtual}
              isArCondicionado={goalMetrics.isArCondicionado}
            />
          </section>

          <section className={styles.chartRow}>
            <div className={styles.mainChart}>
              <RevenueChart
                data={dailyData}
                companies={chartCompanies}
                comparisonData={comparisonDailyData}
                comparisonLabel={comparisonLabel}
              />
            </div>
            <div className={styles.sideChart}>
              <div className={styles.pieSwitcher}>
                <div className={styles.pieTabs}>
                  <button
                    type="button"
                    className={`${styles.pieTab} ${pieMode === 'segmento' ? styles.pieTabActive : ''}`}
                    onClick={() => setPieMode('segmento')}
                  >
                    Segmento
                  </button>
                  <button
                    type="button"
                    className={`${styles.pieTab} ${pieMode === 'grupo' ? styles.pieTabActive : ''}`}
                    onClick={() => setPieMode('grupo')}
                  >
                    Grupo
                  </button>
                  <button
                    type="button"
                    className={`${styles.pieTab} ${pieMode === 'empresa' ? styles.pieTabActive : ''}`}
                    onClick={() => setPieMode('empresa')}
                  >
                    Linha
                  </button>
                </div>
                <SharePieChart
                  title={pieConfig.title}
                  data={pieConfig.data}
                  showLegend
                />
              </div>
            </div>
          </section>

          <section className={styles.fullWidthChart}>
            <GroupStackedBars
              data={dailyData}
              groups={allGroupsInData}
              title="Contribuição por Grupo"
              comparisonData={comparisonDailyData}
              comparisonLabel={comparisonLabel}
            />
          </section>

          <section className={styles.grid}>
            <div className={styles.gridItem}>
              <BreakdownBars
                title="Por Linha"
                data={empresaBreakdown.map((e) => ({ label: e.empresa, value: e.total }))}
                limit={8}
              />
            </div>
            <div className={styles.gridItem}>
              <BreakdownBars
                title="Por Grupo"
                data={groupBreakdown.map((g) => ({ label: g.grupo, value: g.total }))}
              />
            </div>
            <div className={styles.gridItem}>
              <BreakdownBars
                title="Por Segmento"
                data={segmentBreakdown.map((s) => ({ label: s.segmento, value: s.total }))}
              />
            </div>
          </section>
        </>
      )}

      {currentView === 'metas' && (
        <>
          <section className={styles.filters}>
            <MultiSelect
              label="Grupo"
              values={filters.grupos}
              options={options.grupos}
              onChange={(v) => toggleFilterValue('grupos', v)}
              onClear={() => updateFilter('grupos', [])}
            />
            <MultiSelect
              label="Segmento"
              values={filters.segmentos}
              options={options.segmentos}
              onChange={(v) => toggleFilterValue('segmentos', v)}
              onClear={() => updateFilter('segmentos', [])}
            />
            <MultiSelect
              label="Linha"
              values={filters.empresas}
              options={options.empresas}
              onChange={(v) => toggleFilterValue('empresas', v)}
              onClear={() => updateFilter('empresas', [])}
            />
            <div className={styles.filtersDivider} />
            <DatePresets value={datePreset} onChange={setDatePreset} />
            <button
              type="button"
              className={styles.clearButton}
              onClick={clearFilters}
              title="Limpar filtros"
              disabled={!hasActiveFilters}
            >
              <RotateCcw size={14} />
            </button>
          </section>

          <GoalsDashboard
            data={companyGoalData}
            totalRealizado={goalMetrics.realizadoMes}
            totalMeta={goalMetrics.metaMensal}
            metaProporcional={goalMetrics.metaProporcional}
            diaAtual={goalMetrics.diaAtual}
            diasNoMes={goalMetrics.diasNoMes}
            coverage={goalMetrics.coverage}
            filters={filters}
            datePreset={datePreset}
            dailyData={dailyData}
            allHistoricalData={allHistoricalDailyData}
            rawDataForSeasonality={rawDataForSeasonality}
            getGoalForDate={getGoalForDate}
            realizadoHoje={goalMetrics.realizadoDia}
            metaHoje={goalMetrics.metaDiaAjustada}
            realizadoSemana={goalMetrics.realizadoSemana}
            metaSemana={goalMetrics.metaSemana}
            esperadoSemanal={goalMetrics.esperadoSemanal}
            realizadoAno={goalMetrics.realizadoAno}
            metaAno={goalMetrics.metaAno}
            metasMensais={goalMetrics.metasMensais}
            mesAtual={goalMetrics.mesAtual}
          />
        </>
      )}

      {currentView === 'entrada' && (
        <section className={styles.dataEntry}>
          <DataEntry
            data={data}
            goals={yearlyGoals}
            lines={lines}
            onSave={handleSaveEntry}
          />
        </section>
      )}

      {currentView === 'linhas' && (
        <section className={styles.dataEntry}>
          <RevenueLinesManager
            lines={lines}
            onAdd={handleAddLine}
            onUpdate={handleUpdateLine}
            onRemove={handleRemoveLine}
          />
        </section>
      )}

      {showGoalEditor && (
        <GoalEditor
          yearlyGoals={yearlyGoals}
          onSave={updateYearlyGoals}
          onClose={() => setShowGoalEditor(false)}
        />
      )}
    </div>
  );
}

export default App;
