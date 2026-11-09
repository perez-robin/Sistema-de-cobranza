import React, { useState } from 'react';
import { CashClosing, Client, LoanType } from '../types';
import {
  currentTimeStr,
  formatDateGt,
  formatQ,
  formatTime12h,
  getSemaphore,
  isoToday,
} from '../utils/calculations';
import { DollarSign, Save, Copy, Check, Send, Clock, Calendar, CheckCircle, AlertTriangle } from 'lucide-react';

interface Props {
  clients: Client[];
  mode: LoanType;
  collectorName: string;
  closings: CashClosing[];
  onSaveClosing: (closing: CashClosing) => void;
  onToast: (msg: string) => void;
}

export const CashClosingView: React.FC<Props> = ({
  clients,
  mode,
  collectorName,
  closings,
  onSaveClosing,
  onToast,
}) => {
  const [copied, setCopied] = useState(false);
  const hoy = isoToday();
  const currentModeClients = clients.filter((c) => c.tipo === mode);

  // Collections made today
  interface CollectionRecord {
    time: string;
    nombre: string;
    quotaIdx: number;
    amount: number;
    collector: string;
  }

  const collectionsToday: CollectionRecord[] = [];
  let totalCobrado = 0;
  const uncollectedClients: { nombre: string; statusText: string }[] = [];

  currentModeClients.forEach((c) => {
    let paidToday = false;
    c.rows.forEach((r, idx) => {
      if (r.f === hoy && Number(r.m) > 0) {
        paidToday = true;
        const m = Number(r.m);
        totalCobrado += m;
        collectionsToday.push({
          time: r.h || currentTimeStr(),
          nombre: c.nombre || 'Sin nombre',
          quotaIdx: idx + 1,
          amount: m,
          collector: r.firma || collectorName,
        });
      }
    });

    if (!paidToday && !c.cerrado) {
      const sem = getSemaphore(c);
      uncollectedClients.push({
        nombre: c.nombre || 'Sin nombre',
        statusText: sem.txt,
      });
    }
  });

  collectionsToday.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));

  // Formatted text for WhatsApp / report
  const generateClosingText = (): string => {
    const lines = [
      `*TU CRÉDITO · CIERRE DE CAJA ${mode === 's' ? 'SEMANAL' : 'DIARIO'}*`,
      `Fecha: ${formatDateGt(hoy)} ${currentTimeStr()}`,
      collectorName ? `Cobrador: ${collectorName}` : '',
      `--------------------------------`,
      `*TOTAL COBRADO HOY: ${formatQ(totalCobrado)}*`,
      `Cobros realizados: ${collectionsToday.length}`,
      `Clientes pendientes: ${uncollectedClients.length}`,
      `--------------------------------`,
      `*DETALLE DE COBROS:*`,
    ];

    if (collectionsToday.length === 0) {
      lines.push(`(Sin cobros registrados hoy)`);
    } else {
      collectionsToday.forEach((col) => {
        lines.push(`• ${formatTime12h(col.time)} | ${col.nombre} (Pago #${col.quotaIdx}) -> *${formatQ(col.amount)}*`);
      });
    }

    if (uncollectedClients.length > 0) {
      lines.push(``, `*CLIENTES SIN COBRAR (${uncollectedClients.length}):*`);
      uncollectedClients.forEach((u) => {
        lines.push(`- ${u.nombre} (${u.statusText})`);
      });
    }

    return lines.filter(Boolean).join('\n');
  };

  const handleCopyText = () => {
    const text = generateClosingText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    onToast('Texto del cierre copiado para WhatsApp');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const text = generateClosingText();
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleSave = () => {
    const closing: CashClosing = {
      fecha: hoy,
      hora: currentTimeStr(),
      modo: mode,
      cobrador: collectorName,
      total: totalCobrado,
      n: collectionsToday.length,
      pend: uncollectedClients.length,
    };
    onSaveClosing(closing);
    onToast(`Cierre guardado exitosamente: ${formatQ(totalCobrado)}.`);
  };

  const currentModeClosings = closings.filter((x) => x.modo === mode).slice(0, 10);

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4 pb-12">
      {/* Top Banner and Actions */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-900 text-white shadow-md flex items-center justify-between gap-3 flex-wrap">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
            Control de Caja y Liquidación
          </span>
          <h2 className="text-lg font-black leading-tight">
            Cierre de Caja · {mode === 's' ? 'Cobros Semanales' : 'Cobros Diarios'}
          </h2>
          <p className="text-xs text-blue-200 mt-0.5">
            {formatDateGt(hoy)} · {currentTimeStr()} {collectorName ? `· Cobrador: ${collectorName}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={handleSave}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-sm flex items-center gap-1.5 transition active:scale-95"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar Cierre</span>
          </button>

          <button
            onClick={handleShareWhatsApp}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Enviar a WhatsApp</span>
          </button>

          <button
            onClick={handleCopyText}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs flex items-center gap-1.5 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Copiar texto</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 shadow-sm">
          <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 block">
            Total Efectivo Cobrado Hoy
          </span>
          <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 block mt-1">
            {formatQ(totalCobrado)}
          </span>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-500 font-medium">
            Entregar a administración
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 shadow-sm">
          <span className="text-xs font-semibold text-blue-800 dark:text-blue-300 block">
            Cobros Realizados
          </span>
          <span className="text-2xl font-black text-blue-700 dark:text-blue-400 block mt-1">
            {collectionsToday.length}
          </span>
          <span className="text-[11px] text-blue-600 dark:text-blue-500 font-medium">
            Clientes visitados y cobrados
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 shadow-sm">
          <span className="text-xs font-semibold text-rose-800 dark:text-rose-300 block">
            Clientes Pendientes
          </span>
          <span className="text-2xl font-black text-rose-700 dark:text-rose-400 block mt-1">
            {uncollectedClients.length}
          </span>
          <span className="text-[11px] text-rose-600 dark:text-rose-500 font-medium">
            Sin abono en el día
          </span>
        </div>
      </div>

      {/* Collections Today Table */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>Detalle de Cobros Realizados Hoy ({collectionsToday.length})</span>
        </h3>

        {collectionsToday.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            Aún no se han registrado cobros hoy en la sección de cobros {mode === 's' ? 'semanales' : 'diarios'}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold bg-slate-50 dark:bg-slate-800/60">
                  <th className="py-2 px-3">Hora</th>
                  <th className="py-2 px-3">Cliente</th>
                  <th className="py-2 px-3">No. Pago</th>
                  <th className="py-2 px-3 text-right">Monto Recibido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {collectionsToday.map((col, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400 font-medium">
                      {formatTime12h(col.time)}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">
                      {col.nombre}
                    </td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                      Cuota #{col.quotaIdx}
                    </td>
                    <td className="py-2 px-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                      {formatQ(col.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Uncollected Clients List */}
      {uncollectedClients.length > 0 && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Clientes Sin Cobrar Hoy ({uncollectedClients.length})</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {uncollectedClients.map((u, i) => (
              <div
                key={i}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex justify-between items-center"
              >
                <span className="font-bold text-slate-800 dark:text-slate-200">{u.nombre}</span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">{u.statusText}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historical Closings */}
      {currentModeClosings.length > 0 && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Historial de Cierres Anteriores</span>
          </h3>

          <div className="space-y-1.5 text-xs">
            {currentModeClosings.map((c, i) => (
              <div
                key={i}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex justify-between items-center flex-wrap gap-2"
              >
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {formatDateGt(c.fecha)} · {formatTime12h(c.hora)}
                  </span>
                  {c.cobrador && <span className="text-slate-400 text-[11px] ml-1.5">({c.cobrador})</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 text-[11px]">{c.n} cobros</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">{formatQ(c.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
