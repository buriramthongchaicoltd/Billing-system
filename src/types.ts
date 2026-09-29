export interface Project {
  id: string; // e.g. 'PRJ-DOH-24'
  code: string; // e.g. 'ทล.24 ตอน 2'
  name: string; // e.g. 'งานก่อสร้างขยาย ทล.24 สายปราสาท - สังขะ ตอน 2'
  client: string; // e.g. 'กรมทางหลวง (DOH)'
  contractNo: string; // e.g. 'ทล.24/2567'
  location: string; // e.g. 'ทล.24 อ.ปราสาท จ.สุรินทร์'
  budget: number; // e.g. 540,000,000
  color: string; // 'blue' | 'emerald' | 'amber' | 'purple' | 'rose'
}

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'PRJ-DOH-24',
    code: 'ทล.24 ตอน 2',
    name: 'งานก่อสร้างขยาย ทล.24 สายปราสาท - สังขะ ตอน 2 (กม.145+000 - 180+000)',
    client: 'กรมทางหลวง (DOH)',
    contractNo: 'ทล.24/2567',
    location: 'ทล.24 อ.ปราสาท - อ.สังขะ จ.สุรินทร์',
    budget: 540000000,
    color: 'blue'
  },
  {
    id: 'PRJ-DRR-3001',
    code: 'สะพาน บร.3001',
    name: 'งานก่อสร้างสะพานคอนกรีตอัดแรงข้ามทางรถไฟ สาย บร.3001 อ.กระสัง',
    client: 'กรมทางหลวงชนบท (DRR)',
    contractNo: 'ชน.18/2567',
    location: 'อ.กระสัง จ.บุรีรัมย์',
    budget: 185000000,
    color: 'emerald'
  },
  {
    id: 'PRJ-BY-CITY',
    code: 'เลี่ยงเมืองบุรีรัมย์',
    name: 'งานเสริมผิวทางแอสฟัลต์คอนกรีต ถนนสายเลี่ยงเมืองบุรีรัมย์ (ทล.288)',
    client: 'แขวงทางหลวงบุรีรัมย์',
    contractNo: 'บร.09/2567',
    location: 'ถนนเลี่ยงเมืองบุรีรัมย์ กม.4+200',
    budget: 92000000,
    color: 'amber'
  },
  {
    id: 'PRJ-BR-WATER',
    code: 'ท่อระบาย คสล.',
    name: 'งานระบบระบายน้ำและท่อเหลี่ยม คสล. คลองระบายน้ำสายหลัก ลำพุก',
    client: 'อบจ. บุรีรัมย์',
    contractNo: 'อบจ.33/2567',
    location: 'ต.ชุมเห็ด อ.เมือง จ.บุรีรัมย์',
    budget: 48000000,
    color: 'purple'
  }
];

export interface RecordItem {
  id: string;
  projectId?: string; // รหัสโครงการ เช่น 'PRJ-DOH-24'
  projectName?: string; // ชื่อย่อโครงการ เช่น 'ทล.24 ตอน 2'
  category: string;
  billType: 'SUPPLIER' | 'DEST_WEIGHT' | 'PO' | 'RR';
  poNo: string;
  rrNo: string;
  date: string;
  doNo: string;
  supplier: string;
  contractor: string;
  vehicleReg: string;
  itemDesc: string;
  spec: string;
  originGross: number;
  originTare: number;
  originNet: number;
  destDate: string;
  destTicketNo: string;
  destGross: number;
  destTare: number;
  destNet: number;
  weightDiff: number;
  qty: number;
  unit: string;
  pricePerUnit: number;
  totalMaterial: number;
  transportType: string;
  freightRate: number;
  totalFreight: number;
  grandTotal: number;
  paymentMethod: string;
  paidSupplier: number;
  balanceSupplier: number;
  paidHauler: number;
  balanceHauler: number;
  totalPaid: number;
  totalOutstanding: number;
  jobStation: string;
  remarks: string;
  weightTicketNo?: string;
  ticketTimeIn?: string | null;
  ticketTimeOut?: string | null;
  driverName?: string;
  weightPerCu?: number | null;
  photoAttachment?: string | null;
  needsReview?: boolean;
  materialName?: string;
  billRemarks?: string;
  isSubcontractorDeduction?: boolean; // ซื้อวัสดุให้ผู้รับเหมาช่วง (ต้องนำไปหักค่างวดงาน Subcontractor)
  subcontractorName?: string; // ชื่อผู้รับเหมาช่วงที่ถูกหักเงิน
  subcontractorWorkPeriod?: string; // งวดงานที่ต้องนำไปหัก
  status: 'PENDING' | 'MATCHED' | 'ALERT';
}

export interface BufferItem {
  id: string;
  projectId?: string;
  projectName?: string;
  type: string;
  billType: 'DEST_WEIGHT' | 'PO' | 'RR';
  refNo: string;
  weightTicketNo?: string;
  date: string;
  vehicleReg?: string;
  destGross?: number;
  destTare?: number;
  ticketTimeIn?: string | null;
  ticketTimeOut?: string | null;
  driverName?: string;
  supplier?: string;
  itemDesc?: string;
  materialName?: string;
  billRemarks?: string;
  remarks?: string;
  photoAttachment?: string | null;
  needsReview?: boolean;
}

export const INITIAL_RECORDS: RecordItem[] = [
  {
    id: 'TR-2026-001',
    category: 'หินฝุ่น / วัสดุก่อสร้าง',
    billType: 'SUPPLIER',
    poNo: 'PO-69020',
    rrNo: 'RR-1020',
    date: '2026-09-20',
    doNo: '690920/00030',
    supplier: 'RNK-SURIN',
    contractor: 'บจก. บุรีรัมย์ธงชัยก่อสร้าง',
    vehicleReg: '70-6686 บร',
    itemDesc: 'หินฝุ่น (28.72 คิว)',
    spec: 'หินฝุ่น / นน.คิว 1,600',
    originGross: 66690,
    originTare: 20740,
    originNet: 45.950,
    destDate: '2026-09-20',
    destTicketNo: 'DEST-69020',
    destGross: 66620,
    destTare: 20740,
    destNet: 45.880,
    weightDiff: -70,
    qty: 45.95,
    unit: 'ตัน',
    pricePerUnit: 220,
    totalMaterial: 10109,
    transportType: 'สิบล้อพ่วง',
    freightRate: 110,
    totalFreight: 5054.5,
    grandTotal: 15163.5,
    paymentMethod: 'เครดิต 30 วัน',
    paidSupplier: 0,
    balanceSupplier: 10109,
    paidHauler: 0,
    balanceHauler: 5054.5,
    totalPaid: 0,
    totalOutstanding: 15163.5,
    jobStation: 'หน้างานในเมือง บุรีรัมย์',
    remarks: 'มารับเอง / นน.สุทธิ 45.95 ตัน (28.72 คิว)',
    status: 'MATCHED'
  },
  {
    id: 'TR-2026-002',
    category: 'เหล็ก / วัสดุก่อสร้าง',
    billType: 'SUPPLIER',
    poNo: 'PO-69021',
    rrNo: 'RR-1021',
    date: '2026-09-20',
    doNo: 'IV69-00777',
    supplier: 'ร้านสหพาณิชย์',
    contractor: 'บจก. บุรีรัมย์ธงชัยก่อสร้าง',
    vehicleReg: 'ผส-1234 บร',
    itemDesc: 'เหล็กฉาก 2"*1/8 (3มม) & ท่อดำ 1 1/2*1.2',
    materialName: 'เหล็กฉาก + ท่อดำ',
    billRemarks: 'ใบแจ้งหนี้ 2 รายการ: เหล็กฉาก 355.00 + ท่อดำ 315.00 = 670.00 เงินสด',
    spec: 'เหล็กฉาก / ท่อดำ',
    originGross: 0,
    originTare: 0,
    originNet: 0,
    destDate: '2026-09-20',
    destTicketNo: 'IV69-00777',
    destGross: 0,
    destTare: 0,
    destNet: 0,
    weightDiff: 0,
    qty: 2.00,
    unit: 'เส้น',
    pricePerUnit: 335,
    totalMaterial: 670,
    transportType: 'รถกระบะจัดส่ง',
    freightRate: 0,
    totalFreight: 0,
    grandTotal: 670,
    paymentMethod: 'เงินสด / เงินโอน',
    paidSupplier: 670,
    balanceSupplier: 0,
    paidHauler: 0,
    balanceHauler: 0,
    totalPaid: 670,
    totalOutstanding: 0,
    jobStation: 'แพลนท์ยาง บ.ลำพุก',
    remarks: 'ใบส่งสินค้า/ใบแจ้งหนี้ สหพาณิชย์ 670 บาท',
    status: 'MATCHED'
  },
  {
    id: 'TR-2026-003',
    category: 'คอนกรีตผสมเสร็จ',
    billType: 'SUPPLIER',
    poNo: 'PO-7311980',
    rrNo: '-',
    date: '2026-09-17',
    doNo: '02536969',
    supplier: 'บจก. คิวมิกซ์ซัพพลาย',
    contractor: 'บจก. บุรีรัมย์ธงชัยก่อสร้าง',
    vehicleReg: '70-9821 นม',
    itemDesc: 'คอนกรีต Paver 35 Mpa (357 ksc)',
    spec: 'ZBDQ3P434B / Slump 5+20',
    originGross: 24000,
    originTare: 12000,
    originNet: 12.000,
    destDate: '-',
    destTicketNo: '-',
    destGross: 0,
    destTare: 0,
    destNet: 0,
    weightDiff: 0,
    qty: 5.00,
    unit: 'คิว (ม.³)',
    pricePerUnit: 1850,
    totalMaterial: 9250,
    transportType: 'รถโม่ปูน',
    freightRate: 0,
    totalFreight: 0,
    grandTotal: 9250,
    paymentMethod: 'เครดิต 30 วัน',
    paidSupplier: 0,
    balanceSupplier: 9250,
    paidHauler: 0,
    balanceHauler: 0,
    totalPaid: 0,
    totalOutstanding: 9250,
    jobStation: 'สายปราสาท - สังขะ ตอน 2',
    remarks: 'งาน Pavement ช่างนิรันดร์ KM0+570-0+892 LT.4',
    status: 'PENDING'
  },
  {
    id: 'TR-2026-004',
    category: 'ทราย / วัสดุก่อสร้าง',
    billType: 'SUPPLIER',
    poNo: 'PO-69024',
    rrNo: 'RR-1024',
    date: '2026-09-20',
    doNo: '93136',
    supplier: 'บจก. ท่าทรายรุ่งอรุณ',
    contractor: 'บจก. บุรีรัมย์ธงชัยก่อสร้าง',
    vehicleReg: '83-0381',
    itemDesc: 'ทรายสร้าง / ทรายถม',
    spec: 'STD Sand Grade',
    originGross: 50480,
    originTare: 20500,
    originNet: 29.980,
    destDate: '2026-09-20',
    destTicketNo: 'DEST-93136',
    destGross: 49880,
    destTare: 20500,
    destNet: 29.380,
    weightDiff: -600,
    qty: 29.98,
    unit: 'ตัน',
    pricePerUnit: 260,
    totalMaterial: 7795,
    transportType: 'รถพ่วง 18 ล้อ',
    freightRate: 150,
    totalFreight: 4497,
    grandTotal: 12292,
    paymentMethod: 'เครดิต 30 วัน',
    paidSupplier: 0,
    balanceSupplier: 7795,
    paidHauler: 0,
    balanceHauler: 4497,
    totalPaid: 0,
    totalOutstanding: 12292,
    jobStation: 'สาย 24 ปราสาท-สังขะ ตอน 1',
    remarks: 'พนักงานขับรถ: นายกรชวิน ตุนคำ (น้ำหนักปลายทางขาด 600 กก.)',
    status: 'ALERT'
  }
];

export const INITIAL_BUFFER: BufferItem[] = [
  {
    id: 'BUF-101',
    type: 'ตั๋วปลายทาง',
    billType: 'DEST_WEIGHT',
    refNo: 'DEST-02536969',
    date: '2026-09-17',
    vehicleReg: '70-9821 นม',
    destGross: 24000,
    destTare: 12000
  },
  {
    id: 'BUF-102',
    type: 'PO (ใบสั่งซื้อ)',
    billType: 'PO',
    refNo: 'PO-7311980',
    date: '2026-09-17',
    supplier: 'คิวมิกซ์ซัพพลาย',
    itemDesc: 'คอนกรีต Paver 35 Mpa'
  },
  {
    id: 'BUF-103',
    type: 'ตั๋วใบชั่งปลายทาง',
    billType: 'DEST_WEIGHT',
    refNo: '93136',
    weightTicketNo: '93136',
    date: '2026-09-20',
    vehicleReg: '83-0381',
    destGross: 50460,
    destTare: 20500,
    driverName: 'นายกรชวิน ตุนคำ',
    itemDesc: 'ทราย / หิน',
    supplier: 'บจก. ท่าทรายรุ่งอรุณ',
    materialName: 'ทราย',
    billRemarks: 'บนใบ: ทะเบียน 83-0381 เข้าชั่ง 10:26:48 ออก 10:50:37 / สุทธิ 29,960 กก.',
    needsReview: true
  }
];
