import { RecordItem, BufferItem } from './types';

export function normalizeDocNo(val?: string | null): string {
  if (!val) return '';
  return String(val)
    .trim()
    .toUpperCase()
    .replace(/^DEST-/, '')
    .replace(/^DO-/, '')
    .replace(/^PO-/, '')
    .replace(/^RR-/, '')
    .replace(/^WT-/, '')
    .replace(/[^A-Z0-9]/g, '');
}

export function matchByDocumentNo(
  bufferItem: BufferItem, 
  records: RecordItem[]
): { matchedRecord: RecordItem | null; reason: string; rule: string } {
  const normBufRef = normalizeDocNo(bufferItem.refNo);
  const normBufTicket = normalizeDocNo(bufferItem.weightTicketNo);

  if (bufferItem.billType === 'DEST_WEIGHT') {
    // 1. ตรวจตรงตามเลขใบจ่าย/ตั๋ว (DO No)
    let candidate = records.find(r => {
      const normDo = normalizeDocNo(r.doNo);
      return (normBufRef && normDo === normBufRef) || 
             (normBufTicket && normDo === normBufTicket);
    });

    if (candidate) {
      return { 
        matchedRecord: candidate, 
        reason: `ตรงกับเลขใบจ่าย/ตั๋ว (DO: ${candidate.doNo})`,
        rule: 'EXACT_DO_MATCH'
      };
    }

    // 2. ตรวจตรงตามเลขตั๋วปลายทางที่ระบุไว้ล่วงหน้า
    candidate = records.find(r => {
      const normDest = normalizeDocNo(r.destTicketNo);
      return normDest && (normDest === normBufRef || normDest === normBufTicket);
    });

    if (candidate) {
      return { 
        matchedRecord: candidate, 
        reason: `ตรงกับเลขตั๋วปลายทางที่อ้างอิงไว้ (${candidate.destTicketNo})`,
        rule: 'EXACT_DEST_TICKET_MATCH'
      };
    }

    // 3. ตรวจตรงตามเลขที่ใบชั่งเดิม (Weight Ticket No)
    candidate = records.find(r => {
      const normRecordTicket = normalizeDocNo(r.weightTicketNo);
      return normRecordTicket && (normRecordTicket === normBufRef || normRecordTicket === normBufTicket);
    });

    if (candidate) {
      return { 
        matchedRecord: candidate, 
        reason: `ตรงกับเลขที่ใบชั่ง (${candidate.weightTicketNo})`,
        rule: 'EXACT_WEIGHT_TICKET_MATCH'
      };
    }

    // หากไม่พบการอ้างอิงเลขที่บิลเลย ห้ามจับมั่วด้วยทะเบียนรถเด็ดขาด
    return {
      matchedRecord: null,
      reason: `ไม่พบเลขที่เอกสารอ้างอิงตรงกัน (Ref: ${bufferItem.refNo || '-'}) ในตารางบิลผู้จำหน่าย ไม่อนุญาตให้จับคู่มั่วโดยไม่มีเลขบิลอ้างอิงถึงกัน`,
      rule: 'NO_DOCUMENT_REF_FOUND'
    };
  }

  if (bufferItem.billType === 'PO') {
    const candidate = records.find(r => {
      const normPo = normalizeDocNo(r.poNo);
      return normPo && normPo === normBufRef;
    });

    if (candidate) {
      return {
        matchedRecord: candidate,
        reason: `ตรงกับเลขที่ PO (${candidate.poNo}) ในตาราง`,
        rule: 'EXACT_PO_MATCH'
      };
    }

    return {
      matchedRecord: null,
      reason: `ไม่พบเลขที่ใบสั่งซื้อ PO (${bufferItem.refNo}) ที่รอรับของในตาราง`,
      rule: 'PO_NOT_FOUND'
    };
  }

  if (bufferItem.billType === 'RR') {
    const candidate = records.find(r => {
      const normRr = normalizeDocNo(r.rrNo);
      return normRr && normRr === normBufRef;
    });

    if (candidate) {
      return {
        matchedRecord: candidate,
        reason: `ตรงกับเลขที่ใบรับของ RR (${candidate.rrNo}) ในตาราง`,
        rule: 'EXACT_RR_MATCH'
      };
    }

    return {
      matchedRecord: null,
      reason: `ไม่พบเลขที่ใบรับของ RR (${bufferItem.refNo}) ที่ตรงกับตาราง`,
      rule: 'RR_NOT_FOUND'
    };
  }

  return { matchedRecord: null, reason: 'ไม่พบประเภทเอกสารที่รองรับ', rule: 'UNKNOWN' };
}
