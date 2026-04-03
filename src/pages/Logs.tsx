/**
 * src/pages/Logs.tsx
 * ==================
 * Debug Logs page - displays real-time logs from main process.
 * Only visible when ENV=DEV.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import type { LogEntry, LogLevel } from '../types/electron';

// ============================================================================
// CONSTANTS
// ============================================================================

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  debug: 'text-cyan-400',
  info: 'text-green-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

const LOG_LEVEL_BG: Record<LogLevel, string> = {
  debug: 'bg-cyan-500/10',
  info: 'bg-green-500/10',
  warn: 'bg-yellow-500/10',
  error: 'bg-red-500/10',
};

// ============================================================================
// LOG ENTRY COMPONENT
// ============================================================================

interface LogEntryRowProps {
  entry: LogEntry;
}

function LogEntryRow({ entry }: LogEntryRowProps) {
  const [expanded, setExpanded] = useState(false);
  const timestamp = entry.timestamp.slice(11, 23); // HH:MM:SS.mmm
  
  return (
    <div 
      className={`font-mono text-xs border-b border-border/50 ${LOG_LEVEL_BG[entry.level]} hover:bg-surface-light cursor-pointer`}
      onClick={() => entry.data && setExpanded(!expanded)}
    >
      <div className="flex items-start gap-2 px-3 py-1.5">
        {/* Timestamp */}
        <span className="text-text-muted shrink-0 w-24">{timestamp}</span>
        
        {/* Level */}
        <span className={`shrink-0 w-14 uppercase font-semibold ${LOG_LEVEL_COLORS[entry.level]}`}>
          {entry.level}
        </span>
        
        {/* Scope */}
        <span className="shrink-0 w-24 text-text-secondary font-medium">
          [{entry.scope}]
        </span>
        
        {/* Message */}
        <span className="text-text-primary flex-1 break-all">
          {entry.message}
          {entry.data && (
            <span className="text-text-muted ml-2">
              {expanded ? '▼' : '▶'} data
            </span>
          )}
        </span>
      </div>
      
      {/* Expanded data */}
      {expanded && entry.data && (
        <div className="px-3 py-2 bg-app/50 border-t border-border/30">
          <pre className="text-text-secondary text-xs whitespace-pre-wrap overflow-auto max-h-48">
            {(() => {
              try {
                return JSON.stringify(JSON.parse(entry.data), null, 2);
              } catch {
                return entry.data;
              }
            })()}
          </pre>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// FILTER CONTROLS
// ============================================================================

interface FilterControlsProps {
  levelFilter: LogLevel | 'all';
  setLevelFilter: (level: LogLevel | 'all') => void;
  scopeFilter: string;
  setScopeFilter: (scope: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  autoScroll: boolean;
  setAutoScroll: (auto: boolean) => void;
  onClear: () => void;
}

function FilterControls({
  levelFilter,
  setLevelFilter,
  scopeFilter,
  setScopeFilter,
  searchQuery,
  setSearchQuery,
  autoScroll,
  setAutoScroll,
  onClear,
}: FilterControlsProps) {
  return (
    <div className="flex items-center gap-4 p-3 bg-surface border-b border-border">
      {/* Level filter */}
      <div className="flex items-center gap-2">
        <label className="text-text-secondary text-sm">Level:</label>
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as LogLevel | 'all')}
          className="bg-surface-light border border-border rounded px-2 py-1 text-text-primary text-sm"
        >
          <option value="all">All</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
      </div>
      
      {/* Scope filter */}
      <div className="flex items-center gap-2">
        <label className="text-text-secondary text-sm">Scope:</label>
        <input
          type="text"
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value.toUpperCase())}
          placeholder="AUTH, API..."
          className="bg-surface-light border border-border rounded px-2 py-1 text-text-primary text-sm w-24"
        />
      </div>
      
      {/* Search */}
      <div className="flex items-center gap-2 flex-1">
        <label className="text-text-secondary text-sm">Search:</label>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter messages..."
          className="bg-surface-light border border-border rounded px-2 py-1 text-text-primary text-sm flex-1 max-w-xs"
        />
      </div>
      
      {/* Auto-scroll toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={autoScroll}
          onChange={(e) => setAutoScroll(e.target.checked)}
          className="rounded"
        />
        <span className="text-text-secondary text-sm">Auto-scroll</span>
      </label>
      
      {/* Clear button */}
      <button
        onClick={onClear}
        className="px-3 py-1 bg-danger/20 text-danger hover:bg-danger/30 rounded text-sm transition-colors"
      >
        Clear
      </button>
    </div>
  );
}

// ============================================================================
// STATS BAR
// ============================================================================

interface StatsBarProps {
  total: number;
  filtered: number;
  counts: Record<LogLevel, number>;
}

function StatsBar({ total, filtered, counts }: StatsBarProps) {
  return (
    <div className="flex items-center gap-4 px-3 py-2 bg-surface/50 border-b border-border text-xs">
      <span className="text-text-secondary">
        Showing <span className="text-text-primary font-medium">{filtered}</span> of {total}
      </span>
      <span className="text-text-muted">|</span>
      <span className={`${LOG_LEVEL_COLORS.debug}`}>Debug: {counts.debug}</span>
      <span className={`${LOG_LEVEL_COLORS.info}`}>Info: {counts.info}</span>
      <span className={`${LOG_LEVEL_COLORS.warn}`}>Warn: {counts.warn}</span>
      <span className={`${LOG_LEVEL_COLORS.error}`}>Error: {counts.error}</span>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
  const [scopeFilter, setScopeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  
  // Load initial logs
  useEffect(() => {
    const loadLogs = async () => {
      try {
        const buffer = await window.electronAPI.logs.getBuffer();
        setLogs(buffer);
      } catch (e) {
        console.error('Failed to load logs:', e);
      }
    };
    loadLogs();
  }, []);
  
  // Subscribe to new logs
  useEffect(() => {
    const unsubscribe = window.electronAPI.logs.onEntry((entry) => {
      setLogs((prev) => [...prev, entry]);
    });
    
    return unsubscribe;
  }, []);
  
  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);
  
  // Clear logs
  const handleClear = useCallback(async () => {
    try {
      await window.electronAPI.logs.clear();
      setLogs([]);
    } catch (e) {
      console.error('Failed to clear logs:', e);
    }
  }, []);
  
  // Filter logs
  const filteredLogs = logs.filter((log) => {
    // Level filter
    if (levelFilter !== 'all' && log.level !== levelFilter) {
      return false;
    }
    
    // Scope filter
    if (scopeFilter && !log.scope.includes(scopeFilter)) {
      return false;
    }
    
    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesMessage = log.message.toLowerCase().includes(query);
      const matchesData = log.data?.toLowerCase().includes(query);
      if (!matchesMessage && !matchesData) {
        return false;
      }
    }
    
    return true;
  });
  
  // Count logs by level
  const counts: Record<LogLevel, number> = {
    debug: logs.filter((l) => l.level === 'debug').length,
    info: logs.filter((l) => l.level === 'info').length,
    warn: logs.filter((l) => l.level === 'warn').length,
    error: logs.filter((l) => l.level === 'error').length,
  };
  
  return (
    <div className="h-full flex flex-col bg-app">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h1 className="text-xl font-bold text-text-primary">Debug Logs</h1>
        <p className="text-sm text-text-secondary mt-1">
          Real-time logs from main process. Only visible in DEV mode.
        </p>
      </div>
      
      {/* Filters */}
      <FilterControls
        levelFilter={levelFilter}
        setLevelFilter={setLevelFilter}
        scopeFilter={scopeFilter}
        setScopeFilter={setScopeFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        autoScroll={autoScroll}
        setAutoScroll={setAutoScroll}
        onClear={handleClear}
      />
      
      {/* Stats */}
      <StatsBar total={logs.length} filtered={filteredLogs.length} counts={counts} />
      
      {/* Logs container */}
      <div 
        ref={logsContainerRef}
        className="flex-1 overflow-auto bg-app"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted">
            {logs.length === 0 
              ? 'No logs yet. Logs will appear here in real-time.'
              : 'No logs match the current filters.'
            }
          </div>
        ) : (
          filteredLogs.map((entry) => (
            <LogEntryRow key={entry.id} entry={entry} />
          ))
        )}
      </div>
    </div>
  );
}
