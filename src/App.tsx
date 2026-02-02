import { useState } from 'react';
import { useSupabaseFaturamento } from './hooks/useSupabaseFaturamento';
import { useFilters } from './hooks/useFilters';
import { useGoals } from './hooks/useGoals';
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
import { RotateCcw, Settings2 } from 'lucide-react';
import logo from './assets/logo.svg';
import styles from './App.module.css';

function App() {
  // All data comes from Supabase
  const { data, upsertEntry } = useSupabaseFaturamento();

  const [currentView, setCurrentView] = useState<ViewType>('geral');
  const [showGoalEditor, setShowGoalEditor] = useState(false);

  const { goals, yearlyGoals, totalGoal, totalYearGoal, updateYearlyGoals, getCompanyGoal, getGroupGoal } = useGoals();

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
  } = useFilters(data, { goals, totalGoal, totalYearGoal, getCompanyGoal, getGroupGoal });

  const hasEntityFilter =
    filters.empresas.length > 0 ||
    filters.grupos.length > 0 ||
    filters.segmentos.length > 0;

  // Calculate daily goal for chart reference line
  const dailyGoal = goalMetrics.diasNoMes > 0
    ? goalMetrics.metaMensal / goalMetrics.diasNoMes
    : 0;

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
              label="Empresa"
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
              meta={goalMetrics.metaMensal}
              metaProporcional={goalMetrics.metaProporcional}
              diaAtual={goalMetrics.diaAtual}
              datePreset={datePreset}
              metaSemana={goalMetrics.metaSemana}
              realizadoSemana={goalMetrics.realizadoSemana}
              diasNaSemana={goalMetrics.diasNaSemana}
              metaDia={goalMetrics.metaDia}
              realizadoDia={goalMetrics.realizadoDia}
              metaAno={goalMetrics.metaAno}
              realizadoAno={goalMetrics.realizadoAno}
              mesAtual={goalMetrics.mesAtual}
            />
          </section>

          <section className={styles.chartRow}>
            <div className={styles.mainChart}>
              <RevenueChart
                data={dailyData}
                companies={chartCompanies}
                dailyGoal={dailyGoal}
                comparisonData={comparisonDailyData}
                comparisonLabel={comparisonLabel}
              />
            </div>
            <div className={styles.sideChart}>
              <SharePieChart
                title="Por Segmento"
                data={segmentPieData}
                showLegend
              />
            </div>
          </section>

          <section className={styles.fullWidthChart}>
            <GroupStackedBars
              data={dailyData}
              groups={allGroupsInData}
              title="Contribuição por Grupo"
              dailyGoal={dailyGoal}
              comparisonData={comparisonDailyData}
              comparisonLabel={comparisonLabel}
            />
          </section>

          <section className={styles.grid}>
            <div className={styles.gridItem}>
              <BreakdownBars
                title="Por Empresa"
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
              label="Empresa"
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
            totalRealizado={goalMetrics.realizado}
            totalMeta={goalMetrics.metaMensal}
            metaProporcional={goalMetrics.metaProporcional}
            diaAtual={goalMetrics.diaAtual}
            diasNoMes={goalMetrics.diasNoMes}
            filters={filters}
            datePreset={datePreset}
            dailyData={dailyData}
            realizadoHoje={goalMetrics.realizadoDia}
            metaHoje={goalMetrics.metaDia}
            realizadoSemana={goalMetrics.realizadoSemana}
            metaSemana={goalMetrics.metaSemana}
            diasNaSemana={7}
            diaAtualSemana={goalMetrics.diasNaSemana}
            realizadoAno={goalMetrics.realizadoAno}
            metaAno={goalMetrics.metaAno}
          />
        </>
      )}

      {currentView === 'entrada' && (
        <section className={styles.dataEntry}>
          <DataEntry
            data={data}
            goals={yearlyGoals}
            onSave={upsertEntry}
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
