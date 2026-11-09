import { Client, LoanType } from '../types';
import { calculateLoan, formatDateGt, formatQ, formatTime12h, isoToday, nd, promissoryNoteText } from './calculations';

function executePrint(htmlContent: string, title: string = 'Documento Tu Crédito'): void {
  // Create an isolated hidden iframe for printing
  const existingFrame = document.getElementById('tucredito-print-iframe');
  if (existingFrame) {
    document.body.removeChild(existingFrame);
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'tucredito-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @page {
            size: auto;
            margin: 10mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            margin: 0;
            padding: 0;
            font-size: 11pt;
            line-height: 1.4;
          }
          h1, h2, h3, h4 {
            margin: 0;
            color: #1e3a8a;
          }
          .header-box {
            border-bottom: 2px solid #1e3a8a;
            padding-bottom: 8px;
            margin-bottom: 14px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .title-main {
            font-size: 18pt;
            font-weight: 900;
            letter-spacing: -0.5px;
          }
          .subtitle {
            font-size: 9pt;
            color: #475569;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
            font-size: 9.5pt;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 6px 8px;
            text-align: left;
          }
          th {
            background-color: #f1f5f9;
            font-weight: bold;
            color: #1e293b;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 8pt;
            font-weight: bold;
          }
          .badge-paid { background: #dcfce7; color: #166534; }
          .badge-due { background: #fee2e2; color: #991b1b; }
          .legal-box {
            border: 1px solid #94a3b8;
            padding: 10px;
            background: #f8fafc;
            border-radius: 4px;
            font-size: 8pt;
            line-height: 1.35;
            margin-top: 14px;
            text-align: justify;
          }
          .signatures {
            margin-top: 36px;
            display: flex;
            justify-content: space-between;
            gap: 20px;
          }
          .sig-line {
            flex: 1;
            border-top: 1px solid #475569;
            padding-top: 6px;
            text-align: center;
            font-size: 8.5pt;
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.warn('iframe print fallback:', err);
      window.print();
    }
  }, 350);
}

// 1. Imprimir Recibo de Cobro
export function printReceipt(client: Client, collectorName: string, quotaIndex?: number): void {
  const hoy = isoToday();
  const k = calculateLoan(client);
  const isWeekly = client.tipo === 's';

  let payments = client.rows
    .map((r, idx) => ({ ...r, idx: idx + 1 }))
    .filter((r) => r.f === hoy && Number(r.m) > 0);

  if (payments.length === 0 && quotaIndex) {
    const row = client.rows[quotaIndex - 1];
    if (row && Number(row.m) > 0) {
      payments = [{ ...row, idx: quotaIndex }];
    }
  }

  // Fallback to last recorded payment
  if (payments.length === 0) {
    const lastRowIdx = client.rows.findLastIndex((r) => Number(r.m) > 0);
    if (lastRowIdx >= 0) {
      payments = [{ ...client.rows[lastRowIdx], idx: lastRowIdx + 1 }];
    }
  }

  const receiptNo = `R-${hoy.replace(/-/g, '')}-${client.id.slice(-4)}`;
  const totalPaid = payments.reduce((acc, p) => acc + Number(p.m), 0);

  const html = `
    <div style="max-width: 500px; margin: 0 auto; border: 1px dashed #94a3b8; padding: 16px;">
      <div class="header-box">
        <div>
          <div class="title-main">TU CRÉDITO</div>
          <div class="subtitle">Microcréditos y Cobranzas · Guatemala</div>
        </div>
        <div class="text-right">
          <div class="font-bold" style="font-size: 11pt;">COMPROBANTE DE PAGO</div>
          <div class="subtitle">No. ${receiptNo}</div>
          <div class="subtitle">${formatDateGt(hoy)} ${payments[0]?.h || ''}</div>
        </div>
      </div>

      <table style="margin-bottom: 10px;">
        <tr>
          <td style="width: 30%; background: #f8fafc;" class="font-bold">Cliente:</td>
          <td>${client.nombre || 'No registrado'}</td>
        </tr>
        <tr>
          <td style="background: #f8fafc;" class="font-bold">DPI:</td>
          <td>${client.dpi || 'N/A'}</td>
        </tr>
        <tr>
          <td style="background: #f8fafc;" class="font-bold">Establecimiento:</td>
          <td>${client.lugar || 'En campo'}</td>
        </tr>
      </table>

      <table>
        <thead>
          <tr>
            <th>Cuota</th>
            <th>Hora</th>
            <th class="text-right">Monto</th>
          </tr>
        </thead>
        <tbody>
          ${payments
            .map(
              (p) => `
            <tr>
              <td>Cuota #${p.idx} de ${nd(client)} (${isWeekly ? 'Semanal' : 'Diaria'})</td>
              <td>${formatTime12h(p.h)}</td>
              <td class="text-right font-bold">${formatQ(Number(p.m))}</td>
            </tr>
          `
            )
            .join('')}
          <tr style="background: #f1f5f9;">
            <td colspan="2" class="font-bold">TOTAL RECIBIDO:</td>
            <td class="text-right font-bold" style="font-size: 12pt; color: #1e3a8a;">${formatQ(totalPaid)}</td>
          </tr>
        </tbody>
      </table>

      <table style="margin-top: 8px;">
        <tr>
          <td style="width: 50%;">Total cuotas completadas: <b>${k.n} de ${nd(client)}</b></td>
          <td style="width: 50%;" class="text-right">Saldo pendiente: <b style="color: #b91c1c;">${formatQ(k.saldo)}</b></td>
        </tr>
        <tr>
          <td colspan="2">Estado de mora: <b>${k.moraPend > 0 ? formatQ(k.moraPend) + ' pendiente' : 'Sin atrasos'}</b></td>
        </tr>
      </table>

      <div class="signatures" style="margin-top: 28px;">
        <div class="sig-line">
          <b>${collectorName || 'Cobrador'}</b><br />
          Firma del Cobrador
        </div>
        <div class="sig-line">
          <b>${client.nombre || 'Cliente'}</b><br />
          Firma del Cliente
        </div>
      </div>

      <p class="text-center subtitle" style="margin-top: 16px;">¡Gracias por su puntualidad y preferencia!</p>
    </div>
  `;

  executePrint(html, `Recibo_${client.nombre || 'Cliente'}`);
}

// 2. Imprimir Estado de Cuenta
export function printStatement(client: Client): void {
  const k = calculateLoan(client);
  const isWeekly = client.tipo === 's';

  const rowsHtml = client.rows
    .map((r, idx) => {
      const st = k.st[idx];
      const isPaid = Number(r.m) > 0;
      return `
      <tr>
        <td class="text-center font-bold">#${idx + 1}</td>
        <td>${formatDateGt(st.due)}</td>
        <td>${r.f ? formatDateGt(r.f) : '—'}</td>
        <td>${r.h ? formatTime12h(r.h) : '—'}</td>
        <td class="text-right font-bold">${isPaid ? formatQ(Number(r.m)) : '—'}</td>
        <td class="text-center">
          ${isPaid ? '<span class="badge badge-paid">Pagado</span>' : st.late ? '<span class="badge badge-due">Atrasado</span>' : 'Pendiente'}
        </td>
        <td>${r.firma || '—'}</td>
      </tr>
    `;
    })
    .join('');

  const html = `
    <div>
      <div class="header-box">
        <div>
          <div class="title-main">TU CRÉDITO</div>
          <div class="subtitle">Control de Cartera y Cobranzas · Guatemala</div>
        </div>
        <div class="text-right">
          <div class="font-bold" style="font-size: 13pt;">ESTADO DE CUENTA</div>
          <div class="subtitle">Emisión: ${formatDateGt(isoToday())}</div>
        </div>
      </div>

      <div style="display: flex; gap: 20px; margin-bottom: 10px;">
        <table style="flex: 1; margin: 0;">
          <tr><td style="width: 35%; background: #f8fafc;" class="font-bold">Cliente:</td><td>${client.nombre || 'No registrado'}</td></tr>
          <tr><td style="background: #f8fafc;" class="font-bold">DPI:</td><td>${client.dpi || 'N/A'}</td></tr>
          <tr><td style="background: #f8fafc;" class="font-bold">Ubicación:</td><td>${client.lugar || 'No indicada'}</td></tr>
          <tr><td style="background: #f8fafc;" class="font-bold">Teléfono:</td><td>${client.tel || 'No registrado'}</td></tr>
        </table>
        <table style="flex: 1; margin: 0;">
          <tr><td style="width: 45%; background: #f8fafc;" class="font-bold">Modalidad:</td><td>${isWeekly ? 'Semanal (6 cuotas)' : 'Diaria (23 cuotas)'}</td></tr>
          <tr><td style="background: #f8fafc;" class="font-bold">Monto otorgado:</td><td class="font-bold">${formatQ(client.cantidad)}</td></tr>
          <tr><td style="background: #f8fafc;" class="font-bold">Cuota pactada:</td><td class="font-bold">${formatQ(client.cuota)}</td></tr>
          <tr><td style="background: #f8fafc;" class="font-bold">Total a pagar:</td><td class="font-bold">${formatQ(k.total)}</td></tr>
        </table>
      </div>

      <div style="display: flex; gap: 10px; margin: 12px 0;">
        <div style="flex: 1; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; text-align: center;">
          <div class="subtitle">Total Abonado</div>
          <div style="font-size: 13pt; font-weight: bold; color: #166534;">${formatQ(k.ab)}</div>
        </div>
        <div style="flex: 1; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; text-align: center;">
          <div class="subtitle">Saldo Pendiente</div>
          <div style="font-size: 13pt; font-weight: bold; color: #b91c1c;">${formatQ(k.saldo)}</div>
        </div>
        <div style="flex: 1; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; text-align: center;">
          <div class="subtitle">Cuotas Pagadas</div>
          <div style="font-size: 13pt; font-weight: bold;">${k.n} de ${nd(client)}</div>
        </div>
        <div style="flex: 1; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; text-align: center;">
          <div class="subtitle">Mora Pendiente</div>
          <div style="font-size: 13pt; font-weight: bold; color: #b45309;">${formatQ(k.moraPend)}</div>
        </div>
      </div>

      <h4>Tabla Detallada de Pagos y Saldos</h4>
      <table>
        <thead>
          <tr>
            <th class="text-center">No.</th>
            <th>Programada</th>
            <th>Fecha Pago</th>
            <th>Hora</th>
            <th class="text-right">Abono</th>
            <th class="text-center">Estado</th>
            <th>Cobrador</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="legal-box">
        <b>PAGARÉ / COMPROMISO DE PAGO:</b><br />
        "${promissoryNoteText(client)}"
      </div>

      <div class="signatures">
        <div class="sig-line">
          <b>${client.nombre || 'Firma del Cliente'}</b><br />
          DPI: ${client.dpi || '______________________'}
        </div>
        <div class="sig-line">
          <b>Tu Crédito</b><br />
          Firma y Sello de Cobranza
        </div>
      </div>
    </div>
  `;

  executePrint(html, `Estado_Cuenta_${client.nombre || 'Cliente'}`);
}

// 3. Imprimir Reporte de Cobranza (Diario, Semanal, Mensual)
export function printCollectionReport(
  clients: Client[],
  mode: LoanType,
  dateStr: string,
  collectorName: string,
  period: 'diario' | 'semanal' | 'mensual' = 'diario'
): void {
  const periodLabel = period === 'diario' ? 'Diario' : period === 'semanal' ? 'Semanal' : 'Mensual';

  // Calculate metrics
  const activeClients = clients.filter((c) => c.tipo === mode && !c.cerrado);
  let totalRecaudado = 0;
  let cobrosCount = 0;
  const cobradosRows: Array<{ client: Client; amount: number; time: string; quotaIdx: number; firma: string }> = [];
  const pendientesRows: Array<{ client: Client; saldo: number; cuota: number; semTxt: string }> = [];

  activeClients.forEach((c) => {
    const k = calculateLoan(c);
    let paidInPeriod = false;

    c.rows.forEach((r, idx) => {
      if (r.f === dateStr && Number(r.m) > 0) {
        cobradosRows.push({
          client: c,
          amount: Number(r.m),
          time: r.h,
          quotaIdx: idx + 1,
          firma: r.firma,
        });
        totalRecaudado += Number(r.m);
        cobrosCount++;
        paidInPeriod = true;
      }
    });

    if (!paidInPeriod && k.saldo > 0) {
      pendientesRows.push({
        client: c,
        saldo: k.saldo,
        cuota: Number(c.cuota),
        semTxt: k.moraPend > 0 ? `Mora ${formatQ(k.moraPend)}` : 'Pendiente',
      });
    }
  });

  const html = `
    <div>
      <div class="header-box">
        <div>
          <div class="title-main">TU CRÉDITO</div>
          <div class="subtitle">Reporte Oficial de Cobranza · ${periodLabel}</div>
        </div>
        <div class="text-right">
          <div class="font-bold" style="font-size: 13pt;">REPORTE ${periodLabel.toUpperCase()}</div>
          <div class="subtitle">Fecha: ${formatDateGt(dateStr)} · Sección: ${mode === 's' ? 'Semanal' : 'Diaria'}</div>
          <div class="subtitle">Cobrador: ${collectorName || 'Agente'}</div>
        </div>
      </div>

      <div style="display: flex; gap: 10px; margin-bottom: 14px;">
        <div style="flex: 1; padding: 10px; border: 1px solid #cbd5e1; border-radius: 4px; text-align: center; background: #f8fafc;">
          <div class="subtitle">Total Recaudado</div>
          <div style="font-size: 14pt; font-weight: bold; color: #166534;">${formatQ(totalRecaudado)}</div>
        </div>
        <div style="flex: 1; padding: 10px; border: 1px solid #cbd5e1; border-radius: 4px; text-align: center; background: #f8fafc;">
          <div class="subtitle">Abonos Registrados</div>
          <div style="font-size: 14pt; font-weight: bold; color: #1e3a8a;">${cobrosCount} cobros</div>
        </div>
        <div style="flex: 1; padding: 10px; border: 1px solid #cbd5e1; border-radius: 4px; text-align: center; background: #f8fafc;">
          <div class="subtitle">Clientes en Cartera</div>
          <div style="font-size: 14pt; font-weight: bold;">${activeClients.length} activos</div>
        </div>
      </div>

      <h4>1. Cobros Realizados (${cobrosCount})</h4>
      <table>
        <thead>
          <tr>
            <th>No.</th>
            <th>Hora</th>
            <th>Cliente</th>
            <th>Ubicación</th>
            <th class="text-center">Cuota</th>
            <th class="text-right">Monto Recibido</th>
            <th>Firma</th>
          </tr>
        </thead>
        <tbody>
          ${
            cobradosRows.length > 0
              ? cobradosRows
                  .map(
                    (p, i) => `
              <tr>
                <td class="text-center">${i + 1}</td>
                <td>${formatTime12h(p.time)}</td>
                <td class="font-bold">${p.client.nombre}</td>
                <td>${p.client.lugar || '—'}</td>
                <td class="text-center">#${p.quotaIdx}</td>
                <td class="text-right font-bold">${formatQ(p.amount)}</td>
                <td>${p.firma || '—'}</td>
              </tr>
            `
                  )
                  .join('')
              : `<tr><td colspan="7" class="text-center subtitle">No se registraron cobros en esta fecha</td></tr>`
          }
        </tbody>
      </table>

      <h4 style="margin-top: 18px;">2. Clientes Pendientes / En Cartera (${pendientesRows.length})</h4>
      <table>
        <thead>
          <tr>
            <th>No.</th>
            <th>Cliente</th>
            <th>Teléfono</th>
            <th>Ubicación</th>
            <th class="text-right">Cuota</th>
            <th class="text-right">Saldo</th>
            <th>Observación</th>
          </tr>
        </thead>
        <tbody>
          ${
            pendientesRows.length > 0
              ? pendientesRows
                  .slice(0, 40)
                  .map(
                    (p, i) => `
              <tr>
                <td class="text-center">${i + 1}</td>
                <td>${p.client.nombre}</td>
                <td>${p.client.tel || '—'}</td>
                <td>${p.client.lugar || '—'}</td>
                <td class="text-right">${formatQ(p.cuota)}</td>
                <td class="text-right font-bold">${formatQ(p.saldo)}</td>
                <td>${p.semTxt}</td>
              </tr>
            `
                  )
                  .join('')
              : `<tr><td colspan="7" class="text-center subtitle">Todos los clientes abonaron hoy</td></tr>`
          }
        </tbody>
      </table>

      <div class="signatures">
        <div class="sig-line">
          <b>${collectorName || 'Cobrador'}</b><br />
          Firma del Cobrador
        </div>
        <div class="sig-line">
          <b>Supervisión / Auditoría</b><br />
          Revisado y Conforme
        </div>
      </div>
    </div>
  `;

  executePrint(html, `Reporte_Cobranza_${periodLabel}_${dateStr}`);
}

// 4. Imprimir Contrato y Pagaré Legal
export function printContract(client: Client): void {
  const k = calculateLoan(client);
  const isWeekly = client.tipo === 's';

  const html = `
    <div>
      <div class="header-box">
        <div>
          <div class="title-main">TU CRÉDITO</div>
          <div class="subtitle">Microfinanzas y Préstamos Comerciales · Guatemala</div>
        </div>
        <div class="text-right">
          <div class="font-bold" style="font-size: 13pt;">CONTRATO DE MUTUO Y PAGARÉ</div>
          <div class="subtitle">Código de Comercio de Guatemala (Art. 385, 386 y 490)</div>
        </div>
      </div>

      <div style="font-size: 9.5pt; text-align: justify; line-height: 1.5; margin: 16px 0;">
        <p>
          En la Ciudad de Guatemala, el día <b>${formatDateGt(client.inicio || isoToday())}</b>, comparece el/la señor(a)
          <b>${client.nombre || '_____________________________________'}</b>, quien se identifica con el Documento Personal de
          Identificación (DPI) con Código Único de Identificación (CUI) número <b>${client.dpi || '________________________'}</b>,
          con domicilio y residencia en <b>${client.lugar || '_____________________________________'}</b>, teléfono <b>${client.tel || '________'}</b>;
          por este acto reconoce que debe y pagará incondicionalmente a la orden de <b>TU CRÉDITO</b> la cantidad total de
          <b>${formatQ(k.total)}</b> (QUETZALES EXACTOS), correspondiente al capital mutuado de <b>${formatQ(client.cantidad)}</b>
          más los costos financieros acordados.
        </p>

        <p>
          <b>CONDICIONES DE PAGO:</b> El deudor se compromete y obliga a pagar la suma adeudada mediante
          <b>${nd(client)} cuotas ${isWeekly ? 'semanales' : 'diarias'}</b> consecutivas de <b>${formatQ(client.cuota)}</b> cada una,
          a partir del día <b>${formatDateGt(client.inicio)}</b>.
        </p>

        <p>
          <b>MORA E INCUMPLIMIENTO:</b> En caso de atraso en el pago de cualquiera de las cuotas pactadas, transcurridos tres (3) días
          de gracia contados a partir de la fecha de vencimiento, el deudor devengará automáticamente y sin necesidad de requerimiento alguno
          la suma de <b>Q5.00 diarios</b> en concepto de cláusula penal e indemnización por mora.
        </p>

        <p>
          <b>LIBRE DE PROTESTO:</b> El presente título se suscribe con la cláusula <b>LIBRE DE PROTESTO</b> conforme a lo regulado en el
          Artículo 399 del Código de Comercio de Guatemala, exonerando al tenedor de la obligación de efectuar el protesto legal, bastando su
          sola presentación para exigir judicial o extrajudicialmente el pago total del saldo adeudado, costas procesales y daños.
        </p>
      </div>

      <table>
        <tr>
          <td style="width: 25%; background: #f8fafc;" class="font-bold">Monto del Préstamo:</td>
          <td class="font-bold">${formatQ(client.cantidad)}</td>
          <td style="width: 25%; background: #f8fafc;" class="font-bold">Total a Pagar:</td>
          <td class="font-bold">${formatQ(k.total)}</td>
        </tr>
        <tr>
          <td style="background: #f8fafc;" class="font-bold">Número de Cuotas:</td>
          <td>${nd(client)} (${isWeekly ? 'Semanales' : 'Diarias'})</td>
          <td style="background: #f8fafc;" class="font-bold">Valor de la Cuota:</td>
          <td class="font-bold">${formatQ(client.cuota)}</td>
        </tr>
      </table>

      <div class="signatures" style="margin-top: 50px;">
        <div class="sig-line">
          <br /><br />
          <b>${client.nombre || 'Firma del Deudor'}</b><br />
          DPI / CUI: ${client.dpi || '________________________'}
        </div>
        <div class="sig-line">
          <br /><br />
          <b>Tu Crédito</b><br />
          Acreedor / Representante Autorizado
        </div>
      </div>
    </div>
  `;

  executePrint(html, `Contrato_Mutuo_${client.nombre || 'Cliente'}`);
}

// 5. Imprimir Listado Completo de Clientes
export function printClientList(clients: Client[], mode: LoanType): void {
  const active = clients.filter((c) => c.tipo === mode);

  const html = `
    <div>
      <div class="header-box">
        <div>
          <div class="title-main">TU CRÉDITO</div>
          <div class="subtitle">Directorio de Clientes y Cartera · ${mode === 's' ? 'Cobros Semanales' : 'Cobros Diarios'}</div>
        </div>
        <div class="text-right">
          <div class="font-bold">DIRECTORIO GENERAL</div>
          <div class="subtitle">Emisión: ${formatDateGt(isoToday())} · Total: ${active.length} clientes</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>No.</th>
            <th>Cliente</th>
            <th>DPI</th>
            <th>Teléfono</th>
            <th>Ubicación</th>
            <th class="text-right">Otorgado</th>
            <th class="text-right">Cuota</th>
            <th class="text-center">Pagos</th>
            <th class="text-right">Saldo</th>
          </tr>
        </thead>
        <tbody>
          ${active
            .map((c, i) => {
              const k = calculateLoan(c);
              return `
              <tr>
                <td class="text-center">${i + 1}</td>
                <td class="font-bold">${c.nombre || 'Sin nombre'}</td>
                <td>${c.dpi || '—'}</td>
                <td>${c.tel || '—'}</td>
                <td>${c.lugar || '—'}</td>
                <td class="text-right">${formatQ(c.cantidad)}</td>
                <td class="text-right">${formatQ(c.cuota)}</td>
                <td class="text-center">${k.n}/${nd(c)}</td>
                <td class="text-right font-bold">${formatQ(k.saldo)}</td>
              </tr>
            `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  executePrint(html, `Listado_Clientes_${mode === 's' ? 'Semanal' : 'Diario'}`);
}
