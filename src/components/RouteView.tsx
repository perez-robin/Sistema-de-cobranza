import React, { useState } from 'react';
import { Client, LoanType } from '../types';
import {
  calculateLoan,
  canRenew,
  currentTimeStr,
  formatQ,
  getSemaphore,
  isoToday,
  nd,
  sortClientsByRoute,
} from '../utils/calculations';
import {
  CheckCircle,
  AlertTriangle,
  Clock,
  Phone,
  Receipt,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Send,
  UserCheck,
  Download,
  Printer,
  Share2,
  FileSpreadsheet,
  FileText,
  X,
} from 'lucide-react';
import { shareViaWhatsApp } from '../utils/pdfReceipt';
import { generateReceiptPdf, generateReceiptDocx, generateReceiptXlsx } from '../utils/documentGenerators';
import { printReceipt } from '../utils/printService';

interface Props {
  clients: Client[];
  mode: LoanType;
  collectorName: string;
  onOpenClient: (clientId: string) => void;
  onCobrarExpress: (client: Client) => void;
  onUndoExpress: (client: Client) => void;
  onGenerateReceipt: (client: Client) => void;
  searchQuery: string;
}

export const RouteView: React.FC<Props> = ({
  clients,
  mode,
  collectorName,
  onOpenClient,
  onCobrarExpress,
  onUndoExpress,
  onGenerateReceipt,
  searchQuery,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'r' | 'a' | 'c' | 'v'>('all');
  const [undoConfirmId, setUndoConfirmId] = useState<string | null>(null);
  const [receiptModalClient, setReceiptModalClient] = useState<Client | null>(null);

  const hoy = isoToday();
  const currentModeClients = clients.filter((c) => c.tipo === mode);

  // Filter by search query
  const searchedClients = currentModeClients.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.nombre || '').toLowerCase().includes(q) ||
      (c.dpi || '').toLowerCase().includes(q) ||
      (c.lugar || '').toLowerCase().includes(q) ||
      (c.tel || '').toLowerCase().includes(q)
    );
  });

  // Calculate overall financial stats
  let totalPorCobrar = 0;
  let totalCobradoHoy = 0;
  let totalMora = 0;
  let activeClientsCount = 0;
  const renewalDueClients: { client: Client; libre: number }[] = [];

  currentModeClients.forEach((c) => {
    const k = calculateLoan(c);
    if (!c.cerrado) {
      activeClientsCount++;
      totalPorCobrar += k.saldo;
      totalMora += k.moraPend;
      if (canRenew(c)) {
        const nuevo = Number(c.renov) > 0 ? Number(c.renov) : Number(c.cantidad);
        renewalDueClients.push({
          client: c,
          libre: Math.max(nuevo - k.saldo, 0),
        });
      }
    }
    c.rows.forEach((r) => {
      if (r.f === hoy && Number(r.m) > 0) {
        totalCobradoHoy += Number(r.m);
      }
    });
  });

  // Group clients by semaphore status
  const sortedClients = sortClientsByRoute(searchedClients);
  const statusCounts = { v: 0, c: 0, a: 0, r: 0 };
  sortedClients.forEach((c) => {
    const sem = getSemaphore(c);
    if (sem.cls in statusCounts) {
      statusCounts[sem.cls as keyof typeof statusCounts]++;
    }
  });

  const filteredClients = sortedClients.filter((c) => {
    if (filterStatus === 'all') return true;
    const sem = getSemaphore(c);
    return sem.cls === filterStatus;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
      {/* Route KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Cobrado Hoy</p>
          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            {formatQ(totalCobradoHoy)}
          </p>
          <span className="text-[10px] text-slate-400 font-medium">Recaudación del día</span>
        </div>

        <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Capital por Cobrar</p>
          <p className="text-lg font-black text-blue-700 dark:text-blue-300 mt-0.5">
            {formatQ(totalPorCobrar)}
          </p>
          <span className="text-[10px] text-slate-400 font-medium">{activeClientsCount} créditos activos</span>
        </div>

        <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Mora Acumulada</p>
          <p className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">
            {formatQ(totalMora)}
          </p>
          <span className="text-[10px] text-slate-400 font-medium">Atrasos &gt; 3 días</span>
        </div>

        <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Por Cobrar Hoy</p>
          <p className="text-lg font-black text-amber-500 dark:text-amber-400 mt-0.5">
            {statusCounts.c + statusCounts.r + statusCounts.a}
          </p>
          <span className="text-[10px] text-slate-400 font-medium">Clientes pendientes</span>
        </div>
      </div>

      {/* Renewal Alert Card (if any clients eligible for renewal) */}
      {renewalDueClients.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300 dark:border-amber-700/60 shadow-sm">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-bold mb-2">
            <Sparkles className="w-4 h-4 text-amber-600 animate-spin" />
            <span>Renovaciones Disponibles ({renewalDueClients.length} clientes listos):</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {renewalDueClients.map(({ client, libre }) => (
              <button
                key={client.id}
                onClick={() => onOpenClient(client.id)}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-amber-500 shadow-sm flex items-center gap-1.5"
              >
                <span>{client.nombre || 'Cliente'}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  (Libre {formatQ(libre)})
                </span>
                <ArrowRight className="w-3 h-3 text-amber-600" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Route Status Chips (Filter pills) */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-bold">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-3 py-1.5 rounded-xl border transition shrink-0 ${
            filterStatus === 'all'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
          }`}
        >
          Todos ({sortedClients.length})
        </button>
        <button
          onClick={() => setFilterStatus('r')}
          className={`px-3 py-1.5 rounded-xl border transition shrink-0 flex items-center gap-1.5 ${
            filterStatus === 'r'
              ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
          <span>En mora</span>
          <span className="px-1.5 py-0.2 rounded-full bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200 text-[10px]">
            {statusCounts.r}
          </span>
        </button>
        <button
          onClick={() => setFilterStatus('a')}
          className={`px-3 py-1.5 rounded-xl border transition shrink-0 flex items-center gap-1.5 ${
            filterStatus === 'a'
              ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-900'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
          <span>2-3 días atraso</span>
          <span className="px-1.5 py-0.2 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 text-[10px]">
            {statusCounts.a}
          </span>
        </button>
        <button
          onClick={() => setFilterStatus('c')}
          className={`px-3 py-1.5 rounded-xl border transition shrink-0 flex items-center gap-1.5 ${
            filterStatus === 'c'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
          <span>Por cobrar hoy</span>
          <span className="px-1.5 py-0.2 rounded-full bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-200 text-[10px]">
            {statusCounts.c}
          </span>
        </button>
        <button
          onClick={() => setFilterStatus('v')}
          className={`px-3 py-1.5 rounded-xl border transition shrink-0 flex items-center gap-1.5 ${
            filterStatus === 'v'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
          <span>Cobrados</span>
          <span className="px-1.5 py-0.2 rounded-full bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 text-[10px]">
            {statusCounts.v}
          </span>
        </button>
      </div>

      {/* Client List */}
      {filteredClients.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-40 text-blue-500" />
          <p className="text-sm font-semibold">No hay clientes con este filtro</p>
          <p className="text-xs text-slate-400 mt-1">
            {currentModeClients.length === 0
              ? 'Crea tu primer cliente con el botón «+ Nuevo Cliente» arriba'
              : 'Prueba cambiando de filtro o borrando la búsqueda'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredClients.map((client) => {
            const sem = getSemaphore(client);
            const k = calculateLoan(client);
            const hasPaidToday = client.rows.some((r) => r.f === hoy && Number(r.m) > 0);
            const isEligibleRenewal = canRenew(client);

            // Semaphore style mappings
            const cardThemes = {
              v: 'border-l-4 border-l-emerald-500 bg-white dark:bg-slate-900 hover:border-slate-300',
              c: 'border-l-4 border-l-blue-500 bg-blue-50/20 dark:bg-slate-900 hover:border-blue-300',
              a: 'border-l-4 border-l-amber-500 bg-amber-50/20 dark:bg-slate-900 hover:border-amber-300',
              r: 'border-l-4 border-l-rose-500 bg-rose-50/25 dark:bg-slate-900 hover:border-rose-300',
              n: 'border-l-4 border-l-slate-400 bg-slate-50 dark:bg-slate-900 opacity-70',
            };

            const pillThemes = {
              v: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300',
              c: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300',
              a: 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300',
              r: 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-bold',
              n: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
            };

            return (
              <div
                key={client.id}
                className={`p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all ${
                  cardThemes[sem.cls]
                }`}
              >
                {/* Header Row: Name & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div
                    onClick={() => onOpenClient(client.id)}
                    className="flex-1 cursor-pointer group"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition">
                        {client.nombre || 'Cliente sin nombre'}
                      </span>
                      {isEligibleRenewal && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                          Renovación disponible
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                      <span>{client.lugar || 'Sin ubicación'}</span>
                      {client.tel && (
                        <>
                          <span>•</span>
                          <span className="text-blue-600 dark:text-blue-400">{client.tel}</span>
                        </>
                      )}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1 ${
                      pillThemes[sem.cls]
                    }`}
                  >
                    {sem.cls === 'v' && <CheckCircle className="w-3.5 h-3.5" />}
                    {sem.cls === 'r' && <AlertTriangle className="w-3.5 h-3.5" />}
                    <span>{sem.txt}</span>
                  </span>
                </div>

                {/* Loan Numbers Bar */}
                <div
                  onClick={() => onOpenClient(client.id)}
                  className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 cursor-pointer text-xs"
                >
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Cuotas pagadas</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {k.n} de {nd(client)} {mode === 's' ? 'sem.' : 'días'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Cuota fija</span>
                    <span className="font-bold text-blue-700 dark:text-blue-400">
                      {formatQ(client.cuota)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-medium">Saldo pendiente</span>
                    <span className="font-black text-slate-900 dark:text-slate-100">
                      {formatQ(k.saldo)}
                    </span>
                  </div>
                </div>

                {/* Field Collector Actions (Fast Cobro / Receipt / WhatsApp) */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                  {/* Phone dial shortcut */}
                  {client.tel && (
                    <a
                      href={`tel:${client.tel}`}
                      className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1"
                      title="Llamar al cliente"
                    >
                      <Phone className="w-3.5 h-3.5 text-blue-600" />
                      <span className="hidden sm:inline">Llamar</span>
                    </a>
                  )}

                  <div className="flex items-center gap-1.5 ml-auto">
                    {hasPaidToday ? (
                      <>
                        {undoConfirmId === client.id ? (
                          <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950 p-1 rounded-xl border border-rose-200">
                            <span className="text-[11px] text-rose-700 font-bold px-1.5">¿Anular cobro de hoy?</span>
                            <button
                              onClick={() => {
                                onUndoExpress(client);
                                setUndoConfirmId(null);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold shadow-sm"
                            >
                              Sí
                            </button>
                            <button
                              onClick={() => setUndoConfirmId(null)}
                              className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => setReceiptModalClient(client)}
                              className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 text-xs font-bold flex items-center gap-1.5 transition"
                            >
                              <Receipt className="w-3.5 h-3.5 text-blue-600" />
                              <span>Recibo</span>
                            </button>

                            <button
                              onClick={() => shareViaWhatsApp(client, collectorName)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 text-xs font-bold flex items-center gap-1.5 transition"
                              title="Enviar comprobante por WhatsApp"
                            >
                              <Send className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="hidden sm:inline">WhatsApp</span>
                            </button>

                            <button
                              onClick={() => setUndoConfirmId(client.id)}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                              title="Deshacer cobro de hoy"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </>
                    ) : sem.i >= 0 && !client.cerrado ? (
                      <button
                        onClick={() => {
                          if ('vibrate' in navigator) {
                            try {
                              navigator.vibrate([20, 50, 20]);
                            } catch {
                              // Ignore
                            }
                          }
                          onCobrarExpress(client);
                        }}
                        className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white text-xs font-black shadow-md flex items-center gap-1.5 transition active:scale-95"
                      >
                        <UserCheck className="w-4 h-4 text-amber-300" />
                        <span>Cobrar {formatQ(client.cuota)}</span>
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 font-semibold px-2">Pagado completo</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* RECEIPT OPTIONS MODAL */}
      {receiptModalClient && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-4 space-y-3 shadow-2xl border border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">Comprobante de Pago</span>
              </div>
              <button
                onClick={() => setReceiptModalClient(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-1">
              <p className="font-bold text-slate-900 dark:text-slate-100">{receiptModalClient.nombre || 'Cliente'}</p>
              <p className="text-[11px] text-slate-500">
                DPI: {receiptModalClient.dpi || 'N/A'} · Cuota: {formatQ(receiptModalClient.cuota)}
              </p>
              <p className="text-[10px] text-blue-700 dark:text-blue-400 font-mono">
                Guardado en: DOCUMENTOS/Recibos/
              </p>
            </div>

            <div className="space-y-1.5 pt-1">
              <button
                onClick={async () => {
                  await generateReceiptPdf(receiptModalClient, collectorName);
                  setReceiptModalClient(null);
                }}
                className="w-full py-2 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-800 dark:text-rose-200 font-bold border border-rose-200 dark:border-rose-900 flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-rose-600" />
                  <span>Descargar Recibo en PDF</span>
                </div>
                <span className="text-[10px] uppercase font-mono">.pdf</span>
              </button>

              <button
                onClick={async () => {
                  await generateReceiptDocx(receiptModalClient, collectorName);
                  setReceiptModalClient(null);
                }}
                className="w-full py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-800 dark:text-blue-200 font-bold border border-blue-200 dark:border-blue-900 flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Descargar Recibo en Word</span>
                </div>
                <span className="text-[10px] uppercase font-mono">.docx</span>
              </button>

              <button
                onClick={async () => {
                  await generateReceiptXlsx(receiptModalClient, collectorName);
                  setReceiptModalClient(null);
                }}
                className="w-full py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-200 font-bold border border-emerald-200 dark:border-emerald-900 flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Descargar Recibo en Excel</span>
                </div>
                <span className="text-[10px] uppercase font-mono">.xlsx</span>
              </button>

              <button
                onClick={async () => {
                  await Promise.all([
                    generateReceiptPdf(receiptModalClient, collectorName),
                    generateReceiptDocx(receiptModalClient, collectorName),
                    generateReceiptXlsx(receiptModalClient, collectorName),
                  ]);
                  setReceiptModalClient(null);
                }}
                className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold flex items-center justify-center gap-2 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar los 3 Formatos (PDF, Word, Excel)</span>
              </button>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  onClick={() => {
                    printReceipt(receiptModalClient, collectorName);
                    setReceiptModalClient(null);
                  }}
                  className="py-2 px-3 rounded-xl bg-slate-800 dark:bg-slate-100 hover:bg-slate-900 text-white dark:text-slate-900 font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Recibo</span>
                </button>

                <button
                  onClick={() => {
                    shareViaWhatsApp(receiptModalClient, collectorName);
                    setReceiptModalClient(null);
                  }}
                  className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-sm transition"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
