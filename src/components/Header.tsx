import React from 'react';
import { LoanType } from '../types';
import { Smartphone, Moon, Sun, Search, Plus, Calendar, Clock } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface Props {
  mode: LoanType;
  setMode: (mode: LoanType) => void;
  countDaily: number;
  countWeekly: number;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onOpenNewClient: () => void;
  onOpenInstallGuide: () => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
}

export const Header: React.FC<Props> = ({
  mode,
  setMode,
  countDaily,
  countWeekly,
  searchQuery,
  setSearchQuery,
  onOpenNewClient,
  onOpenInstallGuide,
  darkMode,
  setDarkMode,
}) => {
  const { isInstallable, install } = usePWAInstall();

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm safe-top">
      {/* Top Main Bar */}
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* Brand & Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 flex items-center justify-center text-amber-400 font-black text-xl shadow-md border border-amber-400/30">
            Q
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-blue-900 dark:text-blue-100 flex items-center gap-1">
              Tu <span className="text-amber-500 font-extrabold">Crédito</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 ml-1">
                MÓVIL
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-none">
              Cobranza en Ruta · Guatemala
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Quick Install Button for Android */}
          {isInstallable ? (
            <button
              onClick={install}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition animate-pulse"
              title="Instalar en Android"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Instalar</span>
            </button>
          ) : (
            <button
              onClick={onOpenInstallGuide}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 text-xs font-semibold transition"
              title="Guía para Android"
            >
              <Smartphone className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Guía Android</span>
            </button>
          )}

          {/* Theme Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Cambiar tema"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* New Client Button */}
          <button
            onClick={onOpenNewClient}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white text-xs font-bold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden xs:inline">Nuevo Cliente</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher & Search (Android Segmented Tabs) */}
      <div className="max-w-4xl mx-auto px-4 pb-3 flex flex-col sm:flex-row gap-2">
        {/* Loan Type Segmented Buttons */}
        <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setMode('d')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              mode === 'd'
                ? 'bg-blue-700 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Cobros Diarios ({countDaily})</span>
          </button>
          <button
            onClick={() => setMode('s')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              mode === 's'
                ? 'bg-blue-700 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Cobros Semanales ({countWeekly})</span>
          </button>
        </div>

        {/* Quick Search Field */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, DPI o lugar..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
