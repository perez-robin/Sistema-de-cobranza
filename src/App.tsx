import React, { useState, useEffect } from 'react';
import { CashClosing, Client, LoanType } from './types';
import { getDemoClients } from './utils/demoData';
import {
  calculateLoan,
  currentTimeStr,
  formatQ,
  getSemaphore,
  isoToday,
} from './utils/calculations';
import { Header } from './components/Header';
import { BottomNav, NavTab } from './components/BottomNav';
import { OfflineBanner } from './components/OfflineBanner';
import { RouteView } from './components/RouteView';
import { ClientDetailView } from './components/ClientDetailView';
import { CashClosingView } from './components/CashClosingView';
import { DailyReportView } from './components/DailyReportView';
import { SettingsView } from './components/SettingsView';
import { NewClientModal } from './components/NewClientModal';
import { InstallGuideModal } from './components/InstallGuideModal';
import { generateReceiptPdf } from './utils/pdfReceipt';
import { Plus, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'tucredito_cobros_v1';

export default function App() {
  const [clients, setClients] = useState<Client[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    // Default to rich demo data on first launch
    return getDemoClients();
  });

  const [collectorName, setCollectorName] = useState<string>(() => {
    try {
      return localStorage.getItem(`${STORAGE_KEY}_cob`) || 'Ruta Central';
    } catch {
      return 'Ruta Central';
    }
  });

  const [closings, setClosings] = useState<CashClosing[]>(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}_cierres`);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [];
  });

  const [mode, setMode] = useState<LoanType>('d');
  const [activeTab, setActiveTab] = useState<NavTab>('ruta');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('tucredito_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  // Sync dark class on html
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('tucredito_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('tucredito_theme', 'light');
    }
  }, [darkMode]);

  // Persist clients, collector, and closings
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
      localStorage.setItem(`${STORAGE_KEY}_cob`, collectorName);
      localStorage.setItem(`${STORAGE_KEY}_cierres`, JSON.stringify(closings));
    } catch (e) {
      console.error('Error persisting state:', e);
    }
  }, [clients, collectorName, closings]);

  // Toast auto-hide
  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3600);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Client counts
  const countDaily = clients.filter((c) => c.tipo === 'd').length;
  const countWeekly = clients.filter((c) => c.tipo === 's').length;

  // Pending count for today
  const pendingForMode = clients.filter((c) => {
    if (c.tipo !== mode || c.cerrado) return false;
    const sem = getSemaphore(c);
    return sem.cls === 'c' || sem.cls === 'a' || sem.cls === 'r';
  }).length;

  // Handlers
  const handleCreateClient = (newClient: Client) => {
    setClients((prev) => [newClient, ...prev]);
    setSelectedClientId(newClient.id);
    showToast(`Cliente ${newClient.nombre} creado exitosamente.`);
  };

  const handleUpdateClient = (updated: Client) => {
    setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleDeleteClient = (clientId: string) => {
    setClients((prev) => prev.filter((c) => c.id !== clientId));
    setSelectedClientId(null);
    showToast('Cliente eliminado del registro.');
  };

  // Express One-Touch Payment in Route
  const handleCobrarExpress = (client: Client) => {
    const sem = getSemaphore(client);
    if (sem.i < 0) return;

    const newRows = [...client.rows];
    newRows[sem.i] = {
      ...newRows[sem.i],
      f: isoToday(),
      h: currentTimeStr(),
      m: client.cuota,
      firma: collectorName || 'Cobranzas',
    };

    handleUpdateClient({ ...client, rows: newRows });
    showToast(`✓ Cobrado ${formatQ(client.cuota)} a ${client.nombre || 'cliente'}.`);
  };

  // Undo express payment
  const handleUndoExpress = (client: Client) => {
    const hoy = isoToday();
    const newRows = [...client.rows];
    let foundIdx = -1;

    for (let i = newRows.length - 1; i >= 0; i--) {
      if (newRows[i].f === hoy && Number(newRows[i].m) > 0) {
        foundIdx = i;
        break;
      }
    }

    if (foundIdx >= 0) {
      newRows[foundIdx] = {
        ...newRows[foundIdx],
        f: '',
        h: '',
        m: '',
        firma: '',
        mp: false,
      };
      handleUpdateClient({ ...client, rows: newRows });
      showToast('Cobro de hoy anulado exitosamente.');
    }
  };

  const handleGenerateReceipt = (client: Client) => {
    const ok = generateReceiptPdf(client, collectorName);
    if (ok) {
      showToast('Descargando comprobante de pago en PDF...');
    } else {
      showToast('Este cliente aún no registra pagos el día de hoy.');
    }
  };

  const handleSaveClosing = (closing: CashClosing) => {
    setClosings((prev) => [closing, ...prev.slice(0, 59)]);
  };

  const handleSeedDemo = () => {
    const demo = getDemoClients();
    setClients(demo);
    showToast('Datos de ejemplo restaurados.');
  };

  const handleClearAll = () => {
    setClients([]);
    setClosings([]);
    setSelectedClientId(null);
    showToast('Base de datos reiniciada.');
  };

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white pb-20">
      {/* Top Header */}
      <Header
        mode={mode}
        setMode={(m) => {
          setMode(m);
          setSelectedClientId(null);
        }}
        countDaily={countDaily}
        countWeekly={countWeekly}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenNewClient={() => setIsNewClientModalOpen(true)}
        onOpenInstallGuide={() => setIsInstallGuideOpen(true)}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      {/* Offline Status Warning */}
      <OfflineBanner />

      {/* Main Content Area */}
      <main className="flex-1">
        {selectedClient ? (
          <ClientDetailView
            client={selectedClient}
            clientsList={clients.filter((c) => c.tipo === mode)}
            collectorName={collectorName}
            setCollectorName={setCollectorName}
            onUpdateClient={handleUpdateClient}
            onDeleteClient={handleDeleteClient}
            onBack={() => setSelectedClientId(null)}
            onNavigateClient={(id) => setSelectedClientId(id)}
            onToast={showToast}
          />
        ) : (
          <>
            {activeTab === 'ruta' && (
              <RouteView
                clients={clients}
                mode={mode}
                collectorName={collectorName}
                onOpenClient={(id) => setSelectedClientId(id)}
                onCobrarExpress={handleCobrarExpress}
                onUndoExpress={handleUndoExpress}
                onGenerateReceipt={handleGenerateReceipt}
                searchQuery={searchQuery}
              />
            )}

            {activeTab === 'clientes' && (
              <RouteView
                clients={clients}
                mode={mode}
                collectorName={collectorName}
                onOpenClient={(id) => setSelectedClientId(id)}
                onCobrarExpress={handleCobrarExpress}
                onUndoExpress={handleUndoExpress}
                onGenerateReceipt={handleGenerateReceipt}
                searchQuery={searchQuery}
              />
            )}

            {activeTab === 'cierre' && (
              <CashClosingView
                clients={clients}
                mode={mode}
                collectorName={collectorName}
                closings={closings}
                onSaveClosing={handleSaveClosing}
                onToast={showToast}
              />
            )}

            {activeTab === 'reportes' && (
              <DailyReportView
                clients={clients}
                mode={mode}
                collectorName={collectorName}
                onToast={showToast}
              />
            )}

            {activeTab === 'ajustes' && (
              <SettingsView
                collectorName={collectorName}
                setCollectorName={setCollectorName}
                clients={clients}
                closings={closings}
                onRestore={(newClients, newClosings, newCol) => {
                  setClients(newClients);
                  setClosings(newClosings);
                  if (newCol) setCollectorName(newCol);
                }}
                onSeedDemo={handleSeedDemo}
                onClearAll={handleClearAll}
                onOpenInstallGuide={() => setIsInstallGuideOpen(true)}
                onToast={showToast}
              />
            )}
          </>
        )}
      </main>

      {/* Floating Action Button (FAB) for New Loan on Mobile */}
      {!selectedClientId && (
        <button
          onClick={() => setIsNewClientModalOpen(true)}
          className="fixed right-5 bottom-20 z-30 w-14 h-14 rounded-2xl bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white shadow-xl shadow-blue-900/30 flex items-center justify-center transition-transform active:scale-90"
          aria-label="Nuevo préstamo"
        >
          <Plus className="w-7 h-7 stroke-[2.5]" />
        </button>
      )}

      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={(tab) => {
          setActiveTab(tab);
          setSelectedClientId(null);
        }}
        pendingCount={pendingForMode}
      />

      {/* Modals */}
      <NewClientModal
        isOpen={isNewClientModalOpen}
        onClose={() => setIsNewClientModalOpen(false)}
        defaultMode={mode}
        onSave={handleCreateClient}
      />

      <InstallGuideModal
        isOpen={isInstallGuideOpen}
        onClose={() => setIsInstallGuideOpen(false)}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-bold max-w-sm text-center border border-slate-700 dark:border-slate-300 animate-in fade-in slide-in-from-bottom-2">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
