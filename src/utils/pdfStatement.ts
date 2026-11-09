import { jsPDF } from 'jspdf';
import { Client } from '../types';
import { calculateLoan, formatDateGt, formatQ, formatTime12h, isoToday, MORA_MONTO, nd, promissoryNoteText } from './calculations';

export function generateStatementPdf(client: Client): boolean {
  try {
    const k = calculateLoan(client);
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const margin = 14;
    let y = 18;
    const isWeekly = client.tipo === 's';

    // Header Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138); // #1e3a8a
    doc.text('TU CRÉDITO', margin, y);

    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('ESTADO DE CUENTA DE CRÉDITO', 210 - margin, y, { align: 'right' });

    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Emitido el: ${formatDateGt(isoToday())}`, margin, y);
    doc.text(isWeekly ? 'Modalidad: Cobro Semanal (6 semanas)' : 'Modalidad: Cobro Diario (23 cuotas)', 210 - margin, y, { align: 'right' });

    y += 5;
    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(0.6);
    doc.line(margin, y, 210 - margin, y);

    y += 7;

    // Client Metadata Grid
    const infoCol1 = [
      ['Cliente:', client.nombre || 'No registrado'],
      ['DPI / CUI:', client.dpi || 'No registrado'],
      ['Lugar / Dirección:', client.lugar || 'No especificada'],
      ['Teléfono:', client.tel || 'No registrado'],
    ];

    const infoCol2 = [
      ['Fecha de inicio:', formatDateGt(client.inicio)],
      ['Cantidad otorgada:', formatQ(client.cantidad)],
      [isWeekly ? 'Cuota semanal:' : 'Cuota diaria:', formatQ(client.cuota)],
      ['Total financiamiento:', formatQ(k.total)],
    ];

    const startMetaY = y;
    infoCol1.forEach(([lbl, val], i) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(lbl, margin, startMetaY + i * 5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(String(val).slice(0, 36), margin + 34, startMetaY + i * 5);
    });

    infoCol2.forEach(([lbl, val], i) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(lbl, margin + 96, startMetaY + i * 5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(String(val), margin + 140, startMetaY + i * 5);
    });

    y += 24;

    // Summary Boxes (Total, Abonado, Saldo, Mora)
    const boxes = [
      { label: `Total a pagar (${nd(client)} cuotas)`, value: formatQ(k.total), color: [30, 58, 138] },
      { label: `Abonado (${k.n} de ${nd(client)})`, value: formatQ(k.ab), color: [16, 185, 129] },
      { label: 'Saldo restante', value: formatQ(k.saldo), color: [217, 119, 6] },
      { label: 'Mora pendiente', value: formatQ(k.moraPend), color: k.moraPend > 0 ? [220, 38, 38] : [100, 116, 139] },
    ];

    const boxW = (210 - margin * 2 - 9) / 4;
    boxes.forEach((b, i) => {
      const bx = margin + i * (boxW + 3);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(b.color[0], b.color[1], b.color[2]);
      doc.setLineWidth(0.8);
      doc.roundedRect(bx, y, boxW, 14, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(71, 85, 105);
      doc.text(b.label, bx + 2.5, y + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(b.color[0], b.color[1], b.color[2]);
      doc.text(b.value, bx + 2.5, y + 10.5);
    });

    y += 18;

    // Payments Table
    const colW = [11, 23, 23, 17, 23, 38, 26, 21];
    const headers = [isWeekly ? 'Sem.' : 'Día', 'F. Programada', 'F. Abono', 'Hora', 'Cuota', 'Firma Cobrador', 'Mora', 'Estado'];

    // Table Header
    doc.setFillColor(30, 58, 138);
    doc.rect(margin, y, 210 - margin * 2, 6.5, 'F');
    let hx = margin;
    headers.forEach((h, i) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      const isRight = i === 4;
      const isCenter = i === 0;
      doc.text(h, isCenter ? hx + colW[i] / 2 : isRight ? hx + colW[i] - 1.5 : hx + 1.5, y + 4.5, {
        align: isCenter ? 'center' : isRight ? 'right' : 'left',
      });
      hx += colW[i];
    });

    y += 6.5;

    // Table Rows
    client.rows.forEach((r, idx) => {
      const s = k.st[idx];
      const isRowLate = s.late;
      const isRowPaid = s.paid;

      if (y > 260) {
        doc.addPage();
        y = 20;
      }

      // Zebra striping
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, 210 - margin * 2, 5.8, 'F');
      }

      if (isRowPaid) {
        doc.setFillColor(240, 253, 244); // light green
        doc.rect(margin, y, 210 - margin * 2, 5.8, 'F');
      } else if (isRowLate) {
        doc.setFillColor(254, 242, 242); // light red
        doc.rect(margin, y, 210 - margin * 2, 5.8, 'F');
      }

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.15);
      doc.line(margin, y + 5.8, 210 - margin, y + 5.8);

      let rx = margin;
      const rowVals = [
        String(idx + 1),
        formatDateGt(s.due),
        formatDateGt(r.f),
        r.h ? formatTime12h(r.h) : '',
        isRowPaid ? formatQ(r.m) : '',
        String(r.firma || '').slice(0, 24),
        isRowLate ? `${formatQ(MORA_MONTO)}${r.mp ? ' pag.' : ' pend.'}` : '—',
        isRowPaid ? 'Pagado' : isRowLate ? 'Atrasado' : 'Pendiente',
      ];

      rowVals.forEach((val, j) => {
        doc.setFont('helvetica', j === 0 || j === 7 ? 'bold' : 'normal');
        doc.setFontSize(7.2);
        if (isRowLate && (j === 6 || j === 7)) {
          doc.setTextColor(220, 38, 38);
        } else if (isRowPaid && j === 7) {
          doc.setTextColor(22, 101, 52);
        } else {
          doc.setTextColor(30, 41, 59);
        }

        const isRight = j === 4;
        const isCenter = j === 0;
        doc.text(val, isCenter ? rx + colW[j] / 2 : isRight ? rx + colW[j] - 1.5 : rx + 1.5, y + 4.2, {
          align: isCenter ? 'center' : isRight ? 'right' : 'left',
        });
        rx += colW[j];
      });

      y += 5.8;
    });

    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(185, 28, 28);
    doc.text('NOTA: A partir del tercer día de atraso se cobra Q5.00 de mora por cada pago retrasado sin excepción.', margin, y);

    y += 10;
    if (y > 240) {
      doc.addPage();
      y = 25;
    }

    // Promissory Note Legal Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, 210 - margin * 2, 28, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 58, 138);
    doc.text('PAGARÉ / COMPROMISO DE PAGO:', margin + 4, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    const splitLegal = doc.splitTextToSize(promissoryNoteText(client), 210 - margin * 2 - 8);
    doc.text(splitLegal, margin + 4, y + 10);

    y += 34;

    // Signatures
    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 8, margin + 70, y + 8);
    doc.line(210 - margin - 70, y + 8, 210 - margin, y + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(client.nombre || 'Firma del Cliente', margin, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`DPI: ${client.dpi || '____________________'}`, margin, y + 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Firma y Sello de Cobranza', 210 - margin - 70, y + 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Tu Crédito - Control de Cartera', 210 - margin - 70, y + 16);

    const safeName = (client.nombre || 'cliente')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    doc.save(`estado-de-cuenta-${safeName}.pdf`);
    return true;
  } catch (err) {
    console.error('Error generating statement PDF:', err);
    return false;
  }
}

export function getStatementPlainText(client: Client): string {
  const k = calculateLoan(client);
  const isWeekly = client.tipo === 's';
  const lines: string[] = [
    `*🏛️ TU CRÉDITO · ESTADO DE CUENTA*`,
    `📅 Fecha de emisión: ${formatDateGt(isoToday())}`,
    ``,
    `👤 Cliente: ${client.nombre || '-'}`,
    `🆔 DPI / CUI: ${client.dpi || '-'}`,
    `📍 Lugar: ${client.lugar || '-'}`,
    `📞 Teléfono: ${client.tel || '-'}`,
    `💵 Cantidad otorgada: ${formatQ(client.cantidad)}`,
    `📌 ${isWeekly ? 'Cuota semanal' : 'Cuota diaria'}: ${formatQ(client.cuota)}`,
    `🗓️ Fecha de inicio: ${formatDateGt(client.inicio)}`,
    `--------------------------------`,
    `📊 RESUMEN:`,
    `• Cuotas pagadas: ${k.n} de ${nd(client)}`,
    `• Total abonado: ${formatQ(k.ab)}`,
    `• SALDO PENDIENTE: ${formatQ(k.saldo)}`,
    `• Mora pendiente: ${formatQ(k.moraPend)}`,
    `--------------------------------`,
    `COMPROMISO:`,
    promissoryNoteText(client),
  ];
  return lines.join('\n');
}
