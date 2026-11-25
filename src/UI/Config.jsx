import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'tetromino_default_settings_v1';

export const DEFAULT_CONTROLS = {
  moveLeft: 'arrowleft',
  moveRight: 'arrowright',
  rotateCW: 'arrowup',
  rotateCCW: 'z',
  softDrop: 'arrowdown',
  hardDrop: ' ',
  hold: 'c',
  reset: 'r',
  pause: 'p',
};

export const DEFAULT_SETTINGS = {
  username: 'Jugador',
  controls: { ...DEFAULT_CONTROLS },
  das: 167,
  arr: 33,
  softDrop: 30,
  nextCount: 1,
  appearance: 'default', // 'default' (piezas blancas), 'neon' (con iluminacion)
  neonEnabled: false,
  skipLineClearAnimation: false,
};

const CONTROL_LABELS = [
  { key: 'moveLeft', label: 'Mover izquierda' },
  { key: 'moveRight', label: 'Mover derecha' },
  { key: 'rotateCW', label: 'Rotar horario (CW)' },
  { key: 'rotateCCW', label: 'Rotar antihorario (CCW)' },
  { key: 'softDrop', label: 'Soft Drop' },
  { key: 'hardDrop', label: 'Hard Drop' },
  { key: 'hold', label: 'Hold' },
  { key: 'reset', label: 'Reiniciar' },
  { key: 'pause', label: 'Pausa' },
];

const VALID_APPEARANCES = ['default', 'neon'];

export function formatKeyLabel(key) {
  if (!key) return 'Sin asignar';
  if (key === ' ') return 'SPACE';
  if (key === 'arrowleft') return '←';
  if (key === 'arrowright') return '→';
  if (key === 'arrowup') return '↑';
  if (key === 'arrowdown') return '↓';
  return key.toUpperCase();
}

function normalizeAppearance(raw) {
  if (VALID_APPEARANCES.includes(raw?.appearance)) {
    return raw.appearance;
  }
  if (raw?.appearance === 'normal') {
    return 'standard';
  }
  return Boolean(raw?.neonEnabled) ? 'neon' : 'default';
}

function normalizeImportedSettings(raw, fallbackUsername) {
  const safeControls = {
    ...DEFAULT_CONTROLS,
    ...(typeof raw?.controls === 'object' && raw.controls !== null ? raw.controls : {}),
  };

  Object.keys(safeControls).forEach((k) => {
    if (typeof safeControls[k] === 'string') {
      safeControls[k] = safeControls[k].toLowerCase();
    } else {
      safeControls[k] = DEFAULT_CONTROLS[k];
    }
  });

  const clampNum = (val, min, max, fallback) => {
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  };

  const appearance = normalizeAppearance(raw);
  const neonEnabled = appearance === 'neon';
  const skipLineClearAnimation =
    typeof raw?.skipLineClearAnimation === 'boolean'
      ? raw.skipLineClearAnimation
      : DEFAULT_SETTINGS.skipLineClearAnimation;

  return {
    username:
      typeof raw?.username === 'string' && raw.username.trim()
        ? raw.username.trim()
        : fallbackUsername || DEFAULT_SETTINGS.username,
    controls: safeControls,
    das: clampNum(raw?.das, 0, 167, DEFAULT_SETTINGS.das),
    arr: clampNum(raw?.arr, 0, 33, DEFAULT_SETTINGS.arr),
    softDrop: clampNum(raw?.softDrop, 0, 30, DEFAULT_SETTINGS.softDrop),
    nextCount: clampNum(raw?.nextCount, 1, 5, DEFAULT_SETTINGS.nextCount),
    appearance,
    neonEnabled,
    skipLineClearAnimation,
  };
}

const listeners = new Set();

export function subscribeSettings(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSettingsSnapshot() {
  return { ...DEFAULT_SETTINGS, controls: { ...DEFAULT_CONTROLS } };
}

function notifySettingsListeners() {
  const snapshot = getSettingsSnapshot();
  listeners.forEach((fn) => fn(snapshot));
}

// Actualiza DEFAULT_CONTROLS y DEFAULT_SETTINGS en memoria (y persiste en localStorage)
export function syncDefaultSettings(nextSettings, { persist = true } = {}) {
  const normalized = normalizeImportedSettings(nextSettings, DEFAULT_SETTINGS.username);

  Object.assign(DEFAULT_CONTROLS, normalized.controls);

  DEFAULT_SETTINGS.username = normalized.username;
  DEFAULT_SETTINGS.das = normalized.das;
  DEFAULT_SETTINGS.arr = normalized.arr;
  DEFAULT_SETTINGS.softDrop = normalized.softDrop;
  DEFAULT_SETTINGS.nextCount = normalized.nextCount;
  DEFAULT_SETTINGS.appearance = normalized.appearance;
  DEFAULT_SETTINGS.neonEnabled = normalized.neonEnabled;
  DEFAULT_SETTINGS.skipLineClearAnimation = normalized.skipLineClearAnimation;
  DEFAULT_SETTINGS.controls = { ...DEFAULT_CONTROLS };

  if (persist && typeof window !== 'undefined') {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...DEFAULT_SETTINGS,
          controls: { ...DEFAULT_CONTROLS },
        })
      );
    } catch {
      // Ignora errores de cuota o almacenamiento privado
    }
  }

  const snapshot = {
    ...DEFAULT_SETTINGS,
    controls: { ...DEFAULT_CONTROLS },
  };

  // Notifica al instante a todos los componentes/loops suscritos
  notifySettingsListeners();

  return snapshot;
}

// Hidrata DEFAULT_CONTROLS y DEFAULT_SETTINGS al cargar el módulo si había datos guardados
if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      syncDefaultSettings(JSON.parse(saved), { persist: false });
    }
  } catch {
    // Ignora JSON corrupto en localStorage
  }
}

export function useGameSettings() {
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_SETTINGS,
    controls: { ...DEFAULT_CONTROLS },
  }));

  useEffect(() => {
    return subscribeSettings((next) => {
      setSettings(next);
    });
  }, []);

  return settings;
}

export default function Config({
  settings = DEFAULT_SETTINGS,
  initialUsername,
  onChange,
  onSave,
  onClose,
}) {
  const resolvedDefaultUsername =
    initialUsername?.trim() ||
    settings?.username?.trim() ||
    DEFAULT_SETTINGS.username;

  const [draft, setDraft] = useState(() =>
    normalizeImportedSettings(
      { ...DEFAULT_SETTINGS, ...settings, username: resolvedDefaultUsername },
      resolvedDefaultUsername
    )
  );
  const [listeningAction, setListeningAction] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    setDraft(
      normalizeImportedSettings(
        { ...DEFAULT_SETTINGS, ...settings, username: resolvedDefaultUsername },
        resolvedDefaultUsername
      )
    );
  }, [settings, resolvedDefaultUsername]);

  useEffect(() => {
    if (!listeningAction) return;

    const handleCaptureKey = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setListeningAction(null);
        setStatusMessage('Reasignación cancelada.');
        return;
      }

      const nextKey = e.key.toLowerCase();
      setDraft((prev) => ({
        ...prev,
        controls: {
          ...prev.controls,
          [listeningAction]: nextKey,
        },
      }));
      setListeningAction(null);
      setStatusMessage(`Tecla "${formatKeyLabel(nextKey)}" asignada.`);
    };

    window.addEventListener('keydown', handleCaptureKey, { capture: true });
    return () => window.removeEventListener('keydown', handleCaptureKey, { capture: true });
  }, [listeningAction]);

  const updateField = (patch) => {
    setDraft((prev) => {
      const updated = { ...prev, ...patch };
      onChange?.(updated);
      return updated;
    });
  };

  const handleSaveClick = async () => {
    const cleaned = normalizeImportedSettings(draft, resolvedDefaultUsername);
    const updatedDefaults = syncDefaultSettings(cleaned, { persist: true });
    setDraft(updatedDefaults);
    onChange?.(updatedDefaults);
    if (onSave) {
      await onSave(updatedDefaults);
    }
    setStatusMessage('Configuración actualizada.');
  };

  return (
    <section className="settings-panel" aria-label="Panel de configuración">
      <div className="settings-panel__header">
        <h2 className="settings-panel__title">Configuración</h2>
        {onClose && (
          <button type="button" className="settings-panel__btn" onClick={onClose}>
            Cerrar
          </button>
        )}
      </div>

      {/* Superior y centrado: Nombre de usuario */}
      <div className="settings-panel__group">
        <label htmlFor="cfg-username" className="settings-panel__label">
          Nombre de usuario
        </label>
        <input
          id="cfg-username"
          type="text"
          className="settings-panel__input"
          value={draft.username}
          onChange={(e) => updateField({ username: e.target.value })}
          placeholder="Tu nombre de usuario"
        />
      </div>

      {/* Fila con wrap y apartados en columnas */}
      <div className="settings-panel__body">
        <div className="settings-panel__column">
          <div className="settings-panel__section-title">Controles</div>
          <div className="settings-panel__controls-grid">
            {CONTROL_LABELS.map(({ key, label }) => {
              const isListening = listeningAction === key;
              return (
                <React.Fragment key={key}>
                  <span className="settings-panel__control-name">{label}</span>
                  <button
                    type="button"
                    className={`settings-panel__key-btn ${
                      isListening ? 'settings-panel__key-btn--listening' : ''
                    }`}
                    onClick={() => {
                      setListeningAction(key);
                      setStatusMessage(`Presiona una tecla para "${label}" (ESC para cancelar)...`);
                    }}
                  >
                    {isListening ? 'Presiona tecla...' : formatKeyLabel(draft.controls[key])}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="settings-panel__column">
          <div className="settings-panel__section-title">Handling</div>
          <div className="settings-panel__sliders">
            <div>
              <div className="settings-panel__slider-header">
                <label htmlFor="cfg-das" className="settings-panel__label">
                  DAS (Delayed Auto Shift)
                </label>
                <strong className="settings-panel__slider-value">{draft.das} ms</strong>
              </div>
              <input
                id="cfg-das"
                type="range"
                className="settings-panel__slider"
                min={0}
                max={167}
                step={1}
                value={draft.das}
                onChange={(e) => updateField({ das: Number(e.target.value) })}
              />
            </div>

            <div>
              <div className="settings-panel__slider-header">
                <label htmlFor="cfg-arr" className="settings-panel__label">
                  ARR (Auto Repeat Rate)
                </label>
                <strong className="settings-panel__slider-value">{draft.arr} ms</strong>
              </div>
              <input
                id="cfg-arr"
                type="range"
                className="settings-panel__slider"
                min={0}
                max={33}
                step={1}
                value={draft.arr}
                onChange={(e) => updateField({ arr: Number(e.target.value) })}
              />
            </div>

            <div>
              <div className="settings-panel__slider-header">
                <label htmlFor="cfg-softdrop" className="settings-panel__label">
                  SDF (Soft Drop Factor)
                </label>
                <strong className="settings-panel__slider-value">{draft.softDrop} ms</strong>
              </div>
              <input
                id="cfg-softdrop"
                type="range"
                className="settings-panel__slider"
                min={0}
                max={30}
                step={1}
                value={draft.softDrop}
                onChange={(e) => updateField({ softDrop: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="settings-panel__section-title">Aspecto</div>
          <div className="settings-panel__aspect-controls">
            <div className="settings-panel__field-inline">
              <label htmlFor="cfg-next-count" className="settings-panel__label">
                Próximas piezas (1 - 5)
              </label>
              <input
                id="cfg-next-count"
                type="number"
                min={1}
                max={5}
                step={1}
                className="settings-panel__number-input"
                value={draft.nextCount}
                onChange={(e) => {
                  const rawVal = Number(e.target.value);
                  if (!Number.isFinite(rawVal)) return;
                  const clamped = Math.min(5, Math.max(1, Math.round(rawVal)));
                  updateField({ nextCount: clamped });
                }}
              />
            </div>

            <div className="settings-panel__field-inline">
              <label htmlFor="cfg-appearance" className="settings-panel__label">
                Apariencia
              </label>
              <select
                id="cfg-appearance"
                className="settings-panel__select"
                value={draft.appearance}
                onChange={(e) => {
                  const nextAppearance = VALID_APPEARANCES.includes(e.target.value)
                    ? e.target.value
                    : 'default';
                  updateField({
                    appearance: nextAppearance,
                    neonEnabled: nextAppearance === 'neon',
                  });
                }}
              >
                <option value="default">Por defecto</option>
                <option value="neon">Neón</option>
              </select>
            </div>

            <div className="settings-panel__field-inline">
              <label htmlFor="cfg-skip-line-clear" className="settings-panel__label">
                Omitir animación de borrado de líneas
              </label>
              <input
                id="cfg-skip-line-clear"
                type="checkbox"
                checked={Boolean(draft.skipLineClearAnimation)}
                onChange={(e) =>
                  updateField({ skipLineClearAnimation: e.target.checked })
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* Botones fuera del wrap de columnas */}
      <div className="settings-panel__actions">
        <button
          type="button"
          className="settings-panel__btn settings-panel__btn--primary"
          onClick={handleSaveClick}
        >
          Guardar
        </button>
      </div>

      {statusMessage && <p className="settings-panel__status">{statusMessage}</p>}
    </section>
  );
}