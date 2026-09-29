import React, { useState, useEffect } from 'react';
import { 
  Truck, Archive, Plus, FileSpreadsheet, FolderPlus, 
  Search, Expand, Trash2, Camera, Flag, 
  ZoomIn, ZoomOut, Link as LinkIcon,
  X, Save, Upload, AlertTriangle, CheckCircle2, Clock, Download,
  Sparkles, Loader2, Edit3, Check, Building2, FolderKanban, Layers, Bot, Database
} from 'lucide-react';
import { RecordItem, BufferItem, INITIAL_RECORDS, INITIAL_BUFFER, Project, INITIAL_PROJECTS } from './types';
import { REAL_BILLS_RECORDS, REAL_BILLS_BUFFER } from './sampleData';
import { matchByDocumentNo } from './matcher';
import { BillDetailEditModal } from './components/BillDetailEditModal';
import { ProjectManagerModal } from './components/ProjectManagerModal';
import { AutoBotSyncModal } from './components/AutoBotSyncModal';
import { getSupabaseClient, getSavedSupabaseConfig } from './lib/supabaseClient';

export default function App() {
  const STORAGE_VER = 'recon_v8_real_production';

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_VER}_projects`);
    return saved ? JSON.parse(saved) : [];
  });

  const [currentProjectFilter, setCurrentProjectFilter] = useState<string>('ALL');
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isAutoSyncModalOpen, setIsAutoSyncModalOpen] = useState(false);

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

  // OCR Scanner State
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrPreviewImage, setOcrPreviewImage] = useState<string | null>(null);

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

  // Handle incoming bills from external Bot or Supabase
  const handleImportBotBill = (billData: any) => {
    const nextNum = buffer.reduce((max, b) => {
      const m = /^BUF-(\d+)$/.exec(b.id);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 100);
    const newBufId = `BUF-${nextNum + 1}`;

    const newBufItem: BufferItem = {
      id: newBufId,
      projectId: billData.projectId || 'PRJ-DOH-24',
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
      remarks: billData.remarks || 'ดึงเข้าอัตโนมัติจาก Google Drive Bot'
    };

    setBuffer(prev => [newBufItem, ...prev]);

    // Check if can auto-match right away
    const matchResult = matchByDocumentNo(newBufItem, records);
    if (matchResult.matchedRecord) {
      alert(`🎉 บอทดึงบิล ${billData.docNo} เข้ามา และพบรายการในตารางหลักที่ตรงกันทันที (${matchResult.matchedRecord.id})! คุณสามารถกด "จับคู่" ได้ที่กล่องพักรอชนบิล`);
    } else {
      alert(`📥 บอทดึงบิล ${billData.docNo} เข้าสู่กล่องพักรอชนบิล (Buffer Pool) เรียบร้อยแล้ว!`);
    }
  };

  // Supabase Realtime Listener
  useEffect(() => {
    const supabase = getSupabaseClient();
    const cfg = getSavedSupabaseConfig();
    if (!supabase || !cfg.autoSync) return;

    try {
      const channel = supabase
        .channel('realtime_bills_buffer')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: cfg.tableName || 'bills_buffer' },
          (payload) => {
            if (payload.new) {
              handleImportBotBill({
                docNo: payload.new.doc_no || payload.new.id,
                billType: payload.new.bill_type || 'DEST_WEIGHT',
                supplier: payload.new.supplier,
                vehicleReg: payload.new.vehicle_reg,
                itemDesc: payload.new.item_desc,
                netWeight: payload.new.net_weight,
                grossWeight: payload.new.gross_weight,
                tareWeight: payload.new.tare_weight,
                projectId: payload.new.project_id,
                projectName: payload.new.project_name,
                remarks: payload.new.remarks
              });
            }
          }
        )
        .subscribe();

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

      setRecords(prev => prev.map(r => {
        if (r.id === matchedRecord.id) {
          return {
            ...r,
            destDate: item.date || r.destDate,
            destTicketNo: item.refNo || r.destTicketNo,
            destGross: item.destGross || r.destGross,
            destTare: item.destTare || r.destTare,
            destNet: destNet > 0 ? destNet : r.destNet,
            weightDiff: destNet > 0 ? weightDiff : r.weightDiff,
            status: newStatus,
            driverName: item.driverName || r.driverName,
            remarks: `${r.remarks || ''} [ชนบิลสำเร็จ: ${reason}]`.trim()
          };
        }
        return r;
      }));

      setBuffer(prev => prev.filter(b => b.id !== bufId));
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
    }
  };

  const handleSaveViewEdit = (updatedRecord: RecordItem) => {
    setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
    setActiveViewEditRecord(null);
    alert(`✅ บันทึกแก้ไขข้อมูลรายการ ${updatedRecord.id} สำเร็จเรียบร้อยแล้ว!`);
  };

  const handleDeleteBuffer = (id: string) => {
    if (confirm(`ยืนยันการลบรายการ ${id} ออกจากกล่องพักรอ?`)) {
      setBuffer(prev => prev.filter(b => b.id !== id));
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
      setIsBufferDrawerOpen(true);
      alert(`บันทึก ${newBillType} เข้ากล่องพักรอเรียบร้อยแล้ว (รอกดชนบิลด้วยเลขเอกสาร)`);
    }

    setIsAddModalOpen(false);
  };

  // Handle OCR Document Upload
  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      setOcrPreviewImage(base64Data);
      setIsOcrLoading(true);

      try {
        const response = await fetch('/api/ocr-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64Data,
            mimeType: file.type || 'image/jpeg'
          })
        });

        const result = await response.json();
        if (result.success && result.data) {
          const doc = result.data;
          // Auto-fill into form state
          if (doc.billType) setNewBillType(doc.billType);
          if (doc.category) {
            setNewCategory('__NEW__');
            setNewCustomCategory(doc.category);
          }
          if (doc.docNo) setNewDoNo(doc.docNo);
          if (doc.poRef) setNewPoNo(doc.poRef);
          if (doc.supplier) setNewSupplier(doc.supplier);
          if (doc.vehicleReg) setNewVehicleReg(doc.vehicleReg);
          if (doc.itemDesc) {
            setNewItemDesc(doc.itemDesc);
            setNewMaterialName(doc.itemDesc);
          }
          if (doc.qty) setNewQty(doc.qty);
          if (doc.unit) setNewUnit(doc.unit);
          if (doc.pricePerUnit) setNewPrice(doc.pricePerUnit);
          if (doc.remarks) setNewBillRemarks(doc.remarks);

          // Open Add Modal so user can review and approve
          setIsAddModalOpen(true);
          alert(`✨ สแกนเอกสารสำเร็จ!\nประเภท: ${doc.billType}\nหมวดหมู่ที่ AI วิเคราะห์ให้: ${doc.category || 'ทั่วไป'}\nเลขที่บิล: ${doc.docNo || '-'}\nสินค้า: ${doc.itemDesc || '-'}\n\nระบบจัดหมวดหมู่และกรอกข้อมูลให้อัตโนมัติ ตรวจสอบแล้วกดบันทึกได้เลย`);
        } else {
          alert('ไม่สามารถอ่านข้อมูลจากภาพได้: ' + (result.error || 'Unknown error'));
        }
      } catch (err: any) {
        console.error('OCR Fetch Error:', err);
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อระบบ OCR: ' + err.message);
      } finally {
        setIsOcrLoading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
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
      <header className="bg-slate-900 text-white px-5 py-2.5 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow font-bold text-base">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold tracking-wide">ระบบกระทบยอดบิลตั๋วขนส่ง & วัสดุก่อสร้าง (ครบ 38 คอลัมน์มาตรฐาน)</h1>
              <span className="px-2 py-0.5 text-[10px] rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                Full 38 Columns
              </span>
            </div>
            <p className="text-[11px] text-slate-400">ตรวจสอบและจับคู่ตั๋วต้นทาง-ปลายทาง (เรียงลำดับครบ 38 คอลัมน์ ไม่มีการตัดทอน)</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Clear All / Start Real Data Button */}
          <button 
            onClick={handleClearAllData}
            className="flex items-center space-x-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 hover:text-white px-2.5 py-1.5 rounded text-xs font-semibold transition border border-rose-800 shadow-xs cursor-pointer"
            title="ล้างข้อมูลทั้งหมด เพื่อเริ่มใช้งานข้อมูลจริงแบบว่างเปล่า"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>ล้างข้อมูล / เริ่มใช้ข้อมูลจริง</span>
          </button>

          {/* Load Sample Button */}
          <button 
            onClick={handleLoadRealBillsSample}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded text-xs transition border border-slate-700 shadow-xs cursor-pointer text-[11px]"
            title="โหลดตัวอย่างบิลจริง 5 ใบเพื่อทดสอบระบบ"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>ตัวอย่าง 5 ใบ</span>
          </button>

          {/* Auto Drive & Supabase Sync Button */}
          <button 
            onClick={() => setIsAutoSyncModalOpen(true)}
            className="flex items-center space-x-1.5 bg-gradient-to-r from-blue-700 to-cyan-700 hover:from-blue-600 hover:to-cyan-600 text-white px-3 py-1.5 rounded text-xs font-bold transition border border-cyan-500/50 shadow-xs cursor-pointer"
            title="ตั้งค่าดึงบิลอัตโนมัติจาก Google Drive (Gmail อื่น) และ Supabase Cloud"
          >
            <Bot className="w-4 h-4 text-cyan-300" />
            <span>🤖 ดึงบิลอัตโนมัติจาก Drive</span>
          </button>

          {/* AI Document OCR Scanner Button */}
          <label className="flex items-center space-x-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-3 py-1.5 rounded text-xs font-bold transition shadow cursor-pointer">
            {isOcrLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-300" />
            )}
            <span>{isOcrLoading ? 'AI กำลังอ่านและจำแนกเอกสาร...' : '⚡ สแกนบิล/เอกสารด้วย AI'}</span>
            <input 
              type="file" 
              accept="image/*" 
              disabled={isOcrLoading}
              onChange={handleOcrUpload} 
              className="hidden" 
            />
          </label>

          <button 
            onClick={() => setIsBufferDrawerOpen(true)}
            className="flex items-center space-x-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 px-3 py-1.5 rounded text-xs transition"
          >
            <Archive className="w-4 h-4 text-amber-400" />
            <span>กล่องพักรอชนบิล (LINE Feed)</span>
            <span className="bg-amber-500 text-slate-950 font-bold px-1.5 py-0.2 rounded-full text-[10px]">{buffer.length}</span>
          </button>

          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-semibold transition shadow"
          >
            <FolderPlus className="w-4 h-4" />
            <span>+ เพิ่มรายการ/หมวดหมู่ใหม่</span>
          </button>

          <button 
            onClick={exportCSV}
            className="flex items-center space-x-1.5 bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-xs transition border border-slate-600"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>ส่งออก CSV (38 คอลัมน์)</span>
          </button>

          {/* Express RR Export Button */}
          <button 
            onClick={exportExpressFormat}
            className="flex items-center space-x-1.5 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded text-xs font-semibold transition border border-amber-400 shadow-xs"
            title="ส่งออกไฟล์ข้อมูลรับสินค้า/รับวางบิล สำหรับนำเข้าโปรแกรมบัญชี Express"
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-200" />
            <span>ส่งออกไป Express (RR)</span>
          </button>

          {/* Subcontractor Deduction Export Button */}
          <button 
            onClick={exportSubcontractorDeductionReport}
            className="flex items-center space-x-1.5 bg-purple-700 hover:bg-purple-600 text-white px-3 py-1.5 rounded text-xs font-semibold transition border border-purple-500 shadow-xs"
            title="ส่งออกรายงานวัสดุที่ซื้อให้ผู้รับเหมาช่วง เพื่อนำไปหักค่างวดงาน Subcontractor"
          >
            <Download className="w-4 h-4 text-purple-200" />
            <span>รายงานหักเงินผู้รับเหมาช่วง</span>
          </button>
        </div>
      </header>

      {/* Multi-Project Switcher Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-white shrink-0">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1">
            <Building2 className="w-4 h-4 text-blue-400" />
            <span className="font-bold text-slate-300">โครงการ (Project):</span>
            <select
              value={currentProjectFilter}
              onChange={e => setCurrentProjectFilter(e.target.value)}
              className="bg-transparent font-bold text-amber-300 focus:outline-none cursor-pointer max-w-[280px] truncate"
            >
              <option value="ALL" className="bg-slate-900 text-white">📁 ทุกโครงการ (All Projects) — {records.length} รายการ</option>
              {projects.map(p => {
                const prjCount = records.filter(r => r.projectId === p.id).length;
                return (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                    {p.code} ({prjCount} บิล) — {p.name}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Quick Project Pills */}
          <div className="hidden lg:flex items-center space-x-1">
            <button
              onClick={() => setCurrentProjectFilter('ALL')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                currentProjectFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              ทั้งหมด ({records.length})
            </button>
            {projects.length === 0 ? (
              <button
                onClick={() => setIsProjectModalOpen(true)}
                className="px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center space-x-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 cursor-pointer"
                title="คลิกเพื่อสร้างโครงการก่อสร้างจริง"
              >
                <Plus className="w-3.5 h-3.5 text-blue-400" />
                <span>+ เพิ่มโครงการจริงแรกของคุณ</span>
              </button>
            ) : (
              projects.map(p => {
                const isSelected = currentProjectFilter === p.id;
                const count = records.filter(r => r.projectId === p.id).length;
                return (
                  <button
                    key={p.id}
                    onClick={() => setCurrentProjectFilter(p.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition flex items-center space-x-1 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{p.code}</span>
                    <span className={`text-[10px] px-1 rounded-full ${isSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-700 text-slate-300'}`}>
                      {count}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsProjectModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition cursor-pointer shadow-2xs"
            title="จัดการข้อมูลโครงการ เพิ่มสัญญา งบประมาณ และดูยอดใช้จ่ายแยกโครงการ"
          >
            <FolderKanban className="w-3.5 h-3.5 text-amber-400" />
            <span>จัดการโครงการ ({projects.length})</span>
          </button>
        </div>
      </div>

      {/* Active Project Banner (if filtered) */}
      {currentProject && (
        <div className="bg-blue-950/70 border-b border-blue-900/80 px-5 py-1.5 flex flex-wrap items-center justify-between text-xs text-blue-200 shrink-0">
          <div className="flex items-center space-x-3 truncate">
            <span className="font-bold text-white bg-blue-600 px-2 py-0.5 rounded text-[11px] shrink-0">
              {currentProject.code}
            </span>
            <span className="font-semibold text-slate-100 truncate">{currentProject.name}</span>
            <span className="hidden sm:inline text-slate-500">|</span>
            <span className="hidden sm:inline text-blue-300 font-mono">สัญญา: {currentProject.contractNo || '-'}</span>
            <span className="hidden md:inline text-slate-500">|</span>
            <span className="hidden md:inline text-slate-300">{currentProject.client}</span>
            {currentProject.location && (
              <span className="hidden lg:inline text-slate-400 text-[11px]">📍 {currentProject.location}</span>
            )}
          </div>
          <div className="flex items-center space-x-3 shrink-0">
            <span className="text-[11px] text-slate-300">
              ยอดจัดซื้อวัสดุโครงการ: <strong className="text-amber-300 font-mono">฿{projectMaterialSpent.toLocaleString()}</strong>
            </span>
            <button
              onClick={() => setCurrentProjectFilter('ALL')}
              className="text-[11px] text-blue-300 hover:text-white underline cursor-pointer"
            >
              ✕ ดูทุกโครงการ
            </button>
          </div>
        </div>
      )}

      {/* Toolbar: Category-Driven View Presets */}
      <div className="bg-white border-b border-slate-300 px-5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 shadow-xs">
        
        {/* Smart Category Selector (รองรับทั้งแบบเร็ว และแบบมีเป็น 100 หมวดหมู่) */}
        <div className="flex items-center space-x-2">
          {/* Dropdown ค้นหาหมวดหมู่ สำหรับกรณีมีเป็น 100 หมวด */}
          <div className="flex items-center space-x-1.5 bg-slate-100 border border-slate-300 rounded px-2.5 py-1 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <label className="text-[11px] font-bold text-slate-700 whitespace-nowrap">2. หมวดหมู่:</label>
            <select
              value={currentCategoryFilter}
              onChange={e => setCurrentCategoryFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-800 font-bold focus:outline-none cursor-pointer max-w-[200px] truncate"
            >
              <option value="ALL">📋 ทั้งหมดทุกหมวดหมู่ ({records.length})</option>
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

          {/* ปุ่มด่วนเฉพาะหมวดที่มีข้อมูลมากที่สุด (Top 4 Categories) เพื่อความรวดเร็ว */}
          <div className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => setCurrentCategoryFilter('ALL')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                currentCategoryFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ทั้งหมด
            </button>
            {categories.slice(0, 4).map(cat => {
              const isSelected = currentCategoryFilter === cat;
              const count = records.filter(r => r.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setCurrentCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition flex items-center space-x-1 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className="truncate max-w-[120px]">{cat}</span>
                  <span className={`text-[10px] px-1 rounded-full ${isSelected ? 'bg-blue-800 text-white' : 'bg-slate-300 text-slate-700'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Secondary: Status Filter Tabs & Search */}
        <div className="flex items-center space-x-3 flex-wrap gap-y-1">
          {/* Status Tabs */}
          <div className="flex items-center space-x-1 text-[11px]">
            <button onClick={() => setCurrentFilterTab('ALL')} className={`px-2 py-0.5 rounded font-medium ${currentFilterTab === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-100'}`}>ทั้งหมด ({counts.all})</button>
            <button onClick={() => setCurrentFilterTab('PENDING')} className={`px-2 py-0.5 rounded font-medium ${currentFilterTab === 'PENDING' ? 'bg-amber-600 text-white' : 'text-amber-700 bg-amber-50 border border-amber-200'}`}>รอชนบิล ({counts.pending})</button>
            <button onClick={() => setCurrentFilterTab('MATCHED')} className={`px-2 py-0.5 rounded font-medium ${currentFilterTab === 'MATCHED' ? 'bg-emerald-600 text-white' : 'text-emerald-700 bg-emerald-50 border border-emerald-200'}`}>จับคู่แล้ว ({counts.matched})</button>
            <button onClick={() => setCurrentFilterTab('ALERT')} className={`px-2 py-0.5 rounded font-medium ${currentFilterTab === 'ALERT' ? 'bg-rose-600 text-white' : 'text-rose-700 bg-rose-50 border border-rose-200'}`}>น้ำหนักต่างเกินเกณฑ์ ({counts.alert})</button>
            <button onClick={() => setCurrentFilterTab('SUBCONTRACTOR')} className={`px-2 py-0.5 rounded font-medium flex items-center space-x-1 ${currentFilterTab === 'SUBCONTRACTOR' ? 'bg-purple-700 text-white shadow-xs' : 'text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100'}`}>
              <span>หักค่างวดผู้รับเหมาช่วง</span>
              <span className={`text-[10px] px-1 rounded-full ${currentFilterTab === 'SUBCONTRACTOR' ? 'bg-purple-900 text-white' : 'bg-purple-200 text-purple-800'}`}>
                {counts.subcontractorDeductions}
              </span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ค้นหา TR, DO, PO, RR, ทะเบียน, ผู้ขาย..." 
              className="pl-8 pr-2 py-1 border border-slate-300 rounded text-xs w-52 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500"
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
          alert(`✅ เพิ่มโครงการ "${newPrj.name}" เรียบร้อยแล้ว!`);
        }}
        onUpdateProject={(updatedPrj) => {
          setProjects(prev => prev.map(p => p.id === updatedPrj.id ? updatedPrj : p));
          setRecords(prev => prev.map(r => r.projectId === updatedPrj.id ? { ...r, projectName: updatedPrj.code } : r));
          alert(`✅ บันทึกการแก้ไขโครงการ "${updatedPrj.code}" เรียบร้อยแล้ว!`);
        }}
        onDeleteProject={(pId) => {
          setProjects(prev => prev.filter(p => p.id !== pId));
          if (currentProjectFilter === pId) setCurrentProjectFilter('ALL');
          alert('ลบโครงการเรียบร้อยแล้ว');
        }}
      />

      {/* Auto Bot & Supabase Sync Modal */}
      <AutoBotSyncModal
        isOpen={isAutoSyncModalOpen}
        onClose={() => setIsAutoSyncModalOpen(false)}
        onImportBotBill={handleImportBotBill}
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
    </div>
  );
}
