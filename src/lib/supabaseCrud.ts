import { getSupabaseClient, getSavedSupabaseConfig } from './supabaseClient';
import { Project, RecordItem, BufferItem, DriveSyncLog } from '../types';

/**
 * SQL Schema for Supabase SQL Editor
 * ปลอดภัย 100% สามารถรันซ้ำได้ไม่จำกัดครั้ง ข้อมูลเดิมที่มีอยู่จะไม่หายแน่นอน (Idempotent Migration)
 */
export const SUPABASE_SQL_SCHEMA = `-- ==============================================================================
-- คำสั่ง SQL สำหรับ Supabase (รันซ้ำได้ตลอดเวลา ข้อมูลเดิมไม่หาย 100%)
-- รองรับการรันซ้ำเมื่อระบบมีการพัฒนาเพิ่มคอลัมน์ใหม่ในอนาคต (Non-destructive Migration)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ตารางโครงการ (projects)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- เพิ่มคอลัมน์ให้อัตโนมัติหากยังไม่มี (ข้อมูลเดิมไม่หาย)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contract_no TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget NUMERIC DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'blue';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ------------------------------------------------------------------------------
-- 2. ตารางกระทบยอดบิลหลัก 38 คอลัมน์ (reconciliation_records)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reconciliation_records (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- เพิ่มคอลัมน์มาตรฐานครบถ้วน (หากมีอยู่แล้วจะไม่ถูกเขียนทับ ข้อมูลเก่าคงอยู่ครบ)
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS project_name TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS bill_type TEXT DEFAULT 'SUPPLIER';
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS po_no TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS rr_no TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS do_no TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS contractor TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS vehicle_reg TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS item_desc TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS spec TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS origin_gross NUMERIC DEFAULT 0;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS origin_tare NUMERIC DEFAULT 0;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS origin_net NUMERIC DEFAULT 0;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS dest_date TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS dest_ticket_no TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS dest_gross NUMERIC DEFAULT 0;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS dest_tare NUMERIC DEFAULT 0;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS dest_net NUMERIC DEFAULT 0;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS weight_diff NUMERIC DEFAULT 0;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS qty NUMERIC DEFAULT 0;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'ตัน';
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS price_per_unit NUMERIC DEFAULT 0;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS total_material NUMERIC DEFAULT 0;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS transport_type TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS freight_rate NUMERIC DEFAULT 0;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS total_freight NUMERIC DEFAULT 0;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS grand_total NUMERIC DEFAULT 0;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS paid_supplier NUMERIC DEFAULT 0;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS balance_supplier NUMERIC DEFAULT 0;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS paid_hauler NUMERIC DEFAULT 0;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS balance_hauler NUMERIC DEFAULT 0;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS total_paid NUMERIC DEFAULT 0;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS total_outstanding NUMERIC DEFAULT 0;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS job_station TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS weight_ticket_no TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS ticket_time_in TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS ticket_time_out TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS driver_name TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS weight_per_cu NUMERIC;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS photo_attachment TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS material_name TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS bill_remarks TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS is_subcontractor_deduction BOOLEAN DEFAULT FALSE;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS subcontractor_name TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS subcontractor_work_period TEXT;
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE reconciliation_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ------------------------------------------------------------------------------
-- 3. ตารางกล่องพักรอชนบิล (bills_buffer)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bills_buffer (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- เพิ่มคอลัมน์กล่องพัก
ALTER TABLE bills_buffer ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE bills_buffer ADD COLUMN IF NOT EXISTS project_name TEXT;
ALTER TABLE bills_buffer ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE bills_buffer ADD COLUMN IF NOT EXISTS bill_type TEXT DEFAULT 'DEST_WEIGHT';
ALTER TABLE bills_buffer ADD COLUMN IF NOT EXISTS ref_no TEXT;
ALTER TABLE bills_buffer ADD COLUMN IF NOT EXISTS weight_ticket_no TEXT;
ALTER TABLE bills_buffer ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE bills_buffer ADD COLUMN IF NOT EXISTS vehicle_reg TEXT;
ALTER TABLE bills_buffer ADD COLUMN IF NOT EXISTS dest_gross NUMERIC DEFAULT 0;
ALTER TABLE bills_buffer ADD COLUMN IF NOT EXISTS dest_tare NUMERIC DEFAULT 0;
ALTER TABLE bills_buffer ADD COLUMN IF NOT EXISTS ticket_time_in TEXT;
ALTER TABLE bills_buffer ADD COLUMN IF NOT EXISTS ticket_time_out TEXT;
ALTER TABLE bills_buffer ADD COLUMN IF NOT EXISTS driver_name TEXT;
ALTER TABLE bills_buffer ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE bills_buffer ADD COLUMN IF NOT EXISTS item_desc TEXT;
ALTER TABLE bills_buffer ADD COLUMN IF NOT EXISTS material_name TEXT;
ALTER TABLE bills_buffer ADD COLUMN IF NOT EXISTS bill_remarks TEXT;
ALTER TABLE bills_buffer ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE bills_buffer ADD COLUMN IF NOT EXISTS photo_attachment TEXT;
ALTER TABLE bills_buffer ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE;
ALTER TABLE bills_buffer ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE bills_buffer ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ------------------------------------------------------------------------------
-- 4. ตารางบันทึกประวัติไฟล์ Google Drive ที่ดึงเข้ามาแล้ว (drive_sync_logs)
-- ป้องกันการดึงไฟล์ซ้ำ 100% แม้มีไฟล์ใหม่เพิ่มเข้ามาเรื่อยๆ
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drive_sync_logs (
  id TEXT PRIMARY KEY, -- Google Drive File ID
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE drive_sync_logs ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE drive_sync_logs ADD COLUMN IF NOT EXISTS drive_url TEXT;
ALTER TABLE drive_sync_logs ADD COLUMN IF NOT EXISTS folder_path TEXT;
ALTER TABLE drive_sync_logs ADD COLUMN IF NOT EXISTS doc_no TEXT;
ALTER TABLE drive_sync_logs ADD COLUMN IF NOT EXISTS bill_type TEXT;
ALTER TABLE drive_sync_logs ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE drive_sync_logs ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE drive_sync_logs ADD COLUMN IF NOT EXISTS net_weight NUMERIC;
ALTER TABLE drive_sync_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'SUCCESS_AI';
ALTER TABLE drive_sync_logs ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ DEFAULT NOW();

-- ------------------------------------------------------------------------------
-- 5. ตั้งค่าดัชนี (Indexes) เพื่อให้ค้นหาบิลได้รวดเร็ว (รันซ้ำได้ปลอดภัย)
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_rec_project_id ON reconciliation_records(project_id);
CREATE INDEX IF NOT EXISTS idx_rec_do_no ON reconciliation_records(do_no);
CREATE INDEX IF NOT EXISTS idx_rec_po_no ON reconciliation_records(po_no);
CREATE INDEX IF NOT EXISTS idx_rec_date ON reconciliation_records(date);
CREATE INDEX IF NOT EXISTS idx_buf_ref_no ON bills_buffer(ref_no);
CREATE INDEX IF NOT EXISTS idx_buf_date ON bills_buffer(date);
CREATE INDEX IF NOT EXISTS idx_sync_doc_no ON drive_sync_logs(doc_no);

-- ------------------------------------------------------------------------------
-- 6. สิทธิ์การเข้าถึง (Row Level Security & Policies) - รันซ้ำได้ตลอดเวลา
-- ------------------------------------------------------------------------------
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills_buffer ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all projects" ON projects;
CREATE POLICY "Allow all projects" ON projects FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all reconciliation_records" ON reconciliation_records;
CREATE POLICY "Allow all reconciliation_records" ON reconciliation_records FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all bills_buffer" ON bills_buffer;
CREATE POLICY "Allow all bills_buffer" ON bills_buffer FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all drive_sync_logs" ON drive_sync_logs;
CREATE POLICY "Allow all drive_sync_logs" ON drive_sync_logs FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 7. เปิดใช้งาน Supabase Realtime (ป้องกัน error เมื่อตารางอยู่ใน Publication แล้ว)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'projects'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE projects;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'reconciliation_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reconciliation_records;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'bills_buffer'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bills_buffer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'drive_sync_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE drive_sync_logs;
  END IF;
END $$;
`;

// Helper: Project DB Mapping
export function projectToDb(p: Project) {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    client: p.client || null,
    contract_no: p.contractNo || null,
    location: p.location || null,
    budget: p.budget || 0,
    color: p.color || 'blue',
    updated_at: new Date().toISOString()
  };
}

export function dbToProject(row: any): Project {
  return {
    id: row.id,
    code: row.code || '',
    name: row.name || '',
    client: row.client || '',
    contractNo: row.contract_no || '',
    location: row.location || '',
    budget: Number(row.budget) || 0,
    color: row.color || 'blue'
  };
}

// Helper: RecordItem DB Mapping
export function recordToDb(r: RecordItem) {
  return {
    id: r.id,
    project_id: r.projectId || null,
    project_name: r.projectName || null,
    category: r.category || '',
    bill_type: r.billType || 'SUPPLIER',
    po_no: r.poNo || '-',
    rr_no: r.rrNo || '-',
    date: r.date || '',
    do_no: r.doNo || '',
    supplier: r.supplier || '',
    contractor: r.contractor || '',
    vehicle_reg: r.vehicleReg || '-',
    item_desc: r.itemDesc || '',
    spec: r.spec || '',
    origin_gross: Number(r.originGross) || 0,
    origin_tare: Number(r.originTare) || 0,
    origin_net: Number(r.originNet) || 0,
    dest_date: r.destDate || '-',
    dest_ticket_no: r.destTicketNo || '-',
    dest_gross: Number(r.destGross) || 0,
    dest_tare: Number(r.destTare) || 0,
    dest_net: Number(r.destNet) || 0,
    weight_diff: Number(r.weightDiff) || 0,
    qty: Number(r.qty) || 0,
    unit: r.unit || 'ตัน',
    price_per_unit: Number(r.pricePerUnit) || 0,
    total_material: Number(r.totalMaterial) || 0,
    transport_type: r.transportType || '',
    freight_rate: Number(r.freightRate) || 0,
    total_freight: Number(r.totalFreight) || 0,
    grand_total: Number(r.grandTotal) || 0,
    payment_method: r.paymentMethod || '',
    paid_supplier: Number(r.paidSupplier) || 0,
    balance_supplier: Number(r.balanceSupplier) || 0,
    paid_hauler: Number(r.paidHauler) || 0,
    balance_hauler: Number(r.balanceHauler) || 0,
    total_paid: Number(r.totalPaid) || 0,
    total_outstanding: Number(r.totalOutstanding) || 0,
    job_station: r.jobStation || '',
    remarks: r.remarks || '',
    weight_ticket_no: r.weightTicketNo || null,
    ticket_time_in: r.ticketTimeIn || null,
    ticket_time_out: r.ticketTimeOut || null,
    driver_name: r.driverName || null,
    weight_per_cu: r.weightPerCu || null,
    photo_attachment: r.photoAttachment || null,
    needs_review: Boolean(r.needsReview),
    material_name: r.materialName || null,
    bill_remarks: r.billRemarks || null,
    is_subcontractor_deduction: Boolean(r.isSubcontractorDeduction),
    subcontractor_name: r.subcontractorName || null,
    subcontractor_work_period: r.subcontractorWorkPeriod || null,
    status: r.status || 'PENDING',
    updated_at: new Date().toISOString()
  };
}

export function dbToRecord(row: any): RecordItem {
  return {
    id: row.id,
    projectId: row.project_id || undefined,
    projectName: row.project_name || undefined,
    category: row.category || 'ทั่วไป',
    billType: row.bill_type || 'SUPPLIER',
    poNo: row.po_no || '-',
    rrNo: row.rr_no || '-',
    date: row.date || '',
    doNo: row.do_no || '',
    supplier: row.supplier || '',
    contractor: row.contractor || '',
    vehicleReg: row.vehicle_reg || '-',
    itemDesc: row.item_desc || '',
    spec: row.spec || '',
    originGross: Number(row.origin_gross) || 0,
    originTare: Number(row.origin_tare) || 0,
    originNet: Number(row.origin_net) || 0,
    destDate: row.dest_date || '-',
    destTicketNo: row.dest_ticket_no || '-',
    destGross: Number(row.dest_gross) || 0,
    destTare: Number(row.dest_tare) || 0,
    destNet: Number(row.dest_net) || 0,
    weightDiff: Number(row.weight_diff) || 0,
    qty: Number(row.qty) || 0,
    unit: row.unit || 'ตัน',
    pricePerUnit: Number(row.price_per_unit) || 0,
    totalMaterial: Number(row.total_material) || 0,
    transportType: row.transport_type || '',
    freightRate: Number(row.freight_rate) || 0,
    totalFreight: Number(row.total_freight) || 0,
    grandTotal: Number(row.grand_total) || 0,
    paymentMethod: row.payment_method || '',
    paidSupplier: Number(row.paid_supplier) || 0,
    balanceSupplier: Number(row.balance_supplier) || 0,
    paidHauler: Number(row.paid_hauler) || 0,
    balanceHauler: Number(row.balance_hauler) || 0,
    totalPaid: Number(row.total_paid) || 0,
    totalOutstanding: Number(row.total_outstanding) || 0,
    jobStation: row.job_station || '',
    remarks: row.remarks || '',
    weightTicketNo: row.weight_ticket_no || undefined,
    ticketTimeIn: row.ticket_time_in || null,
    ticketTimeOut: row.ticket_time_out || null,
    driverName: row.driver_name || undefined,
    weightPerCu: row.weight_per_cu || null,
    photoAttachment: row.photo_attachment || null,
    needsReview: Boolean(row.needs_review),
    materialName: row.material_name || undefined,
    billRemarks: row.bill_remarks || undefined,
    isSubcontractorDeduction: Boolean(row.is_subcontractor_deduction),
    subcontractorName: row.subcontractor_name || undefined,
    subcontractorWorkPeriod: row.subcontractor_work_period || undefined,
    status: row.status || 'PENDING'
  };
}

// Helper: BufferItem DB Mapping
export function bufferToDb(b: BufferItem) {
  return {
    id: b.id,
    project_id: b.projectId || null,
    project_name: b.projectName || null,
    type: b.type || '',
    bill_type: b.billType || 'DEST_WEIGHT',
    ref_no: b.refNo || '',
    weight_ticket_no: b.weightTicketNo || null,
    date: b.date || '',
    vehicle_reg: b.vehicleReg || null,
    dest_gross: Number(b.destGross) || 0,
    dest_tare: Number(b.destTare) || 0,
    ticket_time_in: b.ticketTimeIn || null,
    ticket_time_out: b.ticketTimeOut || null,
    driver_name: b.driverName || null,
    supplier: b.supplier || null,
    item_desc: b.itemDesc || null,
    material_name: b.materialName || null,
    bill_remarks: b.billRemarks || null,
    remarks: b.remarks || null,
    photo_attachment: b.photoAttachment || null,
    needs_review: Boolean(b.needsReview),
    updated_at: new Date().toISOString()
  };
}

export function dbToBuffer(row: any): BufferItem {
  return {
    id: row.id,
    projectId: row.project_id || undefined,
    projectName: row.project_name || undefined,
    type: row.type || '',
    billType: row.bill_type || 'DEST_WEIGHT',
    refNo: row.ref_no || '',
    weightTicketNo: row.weight_ticket_no || undefined,
    date: row.date || '',
    vehicleReg: row.vehicle_reg || undefined,
    destGross: Number(row.dest_gross) || 0,
    destTare: Number(row.dest_tare) || 0,
    ticketTimeIn: row.ticket_time_in || null,
    ticketTimeOut: row.ticket_time_out || null,
    driverName: row.driver_name || undefined,
    supplier: row.supplier || undefined,
    itemDesc: row.item_desc || undefined,
    materialName: row.material_name || undefined,
    billRemarks: row.bill_remarks || undefined,
    remarks: row.remarks || undefined,
    photoAttachment: row.photo_attachment || null,
    needsReview: Boolean(row.needs_review)
  };
}

// ============================================
// CRUD Functions for Supabase
// ============================================

/**
 * PROJECTS CRUD
 */
export async function supabaseFetchProjects(): Promise<Project[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.from('projects').select('*').order('created_at', { ascending: true });
  if (error) {
    console.error('Supabase fetch projects error:', error);
    return null;
  }
  return data.map(dbToProject);
}

export async function supabaseUpsertProject(project: Project): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client.from('projects').upsert(projectToDb(project));
  if (error) {
    console.error('Supabase upsert project error:', error);
    return false;
  }
  return true;
}

export async function supabaseDeleteProject(projectId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client.from('projects').delete().eq('id', projectId);
  if (error) {
    console.error('Supabase delete project error:', error);
    return false;
  }
  return true;
}

/**
 * RECONCILIATION RECORDS (38 COLS) CRUD
 */
export async function supabaseFetchRecords(): Promise<RecordItem[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.from('reconciliation_records').select('*').order('date', { ascending: false });
  if (error) {
    console.error('Supabase fetch records error:', error);
    return null;
  }
  return data.map(dbToRecord);
}

export async function supabaseUpsertRecord(record: RecordItem): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client.from('reconciliation_records').upsert(recordToDb(record));
  if (error) {
    console.error('Supabase upsert record error:', error);
    return false;
  }
  return true;
}

export async function supabaseDeleteRecord(recordId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client.from('reconciliation_records').delete().eq('id', recordId);
  if (error) {
    console.error('Supabase delete record error:', error);
    return false;
  }
  return true;
}

/**
 * BUFFER POOL CRUD
 */
export async function supabaseFetchBuffer(): Promise<BufferItem[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.from('bills_buffer').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Supabase fetch buffer error:', error);
    return null;
  }
  return data.map(dbToBuffer);
}

export async function supabaseUpsertBuffer(item: BufferItem): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client.from('bills_buffer').upsert(bufferToDb(item));
  if (error) {
    console.error('Supabase upsert buffer error:', error);
    return false;
  }
  return true;
}

export async function supabaseDeleteBuffer(bufferId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client.from('bills_buffer').delete().eq('id', bufferId);
  if (error) {
    console.error('Supabase delete buffer error:', error);
    return false;
  }
  return true;
}

/**
 * Bulk Sync All Data to Supabase (Initial Migration)
 */
export async function supabaseBulkSyncAll(
  projects: Project[],
  records: RecordItem[],
  buffer: BufferItem[]
): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'กรุณาตั้งค่า Supabase URL และ Anon Key ให้เรียบร้อยก่อน' };
  }

  try {
    // 1. Projects
    if (projects.length > 0) {
      const pPayload = projects.map(projectToDb);
      const { error: pErr } = await client.from('projects').upsert(pPayload);
      if (pErr) throw new Error(`ล้มเหลวขณะอัปโหลดโครงการ: ${pErr.message}`);
    }

    // 2. Records
    if (records.length > 0) {
      const rPayload = records.map(recordToDb);
      const { error: rErr } = await client.from('reconciliation_records').upsert(rPayload);
      if (rErr) throw new Error(`ล้มเหลวขณะอัปโหลดตารางบิล: ${rErr.message}`);
    }

    // 3. Buffer
    if (buffer.length > 0) {
      const bPayload = buffer.map(bufferToDb);
      const { error: bErr } = await client.from('bills_buffer').upsert(bPayload);
      if (bErr) throw new Error(`ล้มเหลวขณะอัปโหลดกล่องพัก: ${bErr.message}`);
    }

    return { 
      success: true, 
      message: `✅ อัปโหลดขึ้น Supabase สำเร็จ!\n- โครงการ: ${projects.length} รายการ\n- ตารางบิล 38 คอลัมน์: ${records.length} รายการ\n- กล่องพักรอชน: ${buffer.length} รายการ` 
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Supabase' };
  }
}

/**
 * DRIVE SYNC LOGS CRUD
 */
export function driveSyncLogToDb(log: DriveSyncLog) {
  return {
    id: log.id,
    file_name: log.fileName,
    drive_url: log.driveUrl || null,
    folder_path: log.folderPath || null,
    doc_no: log.docNo || null,
    bill_type: log.billType || null,
    category: log.category || null,
    supplier: log.supplier || null,
    net_weight: log.netWeight ? Number(log.netWeight) : null,
    status: log.status || 'SUCCESS_AI',
    synced_at: log.syncedAt || new Date().toISOString()
  };
}

export function dbToDriveSyncLog(row: any): DriveSyncLog {
  return {
    id: row.id,
    fileName: row.file_name,
    driveUrl: row.drive_url || undefined,
    folderPath: row.folder_path || undefined,
    docNo: row.doc_no || undefined,
    billType: row.bill_type || undefined,
    category: row.category || undefined,
    supplier: row.supplier || undefined,
    netWeight: row.net_weight ? Number(row.net_weight) : undefined,
    status: row.status || 'SUCCESS_AI',
    syncedAt: row.synced_at || undefined
  };
}

export async function supabaseLogDriveSync(log: DriveSyncLog): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client.from('drive_sync_logs').upsert(driveSyncLogToDb(log));
  if (error) {
    console.error('Supabase log drive sync error:', error);
    return false;
  }
  return true;
}

export async function supabaseFetchDriveSyncLogs(): Promise<DriveSyncLog[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.from('drive_sync_logs').select('*').order('synced_at', { ascending: false });
  if (error) {
    console.error('Supabase fetch drive sync logs error:', error);
    return null;
  }
  return data.map(dbToDriveSyncLog);
}

