import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  Terminal,
  FolderOpen,
  Share2,
  ShieldAlert,
  ChevronRight,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallGuideModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { isInstallable, install, isInstalled } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'apk' | 'pwa'>('apk');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const steps = [
    {
      num: 1,
      title: 'Descargar el proyecto en tu computadora',
      desc: 'Descarga o clona la carpeta de este proyecto en tu computadora donde vayas a compilar.',
      cmd: '',
    },
    {
      num: 2,
      title: 'Instalar Capacitor en la terminal del proyecto',
      desc: 'Abre la terminal en la carpeta del proyecto y ejecuta este comando para agregar el motor de Android:',
      cmd: 'npm install @capacitor/core @capacitor/cli @capacitor/android',
    },
    {
      num: 3,
      title: 'Inicializar la configuración de la app',
      desc: 'Asigna el nombre y el identificador de paquete oficial:',
      cmd: 'npx cap init "Tu Crédito" "com.tucredito.cobros" --web-dir dist',
    },
    {
      num: 4,
      title: 'Compilar la aplicación',
      desc: 'Genera la carpeta dist optimizada con todos los módulos, iconos y pantallas:',
      cmd: 'npm run build',
    },
    {
      num: 5,
      title: 'Crear la carpeta nativa de Android',
      desc: 'Capacitor creará automáticamente la estructura de proyecto lista para Android Studio:',
      cmd: 'npx cap add android',
    },
    {
      num: 6,
      title: 'Abrir el proyecto en Android Studio',
      desc: 'Este comando abrirá automáticamente Android Studio con todo configurado:',
      cmd: 'npx cap open android',
    },
  ];

  const fullScript = `# 1. Instalar Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. Inicializar Capacitor
npx cap init "Tu Crédito" "com.tucredito.cobros" --web-dir dist

# 3. Compilar la aplicación
npm run build

# 4. Crear el proyecto Android
npx cap add android

# 5. Abrir en Android Studio
npx cap open android`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-950 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-blue-950 font-black flex items-center justify-center text-xl shadow-md">
              Q
            </div>
            <div>
              <h2 className="text-base font-black">Generar APK para Android (Paso a Paso)</h2>
              <p className="text-xs text-blue-200">Guía completa para compilar e instalar en teléfonos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-1.5 gap-1.5">
          <button
            onClick={() => setActiveTab('apk')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'apk'
                ? 'bg-blue-700 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Opción 2: Generar archivo .APK (Paso a Paso)</span>
          </button>
          <button
            onClick={() => setActiveTab('pwa')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'pwa'
                ? 'bg-blue-700 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Opción 1: Instalar directo en Chrome (WebAPK)</span>
          </button>
        </div>

        {/* TAB 1: Standalone APK step by step */}
        {activeTab === 'apk' && (
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
            {/* Quick Overview Card */}
            <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
              <h3 className="font-bold text-blue-900 dark:text-blue-200 text-sm mb-1 flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-blue-600" />
                <span>¿Cómo funciona la compilación del archivo .APK?</span>
              </h3>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                Usamos <strong>Capacitor</strong> (creado por el equipo de Ionic), la herramienta estándar para empaquetar aplicaciones React/Vite en un proyecto nativo de Android. Luego, con <strong>Android Studio</strong> generas el archivo instalable <code>app-debug.apk</code> o <code>app-release.apk</code>.
              </p>
            </div>

            {/* Prerequisites */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs block">
                Requisitos en tu computadora:
              </span>
              <ul className="list-disc list-inside text-slate-600 dark:text-slate-300 space-y-0.5 text-[11px]">
                <li><strong>Node.js</strong> versión 18 o superior instalado.</li>
                <li><strong>Android Studio</strong> (gratuito) con el SDK de Android instalado.</li>
              </ul>
            </div>

            {/* Full Copy All Button */}
            <div className="flex items-center justify-between pt-1">
              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                Pasos de terminal (Comandos):
              </span>
              <button
                onClick={() => copyCode(fullScript, 'full')}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center gap-1 border border-slate-300 dark:border-slate-700 transition"
              >
                {copiedId === 'full' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>¡Todos los comandos copiados!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar todos los comandos juntos</span>
                  </>
                )}
              </button>
            </div>

            {/* Step by step cards */}
            <div className="space-y-3">
              {steps.map((st) => (
                <div
                  key={st.num}
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-2"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                      {st.num}
                    </span>
                    <div className="flex-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100 text-xs">{st.title}</p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">{st.desc}</p>
                    </div>
                  </div>

                  {st.cmd && (
                    <div className="relative">
                      <pre className="p-2.5 bg-slate-950 text-emerald-400 rounded-xl text-[11px] font-mono overflow-x-auto border border-slate-800 pr-16">
                        {st.cmd}
                      </pre>
                      <button
                        onClick={() => copyCode(st.cmd, `step-${st.num}`)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-semibold flex items-center gap-1"
                      >
                        {copiedId === `step-${st.num}` ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedId === `step-${st.num}` ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Step 7: Android Studio GUI */}
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 space-y-2">
                <div className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                    7
                  </span>
                  <div>
                    <p className="font-bold text-amber-900 dark:text-amber-200 text-xs">
                      En Android Studio: Generar el archivo .APK
                    </p>
                    <p className="text-amber-800/80 dark:text-amber-300/80 text-[11px] mt-0.5">
                      Una vez que Android Studio termine de indexar el proyecto:
                    </p>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 font-medium text-[11px] text-slate-800 dark:text-slate-200 space-y-1">
                  <p>1. Ve al menú superior: <strong>Build</strong></p>
                  <p>2. Selecciona: <strong>Build Bundle(s) / APK(s)</strong></p>
                  <p>3. Haz clic en: <strong>Build APK(s)</strong></p>
                  <p className="text-emerald-600 dark:text-emerald-400 font-bold pt-1">
                    ✓ En 1-2 minutos Android Studio te mostrará un aviso con el enlace «locate» para abrir la carpeta del APK.
                  </p>
                </div>
              </div>

              {/* Step 8: APK File Location */}
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700 space-y-2">
                <div className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    8
                  </span>
                  <div>
                    <p className="font-bold text-emerald-900 dark:text-emerald-200 text-xs">
                      ¿Dónde queda guardado el archivo .APK?
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-0.5">
                      El instalador queda en esta ruta dentro de tu proyecto:
                    </p>
                  </div>
                </div>

                <pre className="p-2.5 bg-slate-950 text-amber-300 rounded-xl text-[11px] font-mono overflow-x-auto border border-slate-800">
                  android/app/build/outputs/apk/debug/app-debug.apk
                </pre>
              </div>

              {/* Step 9: Install on phone */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    9
                  </span>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                      Instalación en el teléfono de los cobradores
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                      Cómo pasarlo y ejecutarlo:
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 text-slate-700 dark:text-slate-300 text-[11px]">
                  <p className="flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Envía el archivo <code>app-debug.apk</code> por <strong>WhatsApp</strong>, cable USB o Google Drive.</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>En el teléfono, al abrir el archivo, pulsa <strong>«Permitir instalar aplicaciones desconocidas»</strong> si te lo solicita Android.</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Toca <strong>«Instalar»</strong> y listo: tendrás la aplicación nativa con su icono oficial en el celular.</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PWA */}
        {activeTab === 'pwa' && (
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
            <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/30 p-3.5 border border-blue-100 dark:border-blue-900">
              <h3 className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2 text-sm mb-1">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                Opción Rápida: Instalar directamente desde Chrome
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                No necesitas compilar nada en la computadora si solo quieres que los cobradores la usen en sus teléfonos de inmediato:
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">1</span>
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">Abre la app en Google Chrome en el teléfono</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Ingresa a la URL compartida de la aplicación.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">2</span>
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">Toca el botón «Instalar» o el menú de 3 puntos (⋮)</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Selecciona «Instalar aplicación» o «Agregar a pantalla de inicio».</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">3</span>
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">Android crea el WebAPK nativo</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Se instala con su icono azul y escudo de Quetzal, pantalla completa y caché 100% offline.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <span className="text-[11px] text-slate-400">
            Tu Crédito Móvil · Generación de paquetes Android
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition shadow-sm"
          >
            Cerrar Guía
          </button>
        </div>
      </div>
    </div>
  );
};
