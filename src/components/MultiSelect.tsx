import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';
import styles from './MultiSelect.module.css';

interface MultiSelectProps {
  label: string;
  values: string[];
  options: string[];
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
  native?: boolean;
}

export function MultiSelect({
  label,
  values,
  options,
  onChange,
  onClear,
  placeholder = 'Todos',
  native = false,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const displayText = values.length === 0
    ? placeholder
    : values.length === 1
      ? values[0]
      : `${values.length} selecionados`;

  if (native) {
    return (
      <div className={styles.container}>
        <span className={styles.label}>{label}</span>
        <div className={styles.nativeRow}>
          <select
            className={styles.nativeSelect}
            multiple
            value={values.length > 0 ? values : ['__ALL__']}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions).map((opt) => opt.value);
              if (selected.includes('__ALL__') || selected.length === 0) {
                onClear();
                return;
              }

              const nextSet = new Set(selected);
              const currentSet = new Set(values);
              values.forEach((value) => {
                if (!nextSet.has(value)) onChange(value);
              });
              selected.forEach((value) => {
                if (!currentSet.has(value)) onChange(value);
              });
            }}
          >
            <option value="__ALL__">{placeholder}</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {values.length > 0 && (
            <button
              type="button"
              className={styles.nativeClear}
              onClick={onClear}
            >
              Limpar
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} ref={ref}>
      <span className={styles.label}>{label}</span>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className={values.length > 0 ? styles.value : styles.placeholder}>
          {displayText}
        </span>
        {values.length > 0 ? (
          <X
            size={14}
            className={styles.clear}
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          />
        ) : (
          <ChevronDown size={14} className={styles.chevron} />
        )}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <input
            ref={inputRef}
            type="text"
            className={styles.search}
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className={styles.options}>
            {filteredOptions.length === 0 ? (
              <div className={styles.empty}>Nenhum resultado</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = values.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    className={`${styles.option} ${isSelected ? styles.selected : ''}`}
                    onClick={() => onChange(opt)}
                  >
                    <span className={styles.checkbox}>
                      {isSelected && <Check size={12} />}
                    </span>
                    {opt}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
