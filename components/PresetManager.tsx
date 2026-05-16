/**
 * PresetManager — Save & load named parameter presets for the Create panel.
 * Stored in localStorage under the key "ace-presets".
 */

import React, { useState, useEffect, useRef } from 'react';
import { BookMarked, Save, Trash2, ChevronDown, X, Check, Plus } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PresetData {
  // Style
  style?: string;
  musicTags?: string[];
  // Lyrics
  lyrics?: string;
  // Vocal
  instrumental?: boolean;
  vocalLanguage?: string;
  vocalGender?: string;
  // Music params
  duration?: number;
  bpm?: number;
  keyScale?: string;
  timeSignature?: string;
  // Generation
  inferenceSteps?: number;
  guidanceScale?: number;
  shift?: number;
  inferMethod?: string;
  batchSize?: number;
  // LM params
  lmTemperature?: number;
  lmCfgScale?: number;
  lmTopP?: number;
  lmTopK?: number;
  lmNegativePrompt?: string;
  // LoRA
  loraPath?: string;
  loraEnabled?: boolean;
  loraScale?: number;
  // Task
  taskType?: string;
}

export interface Preset {
  id: string;
  name: string;
  createdAt: number;
  data: PresetData;
}

const STORAGE_KEY = 'ace-presets';

function loadPresets(): Preset[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function savePresets(presets: Preset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch { /* quota */ }
}

// ─── Field groups for the save modal ─────────────────────────────────────────

interface FieldGroup {
  key: keyof typeof GROUP_FIELDS;
  label: string;
  fields: (keyof PresetData)[];
}

const GROUP_FIELDS = {
  style:      ['style', 'musicTags'] as (keyof PresetData)[],
  lyrics:     ['lyrics'] as (keyof PresetData)[],
  vocal:      ['instrumental', 'vocalLanguage', 'vocalGender'] as (keyof PresetData)[],
  music:      ['duration', 'bpm', 'keyScale', 'timeSignature'] as (keyof PresetData)[],
  generation: ['inferenceSteps', 'guidanceScale', 'shift', 'inferMethod', 'batchSize'] as (keyof PresetData)[],
  lm:         ['lmTemperature', 'lmCfgScale', 'lmTopP', 'lmTopK', 'lmNegativePrompt'] as (keyof PresetData)[],
  lora:       ['loraPath', 'loraEnabled', 'loraScale'] as (keyof PresetData)[],
  task:       ['taskType'] as (keyof PresetData)[],
};

const GROUPS: FieldGroup[] = [
  { key: 'style',      label: 'Style & Tags',      fields: GROUP_FIELDS.style },
  { key: 'lyrics',     label: 'Lyrics',             fields: GROUP_FIELDS.lyrics },
  { key: 'vocal',      label: 'Vocal settings',     fields: GROUP_FIELDS.vocal },
  { key: 'music',      label: 'Music params',        fields: GROUP_FIELDS.music },
  { key: 'generation', label: 'Generation params',   fields: GROUP_FIELDS.generation },
  { key: 'lm',         label: 'LM params',           fields: GROUP_FIELDS.lm },
  { key: 'lora',       label: 'LoRA',                fields: GROUP_FIELDS.lora },
  { key: 'task',       label: 'Task type',           fields: GROUP_FIELDS.task },
];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PresetManagerProps {
  /** Current values from CreatePanel — used when saving */
  currentValues: PresetData;
  /** Called when user loads a preset — apply only the fields that were saved */
  onLoad: (data: PresetData) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PresetManager: React.FC<PresetManagerProps> = ({ currentValues, onLoad }) => {
  const [presets, setPresets] = useState<Preset[]>(() => loadPresets());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [overwriteId, setOverwriteId] = useState<string>(''); // '' = create new
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(
    new Set(['style', 'lyrics', 'vocal', 'music', 'generation', 'lm', 'lora', 'task'])
  );
  const [savedFlash, setSavedFlash] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleGroup = (key: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleSave = () => {
    const data: PresetData = {};
    for (const group of GROUPS) {
      if (!selectedGroups.has(group.key)) continue;
      for (const field of group.fields) {
        const val = currentValues[field];
        if (val !== undefined) {
          (data as Record<string, unknown>)[field] = val;
        }
      }
    }

    let updated: Preset[];
    if (overwriteId) {
      // Overwrite existing preset — keep its id and createdAt, update name+data
      updated = presets.map(p =>
        p.id === overwriteId
          ? { ...p, name: presetName.trim() || p.name, data }
          : p
      );
    } else {
      const name = presetName.trim() || `Preset ${new Date().toLocaleString()}`;
      const preset: Preset = { id: Date.now().toString(), name, createdAt: Date.now(), data };
      updated = [preset, ...presets];
    }

    setPresets(updated);
    savePresets(updated);
    setModalOpen(false);
    setPresetName('');
    setOverwriteId('');
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const handleLoad = (preset: Preset) => {
    onLoad(preset.data);
    setDropdownOpen(false);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    savePresets(updated);
  };

  return (
    <>
      {/* ── Bar ── */}
      <div className="flex items-center gap-2">
        {/* Load dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
          >
            <BookMarked size={13} />
            <span>Presets</span>
            <ChevronDown size={12} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden">
              {presets.length === 0 ? (
                <div className="px-4 py-5 text-center text-xs text-zinc-400">
                  No presets saved yet.<br />Click <strong>Save preset</strong> to create one.
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                  {presets.map(preset => (
                    <div
                      key={preset.id}
                      onClick={() => handleLoad(preset)}
                      className="group flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{preset.name}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          {new Date(preset.createdAt).toLocaleDateString()} · {Object.keys(preset.data).length} fields
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDelete(preset.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-400 hover:text-red-500 transition-all ml-2"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Save button */}
        <button
          onClick={() => setModalOpen(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            savedFlash
              ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'
              : 'border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
          }`}
        >
          {savedFlash ? <Check size={13} /> : <Save size={13} />}
          <span>{savedFlash ? 'Saved!' : 'Save preset'}</span>
        </button>
      </div>

      {/* ── Save Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 w-full max-w-sm p-6 space-y-5">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Save size={16} className="text-purple-500" />
                <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Save preset</h2>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X size={18} />
              </button>
            </div>

            {/* Overwrite or new */}
            {presets.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Save as</label>
                <select
                  value={overwriteId}
                  onChange={e => {
                    setOverwriteId(e.target.value);
                    if (e.target.value) {
                      const found = presets.find(p => p.id === e.target.value);
                      if (found) setPresetName(found.name);
                    } else {
                      setPresetName('');
                    }
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">✦ New preset</option>
                  {presets.map(p => (
                    <option key={p.id} value={p.id}>Overwrite: {p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Name input */}
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                {overwriteId ? 'New name (optional)' : 'Preset name'}
              </label>
              <input
                autoFocus
                type="text"
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder={overwriteId ? 'Leave blank to keep current name' : 'e.g. Dark EDM 120bpm'}
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Group selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">What to include</label>
                <button
                  onClick={() => setSelectedGroups(
                    selectedGroups.size === GROUPS.length
                      ? new Set()
                      : new Set(GROUPS.map(g => g.key))
                  )}
                  className="text-[10px] text-purple-500 hover:text-purple-400 font-medium"
                >
                  {selectedGroups.size === GROUPS.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {GROUPS.map(group => (
                  <label
                    key={group.key}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-xs font-medium select-none ${
                      selectedGroups.has(group.key)
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                        : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={selectedGroups.has(group.key)}
                      onChange={() => toggleGroup(group.key)}
                    />
                    <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${
                      selectedGroups.has(group.key)
                        ? 'bg-purple-500 border-purple-500'
                        : 'border-zinc-300 dark:border-zinc-600'
                    }`}>
                      {selectedGroups.has(group.key) && <Check size={9} className="text-white" />}
                    </div>
                    {group.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={selectedGroups.size === 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                <Plus size={14} />
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
