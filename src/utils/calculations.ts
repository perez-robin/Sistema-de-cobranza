import { Client, LoanCalculation, LoanType, PaymentRow, SemaphoreStatus } from '../types';

export const DIAS_CREDITO = 23;
export const SEMANAS_CREDITO = 6;
export const MORA_MONTO = 5; // Q5.00
export const GRACIA_DIAS = 3; // 3 días de gracia

export function nd(c: Client | LoanType): number {
  const tipo = typeof c === 'string' ? c : c.tipo;
  return tipo === 's' ? SEMANAS_CREDITO : DIAS_CREDITO;
}

export function rmin(c: Client | LoanType): number {
  const tipo = typeof c === 'string' ? c : c.tipo;
  return tipo === 's' ? 5 : 13;
}

export function formatQ(n: number | string | undefined | null): string {
  const num = Number(n) || 0;
  return 'Q' + num.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function isoToday(): string {
  const d = new Date();
  const m = d.getMonth() + 1;
  const k = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' : ''}${m}-${k < 10 ? '0' : ''}${k}`;
}

export function currentTimeStr(): string {
  const d = new Date();
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m}`;
}

export function formatTime12h(timeStr: string): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  let h = Number(parts[0]);
  const ampm = h >= 12 ? 'p. m.' : 'a. m.';
  h = h % 12 || 12;
  return `${h}:${parts[1]} ${ampm}`;
}

export function parseDate(str: string): Date {
  const p = str.split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

export function diffDays(dateA: string, dateB: string): number {
  return Math.round((parseDate(dateA).getTime() - parseDate(dateB).getTime()) / 864e5);
}

export function formatDateGt(str: string): string {
  if (!str) return '';
  const p = str.split('-');
  if (p.length < 3) return str;
  return `${p[2]}/${p[1]}/${p[0]}`;
}

export function formatCUI(val: string): string {
  const digits = String(val || '').replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  if (digits.length <= 9) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 9)} ${digits.slice(9, 13)}`;
}

export function cuotaDe(monto: number | string, tipoOrClient: LoanType | Client): number {
  const m = Number(monto) || 0;
  const tipo = typeof tipoOrClient === 'string' ? tipoOrClient : tipoOrClient.tipo;
  const rate = tipo === 's' ? 140 : 30; // Q140 semanal o Q30 diario por cada Q500
  return Math.round((m / 500) * rate * 100) / 100;
}

export function createBlankRows(tipo: LoanType): PaymentRow[] {
  const count = tipo === 's' ? SEMANAS_CREDITO : DIAS_CREDITO;
  const rows: PaymentRow[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({ f: '', h: '', m: '', firma: '', mp: false });
  }
  return rows;
}

export function createBlankClient(tipo: LoanType = 'd'): Client {
  return {
    id: 'c' + Date.now(),
    tipo,
    nombre: '',
    dpi: '',
    lugar: '',
    tel: '',
    cantidad: 500,
    cuota: tipo === 's' ? 140 : 30,
    inicio: isoToday(),
    dom: true,
    guardado: false,
    fotos: {},
    rows: createBlankRows(tipo),
  };
}

export function dueDates(c: Client): string[] {
  const out: string[] = [];
  const d = parseDate(c.inicio || isoToday());
  const N = nd(c);
  const sem = c.tipo === 's';

  while (out.length < N) {
    if (sem) {
      const m = d.getMonth() + 1;
      const k = d.getDate();
      out.push(`${d.getFullYear()}-${m < 10 ? '0' : ''}${m}-${k < 10 ? '0' : ''}${k}`);
      d.setDate(d.getDate() + 7);
      continue;
    }
    // Para diario: si dom === true, saltar domingos
    if (!(c.dom && d.getDay() === 0)) {
      const m = d.getMonth() + 1;
      const k = d.getDate();
      out.push(`${d.getFullYear()}-${m < 10 ? '0' : ''}${m}-${k < 10 ? '0' : ''}${k}`);
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function calculateLoan(c: Client): LoanCalculation {
  const dues = dueDates(c);
  const hoy = isoToday();
  const cuota = Number(c.cuota) || 0;
  let ab = 0;
  let mora = 0;
  let moraPag = 0;
  let n = 0;

  const st = c.rows.map((r, i) => {
    const m = Number(r.m) || 0;
    if (m > 0) {
      ab += m;
      n++;
    }
    const isPaid = m > 0;
    // Si abonó tarde: fecha de abono r.f >= fecha programada + 3 días
    // Si no ha abonado: hoy >= fecha programada + 3 días
    const late = r.f && isPaid
      ? diffDays(r.f, dues[i]) >= GRACIA_DIAS
      : (!isPaid && diffDays(hoy, dues[i]) >= GRACIA_DIAS);

    if (late) {
      mora += MORA_MONTO;
      if (r.mp) moraPag += MORA_MONTO;
    }

    return {
      due: dues[i],
      late,
      paid: isPaid,
    };
  });

  const total = cuota * nd(c);
  return {
    st,
    total,
    ab,
    saldo: Math.max(total - ab, 0),
    mora,
    moraPend: mora - moraPag,
    n,
  };
}

export function getSemaphore(c: Client): SemaphoreStatus {
  if (c.cerrado) {
    return { cls: 'n', txt: 'Renovado / Liquidado', i: -1 };
  }

  const k = calculateLoan(c);
  const hoy = isoToday();
  let nextIdx = -1;
  const sem = c.tipo === 's';

  for (let j = 0; j < c.rows.length; j++) {
    if (!(Number(c.rows[j].m) > 0)) {
      nextIdx = j;
      break;
    }
  }

  if (nextIdx < 0) {
    return { cls: 'v', txt: 'Pagado completo', i: -1 };
  }

  const d = diffDays(hoy, k.st[nextIdx].due);

  if (d < 0) {
    return { cls: 'v', txt: 'Al día', i: nextIdx, d };
  }
  if (d <= 1) {
    return { cls: 'c', txt: d === 0 ? 'Por cobrar hoy' : '1 día de atraso', i: nextIdx, d };
  }
  if (d === 2 || (sem && d === 3)) {
    return { cls: 'a', txt: `${d} días de atraso`, i: nextIdx, d };
  }
  return { cls: 'r', txt: `${d} días atrasado (Mora)`, i: nextIdx, d };
}

export function sortClientsByRoute(clients: Client[]): Client[] {
  const order: Record<string, number> = { r: 0, a: 1, c: 2, v: 3, n: 4 };
  return [...clients].sort((a, b) => {
    const sA = getSemaphore(a);
    const sB = getSemaphore(b);
    return order[sA.cls] - order[sB.cls];
  });
}

export function canRenew(c: Client): boolean {
  if (c.cerrado) return false;
  const k = calculateLoan(c);
  return k.n >= rmin(c);
}

export function promissoryNoteText(c: Client): string {
  const cuota = formatQ(c.cuota);
  const cant = formatQ(c.cantidad);
  const plazo = c.tipo === 's' ? '6 pagos semanales' : '23 pagos diarios';
  return `Yo, ${c.nombre || '____________________'}, con DPI No. ${c.dpi || '____________________'}, me comprometo formalmente a pagar la cantidad otorgada de ${cant}, en ${plazo} de ${cuota}, más la mora correspondiente de Q5.00 por cada día de atraso después del período de gracia pactado.`;
}

export function dayOfWeekName(isoDate: string): string {
  const names = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  return names[parseDate(isoDate).getDay()];
}
