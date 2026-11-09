import { Client } from '../types';
import { calculateLoan, formatDateGt, formatQ, isoToday, nd } from './calculations';
import { generateStatementPdf as generateDocStatementPdf } from './documentGenerators';

export function generateStatementPdf(client: Client): boolean {
  generateDocStatementPdf(client).catch((err) => {
    console.error('Error generating statement PDF:', err);
  });
  return true;
}

export function getStatementPlainText(client: Client): string {
  const k = calculateLoan(client);
  const isWeekly = client.tipo === 's';
  const lines: string[] = [
    `*TU CRÉDITO · ESTADO DE CUENTA*`,
    `Fecha de emisión: ${formatDateGt(isoToday())}`,
    ``,
    `Cliente: ${client.nombre || '-'}`,
    `DPI / CUI: ${client.dpi || '-'}`,
    `Lugar: ${client.lugar || '-'}`,
    `Teléfono: ${client.tel || '-'}`,
    ``,
    `Modalidad: ${isWeekly ? 'Cobro Semanal (6 semanas)' : 'Cobro Diario (23 cuotas)'}`,
    `Monto otorgado: ${formatQ(client.cantidad)}`,
    `Cuota: ${formatQ(client.cuota)}`,
    `Total financiamiento: ${formatQ(k.total)}`,
    ``,
    `• Cuotas pagadas: ${k.n} de ${nd(client)}`,
    `• Total abonado: ${formatQ(k.ab)}`,
    `• SALDO PENDIENTE: ${formatQ(k.saldo)}`,
    `• Mora pendiente: ${formatQ(k.moraPend)}`,
  ];

  return lines.join('\n');
}
