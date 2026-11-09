import React, { useState } from 'react';
import { CashClosing, Client } from '../types';
import { blobToDataUrl, dataUrlToBlob, getPhoto, putPhoto } from '../utils/idb';
import { isoToday } from '../utils/calculations';
import {
  Download,
  Upload,
  User,
  Smartphone,
  Trash2,
  Sparkles,
  ShieldCheck,
  Check,
  AlertTriangle,
  FolderArchive,
} from 'lucide-react';

interface Props {
  collectorName: string;
  setCollectorName: (name: string) => void;
  clients: Client[];
  closings: CashClosing[];
  onRestore: (clients: Client[], closings: CashClosing[], collector: string) => void;
  onSeedDemo: () => void;
  onClearAll: () => void;
  onOpenInstallGuide: () => void;
  onToast: (msg: string) => void;
}

export const SettingsView: React.FC<Props> = ({
  collectorName,
  setCollectorName,
  clients,
  closings,
  onRestore,
  onSeedDemo,
  onClearAll,
  onOpenInstallGuide,
  onToast,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState<string>(() => {
    try {
      return localStorage.getItem('tucredito_cobros_v1_lastbak') || '';
    } catch {
      return '';
    }
  });
  const [confirmClear, setConfirmClear] = useState(false);

  // Full backup generator including IndexedDB binary photos
  const handleExportBackup = async () => {
    setIsExporting(true);
    onToast('Generando respaldo completo de clientes y fotos...');
    try {
      const photosMap: Record<string, string> = {};
      const slots = ['dpiF', 'dpiT', 'foto'] as const;

      for (const client of clients) {
        for (const slot of slots) {
          if (client.fotos && client.fotos[slot]) {
            try {
              const blob = await getPhoto(`${client.id}:${slot}`);
              if (blob) {
                photosMap[`${client.id}:${slot}`] = await blobToDataUrl(blob);
              }
            } catch (e) {
              console.error(e);
            }
          }
        }
      }

      const backupData = {
        app: 'tucredito_movil',
        version: 2,
        fecha: isoToday(),
        clients,
        closings,
        collectorName,
        photos: photosMap,
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `respaldo-tucredito-${isoToday()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      const timestamp = new Date().toLocaleString('es-GT');
      setLastBackupDate(timestamp);
      try {
        localStorage.setItem('tucredito_cobros_v1_lastbak', timestamp);
      } catch {
        // ignore
      }
      onToast('✅ Respaldo descargado exitosamente. Guárdalo en WhatsApp o Google Drive.');
    } catch (err) {
      console.error(err);
      onToast('Error al generar el respaldo');
    } finally {
      setIsExporting(false);
    }
  };

  // Restore backup from JSON file
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);

        if (!data || !Array.isArray(data.clients)) {
          throw new Error('Formato de archivo inválido');
        }

        // Restore IndexedDB photos if present
        if (data.photos && typeof data.photos === 'object') {
          for (const [key, dataUrl] of Object.entries(data.photos)) {
            if (typeof dataUrl === 'string') {
              try {
                const blob = dataUrlToBlob(dataUrl);
                await putPhoto(key, blob);
              } catch (e) {
                console.error('Error restaurando foto:', e);
              }
            }
          }
        }

        onRestore(data.clients, Array.isArray(data.closings) ? data.closings : [], data.collectorName || '');
        onToast(`✅ Respaldo restaurado con éxito: ${data.clients.length} clientes recuperados.`);
      } catch (err) {
        console.error(err);
        onToast('El archivo seleccionado no es un respaldo válido de Tu Crédito.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4 pb-12 text-xs">
      {/* Android Installation Hero Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-md flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-400 text-blue-950 font-black flex items-center justify-center text-2xl shadow-lg">
            Q
          </div>
          <div>
            <h3 className="text-base font-black">Instalación y Configuración Android</h3>
            <p className="text-xs text-blue-200">
              Instala la aplicación en el teléfono del cobrador como app nativa o genera un APK
            </p>
          </div>
        </div>

        <button
          onClick={onOpenInstallGuide}
          className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-blue-950 font-black text-xs shadow-md flex items-center gap-1.5 transition active:scale-95"
        >
          <Smartphone className="w-4 h-4 text-blue-950" />
          <span>Ver Guía de Instalación Android</span>
        </button>
      </div>

      {/* Collector Settings */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-sm">
          <User className="w-4 h-4 text-blue-600" />
          <span>Datos del Cobrador en Ruta</span>
        </div>

        <div>
          <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
            Nombre del cobrador / ruta:
          </label>
          <input
            type="text"
            value={collectorName}
            onChange={(e) => setCollectorName(e.target.value)}
            placeholder="Ej. Carlos Mendoza (Ruta 1 - Mixco)"
            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Este nombre se anota automáticamente como firma en los recibos emitidos y en el cierre de caja diario.
          </p>
        </div>
      </div>

      {/* Backup & Restore Card */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-sm">
          <FolderArchive className="w-4 h-4 text-emerald-600" />
          <span>Respaldo de Seguridad y Migración</span>
        </div>

        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
          Guarda la base de datos completa de tus clientes, cuotas abonadas, recibos y fotos en un único archivo JSON seguro. Puedes transferirlo fácilmente a otro teléfono Android o guardarlo en WhatsApp.
        </p>

        {lastBackupDate && (
          <p className="text-slate-500 font-medium text-[11px]">
            Último respaldo realizado: <strong>{lastBackupDate}</strong>
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap pt-1">
          <button
            onClick={handleExportBackup}
            disabled={isExporting}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Preparando...' : 'Descargar Archivo de Respaldo'}</span>
          </button>

          <label className="cursor-pointer">
            <input type="file" accept=".json,application/json" onChange={handleImportFile} className="hidden" />
            <span className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 transition">
              <Upload className="w-4 h-4" />
              <span>Restaurar desde Respaldo</span>
            </span>
          </label>
        </div>
      </div>

      {/* Demo Data & Utility */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-sm">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Datos de Demostración</span>
        </div>

        <p className="text-slate-600 dark:text-slate-300">
          ¿Deseas probar la aplicación con créditos de ejemplo? Carga clientes pre-configurados (al día, en atraso, para cobrar y listos para renovar).
        </p>

        <button
          onClick={onSeedDemo}
          className="px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 font-bold text-xs hover:bg-blue-100 transition"
        >
          Cargar Clientes de Ejemplo (Guatemala)
        </button>
      </div>

      {/* Danger Zone */}
      <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 space-y-2">
        <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-sm">
          <Trash2 className="w-4 h-4 text-rose-600" />
          <span>Zona de Peligro: Reiniciar Datos</span>
        </div>

        <p className="text-slate-600 dark:text-slate-400 text-xs">
          Elimina todos los clientes, cierres y fotos almacenados en este dispositivo.
        </p>

        {confirmClear ? (
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => {
                onClearAll();
                setConfirmClear(false);
              }}
              className="px-4 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-sm hover:bg-rose-700"
            >
              Sí, borrar todos los datos
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border text-slate-700 dark:text-slate-300 font-semibold text-xs"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmClear(true)}
            className="px-3 py-1.5 rounded-xl border border-rose-300 text-rose-700 dark:text-rose-400 font-bold hover:bg-rose-100 dark:hover:bg-rose-950 transition"
          >
            Borrar todos los clientes y empezar de cero
          </button>
        )}
      </div>
    </div>
  );
};
