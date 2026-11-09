import { Client } from '../types';
import { calculateLoan, currentTimeStr, formatDateGt, formatQ, formatTime12h, isoToday, nd } from './calculations';
import { generateReceiptPdf as generateDocReceiptPdf } from './documentGenerators';

export interface TodayPayment {
  quotaIndex: number;
  time: string;
  amount: number;
}

export function generateReceiptPdf(client: Client, collectorName: string): boolean {
  generateDocReceiptPdf(client, collectorName).catch((err) => {
    console.error('Error generating PDF receipt:', err);
  });
  return true;
}

export function getWhatsAppReceiptText(client: Client, collectorName: string): string {
  const hoy = isoToday();
  const k = calculateLoan(client);
  const isWeekly = client.tipo === 's';
  let totalToday = 0;
  const quotasPaidToday: number[] = [];

  client.rows.forEach((r, idx) => {
    if (r.f === hoy && Number(r.m) > 0) {
      quotasPaidToday.push(idx + 1);
      totalToday += Number(r.m);
    }
  });

  if (quotasPaidToday.length === 0) {
    const lastPaidIdx = client.rows.findLastIndex((r) => Number(r.m) > 0);
    if (lastPaidIdx >= 0) {
      quotasPaidToday.push(lastPaidIdx + 1);
      totalToday = Number(client.rows[lastPaidIdx].m);
    } else {
      quotasPaidToday.push(1);
      totalToday = Number(client.cuota);
    }
  }

  const lines = [
    `*TU CRÉDITO · COMPROBANTE DE PAGO*`,
    `*Fecha:* ${formatDateGt(hoy)} ${currentTimeStr()}`,
    `*Cliente:* ${client.nombre || 'Estimado cliente'}`,
    `*DPI:* ${client.dpi || 'N/A'}`,
    `*Lugar:* ${client.lugar || 'Establecimiento'}`,
    `--------------------------------`,
    `*Monto Recibido Hoy:* *${formatQ(totalToday)}*`,
    `*Cuota abonada:* ${quotasPaidToday.join(', ')} de ${nd(client)} (${isWeekly ? 'semanal' : 'diaria'})`,
    `*Total de cuotas pagadas:* ${k.n} de ${nd(client)}`,
    `*Saldo pendiente:* *${formatQ(k.saldo)}*`,
    k.moraPend > 0 ? `*Mora pendiente:* ${formatQ(k.moraPend)}` : `*Mora:* Sin atrasos`,
    `--------------------------------`,
    `*Recibido por:* ${collectorName || 'Cobrador'}`,
    `_¡Gracias por su pago puntual!_`,
  ];

  return lines.join('\n');
}

export function shareViaWhatsApp(client: Client, collectorName: string): void {
  const text = getWhatsAppReceiptText(client, collectorName);
  const cleanPhone = String(client.tel || '').replace(/\D/g, '');
  const phoneParam = cleanPhone.length >= 8 ? `phone=502${cleanPhone.slice(-8)}&` : '';
  const url = `https://api.whatsapp.com/send?${phoneParam}text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}
