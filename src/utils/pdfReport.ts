import { jsPDF } from 'jspdf';
import { Client } from '../types';
import { currentTimeStr, dayOfWeekName, formatDateGt, formatQ, formatTime12h, isoToday, nd } from './calculations';

export interface DailyReportItem {
  nombre: string;
  tipo: string;
  hora: string;
  monto: number;
  cuotaIdx: number;
  totalCuotas: number;
  cobrador: string;
}

export interface DailyReportData {
  fecha: string;
  dia: string;
  items: DailyReportItem[];
  total: number;
  totalDiario: number;
  totalSemanal: number;
  countDiario: number;
  countSemanal: number;
}

export function buildDailyReportData(clients: Client[], targetDate?: string): DailyReportData {
  const f = targetDate || isoToday();
  const items: DailyReportItem[] = [];
  let total = 0;
  let totalDiario = 0;
  let totalSemanal = 0;
  let countDiario = 0;
  let countSemanal = 0;

  clients.forEach((c) => {
    // Current loan rows
    c.rows.forEach((r, idx) => {
      if (r.f === f && Number(r.m) > 0) {
        const isWeekly = c.tipo === 's';
        const m = Number(r.m);
        items.push({
          nombre: c.nombre || 'Sin nombre',
          tipo: isWeekly ? 'Semanal' : 'Diario',
          hora: r.h || '',
          monto: m,
          cuotaIdx: idx + 1,
          totalCuotas: nd(c),
          cobrador: r.firma || '',
        });
        total += m;
        if (isWeekly) {
          totalSemanal += m;
          countSemanal++;
        } else {
          totalDiario += m;
          countDiario++;
        }
      }
    });

    // Also include completed loans from history if on the same date
    (c.hist || []).forEach((h) => {
      (h.rows || []).forEach((r, idx) => {
        if (r.f === f && Number(r.m) > 0) {
          const isWeekly = c.tipo === 's';
          const m = Number(r.m);
          items.push({
            nombre: `${c.nombre || 'Sin nombre'} (Renovado)`,
            tipo: isWeekly ? 'Semanal' : 'Diario',
            hora: r.h || '',
            monto: m,
            cuotaIdx: idx + 1,
            totalCuotas: nd(c),
            cobrador: r.firma || '',
          });
          total += m;
          if (isWeekly) {
            totalSemanal += m;
            countSemanal++;
          } else {
            totalDiario += m;
            countDiario++;
          }
        }
      });
    });
  });

  items.sort((a, b) => (a.hora < b.hora ? -1 : a.hora > b.hora ? 1 : 0));

  return {
    fecha: f,
    dia: dayOfWeekName(f),
    items,
    total,
    totalDiario,
    totalSemanal,
    countDiario,
    countSemanal,
  };
}

export function generateDailyReportPdf(report: DailyReportData): boolean {
  try {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const margin = 14;
    let y = 18;

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138);
    doc.text('TU CRÉDITO', margin, y);

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('REPORTE GENERAL DE COBROS DEL DÍA', 210 - margin, y, { align: 'right' });

    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    const diaFormatted = report.dia.charAt(0).toUpperCase() + report.dia.slice(1);
    doc.text(`${diaFormatted}, ${formatDateGt(report.fecha)}`, margin, y);
    doc.text(`Generado: ${formatDateGt(isoToday())} · ${currentTimeStr()}`, 210 - margin, y, { align: 'right' });

    y += 5;
    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(0.6);
    doc.line(margin, y, 210 - margin, y);

    y += 8;

    // Summary Statistics Cards
    const stats = [
      { label: 'Total Cobrado', val: formatQ(report.total), color: [16, 185, 129] },
      { label: 'Total Cobros', val: String(report.items.length), color: [30, 58, 138] },
      { label: `Diarios (${report.countDiario})`, val: formatQ(report.totalDiario), color: [59, 130, 246] },
      { label: `Semanales (${report.countSemanal})`, val: formatQ(report.totalSemanal), color: [139, 92, 246] },
    ];

    const boxW = (210 - margin * 2 - 9) / 4;
    stats.forEach((st, i) => {
      const bx = margin + i * (boxW + 3);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(st.color[0], st.color[1], st.color[2]);
      doc.setLineWidth(0.8);
      doc.roundedRect(bx, y, boxW, 14, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(st.label, bx + 3, y + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(st.color[0], st.color[1], st.color[2]);
      doc.text(st.val, bx + 3, y + 10.5);
    });

    y += 18;

    // Table Header
    const colW = [18, 18, 56, 20, 22, 26, 22];
    const headers = ['Hora', 'Tipo', 'Cliente', 'Pago', 'Cobrador', 'Monto (Q)', 'Firma'];

    doc.setFillColor(30, 58, 138);
    doc.rect(margin, y, 210 - margin * 2, 6.5, 'F');
    let hx = margin;
    headers.forEach((h, i) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      const isRight = i === 5;
      doc.text(h, isRight ? hx + colW[i] - 1.5 : hx + 1.5, y + 4.5, { align: isRight ? 'right' : 'left' });
      hx += colW[i];
    });

    y += 6.5;

    if (report.items.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text('No hay cobros registrados en esta fecha.', margin, y + 10);
    } else {
      report.items.forEach((item, idx) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }

        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, 210 - margin * 2, 6, 'F');
        }

        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.15);
        doc.line(margin, y + 6, 210 - margin, y + 6);

        let rx = margin;
        const rowVals = [
          formatTime12h(item.hora) || '--:--',
          item.tipo,
          item.nombre.slice(0, 32),
          `${item.cuotaIdx} de ${item.totalCuotas}`,
          item.cobrador.slice(0, 14),
          formatQ(item.monto),
          '',
        ];

        rowVals.forEach((val, j) => {
          doc.setFont('helvetica', j === 5 ? 'bold' : 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(15, 23, 42);
          const isRight = j === 5;
          doc.text(val, isRight ? rx + colW[j] - 1.5 : rx + 1.5, y + 4.2, { align: isRight ? 'right' : 'left' });
          rx += colW[j];
        });

        y += 6;
      });

      // Total Final Row
      if (y > 265) {
        doc.addPage();
        y = 20;
      }
      doc.setFillColor(220, 252, 231);
      doc.rect(margin, y, 210 - margin * 2, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(22, 101, 52);
      doc.text('TOTAL RECAUDADO DEL DÍA:', margin + 3, y + 5.5);
      doc.setFontSize(11);
      doc.text(formatQ(report.total), 210 - margin - 25, y + 5.5, { align: 'right' });
    }

    doc.save(`reporte-cobros-${report.fecha}.pdf`);
    return true;
  } catch (err) {
    console.error('Error generating daily report PDF:', err);
    return false;
  }
}
