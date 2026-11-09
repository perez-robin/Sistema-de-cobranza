import { jsPDF } from 'jspdf';
import { Client } from '../types';
import { calculateLoan, currentTimeStr, formatDateGt, formatQ, formatTime12h, isoToday, nd } from './calculations';

export interface TodayPayment {
  quotaIndex: number;
  time: string;
  amount: number;
}

export function generateReceiptPdf(client: Client, collectorName: string): boolean {
  try {
    const hoy = isoToday();
    const k = calculateLoan(client);
    const payments: TodayPayment[] = [];
    let totalReceivedToday = 0;
    const isWeekly = client.tipo === 's';

    client.rows.forEach((r, idx) => {
      if (r.f === hoy && Number(r.m) > 0) {
        payments.push({
          quotaIndex: idx + 1,
          time: r.h || currentTimeStr(),
          amount: Number(r.m),
        });
        totalReceivedToday += Number(r.m);
      }
    });

    if (payments.length === 0) {
      return false;
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a5' });
    const margin = 12;
    let y = 16;
    const width = 148 - 2 * margin;
    const receiptNo = `R-${hoy.replace(/-/g, '')}-${client.id.replace(/\D/g, '').slice(-4)}-${payments[0].quotaIndex}`;

    // Header Banner
    doc.setFillColor(30, 58, 138); // #1e3a8a
    doc.roundedRect(margin, y - 6, width, 18, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('TU CRÉDITO', margin + 6, y + 4);

    doc.setFontSize(10);
    doc.text('COMPROBANTE DE PAGO', 148 - margin - 6, y + 1, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(220, 230, 250);
    doc.text(`No. ${receiptNo}`, 148 - margin - 6, y + 7, { align: 'right' });

    y += 20;

    // Date and time line
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(70, 70, 70);
    doc.text(`Fecha: ${formatDateGt(hoy)} · Hora: ${formatTime12h(payments[payments.length - 1].time)}`, margin, y);
    y += 6;

    // Client Info Box
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, width, 38, 2, 2, 'FD');

    y += 6;
    const fields = [
      ['Cliente:', client.nombre || 'Sin nombre'],
      ['DPI / CUI:', client.dpi || 'No registrado'],
      ['Ubicación:', client.lugar || 'No especificada'],
      ['Tipo de crédito:', isWeekly ? 'Cobro Semanal (6 cuotas)' : 'Cobro Diario (23 cuotas)'],
      ['Monto otorgado:', formatQ(client.cantidad)],
      [isWeekly ? 'Cuota semanal:' : 'Cuota diaria:', formatQ(client.cuota)],
    ];

    fields.forEach(([lbl, val]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(lbl, margin + 4, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(String(val).slice(0, 45), margin + 36, y);
      y += 5.2;
    });

    y += 6;

    // Payment details table header
    doc.setFillColor(224, 231, 255);
    doc.rect(margin, y, width, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 58, 138);
    doc.text(isWeekly ? 'Semana abonada' : 'Día abonado', margin + 3, y + 4.5);
    doc.text('Hora', margin + 55, y + 4.5);
    doc.text('Monto cobrado', 148 - margin - 3, y + 4.5, { align: 'right' });
    y += 6.5;

    // Payments rows
    payments.forEach((p) => {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8.5);
      doc.text(`Cuota ${p.quotaIndex} de ${nd(client)}`, margin + 3, y + 5);
      doc.text(formatTime12h(p.time), margin + 55, y + 5);
      doc.setFont('helvetica', 'bold');
      doc.text(formatQ(p.amount), 148 - margin - 3, y + 5, { align: 'right' });
      y += 6.5;
    });

    y += 3;

    // Total Received Card
    doc.setFillColor(220, 252, 231); // green-100
    doc.setDrawColor(34, 197, 94);
    doc.roundedRect(margin, y, width, 13, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(22, 101, 52);
    doc.text('MONTO TOTAL RECIBIDO', margin + 4, y + 8.5);
    doc.setFontSize(14);
    doc.text(formatQ(totalReceivedToday), 148 - margin - 4, y + 9, { align: 'right' });

    y += 18;

    // Summary of remaining loan
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('Cuotas pagadas a la fecha:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${k.n} de ${nd(client)} cuotas`, margin + 52, y);
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.text('Saldo pendiente de crédito:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formatQ(k.saldo), margin + 52, y);
    y += 5;

    if (k.moraPend > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(185, 28, 28);
      doc.text('Mora pendiente:', margin, y);
      doc.text(formatQ(k.moraPend), margin + 52, y);
      y += 5;
    }

    y += 12;

    // Signature line
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + 55, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Cobrador: ${collectorName || payments[0]?.amount ? client.rows[payments[0].quotaIndex - 1]?.firma || collectorName : 'Cobranzas'}`, margin, y + 4);

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('¡Gracias por su puntualidad y preferencia!', 148 - margin, y + 4, { align: 'right' });

    const safeName = (client.nombre || 'cliente')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    doc.save(`recibo-${safeName}-${hoy}.pdf`);
    return true;
  } catch (err) {
    console.error('Error generating PDF receipt:', err);
    return false;
  }
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

  const lines = [
    `*🏛️ TU CRÉDITO · COMPROBANTE DE PAGO*`,
    `📅 *Fecha:* ${formatDateGt(hoy)} ${currentTimeStr()}`,
    `👤 *Cliente:* ${client.nombre || 'Estimado cliente'}`,
    `🆔 *DPI:* ${client.dpi || 'N/A'}`,
    `📍 *Lugar:* ${client.lugar || 'En ruta'}`,
    `--------------------------------`,
    `💵 *Monto Recibido Hoy:* *${formatQ(totalToday)}*`,
    `📌 *Cuota abonada:* ${quotasPaidToday.join(', ')} de ${nd(client)} (${isWeekly ? 'semanal' : 'diaria'})`,
    `📊 *Total de cuotas pagadas:* ${k.n} de ${nd(client)}`,
    `⚖️ *Saldo pendiente:* *${formatQ(k.saldo)}*`,
    k.moraPend > 0 ? `⚠️ *Mora pendiente:* ${formatQ(k.moraPend)}` : `✅ *Mora:* Sin atrasos`,
    `--------------------------------`,
    `✍️ *Recibido por:* ${collectorName || 'Cobrador en ruta'}`,
    `🙏 _¡Gracias por su pago puntual!_`,
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
