import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import styles from './ConnectionStatus.module.css';

interface ConnectionStatusProps {
  isConnected: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
  loading: boolean;
}

export function ConnectionStatus({
  isConnected,
  lastUpdated,
  onRefresh,
  loading,
}: ConnectionStatusProps) {
  return (
    <div className={styles.container}>
      {isConnected ? (
        <>
          <Cloud size={14} className={styles.iconConnected} />
          <span className={styles.text}>
            Google Sheets
            {lastUpdated && (
              <span className={styles.time}>
                {' '}
                · {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </span>
        </>
      ) : (
        <>
          <CloudOff size={14} className={styles.iconDisconnected} />
          <span className={styles.text}>Dados locais</span>
        </>
      )}
      <button
        type="button"
        className={styles.refresh}
        onClick={onRefresh}
        disabled={loading}
        title="Atualizar dados"
      >
        <RefreshCw size={14} className={loading ? styles.spinning : ''} />
      </button>
    </div>
  );
}
