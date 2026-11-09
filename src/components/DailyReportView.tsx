import React, { useState } from 'react';
import { Client, LoanType } from '../types';
import {
  buildDailyReportData,
  generateDailyReportPdf,
} from '../utils/pdfReport';
import {
  calculateLoan,
  formatDateGt,
  formatQ,
  formatTime12h,
  getSemaphore,
  isoToday,
  sortClientsByRoute,
} from '../utils/calculations';
import { FileText, Printer, Calendar, Download, Sheet, Copy, Check } from 'lucide-react';

interface Props {
  clients: Client[];
  mode: LoanType;
  collectorName: string;
  onToast: (msg: string) => void;
}

export const DailyReportView: React.FC<Props> = ({ clients, mode, collectorName, onToast }) => {
  const [selectedDate, setSelectedDate] = useState(isoToday());
  const [viewMode, setViewMode] = useState<'report' | 'hoja'>('report');
  const [copied, setCopied] = useState(false);

  const report = buildDailyReportData(clients, selectedDate);
  const currentModeClients = sortClientsByRoute(clients.filter((c) => c.tipo === mode && !c.cerrado));

  const copyReportText = () => {
    const lines = [
      `*🏛️ TU CRÉDITO · REPORTE DE COBROS*`,
      `📅 Fecha: ${report.dia.toUpperCase()} ${formatDateGt(report.fecha)}`,
      `--------------------------------`,
      `💵 *TOTAL COBRADO: ${formatQ(report.total)}*`,
      `• Diarios (${report.countDiario}): ${formatQ(report.totalDiario)}`,
      `• Semanales (${report.countSemanal}): ${formatQ(report.totalSemanal)}`,
      `--------------------------------`,
      `*DETALLE:*`,
    ];

    report.items.forEach((it) => {
      lines.push(`${formatTime12h(it.hora)} | ${it.nombre} (${it.tipo}) -> ${formatQ(it.monto)}`);
    });

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    onToast('Reporte copiado al portapapeles');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4 pb-12">
      {/* Top Header & Switcher */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 leading-tight">
            Reportes y Hoja de Cobranza
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Generación de comprobantes oficiales y planillas físicas de ruta
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setViewMode('report')}
            className={`px-3 py-1.5 rounded-lg transition ${
              viewMode === 'report'
                ? 'bg-blue-700 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            📊 Reporte del Día
          </button>
          <button
            onClick={() => setViewMode('hoja')}
            className={`px-3 py-1.5 rounded-lg transition ${
              viewMode === 'hoja'
                ? 'bg-blue-700 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            📋 Hoja de Cobro en Papel
          </button>
        </div>
      </div>

      {/* VIEW 1: Daily Collection Report */}
      {viewMode === 'report' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3 flex-wrap text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <label className="font-semibold text-slate-600 dark:text-slate-400">
                Fecha del reporte:
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2.5 py-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  generateDailyReportPdf(report);
                  onToast('Descargando reporte en PDF...');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar PDF</span>
              </button>

              <button
                onClick={copyReportText}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copiar texto</span>
              </button>

              <button
                onClick={() => window.print()}
                className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Imprimir"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
              <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold block">Total Cobrado</span>
              <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 block mt-0.5">{formatQ(report.total)}</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-500">{report.items.length} pagos</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
              <span className="text-[11px] text-blue-800 dark:text-blue-300 font-semibold block">Cobros Diarios</span>
              <span className="text-xl font-black text-blue-700 dark:text-blue-400 block mt-0.5">{formatQ(report.totalDiario)}</span>
              <span className="text-[10px] text-blue-600 dark:text-blue-500">{report.countDiario} pagos</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
              <span className="text-[11px] text-purple-800 dark:text-purple-300 font-semibold block">Cobros Semanales</span>
              <span className="text-xl font-black text-purple-700 dark:text-purple-400 block mt-0.5">{formatQ(report.totalSemanal)}</span>
              <span className="text-[10px] text-purple-600 dark:text-purple-500">{report.countSemanal} pagos</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold block">Día de la semana</span>
              <span className="text-lg font-black text-slate-800 dark:text-slate-200 block mt-0.5 capitalize">{report.dia}</span>
              <span className="text-[10px] text-slate-500">{formatDateGt(report.fecha)}</span>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 text-blue-900 dark:text-blue-200 font-bold border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-3">Hora</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Cliente</th>
                    <th className="py-2.5 px-3">Cuota</th>
                    <th className="py-2.5 px-3">Cobrador</th>
                    <th className="py-2.5 px-3 text-right">Monto (Q)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {report.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No hay cobros registrados en la fecha {formatDateGt(selectedDate)}.
                      </td>
                    </tr>
                  ) : (
                    report.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          {formatTime12h(it.hora) || '--:--'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              it.tipo === 'Semanal'
                                ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300'
                                : 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                            }`}
                          >
                            {it.tipo}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">
                          {it.nombre}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          {it.cuotaIdx} de {it.totalCuotas}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{it.cobrador || '—'}</td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                          {formatQ(it.monto)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: Printable Paper Sheet for field collectors */}
      {viewMode === 'hoja' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3 text-xs flex-wrap">
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-200">
                Hoja de Cobro en Papel · {mode === 's' ? 'Cobros Semanales' : 'Cobros Diarios'}
              </p>
              <p className="text-slate-500 text-[11px]">
                Imprime esta planilla antes de salir a la ruta para registrar abonos a mano si se descarga el teléfono.
              </p>
            </div>

            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Hoja</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto print:border-none print:shadow-none print:p-0">
            <div className="mb-3 border-b pb-2 flex justify-between items-center text-xs">
              <div>
                <h3 className="text-base font-black text-blue-900">Tu Crédito · Planilla de Cobranza en Ruta</h3>
                <p className="text-slate-600">
                  Fecha: {formatDateGt(isoToday())} · Cobrador: {collectorName || '__________________________'}
                </p>
              </div>
              <div className="text-right">
                <span className="font-bold text-slate-700">Sección: {mode === 's' ? 'Semanal' : 'Diaria'}</span>
              </div>
            </div>

            <table className="w-full text-left text-xs border border-slate-300 collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                  <th className="py-2 px-2 border-r border-slate-300">Cliente</th>
                  <th className="py-2 px-2 border-r border-slate-300">Ubicación / Tel.</th>
                  <th className="py-2 px-2 border-r border-slate-300 text-right">Cuota</th>
                  <th className="py-2 px-2 border-r border-slate-300 text-right">Saldo</th>
                  <th className="py-2 px-2 border-r border-slate-300">Estado</th>
                  <th className="py-2 px-2 border-r border-slate-300 w-24">Cobrado Q</th>
                  <th className="py-2 px-2 border-r border-slate-300 w-16">Hora</th>
                  <th className="py-2 px-2 w-28">Firma</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {currentModeClients.map((client, idx) => {
                  const k = calculateLoan(client);
                  const sem = getSemaphore(client);
                  return (
                    <tr key={idx} className="h-10">
                      <td className="py-1 px-2 font-bold border-r border-slate-300">
                        {client.nombre || 'Sin nombre'}
                      </td>
                      <td className="py-1 px-2 text-slate-600 border-r border-slate-300 text-[11px]">
                        {client.lugar || '—'} {client.tel ? `· ${client.tel}` : ''}
                      </td>
                      <td className="py-1 px-2 text-right font-bold text-blue-900 border-r border-slate-300">
                        {formatQ(client.cuota)}
                      </td>
                      <td className="py-1 px-2 text-right font-semibold border-r border-slate-300">
                        {formatQ(k.saldo)}
                      </td>
                      <td className="py-1 px-2 text-[11px] border-r border-slate-300">
                        {sem.txt}
                      </td>
                      <td className="py-1 px-2 border-r border-slate-300 bg-slate-50/50"></td>
                      <td className="py-1 px-2 border-r border-slate-300 bg-slate-50/50"></td>
                      <td className="py-1 px-2 bg-slate-50/50"></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
