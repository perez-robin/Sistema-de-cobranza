import React, { useState, useEffect } from 'react';
import {
  Folder,
  FileText,
  Download,
  Share2,
  Printer,
  Trash2,
  Edit2,
  Search,
  Filter,
  Plus,
  HardDrive,
  Check,
  AlertCircle,
  Eye,
  Info,
  Archive,
  RefreshCw,
} from 'lucide-react';
import { AppDocument, DocumentFormat } from '../types';
import {
  listDocuments,
  deleteDocument,
  renameDocument,
  downloadBlob,
  shareDocument,
  exportAllDocumentsZip,
  STANDARD_FOLDERS,
  requestDeviceDirectoryAccess,
  isDirectoryPickerSupported,
  getDocumentBlob,
} from '../utils/documentStorage';
import {
  generateReceiptPdf,
  generateReceiptDocx,
  generateReceiptXlsx,
  generateStatementPdf,
  generateStatementDocx,
  generateStatementXlsx,
  generateCollectionReportPdf,
  generateCollectionReportXlsx,
  generateClientListPdf,
  generateClientListXlsx,
  generateContractPdf,
} from '../utils/documentGenerators';
import { Client } from '../types';

interface Props {
  clients?: Client[];
  collectorName?: string;
  onToast: (msg: string) => void;
}

export const DocumentsView: React.FC<Props> = ({ clients = [], collectorName = 'Cobrador', onToast }) => {
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('todos');
  const [selectedFormat, setSelectedFormat] = useState<string>('todos');
  const [selectedDateFilter, setSelectedDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [isGeneratingSamples, setIsGeneratingSamples] = useState(false);

  // Modal states
  const [docToDelete, setDocToDelete] = useState<AppDocument | null>(null);
  const [docToRename, setDocToRename] = useState<AppDocument | null>(null);
  const [newDocName, setNewDocName] = useState('');
  const [docForInfo, setDocForInfo] = useState<AppDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ doc: AppDocument; url: string } | null>(null);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [customFolders, setCustomFolders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tucredito_custom_folders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [linkedDirectory, setLinkedDirectory] = useState<string | null>(null);
  const [isExportingZip, setIsExportingZip] = useState(false);

  const loadDocs = async () => {
    try {
      setLoading(true);
      const docs = await listDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error(err);
      onToast('Error al cargar la lista de documentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const allFolders = Array.from(new Set([...STANDARD_FOLDERS, ...customFolders]));

  // Filtering
  const filteredDocs = documents.filter((doc) => {
    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = doc.name.toLowerCase().includes(q);
      const matchClient = doc.clientName?.toLowerCase().includes(q);
      const matchPath = doc.virtualPath.toLowerCase().includes(q);
      if (!matchName && !matchClient && !matchPath) return false;
    }

    // Folder
    if (selectedFolder !== 'todos') {
      if (doc.folder !== selectedFolder) return false;
    }

    // Format
    if (selectedFormat !== 'todos') {
      if (doc.format !== selectedFormat) return false;
    }

    // Date
    if (selectedDateFilter !== 'all') {
      const docDate = new Date(doc.createdAt);
      const now = new Date();
      if (selectedDateFilter === 'today') {
        const isToday =
          docDate.getDate() === now.getDate() &&
          docDate.getMonth() === now.getMonth() &&
          docDate.getFullYear() === now.getFullYear();
        if (!isToday) return false;
      } else if (selectedDateFilter === 'week') {
        const diffDays = (now.getTime() - docDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7) return false;
      } else if (selectedDateFilter === 'month') {
        const diffDays = (now.getTime() - docDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 30) return false;
      }
    }

    return true;
  });

  // Calculate totals
  const totalBytes = documents.reduce((acc, d) => acc + (d.size || 0), 0);
  const totalKB = (totalBytes / 1024).toFixed(1);
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);

  // Actions
  const handleDownloadDoc = async (doc: AppDocument) => {
    const blob = doc.blob || (await getDocumentBlob(doc.id));
    if (!blob) {
      onToast('No se pudo acceder al archivo para descarga');
      return;
    }
    downloadBlob(blob, doc.name);
    onToast(`Descargando ${doc.name} en la memoria del teléfono`);
  };

  const handleShareDoc = async (doc: AppDocument) => {
    onToast('Abriendo menú de compartir de Android...');
    const ok = await shareDocument(doc);
    if (!ok) {
      onToast('Archivo descargado para compartir por WhatsApp o Gmail.');
    }
  };

  const handlePrintDoc = async (doc: AppDocument) => {
    const blob = doc.blob || (await getDocumentBlob(doc.id));
    if (!blob) {
      onToast('Documento no disponible para imprimir');
      return;
    }

    if (doc.format === 'pdf') {
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.focus();
        setTimeout(() => {
          try {
            printWindow.print();
          } catch {
            // ignore
          }
        }, 800);
      } else {
        downloadBlob(blob, doc.name);
        onToast('Abriendo PDF para imprimir desde el visor del teléfono');
      }
    } else {
      // For Word / Excel, trigger download with print notice
      downloadBlob(blob, doc.name);
      onToast(`El documento ${doc.format.toUpperCase()} se descargó para imprimir desde la aplicación correspondiente`);
    }
  };

  const handleOpenPreview = async (doc: AppDocument) => {
    const blob = doc.blob || (await getDocumentBlob(doc.id));
    if (!blob) {
      onToast('No se puede abrir el documento');
      return;
    }

    if (doc.format === 'pdf') {
      const url = URL.createObjectURL(blob);
      setPreviewDoc({ doc, url });
    } else {
      downloadBlob(blob, doc.name);
      onToast(`Abriendo ${doc.name}...`);
    }
  };

  const confirmDelete = async () => {
    if (!docToDelete) return;
    try {
      await deleteDocument(docToDelete.id);
      setDocuments((prev) => prev.filter((d) => d.id !== docToDelete.id));
      onToast(`Documento ${docToDelete.name} eliminado de la memoria.`);
    } catch {
      onToast('Error al eliminar el documento');
    } finally {
      setDocToDelete(null);
    }
  };

  const confirmRename = async () => {
    if (!docToRename || !newDocName.trim()) return;
    try {
      await renameDocument(docToRename.id, newDocName.trim());
      await loadDocs();
      onToast(`Documento renombrado a ${newDocName.trim()}`);
    } catch {
      onToast('Error al renombrar el documento');
    } finally {
      setDocToRename(null);
      setNewDocName('');
    }
  };

  const handleCreateFolder = () => {
    const clean = newFolderName.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!clean) return;
    if (allFolders.includes(clean)) {
      onToast('Esa carpeta ya existe');
      return;
    }
    const updated = [...customFolders, clean];
    setCustomFolders(updated);
    try {
      localStorage.setItem('tucredito_custom_folders', JSON.stringify(updated));
    } catch {
      // ignore
    }
    onToast(`Carpeta DOCUMENTOS/${clean}/ creada`);
    setIsNewFolderOpen(false);
    setNewFolderName('');
    setSelectedFolder(clean);
  };

  const handleExportZip = async () => {
    try {
      setIsExportingZip(true);
      onToast('Comprimiendo todos los documentos en formato ZIP...');
      const zipBlob = await exportAllDocumentsZip();
      const dateStr = new Date().toISOString().split('T')[0];
      downloadBlob(zipBlob, `DOCUMENTOS_TU_CREDITO_${dateStr}.zip`);
      onToast('Descarga completada: todos los documentos organizados por carpetas.');
    } catch (err) {
      console.error(err);
      onToast('Error al generar el archivo ZIP');
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleGenerateInitialDocuments = async () => {
    if (clients.length === 0) {
      onToast('No hay clientes registrados para generar documentos');
      return;
    }
    try {
      setIsGeneratingSamples(true);
      onToast('Generando documentos oficiales en PDF, Word y Excel...');
      const target = clients[0];
      const today = new Date().toISOString().split('T')[0];

      await Promise.all([
        generateReceiptPdf(target, collectorName),
        generateReceiptDocx(target, collectorName),
        generateReceiptXlsx(target, collectorName),
        generateStatementPdf(target),
        generateStatementDocx(target),
        generateStatementXlsx(target),
        generateContractPdf(target),
        generateCollectionReportPdf(clients, target.tipo, today, collectorName, 'diario'),
        generateCollectionReportXlsx(clients, target.tipo, today, collectorName, 'diario'),
        generateClientListPdf(clients, target.tipo),
        generateClientListXlsx(clients, target.tipo),
      ]);

      await loadDocs();
      onToast('Documentos generados con éxito en DOCUMENTOS/.');
    } catch (err) {
      console.error(err);
      onToast('Error al generar los documentos iniciales');
    } finally {
      setIsGeneratingSamples(false);
    }
  };

  const handleLinkDirectory = async () => {
    if (!isDirectoryPickerSupported()) {
      onToast('Tu navegador o versión de Android gestiona las descargas en la carpeta Descargas/DOCUMENTOS.');
      return;
    }
    const folderName = await requestDeviceDirectoryAccess();
    if (folderName) {
      setLinkedDirectory(folderName);
      onToast(`Carpeta ${folderName} vinculada con éxito. Los documentos se guardarán directamente en ella.`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4 pb-24 text-xs">
      {/* Top Banner & Storage Info */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-blue-600" />
              <span>Administrador de Documentos</span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Almacenamiento interno permanente: <span className="font-mono font-bold text-blue-700 dark:text-blue-400">DOCUMENTOS/</span>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportZip}
              disabled={isExportingZip || documents.length === 0}
              className="px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold flex items-center gap-1.5 transition shadow-sm"
              title="Descargar todos los archivos organizados por carpetas"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{isExportingZip ? 'Comprimiendo...' : 'Descargar Todos (.ZIP)'}</span>
            </button>

            <button
              onClick={() => setIsNewFolderOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva Carpeta</span>
            </button>

            {isDirectoryPickerSupported() && (
              <button
                onClick={handleLinkDirectory}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5 transition"
                title="Vincular con carpeta física en la memoria del teléfono"
              >
                <Folder className="w-3.5 h-3.5 text-amber-500" />
                <span>{linkedDirectory ? `Carpeta: ${linkedDirectory}` : 'Vincular Carpeta Teléfono'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Storage Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span className="text-[10px] text-slate-400 block font-medium">Total Documentos</span>
            <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{documents.length} archivos</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span className="text-[10px] text-slate-400 block font-medium">Espacio Utilizado</span>
            <span className="font-bold text-sm text-blue-700 dark:text-blue-400">
              {Number(totalMB) > 1 ? `${totalMB} MB` : `${totalKB} KB`}
            </span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span className="text-[10px] text-slate-400 block font-medium">Carpetas Activas</span>
            <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{allFolders.length} subcarpetas</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span className="text-[10px] text-slate-400 block font-medium">Estado del Sistema</span>
            <span className="font-bold text-sm text-emerald-600">Almacenamiento Activo</span>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre de archivo, cliente o recibo..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
        </div>

        {/* Folder Filter Scrollable Pills */}
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Organización por Carpetas:
          </span>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedFolder('todos')}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                selectedFolder === 'todos'
                  ? 'bg-blue-700 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              Todas las carpetas ({documents.length})
            </button>
            {allFolders.map((folder) => {
              const count = documents.filter((d) => d.folder === folder).length;
              return (
                <button
                  key={folder}
                  onClick={() => setSelectedFolder(folder)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition ${
                    selectedFolder === folder
                      ? 'bg-blue-700 text-white shadow-sm font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  <Folder className="w-3 h-3 opacity-70" />
                  <span>{folder}</span>
                  {count > 0 && <span className="opacity-80 text-[10px]">({count})</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Format and Date filters row */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Tipo de archivo:</span>
            {(['todos', 'pdf', 'docx', 'xlsx'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setSelectedFormat(fmt)}
                className={`px-2.5 py-0.5 rounded-lg font-bold text-[11px] uppercase transition ${
                  selectedFormat === fmt
                    ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {fmt === 'todos' ? 'Todos' : fmt === 'docx' ? 'Word' : fmt === 'xlsx' ? 'Excel' : 'PDF'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500">Fecha:</span>
            <select
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value as any)}
              className="px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium"
            >
              <option value="all">Todas las fechas</option>
              <option value="today">Creados hoy</option>
              <option value="week">Últimos 7 días</option>
              <option value="month">Este mes</option>
            </select>

            <button
              onClick={loadDocs}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Recargar archivos"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Documents List */}
      <div className="space-y-2">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Cargando documentos de la memoria...</div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
            <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="font-bold text-slate-700 dark:text-slate-300">No se encontraron documentos</p>
            <p className="text-slate-400 text-xs max-w-sm mx-auto">
              {searchQuery || selectedFolder !== 'todos' || selectedFormat !== 'todos'
                ? 'No hay archivos que coincidan con los filtros seleccionados.'
                : 'Los recibos, estados de cuenta, reportes y contratos que generes se guardarán automáticamente aquí en DOCUMENTOS/.'}
            </p>
            {documents.length === 0 && clients.length > 0 && (
              <div className="pt-2">
                <button
                  onClick={handleGenerateInitialDocuments}
                  disabled={isGeneratingSamples}
                  className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 mx-auto shadow-md transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingSamples ? 'animate-spin' : ''}`} />
                  <span>{isGeneratingSamples ? 'Generando documentos...' : 'Generar Suite de Documentos Iniciales'}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredDocs.map((doc) => {
            const formatBadge =
              doc.format === 'pdf'
                ? { label: 'PDF', bg: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200' }
                : doc.format === 'docx'
                ? { label: 'WORD', bg: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200' }
                : { label: 'EXCEL', bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200' };

            const formattedDate = new Date(doc.createdAt).toLocaleString('es-GT', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            const sizeKB = (doc.size / 1024).toFixed(1);

            return (
              <div
                key={doc.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <span
                      className={`px-2 py-0.5 rounded-lg border font-black text-[10px] tracking-wide mt-0.5 ${formatBadge.bg}`}
                    >
                      {formatBadge.label}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate" title={doc.name}>
                        {doc.name}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate" title={doc.virtualPath}>
                        {doc.virtualPath}
                      </p>
                    </div>
                  </div>

                  <div className="text-right whitespace-nowrap text-[11px] text-slate-400">
                    <div>{formattedDate}</div>
                    <div className="font-mono text-[10px]">{sizeKB} KB</div>
                  </div>
                </div>

                {doc.description && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 px-2 py-1 rounded-lg">
                    {doc.description}
                  </p>
                )}

                {/* Document Action Buttons Toolbar */}
                <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-100 dark:border-slate-800 flex-wrap">
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      onClick={() => handleOpenPreview(doc)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold text-[11px] flex items-center gap-1 transition"
                      title="Abrir o previsualizar documento"
                    >
                      <Eye className="w-3 h-3 text-slate-500" />
                      <span>Abrir</span>
                    </button>

                    <button
                      onClick={() => handleDownloadDoc(doc)}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 font-bold text-[11px] flex items-center gap-1 transition border border-blue-200 dark:border-blue-900"
                      title="Descargar documento a la memoria del teléfono"
                    >
                      <Download className="w-3 h-3" />
                      <span>Descargar</span>
                    </button>

                    <button
                      onClick={() => handlePrintDoc(doc)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold text-[11px] flex items-center gap-1 transition"
                      title="Imprimir documento con sistema Android Print"
                    >
                      <Printer className="w-3 h-3" />
                      <span>Imprimir</span>
                    </button>

                    <button
                      onClick={() => handleShareDoc(doc)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] flex items-center gap-1 transition border border-emerald-200 dark:border-emerald-900"
                      title="Compartir por WhatsApp, Gmail, Drive, etc."
                    >
                      <Share2 className="w-3 h-3" />
                      <span>Compartir</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setDocForInfo(doc)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Ver ubicación en memoria interna"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        setDocToRename(doc);
                        setNewDocName(doc.name);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Renombrar archivo"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setDocToDelete(doc)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      title="Eliminar documento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CONFIRM DELETE MODAL */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-4 space-y-3 shadow-xl border border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <AlertCircle className="w-5 h-5" />
              <span>Confirmar Eliminación</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              ¿Está seguro de eliminar el archivo <strong className="text-slate-900 dark:text-slate-100 font-mono">{docToDelete.name}</strong>?
            </p>
            <p className="text-slate-400 text-[11px]">
              Ubicación: <span className="font-mono">{docToDelete.virtualPath}</span>. Esta acción no se puede deshacer.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDocToDelete(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-sm"
              >
                Eliminar Archivo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENAME MODAL */}
      {docToRename && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-4 space-y-3 shadow-xl border border-slate-200 dark:border-slate-800 text-xs">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Renombrar Documento</h3>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Nuevo nombre:</label>
              <input
                type="text"
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDocToRename(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={confirmRename}
                className="px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-sm"
              >
                Guardar Nombre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW FOLDER MODAL */}
      {isNewFolderOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-4 space-y-3 shadow-xl border border-slate-200 dark:border-slate-800 text-xs">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Crear Nueva Carpeta</h3>
            <p className="text-slate-500 text-[11px]">
              Se creará dentro del directorio principal <span className="font-mono font-bold">DOCUMENTOS/</span>
            </p>
            <div>
              <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Nombre de la carpeta:</label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Ej. Cobros_Especiales"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsNewFolderOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-sm"
              >
                Crear Carpeta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOCATION INFO MODAL */}
      {docForInfo && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-4 space-y-3 shadow-xl border border-slate-200 dark:border-slate-800 text-xs">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-blue-600" />
              <span>Ubicación del Archivo</span>
            </h3>

            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 space-y-1 font-mono text-[11px]">
              <div className="text-slate-400">Directorio relativo:</div>
              <div className="font-bold text-blue-700 dark:text-blue-400 break-all">{docForInfo.virtualPath}</div>
              <div className="text-slate-400 pt-1">Ubicación en almacenamiento interno:</div>
              <div className="text-slate-700 dark:text-slate-300 break-all">
                Memoria interna / {docForInfo.virtualPath}
              </div>
            </div>

            <p className="text-slate-500 text-[11px]">
              El archivo se conserva en la memoria interna compartida y en la base de datos local permanente del teléfono.
            </p>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setDocForInfo(null)}
                className="px-4 py-1.5 rounded-xl bg-blue-700 text-white font-bold shadow-sm"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF PREVIEW MODAL */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/75 flex flex-col p-2 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl flex-1 flex flex-col overflow-hidden shadow-2xl">
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="font-bold text-sm truncate">{previewDoc.doc.name}</div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleDownloadDoc(previewDoc.doc)}
                  className="px-3 py-1 rounded-xl bg-blue-700 text-white font-bold text-xs flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar</span>
                </button>
                <button
                  onClick={() => handleShareDoc(previewDoc.doc)}
                  className="px-3 py-1 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center gap-1"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Compartir</span>
                </button>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="px-3 py-1 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs"
                >
                  Cerrar
                </button>
              </div>
            </div>
            <iframe src={previewDoc.url} className="flex-1 w-full border-none" title="Vista previa de documento" />
          </div>
        </div>
      )}
    </div>
  );
};
