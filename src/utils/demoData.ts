import { Client, PaymentRow } from '../types';
import { createBlankRows, isoToday } from './calculations';

export function getDemoClients(): Client[] {
  const hoy = isoToday();
  const dToday = new Date();

  // Helper to subtract days
  const subDays = (n: number) => {
    const d = new Date(dToday);
    d.setDate(d.getDate() - n);
    const m = d.getMonth() + 1;
    const k = d.getDate();
    return `${d.getFullYear()}-${m < 10 ? '0' : ''}${m}-${k < 10 ? '0' : ''}${k}`;
  };

  // 1. Daily loan - Al día / Pagó hoy (Q1,000 otorgado, cuota Q60)
  const rows1 = createBlankRows('d');
  // Fill 8 past payments
  for (let i = 0; i < 7; i++) {
    rows1[i] = {
      f: subDays(8 - i),
      h: '09:30',
      m: 60,
      firma: 'Cobrador Principal',
      mp: false,
    };
  }
  // 8th payment made today!
  rows1[7] = {
    f: hoy,
    h: '10:15',
    m: 60,
    firma: 'Cobrador Principal',
    mp: false,
  };

  const client1: Client = {
    id: 'c_demo_1',
    tipo: 'd',
    nombre: 'Marta Julia Morales Estrada',
    dpi: '2415 89123 0101',
    lugar: 'Mercado Central, Puesto #14 (Verduras)',
    tel: '5512 8890',
    cantidad: 1000,
    cuota: 60,
    inicio: subDays(8),
    dom: true,
    guardado: true,
    fotos: {},
    rows: rows1,
  };

  // 2. Daily loan - Por cobrar hoy (Q500 otorgado, cuota Q30)
  const rows2 = createBlankRows('d');
  rows2[0] = { f: subDays(3), h: '08:45', m: 30, firma: 'Cobrador Principal', mp: false };
  rows2[1] = { f: subDays(2), h: '09:10', m: 30, firma: 'Cobrador Principal', mp: false };
  rows2[2] = { f: subDays(1), h: '08:50', m: 30, firma: 'Cobrador Principal', mp: false };
  // Cuota 4 pendiente para hoy

  const client2: Client = {
    id: 'c_demo_2',
    tipo: 'd',
    nombre: 'Carlos Estuardo Pérez Alvarado',
    dpi: '1890 45612 0108',
    lugar: 'Zona 11, Barbería El Trébol',
    tel: '4123 9081',
    cantidad: 500,
    cuota: 30,
    inicio: subDays(4),
    dom: true,
    guardado: true,
    fotos: {},
    rows: rows2,
  };

  // 3. Daily loan - Con atraso y mora (Q1,500 otorgado, cuota Q90)
  const rows3 = createBlankRows('d');
  rows3[0] = { f: subDays(9), h: '11:00', m: 90, firma: 'Cobrador Principal', mp: false };
  rows3[1] = { f: subDays(8), h: '10:30', m: 90, firma: 'Cobrador Principal', mp: false };
  // Missed past 5 days!

  const client3: Client = {
    id: 'c_demo_3',
    tipo: 'd',
    nombre: 'Jorge Mario Ramos Castillo',
    dpi: '2981 77123 0101',
    lugar: 'Taller Mecánico San José, Mixco',
    tel: '5012 3344',
    cantidad: 1500,
    cuota: 90,
    inicio: subDays(10),
    dom: true,
    guardado: true,
    fotos: {},
    rows: rows3,
  };

  // 4. Daily loan - ¡Listo para renovación! (Ya pagó 14 cuotas de 23)
  const rows4 = createBlankRows('d');
  for (let i = 0; i < 14; i++) {
    rows4[i] = {
      f: subDays(16 - i),
      h: '14:20',
      m: 60,
      firma: 'Cobrador Principal',
      mp: false,
    };
  }

  const client4: Client = {
    id: 'c_demo_4',
    tipo: 'd',
    nombre: 'Gloria Esperanza Batres de León',
    dpi: '1772 34512 0101',
    lugar: 'Librería y Papelería El Estudiante',
    tel: '5890 1122',
    cantidad: 1000,
    cuota: 60,
    inicio: subDays(17),
    dom: true,
    guardado: true,
    renov: 1500,
    fotos: {},
    rows: rows4,
  };

  // 5. Weekly loan (Cobro Semanal - 6 semanas)
  const rows5 = createBlankRows('s');
  rows5[0] = { f: subDays(21), h: '15:00', m: 280, firma: 'Cobrador Principal', mp: false };
  rows5[1] = { f: subDays(14), h: '15:30', m: 280, firma: 'Cobrador Principal', mp: false };
  rows5[2] = { f: subDays(7), h: '16:00', m: 280, firma: 'Cobrador Principal', mp: false };
  // Week 4 is due today

  const client5: Client = {
    id: 'c_demo_5',
    tipo: 's',
    nombre: 'Edwin Geovany Sacalxot',
    dpi: '2109 66543 0901',
    lugar: 'Abarrotería La Bendición, Villa Nueva',
    tel: '4455 6677',
    cantidad: 1000,
    cuota: 280,
    inicio: subDays(28),
    dom: true,
    guardado: true,
    fotos: {},
    rows: rows5,
  };

  return [client1, client2, client3, client4, client5];
}
