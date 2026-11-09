import React, { useState, useEffect, useRef } from 'react';
import { Client, PaymentRow } from '../types';
import {
  calculateLoan,
  canRenew,
  currentTimeStr,
  cuotaDe,
  diffDays,
  dueDates,
  formatCUI,
  formatDateGt,
  formatQ,
  formatTime12h,
  isoToday,
  MORA_MONTO,
  nd,
  promissoryNoteText,
} from '../utils/calculations';
import { getPhoto, putPhoto, deletePhoto } from '../utils/idb';
import { getStatementPlainText } from '../utils/pdfStatement';
import { shareViaWhatsApp } from '../utils/pdfReceipt';
import {
  generateStatementPdf,
  generateStatementDocx,
  generateStatementXlsx,
  generateContractPdf,
  generateContractDocx,
  generateReceiptPdf as genReceiptPdf,
  generateReceiptDocx as genReceiptDocx,
  generateReceiptXlsx as genReceiptXlsx,
} from '../utils/documentGenerators';
import { printStatement, printContract, printReceipt } from '../utils/printService';
import {
  ArrowLeft,
  Camera,
  Trash2,
  FileText,
  Send,
  Sparkles,
  Save,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Printer,
  Copy,
  Check,
  Download,
  FileSpreadsheet,
  Share2,
} from 'lucide-react';

interface Props {
  client: Client;
  clientsList: Client[];
  collectorName: string;
  setCollectorName: (name: string) => void;
  onUpdateClient: (updated: Client) => void;
  onDeleteClient: (clientId: string) => void;
  onBack: () => void;
  onNavigateClient: (clientId: string) => void;
  onToast: (msg: string) => void;
}

export const ClientDetailView: React.FC<Props> = ({
  client,
  clientsList,
  collectorName,
  setCollectorName,
  onUpdateClient,
  onDeleteClient,
  onBack,
  onNavigateClient,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<'tabla' | 'datos' | 'fotos' | 'estado'>('tabla');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [renewAmount, setRenewAmount] = useState<number | string>(client.renov || client.cantidad);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [ocrLoading, setOcrLoading] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const k = calculateLoan(client);
  const dues = dueDates(client);
  const hoy = isoToday();
  const isWeekly = client.tipo === 's';

  // Load photos from IndexedDB
  useEffect(() => {
    let active = true;
    const slots = ['dpiF', 'dpiT', 'foto'] as const;
    slots.forEach(async (slot) => {
      if (client.fotos && client.fotos[slot]) {
        try {
          const blob = await getPhoto(`${client.id}:${slot}`);
          if (blob && active) {
            const url = URL.createObjectURL(blob);
            setPhotoUrls((prev) => ({ ...prev, [slot]: url }));
          }
        } catch (e) {
          console.error('Error loading photo from idb:', e);
        }
      }
    });

    return () => {
      active = false;
      Object.values(photoUrls).forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          // ignore
        }
      });
    };
  }, [client.id]);

  // Handle client field changes
  const handleFieldChange = (field: keyof Client, value: any) => {
    const updated = { ...client, [field]: value };
    if (field === 'cantidad' && Number(value) > 0) {
      updated.cuota = cuotaDe(value, client);
    }
    onUpdateClient(updated);
  };

  // Handle payment row changes
  const handleRowChange = (index: number, key: keyof PaymentRow, value: any) => {
    const newRows = [...client.rows];
    const row = { ...newRows[index], [key]: value };

    // Auto-fill time and date when amount entered
    if (key === 'm' && Number(value) > 0) {
      if (!row.f) row.f = isoToday();
      if (!row.h) row.h = currentTimeStr();
      if (!row.firma) row.firma = collectorName || '';
    }

    newRows[index] = row;
    onUpdateClient({ ...client, rows: newRows });
  };

  // Quick single-row payment
  const handlePayRow = (index: number) => {
    const newRows = [...client.rows];
    newRows[index] = {
      ...newRows[index],
      f: isoToday(),
      h: currentTimeStr(),
      m: client.cuota,
      firma: collectorName || 'Cobranzas',
    };
    onUpdateClient({ ...client, rows: newRows });
    onToast(`Cuota ${index + 1} cobrada exitosamente`);
  };

  // Photo processing
  const handlePhotoInput = (slot: 'dpiF' | 'dpiT' | 'foto', file: File) => {
    const img = new Image();
    const tempUrl = URL.createObjectURL(file);
    img.onload = () => {
      const maxDim = slot === 'foto' ? 1000 : 1600;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          async (blob) => {
            URL.revokeObjectURL(tempUrl);
            if (!blob) {
              onToast('Error al procesar la foto');
              return;
            }
            try {
              await putPhoto(`${client.id}:${slot}`, blob);
              const previewUrl = URL.createObjectURL(blob);
              setPhotoUrls((prev) => ({ ...prev, [slot]: previewUrl }));

              const updatedFotos = { ...client.fotos, [slot]: true };
              onUpdateClient({ ...client, fotos: updatedFotos });
              onToast(`Foto guardada correctamente`);

              // If front of DPI, run Gemini OCR automatically!
              if (slot === 'dpiF') {
                runDpiOcr(blob);
              }
            } catch (err) {
              console.error(err);
              onToast('Error al guardar la foto en el dispositivo');
            }
          },
          'image/jpeg',
          slot === 'foto' ? 0.75 : 0.85
        );
      }
    };
    img.src = tempUrl;
  };

  // Gemini AI OCR for DPI extraction
  const runDpiOcr = async (blob: Blob) => {
    setOcrLoading(true);
    onToast('Escaneando DPI con Inteligencia Artificial...');
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        try {
          const res = await fetch('/api/ocr-dpi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64Data, mimeType: 'image/jpeg' }),
          });

          if (!res.ok) {
            throw new Error('Servidor no disponible');
          }

          const json = await res.json();
          if (json.success && json.data) {
            const { cui, nombre, lugar } = json.data;
            const updated = { ...client };
            let foundCount = 0;

            if (cui) {
              updated.dpi = formatCUI(cui);
              foundCount++;
            }
            if (nombre && (!client.nombre || client.nombre.startsWith('Cliente'))) {
              updated.nombre = nombre;
              foundCount++;
            }
            if (lugar && !client.lugar) {
              updated.lugar = lugar;
            }

            if (foundCount > 0) {
              onUpdateClient(updated);
              onToast('DPI leído con éxito. Se completaron los datos del cliente.');
            } else {
              onToast('No se detectaron datos legibles. Verifique la nitidez o ingréselos a mano.');
            }
          }
        } catch {
          onToast('Modo sin conexión: Por favor escriba el nombre y DPI manualmente.');
        } finally {
          setOcrLoading(false);
        }
      };
      reader.readAsDataURL(blob);
    } catch {
      setOcrLoading(false);
    }
  };

  // Renewal Action
  const handleRenewal = () => {
    const nuevoMonto = Number(renewAmount) > 0 ? Number(renewAmount) : Number(client.cantidad);
    if (!(nuevoMonto > 0)) {
      onToast('Escriba el monto del nuevo crédito');
      return;
    }
    if (nuevoMonto < k.saldo) {
      onToast('El nuevo crédito debe cubrir el saldo pendiente');
      return;
    }

    const libreEfectivo = nuevoMonto - k.saldo;
    const historyItem = {
      ini: client.inicio,
      fin: isoToday(),
      cant: Number(client.cantidad) || 0,
      cuota: Number(client.cuota) || 0,
      ef: client.efectivo != null ? Number(client.efectivo) : Number(client.cantidad) || 0,
      ab: k.ab,
      mora: k.moraPend,
      rows: client.rows,
    };

    // Create fresh rows for the new cycle
    const count = client.tipo === 's' ? 6 : 23;
    const newRows: PaymentRow[] = [];
    for (let i = 0; i < count; i++) {
      newRows.push({ f: '', h: '', m: '', firma: '', mp: false });
    }

    const updated: Client = {
      ...client,
      hist: [...(client.hist || []), historyItem],
      rows: newRows,
      inicio: isoToday(),
      cantidad: nuevoMonto,
      cuota: cuotaDe(nuevoMonto, client),
      efectivo: libreEfectivo,
      renov: '',
      cerrado: false,
    };

    onUpdateClient(updated);
    onToast(`Crédito renovado. Entregar al cliente: ${formatQ(libreEfectivo)} en efectivo.`);
  };

  // Signature pad interactions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e3a8a';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onUpdateClient({ ...client, firmaCliente: dataUrl });
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onUpdateClient({ ...client, firmaCliente: undefined });
  };

  // Client pagination
  const currentIdx = clientsList.findIndex((c) => c.id === client.id);
  const prevClient = currentIdx > 0 ? clientsList[currentIdx - 1] : clientsList[clientsList.length - 1];
  const nextClient = currentIdx < clientsList.length - 1 ? clientsList[currentIdx + 1] : clientsList[0];

  const canRenewNow = canRenew(client);
  const nuevoMontoPropuesto = Number(renewAmount) > 0 ? Number(renewAmount) : Number(client.cantidad);
  const libreCalculado = nuevoMontoPropuesto - k.saldo;

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4 pb-12">
      {/* Top Navigation Bar for Single Client */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al listado</span>
        </button>

        <div className="flex items-center gap-1">
          {clientsList.length > 1 && (
            <>
              <button
                onClick={() => onNavigateClient(prevClient.id)}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                title="Cliente anterior"
              >
                ← Anterior
              </button>
              <button
                onClick={() => onNavigateClient(nextClient.id)}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                title="Siguiente cliente"
              >
                Siguiente →
              </button>
            </>
          )}

          <button
            onClick={() => setDeleteConfirm(true)}
            className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900 transition"
            title="Eliminar cliente"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Delete Confirmation Alert */}
      {deleteConfirm && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 shadow-sm space-y-2">
          <p className="font-bold text-sm flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>¿Eliminar definitivamente a {client.nombre || 'este cliente'}?</span>
          </p>
          <p className="text-slate-600 dark:text-slate-300 text-xs">
            Se borrarán todas sus {nd(client)} cuotas, su historial y sus fotos guardadas. Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onDeleteClient(client.id)}
              className="px-4 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-sm hover:bg-rose-700"
            >
              Sí, eliminar cliente
            </button>
            <button
              onClick={() => setDeleteConfirm(false)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 text-slate-700 dark:text-slate-300 font-semibold text-xs"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Client Profile Card Header */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              {isWeekly ? 'Crédito Semanal (6 Cuotas)' : 'Crédito Diario (23 Cuotas)'}
            </span>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 leading-tight">
              {client.nombre || 'Cliente sin nombre'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              DPI: {client.dpi || 'Sin DPI'} · {client.lugar || 'Sin dirección'}
            </p>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-medium">Saldo pendiente</span>
            <span className="text-xl font-black text-slate-900 dark:text-slate-100">
              {formatQ(k.saldo)}
            </span>
          </div>
        </div>

        {/* Quick Numbers Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <span className="text-[10px] text-slate-400 block font-medium">Otorgado</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{formatQ(client.cantidad)}</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <span className="text-[10px] text-slate-400 block font-medium">Cuota fija</span>
            <span className="font-bold text-blue-700 dark:text-blue-400">{formatQ(client.cuota)}</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <span className="text-[10px] text-slate-400 block font-medium">Abonado</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {formatQ(k.ab)} ({k.n}/{nd(client)})
            </span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <span className="text-[10px] text-slate-400 block font-medium">Mora pendiente</span>
            <span className={`font-bold ${k.moraPend > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
              {formatQ(k.moraPend)}
            </span>
          </div>
        </div>
      </div>

      {/* Renewal Banner (when eligible) */}
      {canRenewNow && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-600 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-xs">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>Cliente apto para renovación: ha completado {k.n} de {nd(client)} pagos.</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Nuevo monto a otorgar (Q):
              </label>
              <input
                type="number"
                step="0.01"
                min="50"
                value={renewAmount}
                onChange={(e) => setRenewAmount(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800">
              <span className="text-[10px] text-slate-400 block font-medium">Saldo que se cancela</span>
              <span className="font-black text-rose-600 text-sm">{formatQ(k.saldo)}</span>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800">
              <span className="text-[10px] text-emerald-800 dark:text-emerald-300 block font-bold">
                Efectivo libre para el cliente
              </span>
              <span className="font-black text-emerald-700 dark:text-emerald-300 text-base">
                {formatQ(Math.max(libreCalculado, 0))}
              </span>
            </div>
          </div>

          {libreCalculado < 0 && (
            <p className="text-xs text-rose-600 font-semibold">
              El nuevo crédito no alcanza a cubrir el saldo pendiente de {formatQ(k.saldo)}.
            </p>
          )}

          <div className="pt-1 flex justify-end">
            <button
              onClick={handleRenewal}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-sm flex items-center gap-1.5 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Confirmar y Renovar Crédito</span>
            </button>
          </div>
        </div>
      )}

      {/* Tabs navigation for client details */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-2xl text-xs font-bold">
        <button
          onClick={() => setActiveTab('tabla')}
          className={`flex-1 py-2 rounded-xl transition ${
            activeTab === 'tabla'
              ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Cuotas ({client.rows.filter((r) => Number(r.m) > 0).length}/{nd(client)})
        </button>
        <button
          onClick={() => setActiveTab('datos')}
          className={`flex-1 py-2 rounded-xl transition ${
            activeTab === 'datos'
              ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Datos y Condiciones
        </button>
        <button
          onClick={() => setActiveTab('fotos')}
          className={`flex-1 py-2 rounded-xl transition ${
            activeTab === 'fotos'
              ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Documentos y Fotos
        </button>
        <button
          onClick={() => setActiveTab('estado')}
          className={`flex-1 py-2 rounded-xl transition ${
            activeTab === 'estado'
              ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Pagaré y Comprobante
        </button>
      </div>

      {/* TAB 1: Payment Schedule Table */}
      {activeTab === 'tabla' && (
        <div className="space-y-3">
          {/* Collector input shortcut */}
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 text-xs">
            <span className="font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Cobrador:
            </span>
            <input
              type="text"
              value={collectorName}
              onChange={(e) => setCollectorName(e.target.value)}
              placeholder="Nombre del cobrador (se anota en los abonos)"
              className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
            />
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 text-blue-900 dark:text-blue-200 font-bold border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-3 w-10 text-center">{isWeekly ? 'Sem.' : 'Día'}</th>
                    <th className="py-2.5 px-3">Fecha Prog.</th>
                    <th className="py-2.5 px-3">Fecha Abono</th>
                    <th className="py-2.5 px-3">Hora</th>
                    <th className="py-2.5 px-3">Cuota (Q)</th>
                    <th className="py-2.5 px-3">Firma</th>
                    <th className="py-2.5 px-3">Mora</th>
                    <th className="py-2.5 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {client.rows.map((row, idx) => {
                    const s = k.st[idx];
                    const isRowPaid = s.paid;
                    const isRowLate = s.late;

                    return (
                      <tr
                        key={idx}
                        className={`transition-colors ${
                          isRowPaid
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20'
                            : isRowLate
                            ? 'bg-rose-50/50 dark:bg-rose-950/20'
                            : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-2 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatDateGt(s.due)}
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="date"
                            value={row.f}
                            onChange={(e) => handleRowChange(idx, 'f', e.target.value)}
                            className="w-28 px-1.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-800"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="time"
                            value={row.h}
                            onChange={(e) => handleRowChange(idx, 'h', e.target.value)}
                            className="w-20 px-1.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-800"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.m}
                            onChange={(e) => handleRowChange(idx, 'm', e.target.value)}
                            placeholder="0.00"
                            className="w-20 px-1.5 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-800"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={row.firma}
                            onChange={(e) => handleRowChange(idx, 'firma', e.target.value)}
                            placeholder="Firma"
                            className="w-24 px-1.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-800"
                          />
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {isRowLate ? (
                            <label className="flex items-center gap-1 cursor-pointer font-bold text-rose-600">
                              <span>Q5.00</span>
                              <input
                                type="checkbox"
                                checked={row.mp}
                                onChange={(e) => handleRowChange(idx, 'mp', e.target.checked)}
                                className="w-3.5 h-3.5 text-blue-600 rounded"
                              />
                              <span className="text-[10px] text-slate-500 font-normal">
                                {row.mp ? 'pagada' : 'pend.'}
                              </span>
                            </label>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          {isRowPaid ? (
                            <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">
                              Pagado
                            </span>
                          ) : (
                            <button
                              onClick={() => handlePayRow(idx)}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-sm transition active:scale-95"
                            >
                              Cobrar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
              Nota: A partir del 3er día de atraso posterior a la fecha programada, el sistema calcula automáticamente Q5.00 de mora por cada pago retrasado.
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Client Profile & Loan Terms Form */}
      {activeTab === 'datos' && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-xs">
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">
            Editar Información del Préstamo
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Nombre completo:</label>
              <input
                type="text"
                value={client.nombre}
                onChange={(e) => handleFieldChange('nombre', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">DPI / CUI (13 dígitos):</label>
              <input
                type="text"
                value={client.dpi}
                onChange={(e) => handleFieldChange('dpi', formatCUI(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Lugar / Negocio:</label>
              <input
                type="text"
                value={client.lugar}
                onChange={(e) => handleFieldChange('lugar', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Teléfono:</label>
              <input
                type="tel"
                value={client.tel}
                onChange={(e) => handleFieldChange('tel', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Cantidad otorgada (Q):</label>
              <input
                type="number"
                step="0.01"
                min="50"
                value={client.cantidad}
                onChange={(e) => handleFieldChange('cantidad', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                {isWeekly ? 'Cuota semanal (Q):' : 'Cuota diaria (Q):'}
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={client.cuota}
                onChange={(e) => handleFieldChange('cuota', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Fecha de inicio:</label>
              <input
                type="date"
                value={client.inicio}
                onChange={(e) => handleFieldChange('inicio', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
              />
            </div>

            {!isWeekly && (
              <div className="flex items-center pt-4">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={client.dom ?? true}
                    onChange={(e) => handleFieldChange('dom', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span>No cobrar domingos (salta automáticamente)</span>
                </label>
              </div>
            )}
          </div>

          {/* Past Loans History if renewed */}
          {client.hist && client.hist.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                Historial de Créditos Anteriores de este Cliente:
              </h4>
              <div className="space-y-1.5">
                {client.hist.map((h, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs flex justify-between items-center"
                  >
                    <span>
                      <strong>Ciclo #{i + 1}:</strong> {formatDateGt(h.ini)} al {formatDateGt(h.fin)} · Otorgado {formatQ(h.cant)}
                    </span>
                    <span className="font-bold text-emerald-600">Cobrado {formatQ(h.ab)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DPI Photos & Client Photo with Gemini OCR */}
      {activeTab === 'fotos' && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-xs">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Documentos y Fotografía del Cliente
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              Toma fotos con la cámara del teléfono. Se guardan localmente en el dispositivo para consulta y archivo.
            </p>
          </div>

          {ocrLoading && (
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 animate-spin text-blue-600" />
              <span>Analizando fotografía del DPI con IA para extraer CUI y Nombre...</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Front DPI */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <p className="font-bold text-slate-800 dark:text-slate-200">1. Foto DPI (Frente)</p>
              {photoUrls.dpiF ? (
                <div className="relative rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600 aspect-video bg-black flex items-center justify-center">
                  <img src={photoUrls.dpiF} alt="DPI Frente" className="max-h-full object-contain" />
                </div>
              ) : (
                <div className="aspect-video rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                  <Camera className="w-6 h-6 mb-1 opacity-50" />
                  <span className="text-[11px]">Sin foto de DPI frontal</span>
                </div>
              )}

              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handlePhotoInput('dpiF', e.target.files[0]);
                  }}
                />
                <span className="w-full py-2 px-3 rounded-xl bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-bold text-center block cursor-pointer transition shadow-sm">
                  {photoUrls.dpiF ? 'Cambiar Foto Frente' : 'Tomar Foto Frente'}
                </span>
              </label>
            </div>

            {/* Back DPI */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <p className="font-bold text-slate-800 dark:text-slate-200">2. Foto DPI (Reverso)</p>
              {photoUrls.dpiT ? (
                <div className="relative rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600 aspect-video bg-black flex items-center justify-center">
                  <img src={photoUrls.dpiT} alt="DPI Reverso" className="max-h-full object-contain" />
                </div>
              ) : (
                <div className="aspect-video rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                  <Camera className="w-6 h-6 mb-1 opacity-50" />
                  <span className="text-[11px]">Sin foto de DPI reverso</span>
                </div>
              )}

              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handlePhotoInput('dpiT', e.target.files[0]);
                  }}
                />
                <span className="w-full py-2 px-3 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-center block cursor-pointer transition shadow-sm">
                  {photoUrls.dpiT ? 'Cambiar Foto Reverso' : 'Tomar Foto Reverso'}
                </span>
              </label>
            </div>

            {/* Client Face Photo */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <p className="font-bold text-slate-800 dark:text-slate-200">3. Foto del Cliente</p>
              {photoUrls.foto ? (
                <div className="relative rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600 aspect-video bg-black flex items-center justify-center">
                  <img src={photoUrls.foto} alt="Cliente" className="max-h-full object-contain" />
                </div>
              ) : (
                <div className="aspect-video rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                  <Camera className="w-6 h-6 mb-1 opacity-50" />
                  <span className="text-[11px]">Sin foto del cliente</span>
                </div>
              )}

              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handlePhotoInput('foto', e.target.files[0]);
                  }}
                />
                <span className="w-full py-2 px-3 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-center block cursor-pointer transition shadow-sm">
                  {photoUrls.foto ? 'Cambiar Foto Rostro' : 'Tomar Foto Rostro'}
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Promissory Note & PDF Statement Export */}
      {activeTab === 'estado' && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-xs">
          {/* Action Toolbar */}
          <div className="space-y-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Documentos del Crédito y Pagaré
                </h3>
                <p className="text-[11px] text-slate-500">
                  Generación y descarga de archivos oficiales para la memoria del teléfono
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={async () => {
                    onToast('Generando todos los documentos del cliente...');
                    await Promise.all([
                      generateStatementPdf(client),
                      generateStatementDocx(client),
                      generateStatementXlsx(client),
                      generateContractPdf(client),
                      generateContractDocx(client),
                    ]);
                    onToast('Todos los documentos guardados en DOCUMENTOS/');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 dark:bg-slate-100 hover:bg-slate-900 text-white dark:text-slate-900 font-bold flex items-center gap-1.5 shadow-sm transition"
                  title="Descargar todos los documentos del cliente en PDF, Word y Excel"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Todos</span>
                </button>
              </div>
            </div>

            {/* Document Format Buttons Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {/* Estado PDF */}
              <button
                onClick={async () => {
                  onToast('Generando Estado de Cuenta en PDF...');
                  await generateStatementPdf(client);
                  onToast('Guardado en DOCUMENTOS/Estados_de_Cuenta/');
                }}
                className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-900 dark:text-rose-200 border border-rose-200 dark:border-rose-900 text-left transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">Estado de Cuenta</span>
                  <span className="text-[10px] font-mono font-bold bg-rose-200 dark:bg-rose-900 px-1 rounded">PDF</span>
                </div>
                <span className="text-[10px] text-rose-600 dark:text-rose-400 block mt-0.5">Descargar .pdf</span>
              </button>

              {/* Estado Word */}
              <button
                onClick={async () => {
                  onToast('Generando Estado de Cuenta en Word...');
                  await generateStatementDocx(client);
                  onToast('Guardado en DOCUMENTOS/Word/');
                }}
                className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-900 text-left transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">Estado de Cuenta</span>
                  <span className="text-[10px] font-mono font-bold bg-blue-200 dark:bg-blue-900 px-1 rounded">WORD</span>
                </div>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 block mt-0.5">Descargar .docx</span>
              </button>

              {/* Tabla Excel */}
              <button
                onClick={async () => {
                  onToast('Generando Tabla de Pagos en Excel...');
                  await generateStatementXlsx(client);
                  onToast('Guardado en DOCUMENTOS/Excel/');
                }}
                className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-900 text-left transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">Tabla de Pagos</span>
                  <span className="text-[10px] font-mono font-bold bg-emerald-200 dark:bg-emerald-900 px-1 rounded">EXCEL</span>
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-0.5">Descargar .xlsx</span>
              </button>

              {/* Contrato Legal PDF */}
              <button
                onClick={async () => {
                  onToast('Generando Contrato y Pagaré Legal...');
                  await generateContractPdf(client);
                  onToast('Guardado en DOCUMENTOS/Contratos/');
                }}
                className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900 text-left transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">Contrato Legal</span>
                  <span className="text-[10px] font-mono font-bold bg-amber-200 dark:bg-amber-900 px-1 rounded">PAGARÉ</span>
                </div>
                <span className="text-[10px] text-amber-700 dark:text-amber-400 block mt-0.5">Descargar .pdf</span>
              </button>
            </div>

            {/* Print & Share Toolbar */}
            <div className="flex items-center justify-between gap-1.5 flex-wrap pt-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => printStatement(client)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold flex items-center gap-1.5 transition"
                  title="Imprimir estado de cuenta con Android Print"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Estado</span>
                </button>

                <button
                  onClick={() => printContract(client)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold flex items-center gap-1.5 transition"
                  title="Imprimir contrato y pagaré con Android Print"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Contrato</span>
                </button>

                <button
                  onClick={async () => {
                    await generateContractDocx(client);
                    onToast('Contrato Word guardado en DOCUMENTOS/Word/');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5 transition"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Contrato Word (.docx)</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const text = getStatementPlainText(client);
                    navigator.clipboard.writeText(text);
                    setCopiedText(true);
                    onToast('Texto copiado al portapapeles');
                    setTimeout(() => setCopiedText(false), 2500);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5 transition"
                >
                  {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copiar texto</span>
                </button>
              </div>
            </div>
          </div>

          {/* Legal Promissory Note preview */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <p className="font-bold text-blue-900 dark:text-blue-300">PAGARÉ / COMPROMISO FORMAL DE PAGO:</p>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed italic">
              "{promissoryNoteText(client)}"
            </p>
          </div>

          {/* Customer Signature Canvas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Firma digital del cliente:
              </label>
              {client.firmaCliente && (
                <button
                  onClick={clearSignature}
                  className="text-xs text-rose-600 hover:underline font-semibold"
                >
                  Borrar firma
                </button>
              )}
            </div>

            <div className="border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden bg-white max-w-sm">
              <canvas
                ref={canvasRef}
                width={360}
                height={120}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={endDrawing}
                onMouseLeave={endDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={endDrawing}
                className="w-full touch-none cursor-crosshair"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              El cliente puede firmar directamente con el dedo sobre la pantalla de su teléfono Android.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
