import React, { useState } from 'react';
import { Smartphone, Download, Sparkles, CheckCircle2, Copy, Check, Terminal, ExternalLink, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallGuideModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { isInstallable, install, isInstalled } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'pwa' | 'apk' | 'twa'>('pwa');
  const [copied, setCopied] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2500);
  };

  const capacitorCommands = `# 1. Instalar Capacitor en este proyecto:
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. Inicializar Capacitor:
npx cap init "Tu Crédito" "com.tucredito.cobros" --web-dir dist

# 3. Compilar los archivos de la app:
npm run build

# 4. Agregar la plataforma Android:
npx cap add android

# 5. Abrir el proyecto en Android Studio para generar el archivo .APK:
npx cap open android`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-blue-950 font-black flex items-center justify-center text-xl shadow-md">
              Q
            </div>
            <div>
              <h2 className="text-lg font-bold">Convertir en App Nativa para Android</h2>
              <p className="text-xs text-blue-200">Guía práctica paso a paso para teléfonos móviles</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Button If Installable Right Now */}
        {isInstallable && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-sm font-medium">
              <Sparkles className="w-5 h-5 text-emerald-600 animate-pulse" />
              <span>¡Tu navegador ya está listo para instalar esta app en Android!</span>
            </div>
            <button
              onClick={() => {
                install();
                onClose();
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition shrink-0"
            >
              Instalar Ahora
            </button>
          </div>
        )}

        {isInstalled && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-800 flex items-center gap-2 text-blue-700 dark:text-blue-300 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <span>Ya estás ejecutando la aplicación en modo App Android (Standalone).</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-1 gap-1">
          <button
            onClick={() => setActiveTab('pwa')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'pwa'
                ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            1. PWA / WebAPK (Inmediato)
          </button>
          <button
            onClick={() => setActiveTab('apk')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'apk'
                ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Download className="w-4 h-4" />
            2. Generar .APK (Capacitor)
          </button>
        </div>

        {/* Content Tab 1: PWA */}
        {activeTab === 'pwa' && (
          <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto text-sm">
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-3.5 border border-blue-100 dark:border-blue-900">
              <h3 className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2 text-sm mb-1">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                Método Oficial: WebAPK de Android (Sin Play Store)
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Esta app ya incluye un <strong>Web App Manifest</strong> y un <strong>Service Worker con caché offline</strong>. Cuando un cobrador la abre en Google Chrome en su teléfono Android, Android genera automáticamente un paquete APK nativo (WebAPK) que se instala en el cajón de aplicaciones.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                Pasos para instalar en el teléfono del cobrador:
              </h4>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">1</span>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs">Abre el enlace en Google Chrome</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Entra a la URL de la app desde el teléfono Android.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">2</span>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs">Toca los 3 puntos (⋮) del menú de Chrome</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    En la esquina superior derecha del navegador.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">3</span>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs">Selecciona «Instalar aplicación» o «Agregar a la pantalla principal»</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Se creará el icono oficial de <strong>Tu Crédito</strong> con fondo azul y el escudo del Quetzal.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">4</span>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs">Listo: Funciona 100% en ruta sin señal</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Los clientes, recibos y fotos se guardan en el dispositivo aunque el cobrador esté en áreas sin cobertura celular.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content Tab 2: Standalone APK via Capacitor */}
        {activeTab === 'apk' && (
          <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto text-sm">
            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 p-3.5 border border-indigo-100 dark:border-indigo-900">
              <h3 className="font-bold text-indigo-900 dark:text-indigo-200 text-sm mb-1">
                ¿Necesitas un archivo instalador .APK independiente?
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Puedes compilar este código en un archivo <strong>app-release.apk</strong> instalable directamente por USB o WhatsApp usando <strong>Capacitor</strong>.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-blue-600" />
                  Comandos para generar el APK:
                </span>
                <button
                  onClick={() => copyCode(capacitorCommands, 'cap')}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  {copied === 'cap' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ¡Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar comandos
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
                {capacitorCommands}
              </pre>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
              <strong>Consejo para distribución:</strong> Una vez generado el archivo <code>.apk</code> en Android Studio (menú <em>Build &gt; Build Bundle(s) / APK(s) &gt; Build APK(s)</em>), puedes pasarlo directamente por WhatsApp a los cobradores para que lo instalen en sus teléfonos en 10 segundos.
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition shadow-sm"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
