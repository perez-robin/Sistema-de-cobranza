import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  Packer,
} from 'docx';
import { Client, LoanType } from '../types';
import {
  calculateLoan,
  formatDateGt,
  formatQ,
  formatTime12h,
  isoToday,
  nd,
  promissoryNoteText,
} from './calculations';
import { saveDocument } from './documentStorage';

// Helpers
function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const safeNumber = (v: any): number => Number(v) || 0;

function createBoldCell(text: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true })],
      }),
    ],
  });
}

function createTextCell(text: string): TableCell {
  return new TableCell({
    children: [new Paragraph(text)],
  });
}

// -------------------------------------------------------------
// 1. RECIBOS DE COBRO (Receipts): PDF, DOCX, XLSX
// -------------------------------------------------------------

export async function generateReceiptPdf(
  client: Client,
  collectorName: string,
  quotaIdx?: number
): Promise<{ success: boolean; filename: string }> {
  try {
    const hoy = isoToday();
    const k = calculateLoan(client);
    const isWeekly = client.tipo === 's';

    let payments = client.rows
      .map((r, idx) => ({ ...r, idx: idx + 1 }))
      .filter((r) => r.f === hoy && Number(r.m) > 0);

    if (payments.length === 0 && quotaIdx) {
      const row = client.rows[quotaIdx - 1];
      if (row && Number(row.m) > 0) {
        payments = [{ ...row, idx: quotaIdx }];
      }
    }

    if (payments.length === 0) {
      const lastRowIdx = client.rows.findLastIndex((r) => Number(r.m) > 0);
      if (lastRowIdx >= 0) {
        payments = [{ ...client.rows[lastRowIdx], idx: lastRowIdx + 1 }];
      } else {
        payments = [{ f: hoy, h: '09:00', m: client.cuota, firma: collectorName || 'Cobrador', mp: false, idx: 1 }];
      }
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a5' });
    const margin = 12;
    let y = 16;
    const width = 148 - 2 * margin;
    const receiptNo = `R-${hoy.replace(/-/g, '')}-${client.id.replace(/\D/g, '').slice(-4)}-${payments[0]?.idx || 1}`;

    // Header banner
    doc.setFillColor(30, 58, 138); // blue-900
    doc.roundedRect(margin, y - 6, width, 18, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text('TU CRÉDITO', margin + 6, y + 4);

    doc.setFontSize(9.5);
    doc.text('COMPROBANTE DE PAGO', 148 - margin - 6, y + 1, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(220, 230, 250);
    doc.text(`No. ${receiptNo}`, 148 - margin - 6, y + 7, { align: 'right' });

    y += 20;

    // Date & Client info
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(70, 70, 70);
    doc.text(`Fecha: ${formatDateGt(hoy)} ${payments[0]?.h ? formatTime12h(payments[0].h) : ''}`, margin, y);
    doc.text(`Modalidad: ${isWeekly ? 'Cobro Semanal' : 'Cobro Diario'}`, 148 - margin, y, { align: 'right' });

    y += 5;
    doc.setDrawColor(200, 210, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, y, 148 - margin, y);

    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('DATOS DEL CLIENTE', margin, y);

    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Cliente: ${client.nombre || 'No registrado'}`, margin, y);
    y += 4.5;
    doc.text(`DPI / CUI: ${client.dpi || 'N/A'}`, margin, y);
    y += 4.5;
    doc.text(`Establecimiento: ${client.lugar || 'En campo'}`, margin, y);

    y += 7;
    // Payment details box
    const totalToday = payments.reduce((acc, p) => acc + Number(p.m), 0);
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, width, 14, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, width, 14, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 58, 138);
    doc.text('TOTAL RECIBIDO HOY:', margin + 4, y + 9);
    doc.setFontSize(13);
    doc.text(formatQ(totalToday), 148 - margin - 4, y + 9.5, { align: 'right' });

    y += 18;

    // Breakdown lines
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('Detalle de Cuotas Abonadas:', margin, y);
    y += 4.5;

    doc.setFont('helvetica', 'normal');
    payments.forEach((p) => {
      doc.text(`• Cuota abonada: #${p.idx} de ${nd(client)}`, margin + 2, y);
      doc.text(formatQ(Number(p.m)), 148 - margin, y, { align: 'right' });
      y += 4;
    });

    y += 3;
    doc.line(margin, y, 148 - margin, y);
    y += 6;

    // Balances
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Total cuotas pagadas:', margin, y);
    doc.setFont('helvetica', 'bold');
    doc.text(`${k.n} de ${nd(client)}`, margin + 50, y);
    y += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.text('Saldo pendiente:', margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(185, 28, 28);
    doc.text(formatQ(k.saldo), margin + 50, y);
    y += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Estado de mora:', margin, y);
    doc.setFont('helvetica', 'bold');
    if (k.moraPend > 0) {
      doc.setTextColor(185, 28, 28);
      doc.text(formatQ(k.moraPend) + ' pendiente', margin + 50, y);
    } else {
      doc.setTextColor(22, 101, 52);
      doc.text('Sin atrasos', margin + 50, y);
    }

    y += 18;
    // Signature
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + 55, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Cobrador: ${collectorName || 'Cobrador'}`, margin, y + 4);

    doc.setFontSize(7.5);
    doc.text('¡Gracias por su puntualidad y preferencia!', 148 - margin, y + 4, { align: 'right' });

    const safeName = sanitizeFileName(client.nombre || 'cliente');
    const filename = `recibo_${safeName}_${hoy}.pdf`;
    const pdfBlob = doc.output('blob');

    await saveDocument({
      name: filename,
      folder: 'Recibos',
      format: 'pdf',
      mimeType: 'application/pdf',
      blob: pdfBlob,
      clientId: client.id,
      clientName: client.nombre,
      description: `Comprobante de pago No. ${receiptNo} por ${formatQ(totalToday)}`,
    });

    return { success: true, filename };
  } catch (err) {
    console.error('Error generating PDF receipt:', err);
    return { success: false, filename: '' };
  }
}

export async function generateReceiptDocx(
  client: Client,
  collectorName: string
): Promise<{ success: boolean; filename: string }> {
  try {
    const hoy = isoToday();
    const k = calculateLoan(client);
    const isWeekly = client.tipo === 's';
    const totalToday = client.rows
      .filter((r) => r.f === hoy && Number(r.m) > 0)
      .reduce((acc, r) => acc + Number(r.m), 0) || Number(client.cuota);

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: 'TU CRÉDITO',
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: 'COMPROBANTE OFICIAL DE PAGO',
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Fecha de emisión: ', bold: true }),
                new TextRun(formatDateGt(hoy)),
                new TextRun({ text: '   |   Modalidad: ', bold: true }),
                new TextRun(isWeekly ? 'Cobro Semanal (6 semanas)' : 'Cobro Diario (23 cuotas)'),
              ],
              spacing: { after: 200 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [createBoldCell('Cliente:'), createTextCell(client.nombre || 'No registrado')],
                }),
                new TableRow({
                  children: [createBoldCell('DPI / CUI:'), createTextCell(client.dpi || 'N/A')],
                }),
                new TableRow({
                  children: [createBoldCell('Establecimiento:'), createTextCell(client.lugar || 'En campo')],
                }),
                new TableRow({
                  children: [createBoldCell('Monto Recibido:'), createBoldCell(formatQ(totalToday))],
                }),
                new TableRow({
                  children: [createBoldCell('Cuotas Pagadas:'), createTextCell(`${k.n} de ${nd(client)}`)],
                }),
                new TableRow({
                  children: [createBoldCell('Saldo Pendiente:'), createBoldCell(formatQ(k.saldo))],
                }),
                new TableRow({
                  children: [createBoldCell('Mora Pendiente:'), createTextCell(k.moraPend > 0 ? formatQ(k.moraPend) : 'Sin atrasos')],
                }),
                new TableRow({
                  children: [createBoldCell('Cobrador / Agente:'), createTextCell(collectorName || 'Cobrador')],
                }),
              ],
            }),
            new Paragraph({
              text: 'Agradecemos su pago puntual y preferencia.',
              alignment: AlignmentType.CENTER,
              spacing: { before: 400 },
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const safeName = sanitizeFileName(client.nombre || 'cliente');
    const filename = `recibo_${safeName}_${hoy}.docx`;

    await saveDocument({
      name: filename,
      folder: 'Word',
      format: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      blob,
      clientId: client.id,
      clientName: client.nombre,
      description: `Recibo Word por ${formatQ(totalToday)}`,
    });

    return { success: true, filename };
  } catch (err) {
    console.error('Error generating DOCX receipt:', err);
    return { success: false, filename: '' };
  }
}

export async function generateReceiptXlsx(
  client: Client,
  collectorName: string
): Promise<{ success: boolean; filename: string }> {
  try {
    const hoy = isoToday();
    const k = calculateLoan(client);
    const isWeekly = client.tipo === 's';
    const totalToday = client.rows
      .filter((r) => r.f === hoy && Number(r.m) > 0)
      .reduce((acc, r) => acc + Number(r.m), 0) || Number(client.cuota);

    const wsData: Array<Array<string | number>> = [
      ['TU CRÉDITO - COMPROBANTE DE PAGO'],
      ['Fecha', formatDateGt(hoy)],
      ['Modalidad', isWeekly ? 'Cobro Semanal' : 'Cobro Diario'],
      [''],
      ['Cliente', client.nombre || 'No registrado'],
      ['DPI / CUI', client.dpi || 'N/A'],
      ['Establecimiento', client.lugar || 'En campo'],
      ['Teléfono', client.tel || 'No registrado'],
      [''],
      ['CONCEPTO', 'VALOR'],
      ['Monto Recibido Hoy', totalToday],
      ['Cuotas Pagadas', `${k.n} de ${nd(client)}`],
      ['Saldo Pendiente', k.saldo],
      ['Mora Pendiente', k.moraPend],
      ['Total Crédito', k.total],
      ['Cobrador', collectorName || 'Cobrador'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Recibo');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const safeName = sanitizeFileName(client.nombre || 'cliente');
    const filename = `recibo_${safeName}_${hoy}.xlsx`;

    await saveDocument({
      name: filename,
      folder: 'Excel',
      format: 'xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      blob,
      clientId: client.id,
      clientName: client.nombre,
      description: `Recibo Excel por ${formatQ(totalToday)}`,
    });

    return { success: true, filename };
  } catch (err) {
    console.error('Error generating XLSX receipt:', err);
    return { success: false, filename: '' };
  }
}

// -------------------------------------------------------------
// 2. ESTADOS DE CUENTA (Statements): PDF, DOCX, XLSX
// -------------------------------------------------------------

export async function generateStatementPdf(client: Client): Promise<{ success: boolean; filename: string }> {
  try {
    const k = calculateLoan(client);
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const margin = 14;
    let y = 18;
    const isWeekly = client.tipo === 's';

    // Header Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138);
    doc.text('TU CRÉDITO', margin, y);

    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('ESTADO DE CUENTA DE CRÉDITO', 210 - margin, y, { align: 'right' });

    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Emitido el: ${formatDateGt(isoToday())}`, margin, y);
    doc.text(
      isWeekly ? 'Modalidad: Cobro Semanal (6 semanas)' : 'Modalidad: Cobro Diario (23 cuotas)',
      210 - margin,
      y,
      { align: 'right' }
    );

    y += 5;
    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(0.6);
    doc.line(margin, y, 210 - margin, y);

    y += 7;

    // Metadata
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
      doc.text(lbl, 115, startMetaY + i * 5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(String(val), 160, startMetaY + i * 5);
    });

    y += 24;

    // Financial KPI cards
    const kpiWidth = (210 - margin * 2 - 9) / 4;
    const kpis = [
      { label: 'Total Abonado', val: formatQ(k.ab), color: [22, 101, 52] },
      { label: 'Saldo Pendiente', val: formatQ(k.saldo), color: [185, 28, 28] },
      { label: 'Cuotas Pagadas', val: `${k.n} de ${nd(client)}`, color: [30, 58, 138] },
      { label: 'Mora Acumulada', val: formatQ(k.moraPend), color: [180, 83, 9] },
    ];

    kpis.forEach((kp, idx) => {
      const bx = margin + idx * (kpiWidth + 3);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(bx, y, kpiWidth, 14, 1.5, 1.5, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(bx, y, kpiWidth, 14, 1.5, 1.5, 'S');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(kp.label, bx + 3, y + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(kp.color[0], kp.color[1], kp.color[2]);
      doc.text(kp.val, bx + 3, y + 10.5);
    });

    y += 20;

    // Table Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('DETALLE DE CUOTAS Y AMORTIZACIÓN', margin, y);

    y += 4;
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, 210 - margin * 2, 7, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text('No.', margin + 2, y + 4.5);
    doc.text('Fecha Prog.', margin + 12, y + 4.5);
    doc.text('Fecha Pago', margin + 35, y + 4.5);
    doc.text('Hora', margin + 58, y + 4.5);
    doc.text('Monto Abonado', margin + 74, y + 4.5);
    doc.text('Estado', margin + 106, y + 4.5);
    doc.text('Firma / Cobrador', margin + 138, y + 4.5);

    y += 7;

    // Table Rows
    doc.setFont('helvetica', 'normal');
    client.rows.forEach((r, idx) => {
      const st = k.st[idx];
      const isPaid = Number(r.m) > 0;

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, 210 - margin * 2, 5, 'F');
      }

      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text(String(idx + 1), margin + 3, y + 3.5);
      doc.text(formatDateGt(st.due), margin + 12, y + 3.5);
      doc.text(r.f ? formatDateGt(r.f) : '—', margin + 35, y + 3.5);
      doc.text(r.h ? formatTime12h(r.h) : '—', margin + 58, y + 3.5);

      if (isPaid) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 101, 52);
        doc.text(formatQ(Number(r.m)), margin + 74, y + 3.5);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text('—', margin + 74, y + 3.5);
      }

      if (isPaid) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 101, 52);
        doc.text('Pagado', margin + 106, y + 3.5);
      } else if (st.late) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(185, 28, 28);
        doc.text('Atrasado', margin + 106, y + 3.5);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text('Pendiente', margin + 106, y + 3.5);
      }

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text((r.firma || '—').slice(0, 25), margin + 138, y + 3.5);

      y += 5;
    });

    y += 5;

    // Legal Promissory Note box
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, 210 - margin * 2, 28, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, 210 - margin * 2, 28, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
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

    const safeName = sanitizeFileName(client.nombre || 'cliente');
    const filename = `estado_de_cuenta_${safeName}.pdf`;
    const blob = doc.output('blob');

    await saveDocument({
      name: filename,
      folder: 'Estados_de_Cuenta',
      format: 'pdf',
      mimeType: 'application/pdf',
      blob,
      clientId: client.id,
      clientName: client.nombre,
      description: `Estado de cuenta completo con saldo de ${formatQ(k.saldo)}`,
    });

    return { success: true, filename };
  } catch (err) {
    console.error('Error generating statement PDF:', err);
    return { success: false, filename: '' };
  }
}

export async function generateStatementDocx(client: Client): Promise<{ success: boolean; filename: string }> {
  try {
    const k = calculateLoan(client);

    const tableRows = [
      new TableRow({
        children: [
          createBoldCell('No.'),
          createBoldCell('Fecha Prog.'),
          createBoldCell('Fecha Pago'),
          createBoldCell('Hora'),
          createBoldCell('Abono'),
          createBoldCell('Estado'),
          createBoldCell('Cobrador'),
        ],
      }),
    ];

    client.rows.forEach((r, idx) => {
      const st = k.st[idx];
      const isPaid = Number(r.m) > 0;
      tableRows.push(
        new TableRow({
          children: [
            createTextCell(String(idx + 1)),
            createTextCell(formatDateGt(st.due)),
            createTextCell(r.f ? formatDateGt(r.f) : '—'),
            createTextCell(r.h ? formatTime12h(r.h) : '—'),
            createTextCell(isPaid ? formatQ(Number(r.m)) : '—'),
            createTextCell(isPaid ? 'Pagado' : st.late ? 'Atrasado' : 'Pendiente'),
            createTextCell(r.firma || '—'),
          ],
        })
      );
    });

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: 'TU CRÉDITO - ESTADO DE CUENTA DE CRÉDITO',
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Cliente: ', bold: true }),
                new TextRun(client.nombre || 'No registrado'),
                new TextRun({ text: '   |   DPI / CUI: ', bold: true }),
                new TextRun(client.dpi || 'N/A'),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Monto Otorgado: ', bold: true }),
                new TextRun(formatQ(client.cantidad)),
                new TextRun({ text: '   |   Total a Pagar: ', bold: true }),
                new TextRun(formatQ(k.total)),
                new TextRun({ text: '   |   Saldo Pendiente: ', bold: true }),
                new TextRun(formatQ(k.saldo)),
              ],
              spacing: { after: 200 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: tableRows,
            }),
            new Paragraph({
              children: [new TextRun({ text: 'PAGARÉ / COMPROMISO FORMAL DE PAGO:', bold: true })],
              spacing: { before: 300, after: 100 },
            }),
            new Paragraph({
              text: `"${promissoryNoteText(client)}"`,
              spacing: { after: 300 },
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const safeName = sanitizeFileName(client.nombre || 'cliente');
    const filename = `estado_de_cuenta_${safeName}.docx`;

    await saveDocument({
      name: filename,
      folder: 'Word',
      format: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      blob,
      clientId: client.id,
      clientName: client.nombre,
      description: `Estado de cuenta en Word`,
    });

    return { success: true, filename };
  } catch (err) {
    console.error('Error generating statement DOCX:', err);
    return { success: false, filename: '' };
  }
}

export async function generateStatementXlsx(client: Client): Promise<{ success: boolean; filename: string }> {
  try {
    const k = calculateLoan(client);
    const isWeekly = client.tipo === 's';

    const headerData: Array<Array<string | number>> = [
      ['TU CRÉDITO - ESTADO DE CUENTA'],
      ['Cliente', client.nombre || 'No registrado'],
      ['DPI / CUI', client.dpi || 'N/A'],
      ['Ubicación', client.lugar || 'En campo'],
      ['Teléfono', client.tel || 'No registrado'],
      ['Modalidad', isWeekly ? 'Cobro Semanal (6 cuotas)' : 'Cobro Diario (23 cuotas)'],
      ['Monto Otorgado', safeNumber(client.cantidad)],
      ['Total Financiamiento', k.total],
      ['Total Abonado', k.ab],
      ['Saldo Pendiente', k.saldo],
      ['Mora Pendiente', k.moraPend],
      ['Cuotas Pagadas', `${k.n} de ${nd(client)}`],
      [''],
      ['No. Cuota', 'Fecha Programada', 'Fecha de Pago', 'Hora', 'Monto Abonado', 'Estado', 'Cobrador'],
    ];

    client.rows.forEach((r, idx) => {
      const st = k.st[idx];
      const isPaid = Number(r.m) > 0;
      headerData.push([
        idx + 1,
        formatDateGt(st.due),
        r.f ? formatDateGt(r.f) : '',
        r.h ? formatTime12h(r.h) : '',
        isPaid ? Number(r.m) : 0,
        isPaid ? 'Pagado' : st.late ? 'Atrasado' : 'Pendiente',
        r.firma || '',
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(headerData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estado_de_Cuenta');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const safeName = sanitizeFileName(client.nombre || 'cliente');
    const filename = `estado_de_cuenta_${safeName}.xlsx`;

    await saveDocument({
      name: filename,
      folder: 'Excel',
      format: 'xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      blob,
      clientId: client.id,
      clientName: client.nombre,
      description: `Tabla de pagos en Excel`,
    });

    return { success: true, filename };
  } catch (err) {
    console.error('Error generating statement XLSX:', err);
    return { success: false, filename: '' };
  }
}

// -------------------------------------------------------------
// 3. CONTRATOS Y PAGARÉS LEGALES (Contracts): PDF, DOCX
// -------------------------------------------------------------

export async function generateContractPdf(client: Client): Promise<{ success: boolean; filename: string }> {
  try {
    const k = calculateLoan(client);
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const margin = 18;
    let y = 22;
    const isWeekly = client.tipo === 's';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(30, 58, 138);
    doc.text('TU CRÉDITO', 105, y, { align: 'center' });
    y += 6;
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('CONTRATO DE MUTUO MERCANTIL Y PAGARÉ NOTARIAL', 105, y, { align: 'center' });
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Código de Comercio de Guatemala (Artículos 385, 386 y 490)', 105, y, { align: 'center' });

    y += 10;
    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(0.5);
    doc.line(margin, y, 210 - margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);

    const contractBody = [
      `En la Ciudad de Guatemala, el día ${formatDateGt(client.inicio || isoToday())}, comparece el/la señor(a) ${client.nombre || '_____________________________________'}, quien se identifica con el Documento Personal de Identificación (DPI) con Código Único de Identificación (CUI) número ${client.dpi || '________________________'}, con domicilio y residencia en ${client.lugar || '_____________________________________'}, teléfono ${client.tel || '________'}; por este acto reconoce expresamente que debe y pagará incondicionalmente a la orden de TU CRÉDITO la cantidad líquida y exigible de ${formatQ(k.total)} (QUETZALES EXACTOS).`,
      ``,
      `PRIMERA: El monto antes indicado corresponde al capital mutuado de ${formatQ(client.cantidad)}, más los costos financieros pactados por mutuo acuerdo.`,
      ``,
      `SEGUNDA (FORMA DE PAGO): El deudor se compromete y obliga a pagar la suma adeudada mediante ${nd(client)} cuotas ${isWeekly ? 'semanales' : 'diarias'} consecutivas de ${formatQ(client.cuota)} cada una, pagaderas a partir del día ${formatDateGt(client.inicio)}.`,
      ``,
      `TERCERA (MORA): En caso de atraso en el pago de cualquiera de las cuotas pactadas, transcurridos tres (3) días de gracia contados a partir de su vencimiento, el deudor devengará automáticamente y sin necesidad de requerimiento alguno la suma de Q5.00 diarios en concepto de cláusula penal e indemnización por mora hasta la total cancelación del saldo.`,
      ``,
      `CUARTA (LIBRE DE PROTESTO): El presente título se emite con la cláusula LIBRE DE PROTESTO conforme al Artículo 399 del Código de Comercio de Guatemala, exonerando al acreedor de levantar acta notarial de protesto, facultándolo para entablar acción cambiaria directa o ejecutiva en los tribunales correspondientes.`,
    ];

    contractBody.forEach((par) => {
      if (par === '') {
        y += 3;
        return;
      }
      const splitLines = doc.splitTextToSize(par, 210 - margin * 2);
      doc.text(splitLines, margin, y);
      y += splitLines.length * 4.8;
    });

    y += 10;
    // Signatures
    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 20, margin + 70, y + 20);
    doc.line(210 - margin - 70, y + 20, 210 - margin, y + 20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(client.nombre || 'Firma del Deudor', margin, y + 25);
    doc.setFont('helvetica', 'normal');
    doc.text(`DPI / CUI: ${client.dpi || '________________________'}`, margin, y + 29);

    doc.setFont('helvetica', 'bold');
    doc.text('Tu Crédito', 210 - margin - 70, y + 25);
    doc.setFont('helvetica', 'normal');
    doc.text('Acreedor / Representante Autorizado', 210 - margin - 70, y + 29);

    const safeName = sanitizeFileName(client.nombre || 'cliente');
    const filename = `contrato_pagare_${safeName}.pdf`;
    const blob = doc.output('blob');

    await saveDocument({
      name: filename,
      folder: 'Contratos',
      format: 'pdf',
      mimeType: 'application/pdf',
      blob,
      clientId: client.id,
      clientName: client.nombre,
      description: `Contrato de mutuo y pagaré legal`,
    });

    return { success: true, filename };
  } catch (err) {
    console.error('Error generating contract PDF:', err);
    return { success: false, filename: '' };
  }
}

export async function generateContractDocx(client: Client): Promise<{ success: boolean; filename: string }> {
  try {
    const k = calculateLoan(client);
    const isWeekly = client.tipo === 's';

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: 'CONTRATO DE MUTUO MERCANTIL Y PAGARÉ LIBRE DE PROTESTO',
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun(
                  `En la Ciudad de Guatemala, comparece ${client.nombre || 'el deudor'}, identificado con DPI ${client.dpi || 'N/A'}, domiciliado en ${client.lugar || 'Guatemala'}, quien reconoce adeudar a TU CRÉDITO la cantidad de ${formatQ(k.total)} por concepto de crédito mutuado de ${formatQ(client.cantidad)}.`
                ),
              ],
              spacing: { after: 150 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'CLÁUSULA DE PAGO: ', bold: true }),
                new TextRun(
                  `Se pacta la cancelación en ${nd(client)} cuotas ${isWeekly ? 'semanales' : 'diarias'} de ${formatQ(client.cuota)} cada una.`
                ),
              ],
              spacing: { after: 150 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'CLÁUSULA DE MORA: ', bold: true }),
                new TextRun('A partir del 3er día de atraso, se generará una mora de Q5.00 diarios por cuota retrasada.'),
              ],
              spacing: { after: 150 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'LIBRE DE PROTESTO: ', bold: true }),
                new TextRun('Conforme al Art. 399 del Código de Comercio de Guatemala.'),
              ],
              spacing: { after: 300 },
            }),
            new Paragraph({
              text: 'Firma del Deudor: ____________________________',
              spacing: { after: 100 },
            }),
            new Paragraph({
              text: 'Firma del Acreedor: ___________________________',
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const safeName = sanitizeFileName(client.nombre || 'cliente');
    const filename = `contrato_pagare_${safeName}.docx`;

    await saveDocument({
      name: filename,
      folder: 'Contratos',
      format: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      blob,
      clientId: client.id,
      clientName: client.nombre,
      description: `Contrato de mutuo en Word`,
    });

    return { success: true, filename };
  } catch (err) {
    console.error('Error generating contract DOCX:', err);
    return { success: false, filename: '' };
  }
}

// -------------------------------------------------------------
// 4. REPORTES DE COBRANZA (Collection Reports): PDF, DOCX, XLSX
// -------------------------------------------------------------

export async function generateCollectionReportPdf(
  clients: Client[],
  mode: LoanType,
  dateStr: string,
  collectorName: string,
  period: 'diario' | 'semanal' | 'mensual' = 'diario'
): Promise<{ success: boolean; filename: string }> {
  try {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const margin = 14;
    let y = 18;
    const periodLabel = period === 'diario' ? 'Diario' : period === 'semanal' ? 'Semanal' : 'Mensual';

    const activeClients = clients.filter((c) => c.tipo === mode && !c.cerrado);
    let totalRecaudado = 0;
    let cobrosCount = 0;
    const cobrados: Array<{ client: Client; amount: number; time: string; quotaIdx: number; firma: string }> = [];

    activeClients.forEach((c) => {
      c.rows.forEach((r, idx) => {
        if (r.f === dateStr && Number(r.m) > 0) {
          cobrados.push({
            client: c,
            amount: Number(r.m),
            time: r.h,
            quotaIdx: idx + 1,
            firma: r.firma,
          });
          totalRecaudado += Number(r.m);
          cobrosCount++;
        }
      });
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138);
    doc.text('TU CRÉDITO', margin, y);

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`REPORTE DE COBRANZA ${periodLabel.toUpperCase()}`, 210 - margin, y, { align: 'right' });

    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Fecha: ${formatDateGt(dateStr)} · Sección: ${mode === 's' ? 'Semanal' : 'Diaria'}`, margin, y);
    doc.text(`Cobrador: ${collectorName || 'Agente'}`, 210 - margin, y, { align: 'right' });

    y += 5;
    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(0.5);
    doc.line(margin, y, 210 - margin, y);

    y += 8;

    // Summary Box
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, 210 - margin * 2, 14, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 58, 138);
    doc.text('TOTAL RECAUDADO:', margin + 4, y + 9);
    doc.setFontSize(13);
    doc.text(formatQ(totalRecaudado), margin + 65, y + 9.5);
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Total de cobros: ${cobrosCount}`, 210 - margin - 4, y + 9, { align: 'right' });

    y += 20;

    // Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('DETALLE DE COBROS EFECTUADOS', margin, y);

    y += 4;
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, 210 - margin * 2, 6, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text('No.', margin + 2, y + 4);
    doc.text('Hora', margin + 12, y + 4);
    doc.text('Cliente', margin + 30, y + 4);
    doc.text('Ubicación', margin + 80, y + 4);
    doc.text('Cuota', margin + 130, y + 4);
    doc.text('Monto', margin + 155, y + 4);
    doc.text('Firma', margin + 175, y + 4);

    y += 6;
    doc.setFont('helvetica', 'normal');

    if (cobrados.length === 0) {
      doc.text('No se registraron cobros en esta fecha.', margin + 2, y + 5);
      y += 8;
    } else {
      cobrados.forEach((p, i) => {
        if (i % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, 210 - margin * 2, 5, 'F');
        }
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);
        doc.text(String(i + 1), margin + 2, y + 3.5);
        doc.text(p.time ? formatTime12h(p.time) : '—', margin + 12, y + 3.5);
        doc.text(p.client.nombre.slice(0, 26), margin + 30, y + 3.5);
        doc.text((p.client.lugar || '—').slice(0, 26), margin + 80, y + 3.5);
        doc.text(`#${p.quotaIdx}`, margin + 130, y + 3.5);
        doc.setFont('helvetica', 'bold');
        doc.text(formatQ(p.amount), margin + 155, y + 3.5);
        doc.setFont('helvetica', 'normal');
        doc.text((p.firma || '—').slice(0, 15), margin + 175, y + 3.5);
        y += 5;
      });
    }

    const filename = `reporte_cobranza_${period}_${dateStr}.pdf`;
    const blob = doc.output('blob');
    const folder = mode === 's' ? 'Cobros_Semanales' : 'Cobros_Diarios';

    await saveDocument({
      name: filename,
      folder,
      format: 'pdf',
      mimeType: 'application/pdf',
      blob,
      description: `Reporte de cobranza ${periodLabel} por ${formatQ(totalRecaudado)}`,
    });

    return { success: true, filename };
  } catch (err) {
    console.error('Error generating report PDF:', err);
    return { success: false, filename: '' };
  }
}

export async function generateCollectionReportDocx(
  clients: Client[],
  mode: LoanType,
  dateStr: string,
  collectorName: string,
  period: 'diario' | 'semanal' | 'mensual' = 'diario'
): Promise<{ success: boolean; filename: string }> {
  try {
    const periodLabel = period === 'diario' ? 'Diario' : period === 'semanal' ? 'Semanal' : 'Mensual';
    const activeClients = clients.filter((c) => c.tipo === mode && !c.cerrado);
    let totalRecaudado = 0;
    const tableRows = [
      new TableRow({
        children: [
          createBoldCell('No.'),
          createBoldCell('Hora'),
          createBoldCell('Cliente'),
          createBoldCell('Cuota'),
          createBoldCell('Monto'),
          createBoldCell('Cobrador'),
        ],
      }),
    ];

    let rowIdx = 1;
    activeClients.forEach((c) => {
      c.rows.forEach((r, idx) => {
        if (r.f === dateStr && Number(r.m) > 0) {
          totalRecaudado += Number(r.m);
          tableRows.push(
            new TableRow({
              children: [
                createTextCell(String(rowIdx++)),
                createTextCell(r.h ? formatTime12h(r.h) : '—'),
                createTextCell(c.nombre),
                createTextCell(`#${idx + 1}`),
                createTextCell(formatQ(Number(r.m))),
                createTextCell(r.firma || '—'),
              ],
            })
          );
        }
      });
    });

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: `TU CRÉDITO - REPORTE DE COBRANZA ${periodLabel.toUpperCase()}`,
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: `Fecha: ${formatDateGt(dateStr)} | Sección: ${mode === 's' ? 'Semanal' : 'Diaria'} | Cobrador: ${collectorName || 'Agente'}`,
              spacing: { after: 150 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'TOTAL RECAUDADO: ', bold: true }),
                new TextRun({ text: formatQ(totalRecaudado), bold: true }),
              ],
              spacing: { after: 200 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: tableRows,
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const filename = `reporte_cobranza_${period}_${dateStr}.docx`;

    await saveDocument({
      name: filename,
      folder: 'Word',
      format: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      blob,
      description: `Reporte de cobranza en Word`,
    });

    return { success: true, filename };
  } catch (err) {
    console.error('Error generating report DOCX:', err);
    return { success: false, filename: '' };
  }
}

export async function generateCollectionReportXlsx(
  clients: Client[],
  mode: LoanType,
  dateStr: string,
  collectorName: string,
  period: 'diario' | 'semanal' | 'mensual' = 'diario'
): Promise<{ success: boolean; filename: string }> {
  try {
    const periodLabel = period === 'diario' ? 'Diario' : period === 'semanal' ? 'Semanal' : 'Mensual';
    const activeClients = clients.filter((c) => c.tipo === mode && !c.cerrado);

    const sheetData: Array<Array<string | number>> = [
      [`TU CRÉDITO - REPORTE DE COBRANZA ${periodLabel.toUpperCase()}`],
      ['Fecha', formatDateGt(dateStr)],
      ['Modalidad', mode === 's' ? 'Cobro Semanal' : 'Cobro Diario'],
      ['Cobrador', collectorName || 'Agente'],
      [''],
      ['No.', 'Hora', 'Cliente', 'DPI', 'Ubicación', 'No. Cuota', 'Monto Abonado', 'Firma / Agente'],
    ];

    let total = 0;
    let count = 1;

    activeClients.forEach((c) => {
      c.rows.forEach((r, idx) => {
        if (r.f === dateStr && Number(r.m) > 0) {
          total += Number(r.m);
          sheetData.push([
            count++,
            r.h ? formatTime12h(r.h) : '',
            c.nombre,
            c.dpi || '',
            c.lugar || '',
            idx + 1,
            Number(r.m),
            r.firma || '',
          ]);
        }
      });
    });

    sheetData.push(['']);
    sheetData.push(['TOTAL RECAUDADO', total]);

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cobranza');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const filename = `reporte_cobranza_${period}_${dateStr}.xlsx`;
    const folder = mode === 's' ? 'Cobros_Semanales' : 'Cobros_Diarios';

    await saveDocument({
      name: filename,
      folder,
      format: 'xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      blob,
      description: `Reporte de cobranza en Excel`,
    });

    return { success: true, filename };
  } catch (err) {
    console.error('Error generating report XLSX:', err);
    return { success: false, filename: '' };
  }
}

// -------------------------------------------------------------
// 5. LISTADOS DE CLIENTES (Customer Roster): PDF, DOCX, XLSX
// -------------------------------------------------------------

export async function generateClientListPdf(clients: Client[], mode: LoanType): Promise<{ success: boolean; filename: string }> {
  try {
    const active = clients.filter((c) => c.tipo === mode);
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const margin = 14;
    let y = 18;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138);
    doc.text('TU CRÉDITO', margin, y);

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('DIRECTORIO DE CLIENTES Y CARTERA', 210 - margin, y, { align: 'right' });

    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Fecha: ${formatDateGt(isoToday())} · Total Clientes: ${active.length}`, margin, y);

    y += 6;
    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(0.5);
    doc.line(margin, y, 210 - margin, y);

    y += 6;
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, 210 - margin * 2, 6, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text('No.', margin + 2, y + 4);
    doc.text('Cliente', margin + 12, y + 4);
    doc.text('DPI', margin + 65, y + 4);
    doc.text('Teléfono', margin + 95, y + 4);
    doc.text('Otorgado', margin + 125, y + 4);
    doc.text('Cuota', margin + 145, y + 4);
    doc.text('Pagos', margin + 163, y + 4);
    doc.text('Saldo', margin + 175, y + 4);

    y += 6;
    doc.setFont('helvetica', 'normal');

    active.forEach((c, i) => {
      const k = calculateLoan(c);
      if (i % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, 210 - margin * 2, 5, 'F');
      }
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text(String(i + 1), margin + 2, y + 3.5);
      doc.text((c.nombre || 'Sin nombre').slice(0, 28), margin + 12, y + 3.5);
      doc.text((c.dpi || '—').slice(0, 16), margin + 65, y + 3.5);
      doc.text(c.tel || '—', margin + 95, y + 3.5);
      doc.text(formatQ(c.cantidad), margin + 125, y + 3.5);
      doc.text(formatQ(c.cuota), margin + 145, y + 3.5);
      doc.text(`${k.n}/${nd(c)}`, margin + 163, y + 3.5);
      doc.setFont('helvetica', 'bold');
      doc.text(formatQ(k.saldo), margin + 175, y + 3.5);
      doc.setFont('helvetica', 'normal');

      y += 5;
    });

    const filename = `directorio_clientes_${mode === 's' ? 'semanal' : 'diario'}.pdf`;
    const blob = doc.output('blob');

    await saveDocument({
      name: filename,
      folder: 'Clientes',
      format: 'pdf',
      mimeType: 'application/pdf',
      blob,
      description: `Directorio de clientes (${active.length} registros)`,
    });

    return { success: true, filename };
  } catch (err) {
    console.error('Error generating client list PDF:', err);
    return { success: false, filename: '' };
  }
}

export async function generateClientListXlsx(clients: Client[], mode: LoanType): Promise<{ success: boolean; filename: string }> {
  try {
    const active = clients.filter((c) => c.tipo === mode);

    const sheetData: Array<Array<string | number>> = [
      ['TU CRÉDITO - DIRECTORIO Y CARTERA DE CLIENTES'],
      ['Modalidad', mode === 's' ? 'Cobros Semanales' : 'Cobros Diarios'],
      ['Fecha de Emisión', formatDateGt(isoToday())],
      ['Total de Clientes', active.length],
      [''],
      [
        'No.',
        'Nombre Completo',
        'DPI / CUI',
        'Teléfono',
        'Ubicación / Negocio',
        'Monto Otorgado',
        'Cuota',
        'Cuotas Pagadas',
        'Cuotas Pendientes',
        'Total Pagado',
        'Saldo Pendiente',
        'Mora Pendiente',
        'Fecha Inicio',
      ],
    ];

    active.forEach((c, idx) => {
      const k = calculateLoan(c);
      sheetData.push([
        idx + 1,
        c.nombre,
        c.dpi || '',
        c.tel || '',
        c.lugar || '',
        safeNumber(c.cantidad),
        safeNumber(c.cuota),
        k.n,
        nd(c) - k.n,
        k.ab,
        k.saldo,
        k.moraPend,
        c.inicio || '',
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cartera_Clientes');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const filename = `cartera_clientes_${mode === 's' ? 'semanal' : 'diario'}.xlsx`;

    await saveDocument({
      name: filename,
      folder: 'Clientes',
      format: 'xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      blob,
      description: `Cartera de clientes en Excel (${active.length} registros)`,
    });

    return { success: true, filename };
  } catch (err) {
    console.error('Error generating client list XLSX:', err);
    return { success: false, filename: '' };
  }
}
