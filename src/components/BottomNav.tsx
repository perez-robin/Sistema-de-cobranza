import React from 'react';
import { Home, Users, DollarSign, FileText, Settings, FolderOpen } from 'lucide-react';

export type NavTab = 'cobranza' | 'clientes' | 'cierre' | 'reportes' | 'documentos' | 'ajustes';

interface Props {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  pendingCount?: number;
}

export const BottomNav: React.FC<Props> = ({ activeTab, onChangeTab, pendingCount = 0 }) => {
  const tabs = [
    { id: 'cobranza' as NavTab, label: 'Cobranza', icon: Home, badge: pendingCount > 0 ? pendingCount : null },
    { id: 'clientes' as NavTab, label: 'Clientes', icon: Users },
    { id: 'cierre' as NavTab, label: 'Cierre', icon: DollarSign },
    { id: 'reportes' as NavTab, label: 'Reportes', icon: FileText },
    { id: 'documentos' as NavTab, label: 'Documentos', icon: FolderOpen },
    { id: 'ajustes' as NavTab, label: 'Ajustes', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe shadow-lg">
      <div className="max-w-md mx-auto grid grid-cols-6 h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if ('vibrate' in navigator) {
                  try {
                    navigator.vibrate(10);
                  } catch {
                    // Ignore if vibrate not supported
                  }
                }
                onChangeTab(tab.id);
              }}
              className={`flex flex-col items-center justify-center relative transition-all active:scale-95 ${
                isActive
                  ? 'text-blue-700 dark:text-blue-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 font-medium hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.5]' : ''}`} />
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-[10px] text-white font-bold flex items-center justify-center shadow-sm">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1 tracking-tight leading-none">{tab.label}</span>
              {isActive && (
                <span className="absolute top-0 w-8 h-1 rounded-b-full bg-blue-700 dark:bg-blue-500" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
