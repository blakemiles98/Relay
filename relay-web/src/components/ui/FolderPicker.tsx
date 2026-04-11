'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { filesystem } from '@/lib/api';
import type { BrowseResult } from '@/lib/api';
import { Spinner } from './Spinner';

interface FolderPickerProps {
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function FolderPicker({ onSelect, onClose }: FolderPickerProps) {
  const [result, setResult] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // The editable text input mirrors the current path
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const browse = useCallback(async (path?: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await filesystem.browse(path);
      setResult(data);
      setInputValue(data.path);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load folder');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load on open — shows drives on Windows, / on Linux
  useEffect(() => { browse(); }, [browse]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleDirClick(fullPath: string) {
    browse(fullPath);
  }

  function handleUp() {
    if (result?.parent != null) browse(result.parent);
  }

  function handleInputGo() {
    if (inputValue.trim()) browse(inputValue.trim());
  }

  function handleSelect() {
    const path = result?.path;
    if (path) onSelect(path);
  }

  // Display name for a full path entry (last segment, or the whole thing for drives)
  function displayName(fullPath: string): string {
    // Windows drive like "C:" — show as "C:\"
    if (/^[A-Za-z]:$/.test(fullPath)) return fullPath + '\\';
    const parts = fullPath.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts[parts.length - 1] ?? fullPath;
  }

  const atRoot = !result?.path;
  const canGoUp = result?.parent != null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '75vh' }}>

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2e2e2e] shrink-0">
          <button
            onClick={canGoUp ? handleUp : onClose}
            className="p-1 text-slate-400 hover:text-white transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-white flex-1">Select folder</span>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Path input */}
        <div className="px-4 py-2.5 border-b border-[#2e2e2e] shrink-0">
          <div className="flex items-center bg-[#242424] border border-[#2e2e2e] rounded-lg overflow-hidden focus-within:border-indigo-500">
            <svg className="w-4 h-4 ml-3 text-slate-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInputGo()}
              placeholder={atRoot ? 'Type a path or select below…' : ''}
              className="flex-1 bg-transparent px-2 py-2 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none"
            />
            {inputValue && (
              <button
                onClick={handleInputGo}
                className="px-3 text-slate-400 hover:text-white transition text-xs font-medium"
              >
                Go
              </button>
            )}
          </div>
        </div>

        {/* Directory list */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Spinner size="md" />
            </div>
          )}

          {!loading && error && (
            <div className="px-4 py-8 text-center">
              <p className="text-red-400 text-sm mb-3">{error}</p>
              <button
                onClick={() => browse()}
                className="text-xs text-indigo-400 hover:underline"
              >
                Back to root
              </button>
            </div>
          )}

          {!loading && !error && result && (
            <ul className="py-1">
              {result.directories.length === 0 && (
                <li className="px-4 py-8 text-center text-slate-500 text-sm">
                  No subfolders here
                </li>
              )}

              {result.directories.map((fullPath) => (
                <li key={fullPath}>
                  <button
                    onClick={() => handleDirClick(fullPath)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 active:bg-white/10 transition text-left group"
                  >
                    <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                    </svg>
                    <span className="flex-1 text-sm text-white truncate">
                      {displayName(fullPath)}
                    </span>
                    <svg className="w-4 h-4 text-slate-600 group-hover:text-slate-400 shrink-0 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#2e2e2e] flex items-center gap-3 shrink-0">
          <p className="flex-1 text-xs text-slate-500 font-mono truncate">
            {result?.path || 'No folder selected'}
          </p>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-300 hover:text-white border border-[#2e2e2e] rounded-lg hover:bg-white/5 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            disabled={!result?.path}
            className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 rounded-lg transition"
          >
            Select
          </button>
        </div>
      </div>
    </div>
  );
}
