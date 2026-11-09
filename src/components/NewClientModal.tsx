import React, { useState } from 'react';
import { Client, LoanType } from '../types';
import { createBlankRows, cuotaDe, formatCUI, isoToday } from '../utils/calculations';
import { X, UserPlus, Sparkles, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultMode: LoanType;
  onSave: (client: Client) => void;
}

export const NewClientModal: React.FC<Props> = ({ isOpen, onClose, defaultMode, onSave }) => {
  const [tipo, setTipo] = useState<LoanType>(defaultMode);
  const [nombre, setNombre] = useState('');
  const [dpi, setDpi] = useState('');
  const [lugar, setLugar] = useState('');
  const [tel, setTel] = useState('');
  const [cantidad, setCantidad] = useState<number | string>(1000);
  const [cuota, setCuota] = useState<number | string>(defaultMode === 's' ? 280 : 60);
  const [inicio, setInicio] = useState(isoToday());
  const [dom, setDom] = useState(true);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleAmountChange = (amt: number | string) => {
    setCantidad(amt);
    if (Number(amt) > 0) {
      setCuota(cuotaDe(amt, tipo));
    }
  };

  const handleTipoChange = (newTipo: LoanType) => {
    setTipo(newTipo);
    if (Number(cantidad) > 0) {
      setCuota(cuotaDe(cantidad, newTipo));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setError('Por favor ingrese el nombre del cliente');
      return;
    }
    if (!(Number(cantidad) > 0)) {
      setError('El monto otorgado debe ser mayor a 0');
      return;
    }
    if (!(Number(cuota) > 0)) {
      setError('La cuota debe ser mayor a 0');
      return;
    }

    const newClient: Client = {
      id: 'c' + Date.now(),
      tipo,
      nombre: nombre.trim(),
      dpi: dpi.trim(),
      lugar: lugar.trim(),
      tel: tel.trim(),
      cantidad: Number(cantidad),
      cuota: Number(cuota),
      inicio: inicio || isoToday(),
      dom: tipo === 'd' ? dom : false,
      guardado: true,
      fotos: {},
      rows: createBlankRows(tipo),
    };

    onSave(newClient);
    onClose();
  };

  const presets = [500, 1000, 1500, 2000, 3000, 5000];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 text-amber-300">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Nuevo Préstamo</h2>
              <p className="text-xs text-blue-200">
                {tipo === 's' ? 'Crédito Semanal (6 semanas)' : 'Crédito Diario (23 cuotas)'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-white/80">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900 flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {/* Loan Type Selector */}
          <div>
            <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
              Modalidad de cobro:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTipoChange('d')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  tipo === 'd'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>Cobro Diario (23 días)</span>
              </button>
              <button
                type="button"
                onClick={() => handleTipoChange('s')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  tipo === 's'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>Cobro Semanal (6 semanas)</span>
              </button>
            </div>
          </div>

          {/* Preset Amounts */}
          <div>
            <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Montos frecuentes en Quetzales:</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {presets.map((amt) => (
                <button
                  type="button"
                  key={amt}
                  onClick={() => handleAmountChange(amt)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition ${
                    Number(cantidad) === amt
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Q{amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Amount & Quota Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                Cantidad otorgada (Q):
              </label>
              <input
                type="number"
                step="0.01"
                min="50"
                value={cantidad}
                onChange={(e) => handleAmountChange(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-bold focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                {tipo === 's' ? 'Cuota semanal (Q):' : 'Cuota diaria (Q):'}
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={cuota}
                onChange={(e) => setCuota(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-bold focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
            {tipo === 's'
              ? 'Tasa estándar: Q140 semanales por cada Q500 otorgados (Total financiado: 6 cuotas).'
              : 'Tasa estándar: Q30 diarios por cada Q500 otorgados (Total financiado: 23 cuotas).'}
          </p>

          {/* Client Details */}
          <div>
            <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
              Nombre completo del cliente: *
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Ana Victoria González López"
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-600 focus:outline-none font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                DPI / CUI (13 dígitos):
              </label>
              <input
                type="text"
                value={dpi}
                onChange={(e) => setDpi(formatCUI(e.target.value))}
                placeholder="1234 56789 0101"
                maxLength={15}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                Teléfono:
              </label>
              <input
                type="tel"
                value={tel}
                onChange={(e) => setTel(e.target.value)}
                placeholder="Ej. 5555 1234"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
              Lugar / Negocio o Dirección:
            </label>
            <input
              type="text"
              value={lugar}
              onChange={(e) => setLugar(e.target.value)}
              placeholder="Ej. Mercado Central, Puesto #42"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          {/* Dates & Sunday Option */}
          <div className="grid grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                Fecha de inicio:
              </label>
              <input
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            {tipo === 'd' && (
              <div className="pt-4">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={dom}
                    onChange={(e) => setDom(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>No cobrar domingos</span>
                </label>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-bold transition shadow-sm"
            >
              Crear Préstamo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
