export type LoanType = 'd' | 's'; // 'd' = diario (23 días), 's' = semanal (6 semanas)

export interface PaymentRow {
  f: string;       // Fecha de abono (YYYY-MM-DD)
  h: string;       // Hora de abono (HH:MM)
  m: number | string; // Monto abonado
  firma: string;   // Firma o nombre del cobrador
  mp: boolean;     // Mora pagada
}

export interface LoanHistoryItem {
  ini: string;
  fin: string;
  cant: number;
  cuota: number;
  ef: number;      // Efectivo entregado
  ab: number;      // Total abonado
  mora: number;    // Mora acumulada
  rows: PaymentRow[];
}

export interface Client {
  id: string;
  tipo: LoanType;
  nombre: string;
  dpi: string;
  lugar: string;
  tel: string;
  cantidad: number | string; // Cantidad otorgada en Quetzales
  cuota: number | string;    // Cuota diaria/semanal en Quetzales
  inicio: string;            // Fecha de inicio (YYYY-MM-DD)
  dom?: boolean;             // No cobrar domingos (solo diario)
  guardado?: boolean;
  renov?: number | string;   // Monto propuesto para renovación
  efectivo?: number;         // Efectivo entregado en renovación
  cerrado?: boolean;         // Si ya fue liquidado/renovado
  fotos?: {
    dpiF?: boolean;          // Foto frontal DPI
    dpiT?: boolean;          // Foto reverso DPI
    foto?: boolean;          // Foto del cliente
  };
  rows: PaymentRow[];        // Las cuotas del crédito (23 diarias o 6 semanales)
  hist?: LoanHistoryItem[];  // Historial de préstamos anteriores
  firmaCliente?: string;     // Firma digital del cliente en base64
}

export type SemaphoreColor = 'v' | 'c' | 'a' | 'r' | 'n';

export interface SemaphoreStatus {
  cls: SemaphoreColor;
  txt: string;
  i: number; // Índice de la siguiente cuota por cobrar (-1 si pagado)
  d?: number; // Días de atraso
}

export interface RowStatus {
  due: string;
  late: boolean;
  paid: boolean;
}

export interface LoanCalculation {
  st: RowStatus[];
  total: number;
  ab: number;
  saldo: number;
  mora: number;
  moraPend: number;
  n: number; // Cantidad de pagos completados
}

export interface CashClosing {
  fecha: string;
  hora: string;
  modo: LoanType;
  cobrador: string;
  total: number;
  n: number;
  pend: number;
}

export type DocumentFormat = 'pdf' | 'docx' | 'xlsx';

export type StandardFolder =
  | 'Clientes'
  | 'Recibos'
  | 'Cobros_Diarios'
  | 'Cobros_Semanales'
  | 'Reportes'
  | 'Estados_de_Cuenta'
  | 'Contratos'
  | 'Comprobantes'
  | 'Excel'
  | 'Word'
  | 'PDF'
  | 'Respaldos';

export interface AppDocument {
  id: string;
  name: string;
  folder: string;
  format: DocumentFormat;
  mimeType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  clientId?: string;
  clientName?: string;
  description?: string;
  virtualPath: string; // e.g. "DOCUMENTOS/Recibos/recibo_...pdf"
  blob?: Blob;
}
