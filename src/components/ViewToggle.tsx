import styles from './ViewToggle.module.css';

export type ViewType = 'geral' | 'metas' | 'entrada';

interface ViewToggleProps {
  value: ViewType;
  onChange: (view: ViewType) => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className={styles.container}>
      <button
        className={`${styles.button} ${value === 'geral' ? styles.active : ''}`}
        onClick={() => onChange('geral')}
      >
        Visão Geral
      </button>
      <button
        className={`${styles.button} ${value === 'metas' ? styles.active : ''}`}
        onClick={() => onChange('metas')}
      >
        Metas
      </button>
      <button
        className={`${styles.button} ${value === 'entrada' ? styles.active : ''}`}
        onClick={() => onChange('entrada')}
      >
        Entrada
      </button>
    </div>
  );
}
