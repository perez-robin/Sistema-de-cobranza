import JSZip from 'jszip';
import { AppDocument, DocumentFormat, StandardFolder } from '../types';

export const STANDARD_FOLDERS: StandardFolder[] = [
  'Clientes',
  'Recibos',
  'Cobros_Diarios',
  'Cobros_Semanales',
  'Reportes',
  'Estados_de_Cuenta',
  'Contratos',
  'Comprobantes',
  'Excel',
  'Word',
  'PDF',
  'Respaldos',
];

const DB_NAME = 'tucredito_documentos';
const DB_VERSION = 1;
const STORE_NAME = 'docs';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('folder', 'folder', { unique: false });
          store.createIndex('format', 'format', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (err) {
      reject(err);
    }
  });
  return dbPromise;
}

// Download blob directly to device storage
export function downloadBlob(blob: Blob, filename: string): void {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }, 2000);
  } catch (err) {
    console.error('Error downloading blob:', err);
  }
}

// Share document via Android Native Share Sheet
export async function shareDocument(doc: AppDocument, blobOverride?: Blob): Promise<boolean> {
  try {
    const blob = blobOverride || doc.blob || (await getDocumentBlob(doc.id));
    if (!blob) {
      throw new Error('Archivo no disponible para compartir');
    }

    const file = new File([blob], doc.name, { type: doc.mimeType || 'application/octet-stream' });

    // Check for native Web Share API with files support (Android Chrome, WebViews, Capacitor)
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: doc.name,
        text: `Comprobante Tu Crédito: ${doc.name}`,
      });
      return true;
    }

    // Fallback: trigger download and notify
    downloadBlob(blob, doc.name);
    return false;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return true; // User cancelled share sheet
    }
    console.warn('Native share failed, triggering download fallback:', err);
    if (doc.blob) {
      downloadBlob(doc.blob, doc.name);
    }
    return false;
  }
}

// Save document into IndexedDB & optionally download
export async function saveDocument(
  data: {
    name: string;
    folder: string;
    format: DocumentFormat;
    mimeType: string;
    blob: Blob;
    clientId?: string;
    clientName?: string;
    description?: string;
  },
  triggerDownload: boolean = true
): Promise<AppDocument> {
  const db = await getDb();
  const id = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const virtualPath = `DOCUMENTOS/${data.folder}/${data.name}`;

  const docRecord: AppDocument = {
    id,
    name: data.name,
    folder: data.folder,
    format: data.format,
    mimeType: data.mimeType,
    size: data.blob.size,
    createdAt: now,
    updatedAt: now,
    clientId: data.clientId,
    clientName: data.clientName,
    description: data.description,
    virtualPath,
    blob: data.blob,
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(docRecord);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  if (triggerDownload) {
    downloadBlob(data.blob, data.name);
  }

  // Also try writing to linked device directory if user authorized one
  tryWriteToDeviceDirectory(data.folder, data.name, data.blob).catch(() => {});

  return docRecord;
}

// List all documents sorted by date descending
export async function listDocuments(): Promise<AppDocument[]> {
  const db = await getDb();
  return new Promise<AppDocument[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const docs = (req.result || []) as AppDocument[];
      docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      resolve(docs);
    };
    req.onerror = () => reject(req.error);
  });
}

// Get single document blob
export async function getDocumentBlob(id: string): Promise<Blob | null> {
  const db = await getDb();
  return new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      const doc = req.result as AppDocument | undefined;
      resolve(doc?.blob || null);
    };
    req.onerror = () => reject(req.error);
  });
}

// Rename document
export async function renameDocument(id: string, newName: string): Promise<void> {
  const db = await getDb();
  const doc = await new Promise<AppDocument | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  if (!doc) throw new Error('Documento no encontrado');

  const cleanName = newName.trim();
  const virtualPath = `DOCUMENTOS/${doc.folder}/${cleanName}`;

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({
      ...doc,
      name: cleanName,
      virtualPath,
      updatedAt: new Date().toISOString(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Delete document
export async function deleteDocument(id: string): Promise<void> {
  const db = await getDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Pack all documents into a ZIP file with folder hierarchy
export async function exportAllDocumentsZip(): Promise<Blob> {
  const docs = await listDocuments();
  const zip = new JSZip();
  const root = zip.folder('DOCUMENTOS');

  // Pre-create standard subfolders in ZIP
  STANDARD_FOLDERS.forEach((folder) => {
    root?.folder(folder);
  });

  for (const doc of docs) {
    const blob = doc.blob || (await getDocumentBlob(doc.id));
    if (blob && root) {
      const targetFolder = root.folder(doc.folder || 'Otros');
      targetFolder?.file(doc.name, blob);
    }
  }

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

// Storage Access Framework Handle (Directory picker)
let directoryHandle: any = null;

export function isDirectoryPickerSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function requestDeviceDirectoryAccess(): Promise<string | null> {
  if (!isDirectoryPickerSupported()) {
    return null;
  }
  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents',
    });
    directoryHandle = handle;

    // Create standard subfolders
    for (const sub of STANDARD_FOLDERS) {
      try {
        await handle.getDirectoryHandle(sub, { create: true });
      } catch {
        // ignore
      }
    }

    return handle.name || 'DOCUMENTOS';
  } catch (err) {
    console.warn('User dismissed or error in showDirectoryPicker:', err);
    return null;
  }
}

async function tryWriteToDeviceDirectory(folder: string, filename: string, blob: Blob): Promise<void> {
  if (!directoryHandle) return;
  try {
    const subDirHandle = await directoryHandle.getDirectoryHandle(folder, { create: true });
    const fileHandle = await subDirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  } catch (err) {
    console.warn('Could not write directly to device directory handle:', err);
  }
}
