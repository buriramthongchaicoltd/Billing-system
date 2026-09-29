import React, { useState, useEffect, useRef } from 'react';
import { 
  Truck, Archive, Plus, FileSpreadsheet, FolderPlus, 
  Search, Expand, Trash2, Camera, Flag, 
  ZoomIn, ZoomOut, Link as LinkIcon,
  X, Save, Upload, AlertTriangle, CheckCircle2, Clock, Download,
  Sparkles, Loader2, Edit3, Check, Building2, FolderKanban, Layers, Bot, Database,
  ChevronDown, MoreVertical, FileText
} from 'lucide-react';
import { RecordItem, BufferItem, INITIAL_RECORDS, INITIAL_BUFFER, Project, INITIAL_PROJECTS } from './types';
import { REAL_BILLS_RECORDS, REAL_BILLS_BUFFER } from './sampleData';
import { matchByDocumentNo } from './matcher';
import { BillDetailEditModal } from './components/BillDetailEditModal';
import { ProjectManagerModal } from './components/ProjectManagerModal';
import { AutoBotSyncModal } from './components/AutoBotSyncModal';
import { getSupabaseClient, getSavedSupabaseConfig } from './lib/supabaseClient';
import { 
  supabaseFetchProjects, supabaseUpsertProject, supabaseDeleteProject,
  supabaseFetchRecords, supabaseUpsertRecord, supabaseDeleteRecord,
  supabaseFetchBuffer, supabaseUpsertBuffer, supabaseDeleteBuffer,
  dbToRecord, dbToProject, dbToBuffer
} from './lib/supabaseCrud';

export default function App() {
  const STORAGE_VER = 'recon_v8_real_production';

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_VER}_projects`);
    return saved ? JSON.parse(saved) : [];
  });

  const [currentProjectFilter, setCurrentProjectFilter] = useState<string>('ALL');
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isAutoSyncModalOpen, setIsAutoSyncModalOpen] = useState(false);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [isCloudLoading, setIsCloudLoading] = useState(false);

  const [records, setRecords] = useState<RecordItem[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_VER}_records`);
    return saved ? JSON.parse(saved) : [];
  });

  const [buffer, setBuffer] = useState<BufferItem[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_VER}_buffer`);
    return saved ? JSON.parse(saved) : [];
  });

  const handleClearAllData = () => {
    if (window.confirm('คุณต้องการล้างข้อมูลตัวอย่างทั้งหมด (รวมทั้งโครงการตัวอย่าง) เพื่อเริ่มใช้งานข้อมูลจริงใช่หรือไม่?\n\n(ตารางหลัก กล่องพักรอชนบิล และโครงการตัวอย่างจะถูกล้างให้ว่างเปล่า 100% พร้อมสำหรับสร้างโครงการและดึงข้อมูลจริง)')) {
      setRecords([]);
      setBuffer([]);
      setProjects([]);
      setCurrentProjectFilter('ALL');
      localStorage.setItem(`${STORAGE_VER}_records`, JSON.stringify([]));
      localStorage.setItem(`${STORAGE_VER}_buffer`, JSON.stringify([]));
      localStorage.setItem(`${STORAGE_VER}_projects`, JSON.stringify([]));
      fetch('/api/bot-bills/ack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).catch(() => {});
      alert('✨ ล้างข้อมูลตัวอย่างและโครงการตัวอย่างเรียบร้อยแล้ว! ระบบว่าง 100% พร้อมสำหรับข้อมูลจริงของคุณแล้วครับ');
    }
  };

  const handleLoadRealBillsSample = () => {
    setRecords(REAL_BILLS_RECORDS);
    setBuffer(REAL_BILLS_BUFFER);
    setProjects(INITIAL_PROJECTS);
    setCurrentProjectFilter('ALL');
    localStorage.setItem(`${STORAGE_VER}_records`, JSON.stringify(REAL_BILLS_RECORDS));
    localStorage.setItem(`${STORAGE_VER}_buffer`, JSON.stringify(REAL_BILLS_BUFFER));
    localStorage.setItem(`${STORAGE_VER}_projects`, JSON.stringify(INITIAL_PROJECTS));
    alert('✅ โหลดข้อมูลตัวอย่างตรงตามภาพบิลจริง 5 ใบ เรียบร้อยแล้ว!');
  };

  const [currentFilterTab, setCurrentFilterTab] = useState<'ALL' | 'PENDING' | 'MATCHED' | 'ALERT' | 'SUBCONTRACTOR'>('ALL');
  const [currentCategoryFilter, setCurrentCategoryFilter] = useState<string>('ALL');
  const [currentViewMode, setCurrentViewMode] = useState<'FULL' | 'WEIGHT' | 'FINANCE'>('FULL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Drawer & Modals
  const [isBufferDrawerOpen, setIsBufferDrawerOpen] = useState(false);
  const [activeViewEditRecord, setActiveViewEditRecord] = useState<RecordItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // OCR Scanner State
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrPreviewImage, setOcrPreviewImage] = useState<string | null>(null);

  // In-App Toast Notification
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'info' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // New Record Form State
  const [newProjectId, setNewProjectId] = useState<string>('PRJ-DOH-24');
  const [newBillType, setNewBillType] = useState<'SUPPLIER' | 'DEST_WEIGHT' | 'PO' | 'RR'>('SUPPLIER');
  const [newCategory, setNewCategory] = useState('หินฝุ่น / วัสดุก่อสร้าง');
  const [newCustomCategory, setNewCustomCategory] = useState('');
  const [newDoNo, setNewDoNo] = useState('');
  const [newPoNo, setNewPoNo] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newVehicleReg, setNewVehicleReg] = useState('');
  const [newQty, setNewQty] = useState<number>(0);
  const [newUnit, setNewUnit] = useState('ตัน');
  const [newPrice, setNewPrice] = useState<number>(0);
  const [newFreight, setNewFreight] = useState<number>(0);
  const [newWeightTicketNo, setNewWeightTicketNo] = useState('');
  const [newDriverName, setNewDriverName] = useState('');
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newBillRemarks, setNewBillRemarks] = useState('');

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(`${STORAGE_VER}_records`, JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_VER}_buffer`, JSON.stringify(buffer));
  }, [buffer]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_VER}_projects`, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 🛡️ Comprehensive Duplicate Bill Detection Engine (ป้องกันการคีย์บิลซ้ำ 100%)
  const checkIsDuplicateBill = (
    docNo?: string,
    refNo?: string,
    driveFileId?: string,
    extra?: { date?: string; vehicleReg?: string; netWeight?: number; supplier?: string }
  ): { isDuplicate: boolean; reason: string; matchedId?: string; inTable?: 'records' | 'buffer' } => {
    const cleanDoc = (docNo || '').trim().toLowerCase();
    const cleanRef = (refNo || '').trim().toLowerCase();
    const cleanFileId = (driveFileId || '').trim();

    const isMeaningfulDoc = cleanDoc && cleanDoc !== '-' && cleanDoc !== 'รอระบุ' && cleanDoc.length > 2;
    const isMeaningfulRef = cleanRef && cleanRef !== '-' && cleanRef !== 'รอระบุ' && cleanRef.length > 2;

    // 1. ตรวจในตารางหลัก 38 คอลัมน์ (records)
    for (const r of records) {
      const rDoNo = (r.doNo || '').trim().toLowerCase();
      const rPoNo = (r.poNo || '').trim().toLowerCase();
      const rDestTicket = (r.destTicketNo || '').trim().toLowerCase();
      const rRemarks = (r.remarks || '').toLowerCase();
      const rPhoto = r.photoAttachment || '';

      if (cleanFileId && (rRemarks.includes(cleanFileId) || rPhoto.includes(cleanFileId))) {
        return { isDuplicate: true, reason: `ไฟล์เดียวกันใน Google Drive (ID: ${cleanFileId})`, matchedId: r.id, inTable: 'records' };
      }
      if (isMeaningfulDoc && (rDoNo === cleanDoc || rDestTicket === cleanDoc || rPoNo === cleanDoc)) {
        return { isDuplicate: true, reason: `เลขที่บิล/ตั๋ว ${docNo} มีอยู่ในตารางหลักแล้ว (${r.id})`, matchedId: r.id, inTable: 'records' };
      }
      if (isMeaningfulRef && (rDoNo === cleanRef || rPoNo === cleanRef || rDestTicket === cleanRef)) {
        return { isDuplicate: true, reason: `เลขที่อ้างอิง ${refNo} มีอยู่ในตารางหลักแล้ว (${r.id})`, matchedId: r.id, inTable: 'records' };
      }

      // ตรวจสอบวันที่ + ทะเบียนรถ + น้ำหนัก (กรณีเลขที่บิลไม่ชัดเจน)
      if (extra?.date && extra?.vehicleReg && extra.vehicleReg !== '-' && extra.vehicleReg !== 'ระบุทะเบียน' && extra?.netWeight && extra.netWeight > 0) {
        const sameDate = r.date === extra.date;
        const normV1 = r.vehicleReg ? r.vehicleReg.replace(/[^ก-ฮ0-9]/g, '') : '';
        const normV2 = extra.vehicleReg.replace(/[^ก-ฮ0-9]/g, '');
        const sameVehicle = normV1 && normV2 && (normV1 === normV2 || normV1.includes(normV2) || normV2.includes(normV1));
        const rNet = r.originNet || r.qty || 0;
        const weightDiff = Math.abs(rNet - extra.netWeight);
        if (sameDate && sameVehicle && weightDiff < 0.05) {
          return { isDuplicate: true, reason: `ตรวจพบรายการตรงกันในตารางหลัก (${r.id}: วันที่ ${extra.date}, ทะเบียน ${extra.vehicleReg}, นน. ${extra.netWeight} ตัน)`, matchedId: r.id, inTable: 'records' };
        }
      }
    }

    // 2. ตรวจในกล่องพักรอชนบิล (buffer)
    for (const b of buffer) {
      const bRefNo = (b.refNo || '').trim().toLowerCase();
      const bWeightNo = (b.weightTicketNo || '').trim().toLowerCase();
      const bRemarks = (b.remarks || '').toLowerCase();
      const bPhoto = b.photoAttachment || '';

      if (cleanFileId && (b.id.includes(cleanFileId) || bRemarks.includes(cleanFileId) || bPhoto.includes(cleanFileId))) {
        return { isDuplicate: true, reason: `ไฟล์เดียวกันใน Google Drive (ID: ${cleanFileId})`, matchedId: b.id, inTable: 'buffer' };
      }
      if (isMeaningfulDoc && (bRefNo === cleanDoc || bWeightNo === cleanDoc)) {
        return { isDuplicate: true, reason: `เลขที่ตั๋ว/บิล ${docNo} มีอยู่ในกล่องพักรอชนบิลแล้ว (${b.id})`, matchedId: b.id, inTable: 'buffer' };
      }
      if (isMeaningfulRef && (bRefNo === cleanRef || bWeightNo === cleanRef)) {
        return { isDuplicate: true, reason: `เลขที่อ้างอิง ${refNo} มีอยู่ในกล่องพักรอชนบิลแล้ว (${b.id})`, matchedId: b.id, inTable: 'buffer' };
      }

      // ตรวจสอบวันที่ + ทะเบียนรถ + น้ำหนัก
      if (extra?.date && extra?.vehicleReg && extra.vehicleReg !== '-' && extra.vehicleReg !== 'ระบุทะเบียน' && extra?.netWeight && extra.netWeight > 0) {
        const sameDate = b.date === extra.date;
        const normV1 = b.vehicleReg ? b.vehicleReg.replace(/[^ก-ฮ0-9]/g, '') : '';
        const normV2 = extra.vehicleReg.replace(/[^ก-ฮ0-9]/g, '');
        const sameVehicle = normV1 && normV2 && (normV1 === normV2 || normV1.includes(normV2) || normV2.includes(normV1));
        const bNet = ((b.destGross || 0) - (b.destTare || 0)) / 1000;
        const weightDiff = Math.abs(bNet - extra.netWeight);
        if (sameDate && sameVehicle && weightDiff < 0.05) {
          return { isDuplicate: true, reason: `ตรวจพบรายการตรงกันในกล่องพัก (${b.id}: วันที่ ${extra.date}, ทะเบียน ${extra.vehicleReg}, นน. ${extra.netWeight} ตัน)`, matchedId: b.id, inTable: 'buffer' };
        }
      }
    }

    return { isDuplicate: false, reason: '' };
  };

  // Handle incoming bills from external Bot or Supabase (with AI Type & Category Routing & Duplicate Prevention)
  const handleImportBotBill = (billData: any) => {
    // 🛡️ ตรวจสอบว่าบิลมีอยู่ในระบบหรือยังก่อนบันทึกเสมอ
    const dupCheck = checkIsDuplicateBill(
      billData.docNo,
      billData.refDocNo || billData.refNo,
      billData.driveFileId,
      {
        date: billData.date,
        vehicleReg: billData.vehicleReg,
        netWeight: Number(billData.netWeight || billData.qty || 0),
        supplier: billData.supplier
      }
    );

    if (dupCheck.isDuplicate) {
      // แนบรูปภาพเพิ่มเติมหากบิลเดิมยังไม่มีรูป
      if (billData.photoAttachment) {
        if (dupCheck.inTable === 'records' && dupCheck.matchedId) {
          setRecords(prev => prev.map(r => r.id === dupCheck.matchedId && !r.photoAttachment ? { ...r, photoAttachment: billData.photoAttachment } : r));
        } else if (dupCheck.inTable === 'buffer' && dupCheck.matchedId) {
          setBuffer(prev => prev.map(b => b.id === dupCheck.matchedId && !b.photoAttachment ? { ...b, photoAttachment: billData.photoAttachment } : b));
        }
      }
      showToast(`⚠️ ตรวจพบบิลซ้ำ: ${dupCheck.reason} (ระบบข้ามการบันทึกเพื่อไม่ให้ข้อมูลเบิ้ล)`, 'info');
      return;
    }

    // If AI separated this bill as SUPPLIER DO (บิลร้านค้า/ผู้จำหน่าย) -> ลงตารางหลัก 38 คอลัมน์
    if (billData.billType === 'SUPPLIER') {
      const nextNum = records.reduce((max, r) => {
        const m = /^TR-2026-(\d+)$/.exec(r.id);
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 0);
      const newId = `TR-2026-${String(nextNum + 1).padStart(3, '0')}`;
      const qty = Number(billData.qty || billData.netWeight || 0);
      const price = Number(billData.pricePerUnit || 0);
      const totalMat = Number(billData.totalAmount || (qty * price));

      const newRec: RecordItem = {
        id: newId,
        projectId: billData.projectId || (currentProjectFilter !== 'ALL' ? currentProjectFilter : 'PRJ-DOH-24'),
        projectName: billData.projectName || 'ทล.24 ตอน 2',
        category: billData.category || 'ทั่วไป',
        billType: 'SUPPLIER',
        poNo: billData.poRef || billData.poNo || '-',
        rrNo: '-',
        date: billData.date || new Date().toISOString().slice(0, 10),
        doNo: billData.docNo || '-',
        supplier: billData.supplier || 'โรงโม่ / ร้านค้า (AI สแกน)',
        contractor: 'บจก. บุรีรัมย์ธงชัยก่อสร้าง',
        vehicleReg: billData.vehicleReg || '-',
        itemDesc: billData.itemDesc || 'วัสดุก่อสร้าง',
        spec: billData.spec || 'STD',
        originGross: Number(billData.grossWeight || 0),
        originTare: Number(billData.tareWeight || 0),
        originNet: Number(billData.netWeight || qty),
        destDate: '-',
        destTicketNo: '-',
        destGross: 0,
        destTare: 0,
        destNet: 0,
        weightDiff: 0,
        qty: qty,
        unit: billData.unit || 'ตัน',
        pricePerUnit: price,
        totalMaterial: totalMat,
        transportType: 'สิบล้อ',
        freightRate: 0,
        totalFreight: 0,
        grandTotal: totalMat,
        paymentMethod: 'เครดิต 30 วัน',
        paidSupplier: 0,
        balanceSupplier: totalMat,
        paidHauler: 0,
        balanceHauler: 0,
        totalPaid: 0,
        totalOutstanding: totalMat,
        jobStation: billData.remarks || 'ระบุหน้างาน',
        remarks: `[บอทดึงจาก Drive + AI จัดหมวดหมู่] ${billData.remarks || ''}`.trim(),
        materialName: billData.itemDesc,
        billRemarks: billData.remarks,
        photoAttachment: billData.photoAttachment,
        isSubcontractorDeduction: Boolean(billData.isSubcontractorDeduction),
        subcontractorName: billData.subcontractorName,
        status: 'PENDING'
      };

      setRecords(prev => [newRec, ...prev]);
      supabaseUpsertRecord(newRec).catch(() => {});
      showToast(`🎉 AI สแกนสำเร็จ: บิล ${newRec.doNo} (${newRec.category}) เพิ่มลงในตารางหลัก (${newId}) เรียบร้อยแล้ว!`, 'success');
      return;
    }

    // If AI separated this bill as DEST_WEIGHT (ตั๋วชั่งปลายทาง) / PO / RR -> ส่งเข้ากล่องพักรอชนบิล (Buffer Pool)
    const nextNum = buffer.reduce((max, b) => {
      const m = /^BUF-(\d+)$/.exec(b.id);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 100);
    const newBufId = `BUF-${nextNum + 1}`;

    const newBufItem: BufferItem = {
      id: newBufId,
      projectId: billData.projectId || (currentProjectFilter !== 'ALL' ? currentProjectFilter : 'PRJ-DOH-24'),
      projectName: billData.projectName || 'ทล.24 ตอน 2',
      type: billData.billType === 'DEST_WEIGHT' ? 'ตั๋วใบชั่งปลายทาง' : (billData.billType || 'ตั๋วใบชั่งปลายทาง'),
      billType: billData.billType || 'DEST_WEIGHT',
      refNo: billData.docNo,
      weightTicketNo: billData.weightTicketNo || billData.docNo,
      date: billData.date || new Date().toISOString().slice(0, 10),
      vehicleReg: billData.vehicleReg || '-',
      destGross: billData.grossWeight || (billData.netWeight ? billData.netWeight * 1000 + 14000 : 0),
      destTare: billData.tareWeight || 14000,
      supplier: billData.supplier || 'โรงโม่ / นำเข้าอัตโนมัติจาก Bot',
      itemDesc: billData.itemDesc || 'วัสดุก่อสร้าง',
      materialName: billData.itemDesc,
      photoAttachment: billData.photoAttachment,
      remarks: billData.remarks || 'ดึงเข้าอัตโนมัติจาก Google Drive Bot + AI จัดประเภท'
    };

    setBuffer(prev => [newBufItem, ...prev]);
    supabaseUpsertBuffer(newBufItem).catch(() => {});

    // Check if can auto-match right away
    const matchResult = matchByDocumentNo(newBufItem, records);
    if (matchResult.matchedRecord) {
      showToast(`🎉 ตรวจพบการจับคู่ทันที! ตั๋ว ${billData.docNo} ตรงกับรายการ ${matchResult.matchedRecord.id} (${matchResult.matchedRecord.supplier}) ชนบิลได้เลย`, 'success');
    } else {
      showToast(`📥 AI สแกนสำเร็จ: บิล/ตั๋ว ${billData.docNo} ส่งเข้าสู่กล่องพักรอชนบิล (Buffer Pool) เรียบร้อยแล้ว`, 'info');
    }
  };

  // Handle batch incoming bills from external Bot (with Duplicate Check)
  const handleImportBatchBotBills = (billsData: any[]) => {
    let nextBufNum = buffer.reduce((max, b) => {
      const m = /^BUF-(\d+)$/.exec(b.id);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 100);

    let nextRecNum = records.reduce((max, r) => {
      const m = /^TR-2026-(\d+)$/.exec(r.id);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);

    const newBufItems: BufferItem[] = [];
    const newRecItems: RecordItem[] = [];
    let skippedDupCount = 0;

    for (const billData of billsData) {
      // 🛡️ ตรวจสอบบิลซ้ำ
      const dupCheck = checkIsDuplicateBill(
        billData.docNo,
        billData.refDocNo || billData.refNo,
        billData.driveFileId,
        {
          date: billData.date,
          vehicleReg: billData.vehicleReg,
          netWeight: Number(billData.netWeight || billData.qty || 0),
          supplier: billData.supplier
        }
      );

      // ตรวจสอบกับรายการที่เพิ่งเพิ่มในรอบนี้ด้วย
      const inCurrentRec = newRecItems.some(r => r.doNo === billData.docNo);
      const inCurrentBuf = newBufItems.some(b => b.refNo === billData.docNo || b.weightTicketNo === billData.docNo);

      if (dupCheck.isDuplicate || inCurrentRec || inCurrentBuf) {
        skippedDupCount++;
        continue;
      }

      if (billData.billType === 'SUPPLIER') {
        nextRecNum++;
        const newId = `TR-2026-${String(nextRecNum).padStart(3, '0')}`;
        const qty = Number(billData.qty || billData.netWeight || 0);
        const price = Number(billData.pricePerUnit || 0);
        const totalMat = Number(billData.totalAmount || (qty * price));

        newRecItems.push({
          id: newId,
          projectId: billData.projectId || (currentProjectFilter !== 'ALL' ? currentProjectFilter : 'PRJ-DOH-24'),
          projectName: billData.projectName || 'ทล.24 ตอน 2',
          category: billData.category || 'ทั่วไป',
          billType: 'SUPPLIER',
          poNo: billData.poRef || billData.poNo || '-',
          rrNo: '-',
          date: billData.date || new Date().toISOString().slice(0, 10),
          doNo: billData.docNo || '-',
          supplier: billData.supplier || 'โรงโม่ / ร้านค้า (AI สแกน)',
          contractor: 'บจก. บุรีรัมย์ธงชัยก่อสร้าง',
          vehicleReg: billData.vehicleReg || '-',
          itemDesc: billData.itemDesc || 'วัสดุก่อสร้าง',
          spec: billData.spec || 'STD',
          originGross: Number(billData.grossWeight || 0),
          originTare: Number(billData.tareWeight || 0),
          originNet: Number(billData.netWeight || qty),
          destDate: '-',
          destTicketNo: '-',
          destGross: 0,
          destTare: 0,
          destNet: 0,
          weightDiff: 0,
          qty: qty,
          unit: billData.unit || 'ตัน',
          pricePerUnit: price,
          totalMaterial: totalMat,
          transportType: 'สิบล้อ',
          freightRate: 0,
          totalFreight: 0,
          grandTotal: totalMat,
          paymentMethod: 'เครดิต 30 วัน',
          paidSupplier: 0,
          balanceSupplier: totalMat,
          paidHauler: 0,
          balanceHauler: 0,
          totalPaid: 0,
          totalOutstanding: totalMat,
          jobStation: billData.remarks || 'ระบุหน้างาน',
          remarks: `[บอทดึงจาก Drive + AI จัดหมวดหมู่] ${billData.remarks || ''}`.trim(),
          materialName: billData.itemDesc,
          billRemarks: billData.remarks,
          photoAttachment: billData.photoAttachment,
          isSubcontractorDeduction: Boolean(billData.isSubcontractorDeduction),
          subcontractorName: billData.subcontractorName,
          status: 'PENDING'
        });
      } else {
        nextBufNum++;
        newBufItems.push({
          id: `BUF-${nextBufNum}`,
          projectId: billData.projectId || (currentProjectFilter !== 'ALL' ? currentProjectFilter : 'PRJ-DOH-24'),
          projectName: billData.projectName || 'ทล.24 ตอน 2',
          type: billData.billType === 'DEST_WEIGHT' ? 'ตั๋วใบชั่งปลายทาง' : (billData.billType || 'ตั๋วใบชั่งปลายทาง'),
          billType: billData.billType || 'DEST_WEIGHT',
          refNo: billData.docNo,
          weightTicketNo: billData.weightTicketNo || billData.docNo,
          date: billData.date || new Date().toISOString().slice(0, 10),
          vehicleReg: billData.vehicleReg || '-',
          destGross: billData.grossWeight || (billData.netWeight ? billData.netWeight * 1000 + 14000 : 0),
          destTare: billData.tareWeight || 14000,
          supplier: billData.supplier || 'โรงโม่ / นำเข้าอัตโนมัติจาก Bot',
          itemDesc: billData.itemDesc || 'วัสดุก่อสร้าง',
          materialName: billData.itemDesc,
          photoAttachment: billData.photoAttachment,
          remarks: billData.remarks || billData.driveFileName || 'ดึงเข้าอัตโนมัติจาก Google Drive Bot + AI จัดประเภท'
        });
      }
    }

    if (newRecItems.length > 0) {
      setRecords(prev => [...newRecItems, ...prev]);
      newRecItems.forEach(r => supabaseUpsertRecord(r).catch(() => {}));
    }
    if (newBufItems.length > 0) {
      setBuffer(prev => [...newBufItems, ...prev]);
      newBufItems.forEach(b => supabaseUpsertBuffer(b).catch(() => {}));
    }

    const totalAdded = newRecItems.length + newBufItems.length;
    if (skippedDupCount > 0) {
      showToast(`🎉 ประมวลผลเสร็จสิ้น: นำเข้าบิลใหม่ ${totalAdded} รายการ | ข้ามบิลที่มีอยู่แล้วในระบบ ${skippedDupCount} รายการ (ป้องกันข้อมูลซ้ำซ้อน 100%)`, 'info');
    } else {
      showToast(`🎉 นำเข้าบิลสำเร็จรวม ${totalAdded} รายการ! (บิลผู้จำหน่าย: ${newRecItems.length} ใบ, ตั๋วชั่ง/ใบสั่ง: ${newBufItems.length} ใบ)`, 'success');
    }
  };

  // 1. Initial Load from Supabase Cloud (if configured)
  useEffect(() => {
    let isMounted = true;
    async function loadCloudData() {
      const client = getSupabaseClient();
      if (!client) {
        setIsCloudConnected(false);
        return;
      }
      try {
        setIsCloudLoading(true);
        const [cloudProjects, cloudRecords, cloudBuffer] = await Promise.all([
          supabaseFetchProjects(),
          supabaseFetchRecords(),
          supabaseFetchBuffer()
        ]);
        if (!isMounted) return;

        if (cloudProjects && cloudProjects.length > 0) {
          setProjects(cloudProjects);
        }
        if (cloudRecords && cloudRecords.length > 0) {
          setRecords(cloudRecords);
        }
        if (cloudBuffer && cloudBuffer.length > 0) {
          setBuffer(cloudBuffer);
        }
        setIsCloudConnected(true);
      } catch (err) {
        console.error('Supabase initial load error:', err);
      } finally {
        if (isMounted) setIsCloudLoading(false);
      }
    }
    loadCloudData();
    return () => { isMounted = false; };
  }, []);

  // 2. Supabase Realtime 2-Way Sync (Listening to projects, records, buffer)
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const channel = supabase
        .channel('realtime_all_tables_v1')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'reconciliation_records' },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const updatedRec = dbToRecord(payload.new);
              setRecords(prev => {
                const idx = prev.findIndex(r => r.id === updatedRec.id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = updatedRec;
                  return next;
                }
                return [updatedRec, ...prev];
              });
            } else if (payload.eventType === 'DELETE') {
              const delId = (payload.old as any)?.id;
              if (delId) setRecords(prev => prev.filter(r => r.id !== delId));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'projects' },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const updatedPrj = dbToProject(payload.new);
              setProjects(prev => {
                const idx = prev.findIndex(p => p.id === updatedPrj.id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = updatedPrj;
                  return next;
                }
                return [...prev, updatedPrj];
              });
            } else if (payload.eventType === 'DELETE') {
              const delId = (payload.old as any)?.id;
              if (delId) setProjects(prev => prev.filter(p => p.id !== delId));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bills_buffer' },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const updatedBuf = dbToBuffer(payload.new);
              setBuffer(prev => {
                const idx = prev.findIndex(b => b.id === updatedBuf.id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = updatedBuf;
                  return next;
                }
                return [updatedBuf, ...prev];
              });
            } else if (payload.eventType === 'DELETE') {
              const delId = (payload.old as any)?.id;
              if (delId) setBuffer(prev => prev.filter(b => b.id !== delId));
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsCloudConnected(true);
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.error('Supabase Realtime subscription error:', e);
    }
  }, []);

  const categories = Array.from(new Set(records.map(r => r.category))).filter(Boolean);

  // Filtered Records
  const filteredRecords = records.filter(item => {
    if (currentProjectFilter !== 'ALL' && item.projectId !== currentProjectFilter) return false;
    if (currentFilterTab === 'PENDING' && item.status !== 'PENDING') return false;
    if (currentFilterTab === 'MATCHED' && item.status !== 'MATCHED') return false;
    if (currentFilterTab === 'ALERT' && item.status !== 'ALERT') return false;
    if (currentFilterTab === 'SUBCONTRACTOR' && !item.isSubcontractorDeduction) return false;
    if (currentCategoryFilter !== 'ALL' && item.category !== currentCategoryFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const searchable = [
        item.id, item.projectId, item.projectName, item.poNo, item.rrNo, item.doNo, item.vehicleReg,
        item.supplier, item.contractor, item.itemDesc, item.spec,
        item.weightTicketNo, item.driverName, item.materialName, item.billRemarks
      ].map(v => String(v || '').toLowerCase()).join(' ');
      if (!searchable.includes(q)) return false;
    }
    return true;
  });

  // Strict Document Matching Function
  const handleMatchBufferItem = (bufId: string) => {
    const item = buffer.find(b => b.id === bufId);
    if (!item) return;

    const { matchedRecord, reason, rule } = matchByDocumentNo(item, records);

    if (!matchedRecord) {
      alert(`⚠️ ไม่สามารถจับคู่ได้ (ระบบจัดซื้อ/กระทบยอดเอกสาร):\n\n${reason}`);
      return;
    }

    if (item.billType === 'DEST_WEIGHT') {
      const destNet = (item.destGross && item.destTare) ? (item.destGross - item.destTare) / 1000 : 0;
      const weightDiff = Math.round((destNet - matchedRecord.originNet) * 1000);
      const newStatus = Math.abs(weightDiff) > 100 ? 'ALERT' : 'MATCHED';

      const updatedRec: RecordItem = {
        ...matchedRecord,
        destDate: item.date || matchedRecord.destDate,
        destTicketNo: item.refNo || matchedRecord.destTicketNo,
        destGross: item.destGross || matchedRecord.destGross,
        destTare: item.destTare || matchedRecord.destTare,
        destNet: destNet > 0 ? destNet : matchedRecord.destNet,
        weightDiff: destNet > 0 ? weightDiff : matchedRecord.weightDiff,
        status: newStatus,
        driverName: item.driverName || matchedRecord.driverName,
        remarks: `${matchedRecord.remarks || ''} [ชนบิลสำเร็จ: ${reason}]`.trim()
      };

      setRecords(prev => prev.map(r => r.id === matchedRecord.id ? updatedRec : r));
      setBuffer(prev => prev.filter(b => b.id !== bufId));
      supabaseUpsertRecord(updatedRec).catch(() => {});
      supabaseDeleteBuffer(bufId).catch(() => {});

      alert(`✅ ชนบิลสำเร็จตามเลขที่เอกสารอ้างอิง!\n\n${reason}\nรายการ: ${matchedRecord.id} (${matchedRecord.supplier})`);
    } else if (item.billType === 'PO') {
      alert(`ℹ️ ตรวจสอบพบเลขที่ PO ตรงกับ ${matchedRecord.id} (${matchedRecord.supplier}) ในตารางเรียบร้อยแล้ว`);
    } else if (item.billType === 'RR') {
      alert(`ℹ️ ตรวจสอบพบเลขที่ RR ตรงกับ ${matchedRecord.id} ในตารางเรียบร้อยแล้ว`);
    }
  };

  const handleDeleteRecord = (id: string) => {
    if (confirm(`ยืนยันการลบรายการ ${id}?`)) {
      setRecords(prev => prev.filter(r => r.id !== id));
      if (activeViewEditRecord?.id === id) setActiveViewEditRecord(null);
      supabaseDeleteRecord(id).catch(() => {});
    }
  };

  const handleSaveViewEdit = (updatedRecord: RecordItem) => {
    setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
    setActiveViewEditRecord(null);
    supabaseUpsertRecord(updatedRecord).catch(() => {});
    alert(`✅ บันทึกแก้ไขข้อมูลรายการ ${updatedRecord.id} สำเร็จเรียบร้อยแล้ว!`);
  };

  const handleDeleteBuffer = (id: string) => {
    if (confirm(`ยืนยันการลบรายการ ${id} ออกจากกล่องพักรอ?`)) {
      setBuffer(prev => prev.filter(b => b.id !== id));
      supabaseDeleteBuffer(id).catch(() => {});
    }
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = newCategory === '__NEW__' ? (newCustomCategory || 'ทั่วไป') : newCategory;
    const selectedPrj = projects.find(p => p.id === newProjectId) || projects[0];

    if (newBillType === 'SUPPLIER') {
      const nextNum = records.reduce((max, r) => {
        const m = /^TR-2026-(\d+)$/.exec(r.id);
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 0);
      const newId = `TR-2026-${String(nextNum + 1).padStart(3, '0')}`;
      const totalMat = newQty * newPrice;
      const totalFrt = newQty * newFreight;

      const newRec: RecordItem = {
        id: newId,
        projectId: selectedPrj?.id || 'PRJ-DOH-24',
        projectName: selectedPrj?.code || 'ทล.24 ตอน 2',
        category: finalCategory,
        billType: 'SUPPLIER',
        poNo: newPoNo || '-',
        rrNo: '-',
        date: new Date().toISOString().slice(0, 10),
        doNo: newDoNo,
        supplier: newSupplier,
        contractor: 'บจก. บุรีรัมย์ธงชัยก่อสร้าง',
        vehicleReg: newVehicleReg || '-',
        itemDesc: newItemDesc,
        spec: 'STD',
        originGross: 0,
        originTare: 0,
        originNet: newQty,
        destDate: '-',
        destTicketNo: '-',
        destGross: 0,
        destTare: 0,
        destNet: 0,
        weightDiff: 0,
        qty: newQty,
        unit: newUnit,
        pricePerUnit: newPrice,
        totalMaterial: totalMat,
        transportType: 'สิบล้อ',
        freightRate: newFreight,
        totalFreight: totalFrt,
        grandTotal: totalMat + totalFrt,
        paymentMethod: 'เครดิต 30 วัน',
        paidSupplier: 0,
        balanceSupplier: totalMat,
        paidHauler: 0,
        balanceHauler: totalFrt,
        totalPaid: 0,
        totalOutstanding: totalMat + totalFrt,
        jobStation: 'ระบุหน้างาน',
        remarks: 'คีย์บันทึกจากระบบ',
        weightTicketNo: newWeightTicketNo || '-',
        driverName: newDriverName || '-',
        materialName: newMaterialName,
        billRemarks: newBillRemarks,
        status: 'PENDING'
      };

      setRecords(prev => [newRec, ...prev]);
      supabaseUpsertRecord(newRec).catch(() => {});
      alert(`บันทึกบิลผู้จำหน่าย ${newId} ลงตารางหลักสำเร็จ`);
    } else {
      const nextNum = buffer.reduce((max, b) => {
        const m = /^BUF-(\d+)$/.exec(b.id);
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 100);
      const newBufId = `BUF-${nextNum + 1}`;

      const newBuf: BufferItem = {
        id: newBufId,
        projectId: selectedPrj?.id || 'PRJ-DOH-24',
        projectName: selectedPrj?.code || 'ทล.24 ตอน 2',
        type: newBillType === 'DEST_WEIGHT' ? 'ตั๋วใบชั่งปลายทาง' : newBillType,
        billType: newBillType,
        refNo: newDoNo,
        weightTicketNo: newWeightTicketNo || newDoNo,
        date: new Date().toISOString().slice(0, 10),
        vehicleReg: newVehicleReg || '-',
        destGross: newQty * 1000,
        destTare: 0,
        supplier: newSupplier,
        itemDesc: newItemDesc,
        driverName: newDriverName,
        materialName: newMaterialName,
        billRemarks: newBillRemarks
      };

      setBuffer(prev => [newBuf, ...prev]);
      supabaseUpsertBuffer(newBuf).catch(() => {});
      setIsBufferDrawerOpen(true);
      alert(`บันทึก ${newBillType} เข้ากล่องพักรอเรียบร้อยแล้ว (รอกดชนบิลด้วยเลขเอกสาร)`);
    }

    setIsAddModalOpen(false);
  };

  // Handle OCR Document Upload (Supports both single and multi-file batch scanning with Gemini AI)
  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsOcrLoading(true);

    // If multiple files selected: batch scan and save all automatically!
    if (files.length > 1) {
      showToast(`🤖 เริ่มให้ AI สแกนอ่านข้อมูลในบิลทั้งหมด ${files.length} ใบ...`, 'info');
      let successCount = 0;
      let skippedCount = 0;
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          showToast(`⏳ [${i + 1}/${files.length}] AI กำลังอ่านตัวเลขในบิล: ${file.name}...`, 'info');
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          const response = await fetch('/api/ocr-scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64Data,
              mimeType: file.type || 'image/jpeg',
              fileName: file.name
            })
          });

          const result = await response.json().catch(() => ({ success: false }));
          if (result.success && result.data) {
            const doc = result.data;

            // 🛡️ ตรวจสอบบิลซ้ำก่อนบันทึก
            const dupCheck = checkIsDuplicateBill(
              doc.docNo,
              doc.poRef || doc.refDocNo,
              undefined,
              {
                date: doc.date,
                vehicleReg: doc.vehicleReg,
                netWeight: Number(doc.netWeight || doc.qty || 0),
                supplier: doc.supplier
              }
            );

            if (dupCheck.isDuplicate) {
              skippedCount++;
              continue;
            }

            const isSupplier = doc.billType === 'SUPPLIER';

            if (isSupplier) {
              const nextNum = records.reduce((max, r) => {
                const m = /^TR-2026-(\d+)$/.exec(r.id);
                return m ? Math.max(max, parseInt(m[1], 10)) : max;
              }, 0);
              const newId = `TR-2026-${String(nextNum + 1 + successCount).padStart(3, '0')}`;
              const qty = Number(doc.qty || doc.netWeight || 0);
              const price = Number(doc.pricePerUnit || 0);
              const totalMat = Number(doc.totalAmount || (qty * price));

              const newRec: RecordItem = {
                id: newId,
                projectId: currentProjectFilter !== 'ALL' ? currentProjectFilter : 'PRJ-DOH-24',
                projectName: 'โครงการทางหลวง (BTC)',
                category: doc.category || 'หินคลุก / หินผสม (Base & Subbase)',
                billType: 'SUPPLIER',
                poNo: doc.poRef || '-',
                rrNo: '-',
                date: doc.date || new Date().toISOString().slice(0, 10),
                doNo: doc.docNo || file.name,
                supplier: doc.supplier || 'โรงโม่ / ร้านค้า',
                contractor: 'บจก. บุรีรัมย์ธงชัยก่อสร้าง',
                vehicleReg: doc.vehicleReg || '-',
                itemDesc: doc.itemDesc || 'วัสดุก่อสร้าง',
                spec: doc.spec || 'STD',
                originGross: doc.grossWeight || 0,
                originTare: doc.tareWeight || 0,
                originNet: doc.netWeight || qty,
                destDate: '-',
                destTicketNo: '-',
                destGross: 0,
                destTare: 0,
                destNet: 0,
                weightDiff: 0,
                qty: qty,
                unit: doc.unit || 'ตัน',
                pricePerUnit: price,
                totalMaterial: totalMat,
                transportType: 'สิบล้อ',
                freightRate: 0,
                totalFreight: 0,
                grandTotal: totalMat,
                paymentMethod: 'เครดิต 30 วัน',
                paidSupplier: 0,
                balanceSupplier: totalMat,
                paidHauler: 0,
                balanceHauler: 0,
                totalPaid: 0,
                totalOutstanding: totalMat,
                jobStation: 'ระบุหน้างาน',
                remarks: doc.remarks || 'สแกนคีย์ด้วย AI Vision',
                weightTicketNo: doc.docNo || '-',
                driverName: '-',
                materialName: doc.itemDesc || 'วัสดุก่อสร้าง',
                billRemarks: doc.remarks || '',
                isSubcontractorDeduction: doc.isSubcontractorDeduction || false,
                subcontractorName: doc.subcontractorName || '',
                status: 'PENDING'
              };

              setRecords(prev => [newRec, ...prev]);
              supabaseUpsertRecord(newRec).catch(() => {});
            } else {
              const nextNum = buffer.reduce((max, b) => {
                const m = /^BUF-(\d+)$/.exec(b.id);
                return m ? Math.max(max, parseInt(m[1], 10)) : max;
              }, 100);
              const newBufId = `BUF-${nextNum + 1 + successCount}`;

              const newBuf: BufferItem = {
                id: newBufId,
                projectId: currentProjectFilter !== 'ALL' ? currentProjectFilter : 'PRJ-DOH-24',
                projectName: 'โครงการทางหลวง (BTC)',
                type: 'ตั๋วใบชั่งปลายทาง',
                billType: 'DEST_WEIGHT',
                refNo: doc.refDocNo || doc.docNo,
                weightTicketNo: doc.docNo,
                date: doc.date || new Date().toISOString().slice(0, 10),
                vehicleReg: doc.vehicleReg || '-',
                destGross: doc.grossWeight || 0,
                destTare: doc.tareWeight || 0,
                supplier: doc.supplier || 'ตั๋วชั่งปลายทาง',
                itemDesc: doc.itemDesc || 'หิน / วัสดุ',
                driverName: '-',
                materialName: doc.itemDesc || 'หิน / วัสดุ',
                billRemarks: doc.remarks || ''
              };

              setBuffer(prev => [newBuf, ...prev]);
              supabaseUpsertBuffer(newBuf).catch(() => {});
            }
            successCount++;
          }
        } catch (err) {
          console.error(`Error scanning file ${file.name}:`, err);
        }
      }

      setIsOcrLoading(false);
      if (skippedCount > 0) {
        showToast(`🎉 AI สแกนเสร็จสิ้น: นำเข้าใหม่ ${successCount} ใบ | ข้ามบิลซ้ำที่มีอยู่แล้ว ${skippedCount} ใบ (ป้องกันข้อมูลเบิ้ล 100%)`, 'info');
      } else {
        showToast(`🎉 AI สแกนอ่านข้อมูลและคีย์ลงตารางสำเร็จเรียบร้อย ${successCount} จาก ${files.length} ใบ!`, 'success');
      }
      e.target.value = '';
      return;
    }

    // Single file upload: fill into form state and open review modal
    const file = files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      setOcrPreviewImage(base64Data);

      try {
        const response = await fetch('/api/ocr-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64Data,
            mimeType: file.type || 'image/jpeg',
            fileName: file.name
          })
        });

        const result = await response.json().catch(() => ({ success: false }));
        if (result.success && result.data) {
          const doc = result.data;

          // 🛡️ ตรวจสอบว่าบิลซ้ำหรือไม่
          const dupCheck = checkIsDuplicateBill(
            doc.docNo,
            doc.poRef || doc.refDocNo,
            undefined,
            {
              date: doc.date,
              vehicleReg: doc.vehicleReg,
              netWeight: Number(doc.netWeight || doc.qty || 0),
              supplier: doc.supplier
            }
          );

          if (dupCheck.isDuplicate) {
            showToast(`⚠️ คำเตือน: ${dupCheck.reason} (ระบบตรวจพบบิลซ้ำในระบบ โปรดตรวจสอบก่อนบันทึก)`, 'info');
          }

          // Auto-fill into form state
          if (doc.billType) setNewBillType(doc.billType);
          if (doc.category) {
            setNewCategory('__NEW__');
            setNewCustomCategory(doc.category);
          }
          if (doc.docNo) {
            setNewDoNo(doc.docNo);
            setNewWeightTicketNo(doc.docNo);
          }
          if (doc.poRef) setNewPoNo(doc.poRef);
          if (doc.supplier) setNewSupplier(doc.supplier);
          if (doc.vehicleReg) setNewVehicleReg(doc.vehicleReg);
          if (doc.itemDesc) {
            setNewItemDesc(doc.itemDesc);
            setNewMaterialName(doc.itemDesc);
          }
          const qty = Number(doc.qty || doc.netWeight || 0);
          if (qty) setNewQty(qty);
          if (doc.unit) setNewUnit(doc.unit);
          if (doc.pricePerUnit) setNewPrice(doc.pricePerUnit);
          if (doc.remarks) setNewBillRemarks(doc.remarks);

          setIsAddModalOpen(true);
          if (doc.quotaExceeded || doc.isAiFallback) {
            showToast(`⚠️ โควต้า AI ของ Google ชั่วคราวเกินกำหนด (Resource Exhausted) ระบบอ่านเลขที่บิลและหมวดหมู่วัสดุจากชื่อไฟล์ให้แทน โปรดตรวจตัวเลขก่อนบันทึก`, 'info');
          } else {
            showToast(`✨ AI สแกนบิลสำเร็จ! กรอกข้อมูลเลขที่ ${doc.docNo || '-'}, สินค้า: ${doc.itemDesc || '-'}, นน: ${doc.netWeight || qty} ${doc.unit || 'ตัน'} ให้อัตโนมัติแล้ว ตรวจสอบแล้วกดบันทึกได้เลย!`, 'success');
          }
        } else {
          // Client-side fallback if server response wasn't successful
          applyClientFallback(file);
        }
      } catch (err: any) {
        console.warn('OCR Fetch Notice, applying client fallback:', err);
        applyClientFallback(file);
      } finally {
        setIsOcrLoading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const applyClientFallback = (file: File) => {
    const isSupplier = file.name.includes('ใบส่งของ') || file.name.includes('บิล') || file.name.toUpperCase().includes('INV') || file.name.toUpperCase().includes('DO');
    const docNoMatch = file.name.match(/(?:เลขที่|No\.?|DO-?|INV-?)\s*([A-Za-z0-9\-\/]+)/i);
    const docNo = docNoMatch ? docNoMatch[1] : file.name.replace(/\.[^/.]+$/, '');
    setNewBillType(isSupplier ? 'SUPPLIER' : 'DEST_WEIGHT');
    setNewDoNo(docNo);
    setNewWeightTicketNo(docNo);
    setNewItemDesc('วัสดุก่อสร้างงานทางหลวง (โปรดตรวจสอบ)');
    setNewCategory('หินคลุก / หินผสม (Base & Subbase)');
    setIsAddModalOpen(true);
    showToast('⚠️ สแกนด้วย AI ขัดข้องชั่วคราว (โควต้า AI เต็ม) ระบบเปิดฟอร์มพร้อมเลขที่บิลจากชื่อไฟล์ให้แทน สามารถระบุตัวเลขและบันทึกได้ทันที', 'info');
  };

  const exportCSV = () => {
    const q = (v: any) => `"${String(v === null || v === undefined ? '' : v).replace(/"/g, '""')}"`;
    let csv = 'TR_ID,Category,PO_No,RR_No,DO_No,Date,Supplier,Contractor,Vehicle_Reg,Item_Desc,Spec,Origin_Gross,Origin_Tare,Origin_Net,Dest_Date,Dest_Ticket,Dest_Gross,Dest_Tare,Dest_Net,Weight_Diff,Qty,Unit,Price_Per_Unit,Total_Material,Transport_Type,Freight_Rate,Total_Freight,Grand_Total,Payment_Method,Paid_Supplier,Balance_Supplier,Paid_Hauler,Balance_Hauler,Total_Paid,Total_Outstanding,Job_Station,Remarks,Action\n';

    records.forEach(r => {
      csv += `${q(r.id)},${q(r.category)},${q(r.poNo)},${q(r.rrNo)},${q(r.doNo)},${q(r.date)},${q(r.supplier)},${q(r.contractor)},${q(r.vehicleReg)},${q(r.itemDesc)},${q(r.spec)},${r.originGross},${r.originTare},${r.originNet},${q(r.destDate)},${q(r.destTicketNo)},${r.destGross},${r.destTare},${r.destNet},${r.weightDiff},${r.qty},${q(r.unit)},${r.pricePerUnit},${r.totalMaterial},${q(r.transportType)},${r.freightRate},${r.totalFreight},${r.grandTotal},${q(r.paymentMethod)},${r.paidSupplier},${r.balanceSupplier},${r.paidHauler},${r.balanceHauler},${r.totalPaid},${r.totalOutstanding},${q(r.jobStation)},${q(r.remarks)},"VIEW"\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Reconciliation_38Cols_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export for Accounting System (Express Software: RR / รับวางบิล)
  const exportExpressFormat = () => {
    const q = (v: any) => `"${String(v === null || v === undefined ? '' : v).replace(/"/g, '""')}"`;
    // ฟอร์แมตนำเข้าโปรแกรม Express (เอกสารรับสินค้า / รับวางบิล RR)
    let csv = 'DOC_TYPE,DOC_NO,DOC_DATE,SUPPLIER_CODE,SUPPLIER_NAME,INV_NO,PO_REF,ITEM_CODE,ITEM_DESC,QTY,UNIT,PRICE,AMOUNT,VAT,TOTAL,REMARKS,STATUS\n';
    
    records.forEach(r => {
      csv += `"RR",${q(r.rrNo || r.id)},${q(r.date)},${q(r.supplier)},${q(r.supplier)},${q(r.doNo)},${q(r.poNo)},${q(r.itemDesc)},${q(r.materialName || r.itemDesc)},${r.qty},${q(r.unit)},${r.pricePerUnit},${r.totalMaterial},0,${r.grandTotal},${q(r.remarks)},${q(r.status)}\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Express_RR_Import_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert('📁 ส่งออกไฟล์สำหรับนำเข้า Express (ใบรับสินค้า/รับวางบิล RR) สำเร็จเรียบร้อยแล้ว!');
  };

  // Export Subcontractor Backcharge Deduction Report (รายงานสรุปหักเงินค่างวดผู้รับเหมาช่วง)
  const exportSubcontractorDeductionReport = () => {
    const q = (v: any) => `"${String(v === null || v === undefined ? '' : v).replace(/"/g, '""')}"`;
    let csv = 'TR_ID,วันที่,ผู้รับเหมาช่วง(ที่ถูกหักเงิน),งวดงานที่หัก,ร้านค้า/ผู้จำหน่าย,เลขที่บิล_DO,รายการวัสดุที่ซื้อให้,จำนวน,หน่วย,ราคา/หน่วย,ยอดเงินที่ต้องหัก(บาท),งาน_กม_สถานที่,หมายเหตุ\n';
    
    const subRecords = records.filter(r => r.isSubcontractorDeduction);
    if (subRecords.length === 0) {
      alert('⚠️ ยังไม่มีรายการที่ระบุให้หักเงินผู้รับเหมาช่วง');
      return;
    }

    subRecords.forEach(r => {
      csv += `${q(r.id)},${q(r.date)},${q(r.subcontractorName || r.contractor)},${q(r.subcontractorWorkPeriod || '-')},${q(r.supplier)},${q(r.doNo)},${q(r.itemDesc)},${r.qty},${q(r.unit)},${r.pricePerUnit},${r.totalMaterial},${q(r.jobStation)},${q(r.remarks)}\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Subcontractor_Deductions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert('📋 ส่งออก "รายงานหักเงินค่างวดผู้รับเหมาช่วง" เรียบร้อยแล้ว!');
  };

  const currentProject = projects.find(p => p.id === currentProjectFilter);
  const projectFilteredRecords = currentProjectFilter === 'ALL'
    ? records
    : records.filter(r => r.projectId === currentProjectFilter);

  const projectMaterialSpent = projectFilteredRecords.reduce((sum, r) => sum + (r.totalMaterial || 0), 0);
  const projectFreightSpent = projectFilteredRecords.reduce((sum, r) => sum + (r.totalFreight || 0), 0);
  const projectTotalSpent = projectMaterialSpent + projectFreightSpent;

  const counts = {
    all: projectFilteredRecords.length,
    pending: projectFilteredRecords.filter(r => r.status === 'PENDING').length,
    matched: projectFilteredRecords.filter(r => r.status === 'MATCHED').length,
    alert: projectFilteredRecords.filter(r => r.status === 'ALERT').length,
    subcontractorDeductions: projectFilteredRecords.filter(r => r.isSubcontractorDeduction).length
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 text-slate-800 font-sans overflow-hidden">
      {/* Top Header */}
      <header className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between shrink-0 shadow-sm border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs font-bold shrink-0">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-bold tracking-tight text-white leading-tight">ระบบชนบิลขนส่ง &amp; วัสดุ</h1>
              {isCloudConnected ? (
                <span className="hidden md:inline-flex items-center space-x-1 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-mono shadow-xs" title="เชื่อมต่อ Supabase Cloud สำเร็จ (Live CRUD & Realtime Sync)">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Supabase Cloud (CRUD)</span>
                </span>
              ) : (
                <button
                  onClick={() => setIsAutoSyncModalOpen(true)}
                  className="hidden md:inline-flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-cyan-300 px-2 py-0.5 rounded-full text-[10px] transition cursor-pointer"
                  title="คลิกเพื่อเชื่อมต่อฐานข้อมูล Supabase Cloud ให้บันทึกแบบ Realtime หลายคน"
                >
                  <Database className="w-3 h-3 text-slate-400" />
                  <span>LocalStorage (คลิกต่อ Supabase)</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">กระทบยอดตั๋วต้นทาง-ปลายทาง (38 คอลัมน์)</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Auto Drive / Bot Sync Button - Highlighted as 24/7 Auto-Pilot */}
          <button 
            onClick={() => setIsAutoSyncModalOpen(true)}
            className="flex items-center space-x-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-500/50 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-xs cursor-pointer"
            title="ระบบดูดบิลจาก LINE ใน Google Drive และให้ AI อ่านตัวเลขคีย์ลงตารางให้อัตโนมัติ 24 ชม."
          >
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Bot className="w-3.5 h-3.5 text-emerald-300" />
            <span>บอท Drive (24 ชม.)</span>
          </button>

          {/* AI Document Scanner from Local File (Optional helper) */}
          <label 
            className="hidden sm:flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-medium transition shadow-xs cursor-pointer"
            title="อัปโหลดรูปภาพบิลจากคอมพิวเตอร์หรือมือถือโดยตรง (กรณีไม่ได้ส่งเข้ากลุ่ม LINE)"
          >
            {isOcrLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            )}
            <span>{isOcrLoading ? 'กำลังสแกน...' : '📤 สแกนรูปจากเครื่อง'}</span>
            <input 
              type="file" 
              accept="image/*" 
              multiple
              disabled={isOcrLoading}
              onChange={handleOcrUpload} 
              className="hidden" 
            />
          </label>

          {/* Add Record Button */}
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-xs cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>+ เพิ่มรายการ</span>
          </button>

          {/* Buffer Drawer Button */}
          <button 
            onClick={() => setIsBufferDrawerOpen(true)}
            className="flex items-center space-x-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer"
            title="เปิดกล่องพักรอชนบิล (Buffer Pool)"
          >
            <Archive className="w-3.5 h-3.5 text-amber-400" />
            <span>รอชนบิล</span>
            <span className="bg-amber-500 text-slate-950 font-bold px-1.5 py-0.2 rounded-full text-[10px] leading-tight">
              {buffer.length}
            </span>
          </button>

          {/* Export Dropdown Menu */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setIsExportMenuOpen(prev => !prev)}
              className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer"
              title="ส่งออกรายงานและไฟล์ข้อมูล"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>ส่งออก</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-1 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50 text-xs">
                <button
                  onClick={() => {
                    exportCSV();
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-700/80 flex items-center space-x-2 transition cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-white">ส่งออก CSV (38 คอลัมน์)</div>
                    <div className="text-[10px] text-slate-400">ครบทุกคอลัมน์มาตรฐาน</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    exportExpressFormat();
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-700/80 flex items-center space-x-2 transition cursor-pointer border-t border-slate-700/50"
                >
                  <FileSpreadsheet className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-white">ส่งออกไป Express (RR)</div>
                    <div className="text-[10px] text-slate-400">สำหรับโปรแกรมบัญชี Express</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    exportSubcontractorDeductionReport();
                    setIsExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-700/80 flex items-center space-x-2 transition cursor-pointer border-t border-slate-700/50"
                >
                  <FileText className="w-4 h-4 text-purple-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-white">รายงานหักเงินผู้รับเหมาช่วง</div>
                    <div className="text-[10px] text-slate-400">สรุปหักค่างวดงาน Subcontractor</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* More Actions Dropdown (Clean / Sample Data) */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setIsMoreMenuOpen(prev => !prev)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition cursor-pointer"
              title="เมนูเพิ่มเติม"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {isMoreMenuOpen && (
              <div className="absolute right-0 mt-1 w-52 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50 text-xs">
                <button
                  onClick={() => {
                    handleLoadRealBillsSample();
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-slate-200 hover:bg-slate-700/80 flex items-center space-x-2 transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-medium text-white">โหลดข้อมูลตัวอย่าง (5 ใบ)</div>
                    <div className="text-[10px] text-slate-400">ทดสอบระบบด้วยตั๋วจริง</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    handleClearAllData();
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-rose-300 hover:bg-rose-950/40 flex items-center space-x-2 transition cursor-pointer border-t border-slate-700/50"
                >
                  <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
                  <div>
                    <div className="font-medium text-rose-200">ล้างข้อมูล / เริ่มใช้ข้อมูลจริง</div>
                    <div className="text-[10px] text-rose-400/80">ล้างตัวอย่างให้ระบบว่าง 100%</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Unified Control & Filter Bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 shadow-2xs">
        {/* Left: Project & Category Selectors */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          {/* Project Selector */}
          <div className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-lg px-2 py-1 transition">
            <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <select
              value={currentProjectFilter}
              onChange={e => setCurrentProjectFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer max-w-[190px] truncate"
            >
              <option value="ALL">📁 ทุกโครงการ ({records.length})</option>
              {projects.map(p => {
                const count = records.filter(r => r.projectId === p.id).length;
                return (
                  <option key={p.id} value={p.id}>
                    {p.code} ({count}) — {p.name}
                  </option>
                );
              })}
            </select>
            <button
              onClick={() => setIsProjectModalOpen(true)}
              title="จัดการโครงการ"
              className="p-0.5 text-slate-400 hover:text-blue-600 transition cursor-pointer"
            >
              <FolderKanban className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Active Project Info Tag (if filtered) */}
          {currentProject && (
            <div className="hidden lg:flex items-center space-x-2 bg-blue-50 border border-blue-200 text-blue-900 px-2 py-1 rounded-md text-[11px]">
              <span className="font-semibold truncate max-w-[180px]">{currentProject.name}</span>
              <span className="text-slate-300">|</span>
              <span className="font-mono text-blue-700">จัดซื้อ: ฿{projectMaterialSpent.toLocaleString()}</span>
              <button
                onClick={() => setCurrentProjectFilter('ALL')}
                title="ดูทุกโครงการ"
                className="text-slate-400 hover:text-rose-600 ml-0.5 font-bold cursor-pointer"
              >
                ×
              </button>
            </div>
          )}

          {/* Category Selector */}
          <div className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-lg px-2 py-1 transition">
            <Layers className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={currentCategoryFilter}
              onChange={e => setCurrentCategoryFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer max-w-[160px] truncate"
            >
              <option value="ALL">📋 ทุกหมวดหมู่ ({records.length})</option>
              {categories.map(cat => {
                const count = records.filter(r => r.category === cat).length;
                return (
                  <option key={cat} value={cat}>
                    {cat} ({count})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Right: Status Filters & Search */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          {/* Status Segmented Tabs */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
            <button
              onClick={() => setCurrentFilterTab('ALL')}
              className={`px-2 py-1 rounded-md font-medium transition cursor-pointer ${
                currentFilterTab === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมด ({counts.all})
            </button>
            <button
              onClick={() => setCurrentFilterTab('PENDING')}
              className={`px-2 py-1 rounded-md font-medium transition cursor-pointer flex items-center space-x-1 ${
                currentFilterTab === 'PENDING'
                  ? 'bg-amber-500 text-white shadow-2xs font-bold'
                  : 'text-amber-700 hover:bg-amber-100/60'
              }`}
            >
              <span>รอชนบิล</span>
              <span className={`px-1 rounded-full text-[10px] ${currentFilterTab === 'PENDING' ? 'bg-amber-700' : 'bg-amber-200/80'}`}>
                {counts.pending}
              </span>
            </button>
            <button
              onClick={() => setCurrentFilterTab('MATCHED')}
              className={`px-2 py-1 rounded-md font-medium transition cursor-pointer flex items-center space-x-1 ${
                currentFilterTab === 'MATCHED'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'text-emerald-700 hover:bg-emerald-100/60'
              }`}
            >
              <span>จับคู่แล้ว</span>
              <span className={`px-1 rounded-full text-[10px] ${currentFilterTab === 'MATCHED' ? 'bg-emerald-800' : 'bg-emerald-200/80'}`}>
                {counts.matched}
              </span>
            </button>
            <button
              onClick={() => setCurrentFilterTab('ALERT')}
              className={`px-2 py-1 rounded-md font-medium transition cursor-pointer flex items-center space-x-1 ${
                currentFilterTab === 'ALERT'
                  ? 'bg-rose-600 text-white shadow-2xs font-bold'
                  : 'text-rose-700 hover:bg-rose-100/60'
              }`}
            >
              <span>น้ำหนักต่าง</span>
              <span className={`px-1 rounded-full text-[10px] ${currentFilterTab === 'ALERT' ? 'bg-rose-800' : 'bg-rose-200/80'}`}>
                {counts.alert}
              </span>
            </button>
            <button
              onClick={() => setCurrentFilterTab('SUBCONTRACTOR')}
              className={`px-2 py-1 rounded-md font-medium transition cursor-pointer flex items-center space-x-1 ${
                currentFilterTab === 'SUBCONTRACTOR'
                  ? 'bg-purple-700 text-white shadow-2xs font-bold'
                  : 'text-purple-700 hover:bg-purple-100/60'
              }`}
            >
              <span>หักผู้รับเหมา</span>
              <span className={`px-1 rounded-full text-[10px] ${currentFilterTab === 'SUBCONTRACTOR' ? 'bg-purple-900' : 'bg-purple-200/80'}`}>
                {counts.subcontractorDeductions}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[170px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ค้นหาบิล, ทะเบียน, สินค้า..." 
              className="w-full pl-8 pr-2.5 py-1 bg-slate-100 hover:bg-slate-200/60 focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500 transition"
            />
          </div>
        </div>
      </div>

      {/* Main Table Workspace: Full 38 Columns */}
      <main className="flex-1 overflow-auto bg-slate-200 relative">
        <table className="border-collapse separate border-spacing-0 w-max min-w-full text-[12px] bg-white">
          <thead className="sticky top-0 z-30 font-bold border-b border-slate-300">
            {/* Header Tier 1: Zones */}
            <tr className="text-[11px] uppercase border-b border-slate-300">
              <th colSpan={6} className="bg-slate-300 text-blue-950 p-2 text-center border-r border-slate-400">[โซน 1: เอกสารอ้างอิงหลัก &amp; โครงการ] คอลัมน์ 1-5</th>
              <th colSpan={6} className="bg-slate-200 text-slate-800 p-2 text-center border-r border-slate-300">[โซน 2: วันที่ คู่ค้า &amp; สินค้า] คอลัมน์ 6-11</th>
              <th colSpan={3} className="bg-teal-100 text-teal-900 p-2 text-center border-r border-slate-300">[โซน 3: น้ำหนักต้นทาง] คอลัมน์ 12-14</th>
              <th colSpan={6} className="bg-emerald-100 text-emerald-900 p-2 text-center border-r border-slate-300">[โซน 4: ปลายทาง &amp; ผลต่าง] คอลัมน์ 15-20</th>
              <th colSpan={8} className="bg-indigo-100 text-indigo-900 p-2 text-center border-r border-slate-300">[โซน 5: คิดเงิน &amp; ค่าบรรทุก] คอลัมน์ 21-28</th>
              <th colSpan={7} className="bg-amber-100 text-amber-900 p-2 text-center border-r border-slate-300">[โซน 6: การชำระเงิน] คอลัมน์ 29-35</th>
              <th colSpan={2} className="bg-slate-200 text-slate-800 p-2 text-center border-r border-slate-300">[โซน 7] 36-37</th>
              <th className="bg-slate-300 text-slate-900 p-2 text-center">38. จัดการ</th>
            </tr>
            {/* Header Tier 2: Columns */}
            <tr className="bg-slate-100 text-slate-700 text-[11px] border-b border-slate-300">
              {/* Zone 1 */}
              <th className="p-2 border-r border-slate-300 text-left w-24">1. เลข TR</th>
              <th className="p-2 border-r border-slate-300 text-center w-28 bg-blue-100/70 text-blue-950 font-bold">โครงการ</th>
              <th className="p-2 border-r border-slate-300 text-left w-32">2. หมวดหมู่</th>
              <th className="p-2 border-r border-slate-300 text-left w-24">3. PO</th>
              <th className="p-2 border-r border-slate-300 text-left w-24">4. RR</th>
              <th className="p-2 border-r border-slate-300 text-left w-32 text-blue-700">5. DO / ตั๋ว</th>
              {/* Zone 2 */}
              <th className="p-2 border-r border-slate-300 text-left w-24">6. วันที่</th>
              <th className="p-2 border-r border-slate-300 text-left w-36">7. ผู้จำหน่าย</th>
              <th className="p-2 border-r border-slate-300 text-left w-36">8. ผู้รับเหมา</th>
              <th className="p-2 border-r border-slate-300 text-left w-28">9. ทะเบียนรถ</th>
              <th className="p-2 border-r border-slate-300 text-left w-44">10. รายการสินค้า</th>
              <th className="p-2 border-r border-slate-300 text-left w-32">11. สเปก / Code</th>
              {/* Zone 3 */}
              <th className="p-2 border-r border-slate-300 text-right w-24">12. หนักต้นทาง</th>
              <th className="p-2 border-r border-slate-300 text-right w-24">13. เบาต้นทาง</th>
              <th className="p-2 border-r border-slate-300 text-right w-24 bg-teal-50 text-teal-900">14. สุทธิต้นทาง</th>
              {/* Zone 4 */}
              <th className="p-2 border-r border-slate-300 text-left w-24">15. วันที่ปลายทาง</th>
              <th className="p-2 border-r border-slate-300 text-left w-28">16. ตั๋วปลายทาง</th>
              <th className="p-2 border-r border-slate-300 text-right w-24">17. หนักปลายทาง</th>
              <th className="p-2 border-r border-slate-300 text-right w-24">18. เบาปลายทาง</th>
              <th className="p-2 border-r border-slate-300 text-right w-24 bg-emerald-50 text-emerald-900">19. สุทธิปลายทาง</th>
              <th className="p-2 border-r border-slate-300 text-right w-24 bg-rose-50 text-rose-700">20. ผลต่าง(กก.)</th>
              {/* Zone 5 */}
              <th className="p-2 border-r border-slate-300 text-right w-20">21. ปริมาณ</th>
              <th className="p-2 border-r border-slate-300 text-center w-16">22. หน่วย</th>
              <th className="p-2 border-r border-slate-300 text-right w-20">23. ราคา/หน่วย</th>
              <th className="p-2 border-r border-slate-300 text-right w-24 bg-indigo-50">24. ค่าสินค้า</th>
              <th className="p-2 border-r border-slate-300 text-left w-28">25. ประเภทรถ</th>
              <th className="p-2 border-r border-slate-300 text-right w-20">26. ค่าบรรทุก/หน่วย</th>
              <th className="p-2 border-r border-slate-300 text-right w-24 bg-indigo-50">27. รวมค่าขนส่ง</th>
              <th className="p-2 border-r border-slate-300 text-right w-28 bg-blue-100 text-blue-950 font-bold">28. รวมทั้งสิ้น</th>
              {/* Zone 6 */}
              <th className="p-2 border-r border-slate-300 text-left w-28">29. รูปแบบจ่าย</th>
              <th className="p-2 border-r border-slate-300 text-right w-24">30. จ่ายผู้ขายแล้ว</th>
              <th className="p-2 border-r border-slate-300 text-right w-24 text-amber-800">31. ค้างผู้ขาย</th>
              <th className="p-2 border-r border-slate-300 text-right w-24">32. จ่ายขนส่งแล้ว</th>
              <th className="p-2 border-r border-slate-300 text-right w-24 text-amber-800">33. ค้างขนส่ง</th>
              <th className="p-2 border-r border-slate-300 text-right w-24 text-emerald-800">34. ชำระแล้วรวม</th>
              <th className="p-2 border-r border-slate-300 text-right w-28 text-rose-800 bg-amber-50 font-bold">35. ยอดค้างรวม</th>
              {/* Zone 7 */}
              <th className="p-2 border-r border-slate-300 text-left w-36">36. งาน/กม.</th>
              <th className="p-2 border-r border-slate-300 text-left w-44">37. หมายเหตุ</th>
              {/* Col 38 */}
              <th className="p-2 text-center w-28 bg-slate-200">38. จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-mono">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={39} className="p-12 text-center bg-white font-sans">
                  <div className="max-w-md mx-auto space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner border border-blue-100">
                      <FolderKanban className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-slate-800">
                        {records.length === 0 ? '✨ ระบบว่างพร้อมสำหรับเริ่มบันทึกข้อมูลจริง' : 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {records.length === 0 
                          ? 'ไม่มีข้อมูลตัวอย่างตกค้าง คุณสามารถเริ่มนำเข้าบิลจริงได้ผ่านช่องทางด้านล่างนี้:'
                          : 'ลองปรับเปลี่ยนคำค้นหา หรือเลือกตัวกรองโครงการเป็น "ทุกโครงการ"'}
                      </p>
                    </div>

                    {records.length === 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 text-xs">
                        <button
                          onClick={() => setIsAutoSyncModalOpen(true)}
                          className="p-3 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-900 flex flex-col items-center justify-center space-y-1.5 transition cursor-pointer shadow-2xs"
                        >
                          <Bot className="w-5 h-5 text-blue-600" />
                          <span className="font-bold text-[11px]">ดึงอัตโนมัติจาก Drive</span>
                          <span className="text-[10px] text-blue-700/80">ผ่าน Google Apps Script</span>
                        </button>
                        <button
                          onClick={() => setIsAddModalOpen(true)}
                          className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900 flex flex-col items-center justify-center space-y-1.5 transition cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-5 h-5 text-emerald-600" />
                          <span className="font-bold text-[11px]">คีย์บิล/ตั๋วชั่งใหม่</span>
                          <span className="text-[10px] text-emerald-700/80">เพิ่มข้อมูลตั๋วชั่งเอง</span>
                        </button>
                        <button
                          onClick={handleLoadRealBillsSample}
                          className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex flex-col items-center justify-center space-y-1.5 transition cursor-pointer shadow-2xs"
                        >
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          <span className="font-bold text-[11px]">โหลดตัวอย่างทดสอบ</span>
                          <span className="text-[10px] text-slate-500">บิลจริง 5 ใบเดิม</span>
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredRecords.map(item => (
              <tr key={item.id} className="hover:bg-blue-50/50 transition">
                {/* 1-5 */}
                <td className="p-2 border-r border-slate-200 font-bold font-mono text-blue-800 whitespace-nowrap">
                  <button 
                    onClick={() => setActiveViewEditRecord(item)}
                    className="font-mono text-blue-700 hover:text-blue-950 hover:underline cursor-pointer font-bold text-[12px]"
                    title="คลิกเพื่อดูและแก้ไขข้อมูลพร้อมภาพบิล"
                  >
                    {item.id}
                  </button>
                </td>
                {/* Dedicated Project Column */}
                <td className="p-2 border-r border-slate-200 text-center whitespace-nowrap bg-blue-50/20">
                  {item.projectName ? (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (item.projectId) setCurrentProjectFilter(item.projectId);
                      }}
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-sans font-bold shadow-2xs transition hover:opacity-90 cursor-pointer truncate max-w-[120px] ${
                        item.projectId === 'PRJ-DRR-3001' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200' :
                        item.projectId === 'PRJ-BY-CITY' ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200' :
                        item.projectId === 'PRJ-BR-WATER' ? 'bg-purple-100 text-purple-800 border border-purple-300 hover:bg-purple-200' :
                        'bg-blue-100 text-blue-800 border border-blue-300 hover:bg-blue-200'
                      }`}
                      title={`คลิกเพื่อกรองเฉพาะโครงการ ${item.projectName}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-current"></span>
                      <span className="truncate">{item.projectName}</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-sans">-</span>
                  )}
                </td>
                <td className="p-2 border-r border-slate-200 font-sans truncate max-w-[130px]">{item.category}</td>
                <td className="p-2 border-r border-slate-200">{item.poNo}</td>
                <td className="p-2 border-r border-slate-200">{item.rrNo}</td>
                <td className="p-2 border-r border-slate-200 font-bold text-blue-700 bg-blue-50/30">{item.doNo}</td>
                {/* 6-11 */}
                <td className="p-2 border-r border-slate-200">{item.date}</td>
                <td className="p-2 border-r border-slate-200 font-sans truncate max-w-[140px]">{item.supplier}</td>
                <td className="p-2 border-r border-slate-200 font-sans truncate max-w-[150px]">
                  <div className="flex flex-col">
                    <span className="truncate">{item.contractor}</span>
                    {item.isSubcontractorDeduction && (
                      <span className="inline-block mt-0.5 px-1 py-0.2 bg-purple-100 text-purple-800 rounded text-[9px] font-bold border border-purple-300 w-fit">
                        ✂️ หักเงินค่างวด {item.subcontractorName || ''}
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-2 border-r border-slate-200 font-bold">{item.vehicleReg}</td>
                <td className="p-2 border-r border-slate-200 font-sans truncate max-w-[180px]">
                  <span className="font-bold text-slate-900">{item.materialName || item.itemDesc}</span>
                </td>
                <td className="p-2 border-r border-slate-200 font-sans text-slate-500 truncate max-w-[130px]">{item.spec}</td>
                {/* 12-14 */}
                <td className="p-2 border-r border-slate-200 text-right">{item.originGross ? item.originGross.toLocaleString() : '-'}</td>
                <td className="p-2 border-r border-slate-200 text-right">{item.originTare ? item.originTare.toLocaleString() : '-'}</td>
                <td className="p-2 border-r border-slate-200 text-right font-bold text-teal-800 bg-teal-50/30">{item.originNet ? item.originNet.toFixed(3) : '-'}</td>
                {/* 15-20 */}
                <td className="p-2 border-r border-slate-200">{item.destDate}</td>
                <td className="p-2 border-r border-slate-200 font-bold text-slate-800">{item.destTicketNo}</td>
                <td className="p-2 border-r border-slate-200 text-right">{item.destGross ? item.destGross.toLocaleString() : '-'}</td>
                <td className="p-2 border-r border-slate-200 text-right">{item.destTare ? item.destTare.toLocaleString() : '-'}</td>
                <td className="p-2 border-r border-slate-200 text-right font-bold text-emerald-800 bg-emerald-50/30">{item.destNet > 0 ? item.destNet.toFixed(3) : '-'}</td>
                <td className={`p-2 border-r border-slate-200 text-right font-bold ${item.weightDiff < -100 ? 'text-rose-600 bg-rose-50' : 'text-slate-700'}`}>
                  {item.destNet > 0 ? `${item.weightDiff} kg` : '-'}
                </td>
                {/* 21-28 */}
                <td className="p-2 border-r border-slate-200 text-right font-bold">{item.qty?.toFixed(2)}</td>
                <td className="p-2 border-r border-slate-200 text-center font-sans text-slate-500">{item.unit}</td>
                <td className="p-2 border-r border-slate-200 text-right">฿{item.pricePerUnit?.toLocaleString()}</td>
                <td className="p-2 border-r border-slate-200 text-right font-bold text-indigo-900 bg-indigo-50/30">฿{item.totalMaterial?.toLocaleString()}</td>
                <td className="p-2 border-r border-slate-200 font-sans truncate max-w-[110px]">{item.transportType}</td>
                <td className="p-2 border-r border-slate-200 text-right">฿{item.freightRate?.toLocaleString()}</td>
                <td className="p-2 border-r border-slate-200 text-right font-bold text-indigo-900 bg-indigo-50/30">฿{item.totalFreight?.toLocaleString()}</td>
                <td className="p-2 border-r border-slate-200 text-right font-bold text-blue-900 bg-blue-100">฿{item.grandTotal?.toLocaleString()}</td>
                {/* 29-35 */}
                <td className="p-2 border-r border-slate-200 font-sans truncate max-w-[110px]">{item.paymentMethod}</td>
                <td className="p-2 border-r border-slate-200 text-right">฿{item.paidSupplier?.toLocaleString()}</td>
                <td className="p-2 border-r border-slate-200 text-right font-bold text-amber-700">฿{item.balanceSupplier?.toLocaleString()}</td>
                <td className="p-2 border-r border-slate-200 text-right">฿{item.paidHauler?.toLocaleString()}</td>
                <td className="p-2 border-r border-slate-200 text-right font-bold text-amber-700">฿{item.balanceHauler?.toLocaleString()}</td>
                <td className="p-2 border-r border-slate-200 text-right text-emerald-700">฿{item.totalPaid?.toLocaleString()}</td>
                <td className="p-2 border-r border-slate-200 text-right font-bold text-rose-700 bg-amber-50">฿{item.totalOutstanding?.toLocaleString()}</td>
                {/* 36-37 */}
                <td className="p-2 border-r border-slate-200 font-sans truncate max-w-[150px]" title={item.jobStation}>
                  {item.jobStation || '-'}
                </td>
                <td className="p-2 border-r border-slate-200 font-sans text-slate-500 truncate max-w-[180px]">{item.remarks}</td>
                {/* 38 */}
                <td className="p-2 text-center font-sans">
                  <div className="flex items-center justify-center space-x-1">
                    <button 
                      onClick={() => setActiveViewEditRecord(item)}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-900 border border-blue-200 rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                      title="ดูรายละเอียดและแก้ไขข้อมูลพร้อมภาพบิล (Split-View)"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                      <span>ดู / แก้ไข</span>
                    </button>
                    <button 
                      onClick={() => handleDeleteRecord(item.id)}
                      className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                      title="ลบรายการ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </main>

      {/* Drawer: Buffer Pool */}
      {isBufferDrawerOpen && (
        <aside className="fixed inset-y-0 right-0 w-96 bg-white border-l border-slate-300 shadow-2xl z-50 flex flex-col font-sans">
          <div className="p-4 bg-amber-500 text-slate-950 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Archive className="w-5 h-5" />
              <div>
                <h3 className="font-bold text-sm">กล่องพักรอชนบิล (ตั๋วปลายทาง/PO)</h3>
                <p className="text-[10px] text-slate-900">ตรวจจับคู่ด้วยเลขที่เอกสารอ้างอิงจริง</p>
              </div>
            </div>
            <button onClick={() => setIsBufferDrawerOpen(false)} className="text-slate-900 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs bg-slate-100">
            {buffer.length === 0 ? (
              <div className="text-center py-8 text-slate-400">ไม่มีตั๋วค้างในกล่องพักรอ</div>
            ) : (
              buffer.map(b => (
                <div key={b.id} className="bg-white p-3 rounded border border-slate-200 shadow-xs space-y-1.5">
                  <div className="flex justify-between items-center font-bold">
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px]">{b.type}</span>
                    <span className="font-mono text-blue-700 font-bold">{b.refNo}</span>
                  </div>
                  <div className="text-slate-600 text-[11px] space-y-0.5">
                    <div>วันที่: {b.date}</div>
                    {b.vehicleReg && <div>ทะเบียน: <span className="font-bold">{b.vehicleReg}</span></div>}
                    {b.itemDesc && <div>รายการ: {b.itemDesc}</div>}
                    {(b.destGross || b.destTare) ? (
                      <div>ชั่งรวม/เบา: {b.destGross?.toLocaleString()} / {b.destTare?.toLocaleString()} kg</div>
                    ) : null}
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400">จับคู่ด้วยเลขที่บิล DO/PO/Ref</span>
                    <div className="flex space-x-1">
                      <button 
                        onClick={() => handleMatchBufferItem(b.id)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold flex items-center space-x-1 shadow-xs"
                      >
                        <LinkIcon className="w-3 h-3" />
                        <span>ชนบิล</span>
                      </button>
                      <button 
                        onClick={() => handleDeleteBuffer(b.id)}
                        className="p-1 text-rose-500 hover:text-rose-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      )}

      {/* Unified Modal: Split-View Bill Document Photo (Left) + 38-Columns Edit Form (Right) */}
      {activeViewEditRecord && (
        <BillDetailEditModal
          isOpen={true}
          record={activeViewEditRecord}
          onClose={() => setActiveViewEditRecord(null)}
          onSave={handleSaveViewEdit}
          onDelete={handleDeleteRecord}
          projects={projects}
        />
      )}

      {/* Project Manager Modal */}
      <ProjectManagerModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        projects={projects}
        records={records}
        currentProjectId={currentProjectFilter}
        onSelectProject={(pId) => setCurrentProjectFilter(pId)}
        onAddProject={(newPrj) => {
          setProjects(prev => [...prev, newPrj]);
          supabaseUpsertProject(newPrj).catch(() => {});
          alert(`✅ เพิ่มโครงการ "${newPrj.name}" เรียบร้อยแล้ว!`);
        }}
        onUpdateProject={(updatedPrj) => {
          setProjects(prev => prev.map(p => p.id === updatedPrj.id ? updatedPrj : p));
          setRecords(prev => prev.map(r => r.projectId === updatedPrj.id ? { ...r, projectName: updatedPrj.code } : r));
          supabaseUpsertProject(updatedPrj).catch(() => {});
          alert(`✅ บันทึกการแก้ไขโครงการ "${updatedPrj.code}" เรียบร้อยแล้ว!`);
        }}
        onDeleteProject={(pId) => {
          setProjects(prev => prev.filter(p => p.id !== pId));
          if (currentProjectFilter === pId) setCurrentProjectFilter('ALL');
          supabaseDeleteProject(pId).catch(() => {});
          alert('ลบโครงการเรียบร้อยแล้ว');
        }}
      />

      {/* Auto Bot & Supabase Sync Modal */}
      <AutoBotSyncModal
        isOpen={isAutoSyncModalOpen}
        onClose={() => setIsAutoSyncModalOpen(false)}
        onImportBotBill={handleImportBotBill}
        onImportBatchBotBills={handleImportBatchBotBills}
        projects={projects}
        records={records}
        buffer={buffer}
        onDataReloaded={(p, r, b) => {
          setProjects(p);
          setRecords(r);
          setBuffer(b);
          setIsCloudConnected(true);
        }}
      />

      {/* Modal: Add New Record */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-xl w-full flex flex-col shadow-2xl overflow-hidden border border-slate-300 font-sans">
            <div className="px-5 py-3 bg-blue-900 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Plus className="w-4 h-4 text-blue-300" />
                <h3 className="font-bold text-sm">เพิ่มรายการเอกสาร</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="p-5 space-y-3 text-xs bg-slate-50">
              <div className="bg-slate-900 text-white p-3 rounded space-y-2">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">โครงการก่อสร้าง (Project):</label>
                  {projects.length === 0 ? (
                    <div className="flex items-center space-x-2 bg-slate-800/80 p-2 rounded border border-slate-700">
                      <span className="text-slate-400 italic">ยังไม่มีโครงการในระบบ</span>
                      <button
                        type="button"
                        onClick={() => { setIsAddModalOpen(false); setIsProjectModalOpen(true); }}
                        className="text-xs text-blue-400 hover:text-blue-300 underline font-bold cursor-pointer"
                      >
                        + สร้างโครงการก่อน
                      </button>
                    </div>
                  ) : (
                    <select 
                      value={newProjectId}
                      onChange={e => setNewProjectId(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-amber-300 font-bold cursor-pointer"
                    >
                      <option value="">-- ไม่ระบุโครงการ (ส่วนกลาง) --</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.code} — {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">ประเภทเอกสาร:</label>
                  <select 
                    value={newBillType} 
                    onChange={e => setNewBillType(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-bold"
                  >
                    <option value="SUPPLIER">บิลร้านค้าผู้จำหน่าย (DO/ใบชั่งต้นทาง) → ลงตารางหลัก</option>
                    <option value="DEST_WEIGHT">ตั๋วใบชั่งปลายทาง → กล่องพักรอเพื่อชนบิล</option>
                    <option value="PO">ใบสั่งซื้อ (PO) → กล่องพักรอเพื่อชนบิล</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-0.5">เลขที่บิล / DO / เลขใบชั่ง (*จำเป็น):</label>
                  <input 
                    type="text" 
                    required 
                    value={newDoNo} 
                    onChange={e => setNewDoNo(e.target.value)} 
                    placeholder="เช่น 690920/00030" 
                    className="w-full border border-slate-300 rounded p-1.5 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-0.5">เลขที่ PO (ถ้ามี):</label>
                  <input 
                    type="text" 
                    value={newPoNo} 
                    onChange={e => setNewPoNo(e.target.value)} 
                    placeholder="เช่น PO-69020" 
                    className="w-full border border-slate-300 rounded p-1.5 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-0.5">ผู้จำหน่าย / กิจการ:</label>
                  <input 
                    type="text" 
                    required 
                    value={newSupplier} 
                    onChange={e => setNewSupplier(e.target.value)} 
                    placeholder="เช่น บจก. ศิลาไทย" 
                    className="w-full border border-slate-300 rounded p-1.5 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-0.5">ทะเบียนรถ:</label>
                  <input 
                    type="text" 
                    value={newVehicleReg} 
                    onChange={e => setNewVehicleReg(e.target.value)} 
                    placeholder="เช่น 70-6686 บร" 
                    className="w-full border border-slate-300 rounded p-1.5 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-0.5">รายการสินค้า:</label>
                  <input 
                    type="text" 
                    required 
                    value={newItemDesc} 
                    onChange={e => setNewItemDesc(e.target.value)} 
                    placeholder="เช่น หินฝุ่น, ทรายถม" 
                    className="w-full border border-slate-300 rounded p-1.5 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-0.5">ปริมาณ (ตัน/คิว/หน่วย):</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    value={newQty || ''} 
                    onChange={e => setNewQty(parseFloat(e.target.value) || 0)} 
                    placeholder="0.00" 
                    className="w-full border border-slate-300 rounded p-1.5 bg-white font-mono text-right"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded">
                  ยกเลิก
                </button>
                <button type="submit" className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold">
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Global In-App Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 text-xs font-semibold flex items-center space-x-2 animate-bounce-once">
          <span className="text-sm">
            {toast.type === 'error' ? '❌' : toast.type === 'info' ? 'ℹ️' : '✅'}
          </span>
          <span className="flex-1 leading-relaxed">{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white ml-2 text-sm cursor-pointer">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
