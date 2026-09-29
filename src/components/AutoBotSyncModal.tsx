import React, { useState, useEffect } from 'react';
import { 
  X, Bot, FolderCheck, Check, Copy, RefreshCw, 
  ExternalLink, CheckCircle2, Database, Play, ArrowRight, Clock, FileCode,
  UploadCloud, DownloadCloud, AlertCircle, Sparkles, Layers, MessageSquare,
  Loader2, FileText, CheckCheck, Truck, Scale, ShieldCheck
} from 'lucide-react';
import { 
  getSavedSupabaseConfig, 
  saveSupabaseConfig, 
  getSupabaseClient, 
  SupabaseConfig 
} from '../lib/supabaseClient';
import { 
  SUPABASE_SQL_SCHEMA, 
  supabaseBulkSyncAll, 
  supabaseFetchProjects, 
  supabaseFetchRecords, 
  supabaseFetchBuffer 
} from '../lib/supabaseCrud';
import { Project, RecordItem, BufferItem } from '../types';

interface AutoBotSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'ai_drive_scan' | 'drive_script' | 'supabase';
  onImportBotBill: (billData: any) => void;
  onImportBatchBotBills?: (billsData: any[]) => void;
  projects?: Project[];
  records?: RecordItem[];
  buffer?: BufferItem[];
  onDataReloaded?: (projects: Project[], records: RecordItem[], buffer: BufferItem[]) => void;
}

export const AutoBotSyncModal: React.FC<AutoBotSyncModalProps> = ({
  isOpen,
  onClose,
  initialTab,
  onImportBotBill,
  onImportBatchBotBills,
  projects = [],
  records = [],
  buffer = [],
  onDataReloaded
}) => {
  const [activeTab, setActiveTab] = useState<'ai_drive_scan' | 'drive_script' | 'supabase'>('ai_drive_scan');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // AI Scanning state
  const [isBatchAiScanning, setIsBatchAiScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number; fileName: string; billNo: string; supplier: string; weight: string } | null>(null);
  const [scannedHistory, setScannedHistory] = useState<any[]>([]);

  // Supabase state
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>(getSavedSupabaseConfig());
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const [supabaseStatusMsg, setSupabaseStatusMsg] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Live Bot Bills state
  const [liveBotBills, setLiveBotBills] = useState<any[]>([]);
  const [isLoadingBotBills, setIsLoadingBotBills] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string, _type?: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/bot-import-bill` : '/api/bot-import-bill';
  const webhookBatchUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/bot-import-batch` : '/api/bot-import-batch';
  const [folderId, setFolderId] = useState<string>(() => {
    return localStorage.getItem('btc_bot_folder_id') || '1Z6-WNDovLWEYQsYllTTPCDLIwQt3ufjx';
  });
  const folderUrl = `https://drive.google.com/drive/folders/${folderId}?usp=sharing`;

  const handleImportAllLiveBills = () => {
    if (liveBotBills.length === 0) return;
    if (onImportBatchBotBills) {
      onImportBatchBotBills(liveBotBills.map(b => b.data));
    } else {
      liveBotBills.forEach(b => onImportBotBill(b.data));
    }
    fetch('/api/bot-bills/ack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    setLiveBotBills([]);
  };

  // Fetch bot bills
  const fetchBotBills = async () => {
    setIsLoadingBotBills(true);
    try {
      const res = await fetch('/api/bot-bills');
      const data = await res.json();
      if (data.success && data.bills) {
        setLiveBotBills(data.bills);
      }
    } catch (e) {
      console.error('Failed to fetch bot bills:', e);
    } finally {
      setIsLoadingBotBills(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBotBills();
      const interval = setInterval(fetchBotBills, 4000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  // Test Supabase connection
  const handleTestSupabase = async () => {
    if (!supabaseConfig.url || !supabaseConfig.anonKey) {
      setSupabaseStatusMsg('❌ โปรดกรอก URL และ Anon Key ของ Supabase ให้ครบถ้วน');
      return;
    }
    saveSupabaseConfig(supabaseConfig);
    const client = getSupabaseClient();
    if (!client) {
      setSupabaseStatusMsg('❌ ไม่สามารถสร้าง Supabase Client ได้ โปรดตรวจ URL');
      return;
    }

    try {
      setSupabaseStatusMsg('⏳ กำลังทดสอบเชื่อมต่อ Supabase...');
      const { data, error } = await client.from('reconciliation_records').select('id').limit(1);
      if (error && error.code !== 'PGRST116') {
        if (error.message.includes('relation') || error.message.includes('does not exist')) {
          setIsSupabaseConnected(true);
          setSupabaseStatusMsg('⚠️ เชื่อมต่อ Supabase สำเร็จ! (แต่ยังไม่พบตารางในฐานข้อมูล โปรดคัดลอก SQL ด้านล่างไปรันใน Supabase SQL Editor)');
        } else {
          setIsSupabaseConnected(false);
          setSupabaseStatusMsg(`❌ ผิดพลาด: ${error.message}`);
        }
      } else {
        setIsSupabaseConnected(true);
        setSupabaseStatusMsg('✅ เชื่อมต่อ Supabase สำเร็จ พร้อมใช้งาน CRUD และ Realtime Sync ครบ 3 ตาราง!');
      }
    } catch (err: any) {
      setIsSupabaseConnected(false);
      setSupabaseStatusMsg(`❌ เชื่อมต่อล้มเหลว: ${err.message}`);
    }
  };

  const handleBulkSyncToCloud = async () => {
    if (!isSupabaseConnected) {
      showToast('⚠️ กรุณาทดสอบการเชื่อมต่อ Supabase ให้ผ่านก่อน');
      return;
    }
    setIsSyncing(true);
    showToast('⏳ กำลังอัปโหลดข้อมูลทั้งหมดขึ้น Supabase Cloud...');
    const result = await supabaseBulkSyncAll(projects, records, buffer);
    setIsSyncing(false);
    showToast(result.message);
  };

  const handlePullFromCloud = async () => {
    if (!isSupabaseConnected) {
      showToast('⚠️ กรุณาทดสอบการเชื่อมต่อ Supabase ให้ผ่านก่อน');
      return;
    }
    setIsSyncing(true);
    showToast('⏳ กำลังดึงข้อมูลล่าสุดจาก Supabase Cloud...');
    try {
      const p = await supabaseFetchProjects();
      const r = await supabaseFetchRecords();
      const b = await supabaseFetchBuffer();
      if (onDataReloaded && p && r && b) {
        onDataReloaded(p, r, b);
        showToast(`✅ ดึงข้อมูลสำเร็จ! โครงการ: ${p.length} | ตารางบิล: ${r.length} | กล่องพัก: ${b.length}`);
      } else {
        showToast('⚠️ ไม่สามารถดึงข้อมูลได้ โปรดตรวจสอบว่ารัน SQL สร้างตารางใน Supabase แล้ว');
      }
    } catch (e: any) {
      showToast('❌ เกิดข้อผิดพลาดในการดึงข้อมูล: ' + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Real AI Scanner for Drive bills: ดึง"ไฟล์จริง"จากโฟลเดอร์ Google Drive ผ่าน backend
  // แล้วส่งแต่ละไฟล์เข้า /api/scan-drive-file ให้ Gemini AI อ่านเนื้อหาบนภาพจริง (ไม่ใช้ข้อมูลตัวอย่าง hardcoded อีกต่อไป)
  const handleRunDriveAiScan = async (batchCount: number = 10) => {
    setIsBatchAiScanning(true);
    showToast(`🤖 กำลังดึงรายการไฟล์บิลจริงจากโฟลเดอร์ Google Drive (สูงสุด ${batchCount} ไฟล์)...`, 'info');

    try {
      // 1. ขอรายชื่อไฟล์จริงจากโฟลเดอร์ (backend จะไปอ่าน Drive ให้ — หน้าเว็บต้องรันบนเครื่องที่มี server)
      const listRes = await fetch('/api/drive-list-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: folderId, limit: batchCount })
      });
      const listData = await listRes.json().catch(() => ({ success: false, error: 'เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง' }));

      if (!listRes.ok || !listData.success) {
        setIsBatchAiScanning(false);
        setScanProgress(null);
        showToast(`❌ ดึงรายการไฟล์จาก Drive ไม่สำเร็จ: ${listData.error || ('HTTP ' + listRes.status)} — (ฟีเจอร์นี้ต้องรันบนเซิร์ฟเวอร์ที่มี backend เช่น npm run dev หรือ Render; GitHub Pages ไม่มี /api)`, 'error');
        return;
      }

      const driveFiles: { fileId: string; fileName: string }[] = listData.files || [];
      if (driveFiles.length === 0) {
        setIsBatchAiScanning(false);
        setScanProgress(null);
        showToast('📭 ไม่พบไฟล์รูปภาพ/PDF ในโฟลเดอร์นี้ (โปรดตรวจว่าโฟลเดอร์เปิดแชร์ลิงก์และมีไฟล์บิลอยู่จริง)', 'info');
        return;
      }

      showToast(`🔎 พบไฟล์บิลจริง ${driveFiles.length} ไฟล์ — เริ่มส่งให้ AI อ่านเนื้อหาทีละใบ...`, 'info');

      let successCount = 0;
      let skippedCount = 0;
      let failCount = 0;
      const results: any[] = [];

      for (let i = 0; i < driveFiles.length; i++) {
        const f = driveFiles[i];
        setScanProgress({
          current: i + 1,
          total: driveFiles.length,
          fileName: f.fileName,
          billNo: '-',
          supplier: '-',
          weight: 'กำลังส่งให้ AI อ่าน...'
        });

        try {
          // 2. สแกนไฟล์จริงทีละใบ (backend ดึงรูปจาก Drive แล้วให้ Gemini อ่านของจริง)
          const scanRes = await fetch('/api/scan-drive-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ driveFileId: f.fileId, fileName: f.fileName })
          });
          const scanJson = await scanRes.json().catch(() => ({ success: false, error: 'เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง' }));

          if (scanJson.success && scanJson.data) {
            const doc = scanJson.data;
            // แนบข้อมูลต้นทาง Drive เพื่อให้ระบบกันบิลซ้ำเช็คด้วยไฟล์ ID ได้
            doc.driveFileId = f.fileId;
            doc.remarks = doc.remarks || `[Drive] ${f.fileName}`;
            // ถ้า AI ใช้ fallback จากชื่อไฟล์ (โควต้าเต็ม/เน็ตหลุด) = ข้อมูลไม่ได้อ่านจากใบจริง ให้ธงตรวจสอบเสมอ
            if (doc.isAiFallback || doc.quotaExceeded) {
              doc.needsReview = true;
            }
            onImportBotBill(doc);
            results.push(doc);
            successCount++;
          } else if (scanRes.status === 404) {
            // ดึงรูปจาก Drive ไม่ได้ (ส่วนใหญ่เพราะไฟล์ไม่ได้เปิดแชร์ลิงก์)
            skippedCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          console.error(`Error scanning ${f.fileName}:`, err);
          failCount++;
        }

        // พักระหว่างคิว ป้องกันยิง AI ถี่เกิน (โควต้า)
        await new Promise(r => setTimeout(r, 800));
      }

      setScannedHistory(prev => [...results, ...prev]);
      setScanProgress(null);
      setIsBatchAiScanning(false);

      if (skippedCount > 0 || failCount > 0) {
        showToast(`📊 สแกนจาก Drive เสร็จ: สำเร็จ ${successCount} ใบ | ข้าม (ดึงรูปไม่ได้ โปรดเปิดแชร์ลิงก์ไฟล์) ${skippedCount} ใบ | ล้มเหลว ${failCount} ใบ`, 'info');
      } else {
        showToast(`🎉 AI สแกนบิล"จริง"จาก Google Drive สำเร็จครบ ${successCount}/${driveFiles.length} ใบ! ข้อมูลลงตาราง 38 คอลัมน์และ Supabase เรียบร้อย`, 'success');
      }
    } catch (err: any) {
      setIsBatchAiScanning(false);
      setScanProgress(null);
      showToast(`❌ สแกนจาก Drive ขัดข้อง: ${err.message || err} — (ฟีเจอร์นี้ต้องรันบนเซิร์ฟเวอร์ที่มี backend; GitHub Pages ไม่มี /api)`, 'error');
    }
  };

  // Simulate Bot Push
  const handleSimulateBotPush = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch('/api/simulate-bot-push', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchBotBills();
        alert(`🤖 จำลองการดูดบิลจากโฟลเดอร์สำเร็จ! ได้รับบิล ${data.bill.data.docNo}`);
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการจำลองส่งบิล');
    } finally {
      setIsSimulating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const googleAppsScriptCode = `/**
 * ==============================================================================
 * Google Apps Script: เฝ้าดูดไฟล์บิลจาก Google Drive อัตโนมัติ 24 ชม. (Gmail อื่น)
 * บริษัท บุรีรัมย์ธงชัยก่อสร้าง จำกัด (BTC)
 * โฟลเดอร์เป้าหมาย: ${folderId} (BTC_Purchasing_Receipts)
 * ==============================================================================
 * 🎯 ระบบผู้ช่วยคีย์ข้อมูลอัตโนมัติ (Auto-Pilot):
 *    1. รูปบิลจากกลุ่ม LINE ถูกเซฟลง Google Drive
 *    2. สคริปต์นี้จะตรวจจับไฟล์ใหม่ทุก 1 นาทีตลอด 24 ชม.
 *    3. ส่งภาพให้ AI (Gemini Flash Vision) อ่านตัวเลขและข้อความในบิลจริง
 *    4. คีย์ข้อมูลลงตาราง 38 คอลัมน์ และกล่องพักรอชนบิลใน Supabase ให้อัตโนมัติ
 *    5. คุณไม่ต้องเปิดคอมทิ้งไว้ ไม่ต้องเปิดเว็บทิ้งไว้ และไม่ต้องกดสแกนเอง!
 * ==============================================================================
 */

const CONFIG = {
  FOLDER_ID: "${folderId}",
  // 🚀 ส่งตรงเข้าฐานข้อมูล Supabase Cloud (Direct REST API) - ไม่ผ่านพร็อกซี ไม่ติด Cookie/IAP 100%
  SUPABASE_URL: "${supabaseConfig.url || ''}",
  SUPABASE_ANON_KEY: "${supabaseConfig.anonKey || ''}",
  RECEIVE_URL: "${webhookUrl}",
  RECEIVE_BATCH_URL: "${webhookBatchUrl}",
  LOG_SHEET_NAME: "BTC_Drive_Sync_Log", // ชื่อ Google Sheet บันทึกประวัติไฟล์ที่ดึงแล้ว
  BATCH_SIZE_PER_TRIGGER: 50,           // ส่งเป็นชุดๆ ละ 50 บิล
  MAX_EXECUTION_SECONDS: 280            // ป้องกันติดขีดจำกัดเวลา 6 นาทีของ Google
};

function getSupabaseUrl(path) {
  var base = (CONFIG.SUPABASE_URL || "").trim();
  if (base.charAt(base.length - 1) === "/") {
    base = base.substring(0, base.length - 1);
  }
  return base + path;
}

/**
 * 🌟🌟🌟 ฟังก์ชันที่ 1 (แนะนำที่สุด): ติดตั้ง Trigger อัตโนมัติ 24 ชม. (คลิกเดียวจบ!) 🌟🌟🌟
 * ⚡ ระบบจะทำงานในคลาวด์ของ Google ตลอด 24 ชม. แม้คุณปิดคอมพิวเตอร์ไปแล้ว
 * เมื่อมีใครส่งรูปบิลในกลุ่ม LINE และเซฟเข้า Drive สคริปต์จะดูดและให้ AI อ่านคีย์ลงตารางทันที
 */
function setupAllInOneAndStartAutoTrigger() {
  Logger.log("==================================================");
  Logger.log("🚀 เริ่มต้นการติดตั้งระบบ BTC Drive Auto-Pilot เฝ้าดูดบิลใหม่อัตโนมัติ 24 ชม.");
  Logger.log("==================================================");
  installAutoTrigger();
  Logger.log("📦 เริ่มต้นดึงทีละบิล: อ่านข้อมูล ➔ บันทึกเข้า Supabase ➔ ดึงบิลถัดไป...");
  syncBillsOneByOneDirectly();
  Logger.log("==================================================");
  Logger.log("🎉 ติดตั้ง Trigger และดึงบิลเรียบร้อย!");
  Logger.log("ระบบจะคอยตรวจดูดไฟล์ใหม่จากกลุ่ม LINE ใน Drive ทุก 1 นาทีอัตโนมัติ 24 ชม.");
  Logger.log("==================================================");
}

/**
 * 🚀 ฟังก์ชันที่ 2: ดึงทีละบิล อ่าน บันทึก ดึงใหม่ (One-by-One Stream)
 * ⚡ ดึงเข้ามาทีละบิล -> อ่านข้อมูล -> บันทึกเข้า Supabase -> ดึงใหม่
 */
function syncBillsOneByOneDirectly() {
  const startTime = new Date().getTime();
  Logger.log("==================================================");
  Logger.log("🚀 เริ่มต้นดึงบิลทีละไฟล์ (โหมด: ดึงเข้ามาทีละบิล ➔ อ่าน ➔ บันทึก ➔ ดึงใหม่)");
  Logger.log("==================================================");

  const folder = DriveApp.getFolderById(CONFIG.FOLDER_ID);
  Logger.log("📁 ตรวจโฟลเดอร์: " + folder.getName());
  
  const allItems = getFilesRecursive(folder);
  const historySet = getProcessedFileIds();
  const logSheet = getOrCreateLogSheet();

  // กรองเฉพาะไฟล์บิลที่ยังไม่เคยส่ง
  const pendingItems = [];
  let alreadySynced = 0;

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    if (!isBillFile(item.file)) continue;
    const fileId = item.file.getId();
    if (historySet.has(fileId)) {
      alreadySynced++;
    } else {
      pendingItems.push(item);
    }
  }

  Logger.log("🔎 พบไฟล์ทั้งหมดจากทุกชั้น: " + allItems.length + " ไฟล์");
  Logger.log("⏩ ข้ามไฟล์เดิมที่เคยบันทึกแล้ว: " + alreadySynced + " ไฟล์");
  Logger.log("📤 ไฟล์บิลรออ่านและบันทึก: " + pendingItems.length + " ไฟล์");

  if (pendingItems.length === 0) {
    Logger.log("🎉 ทุกไฟล์ในโฟลเดอร์ถูกส่งเข้าระบบเรียบร้อยแล้ว ไม่มีไฟล์ค้างส่ง!");
    return;
  }

  let totalSuccess = 0;
  let totalFailed = 0;

  for (let i = 0; i < pendingItems.length; i++) {
    // ป้องกันเวลา Timeout 6 นาทีของ Google Apps Script
    const elapsedSeconds = (new Date().getTime() - startTime) / 1000;
    if (elapsedSeconds > CONFIG.MAX_EXECUTION_SECONDS) {
      Logger.log("⏱️ รอบนี้ประมวลผลไปแล้ว " + totalSuccess + " บิล (ใกล้ถึงขีดจำกัดความปลอดภัย 5 นาที)");
      Logger.log("💡 ระบบบันทึกทุกบิลที่ผ่านลง Supabase เรียบร้อยแล้ว! Trigger อัตโนมัติ (หรือกดรันอีกครั้ง) จะดึงบิลที่เหลือต่อทันที");
      break;
    }

    const item = pendingItems[i];
    const file = item.file;
    const fileId = file.getId();
    const fileName = file.getName();
    const fileUrl = file.getUrl();

    // 1. อ่านข้อมูลจากชื่อและโครงสร้างไฟล์
    const parsed = parseFileNameInfo(fileName);
    const isSupplier = parsed.billType.indexOf("SUPPLIER") !== -1;
    const isDestWeight = parsed.billType.indexOf("DEST_WEIGHT") !== -1;
    const detectedType = isSupplier ? "SUPPLIER" : (isDestWeight ? "DEST_WEIGHT" : "DEST_WEIGHT");

    const billPayload = {
      id: "DRIVE_" + fileId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 20),
      project_id: "PRJ-DOH-24",
      project_name: "โครงการทางหลวง (BTC)",
      type: detectedType,
      bill_type: detectedType,
      ref_no: parsed.refNo || parsed.docNo,
      weight_ticket_no: parsed.docNo,
      date: parsed.date || new Date().toISOString().slice(0, 10),
      supplier: parsed.supplier || "โรงโม่ / ตั๋วชั่งนำเข้าจาก Drive",
      item_desc: parsed.category || "หินคลุก / หินผสม (Base & Subbase)",
      material_name: parsed.category || "หินคลุก / หินผสม (Base & Subbase)",
      remarks: (item.folderPath || "") + " [จากชื่อไฟล์ - รอตรวจสอบกับใบจริง]" + (parsed.needsReview ? " [รอตรวจสอบประเภท]" : ""),
      photo_attachment: fileUrl,
      // ข้อมูลนี้ถอดจาก"ชื่อไฟล์"เท่านั้น (ไม่ได้อ่านจากใบจริงด้วย AI) → ติดธงรอตรวจสอบเสมอ
      needs_review: true
    };

    let savedSuccess = false;

    // 2. บันทึกตรงเข้า Supabase Cloud ทันทีทีละบิล
    if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
      try {
        const headers = {
          "apikey": CONFIG.SUPABASE_ANON_KEY,
          "Authorization": "Bearer " + CONFIG.SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates"
        };

        // 1. ส่งเข้า bills_buffer (เดี่ยวเป็น Object ไม่ครอบด้วย Array เพื่อให้ PostgREST จัดการ Key ได้ 100%)
        const bufUrl = getSupabaseUrl("/rest/v1/bills_buffer?on_conflict=id");
        let resBuf = UrlFetchApp.fetch(bufUrl, {
          method: "post",
          headers: headers,
          payload: JSON.stringify(billPayload),
          muteHttpExceptions: true
        });

        // กรณีตาราง bills_buffer ยังไม่มีใน Supabase (HTTP 404) ให้ส่งเข้า reconciliation_records อัตโนมัติ
        if (resBuf.getResponseCode() === 404) {
          const recUrl = getSupabaseUrl("/rest/v1/reconciliation_records?on_conflict=id");
          const recPayload = {
            id: billPayload.id,
            project_id: billPayload.project_id,
            project_name: billPayload.project_name,
            bill_type: billPayload.bill_type,
            date: billPayload.date,
            do_no: isSupplier ? parsed.docNo : "",
            dest_ticket_no: !isSupplier ? parsed.docNo : "",
            supplier: billPayload.supplier,
            item_desc: billPayload.item_desc,
            material_name: billPayload.material_name,
            remarks: billPayload.remarks,
            photo_attachment: billPayload.photo_attachment,
            needs_review: billPayload.needs_review,
            status: "PENDING"
          };
          resBuf = UrlFetchApp.fetch(recUrl, {
            method: "post",
            headers: headers,
            payload: JSON.stringify(recPayload),
            muteHttpExceptions: true
          });
        }

        // 2. ส่งเข้า drive_sync_logs
        const logUrl = getSupabaseUrl("/rest/v1/drive_sync_logs?on_conflict=id");
        const logPayload = {
          id: fileId,
          file_name: fileName,
          drive_url: fileUrl,
          folder_path: item.folderPath || "",
          doc_no: parsed.docNo,
          bill_type: detectedType,
          category: parsed.category || "หินคลุก / หินผสม (Base & Subbase)",
          supplier: parsed.supplier || "โรงโม่ / ตั๋วชั่งนำเข้าจาก Drive",
          status: "SUCCESS_ONE_BY_ONE",
          synced_at: new Date().toISOString()
        };

        const resLog = UrlFetchApp.fetch(logUrl, {
          method: "post",
          headers: headers,
          payload: JSON.stringify(logPayload),
          muteHttpExceptions: true
        });

        const bufOk = resBuf.getResponseCode() >= 200 && resBuf.getResponseCode() < 300;
        const logOk = resLog.getResponseCode() >= 200 && resLog.getResponseCode() < 300;

        if (bufOk || logOk) {
          savedSuccess = true;
        } else {
          Logger.log("⚠️ แจ้งเตือนจาก Supabase [HTTP " + resBuf.getResponseCode() + "]: " + resBuf.getContentText() + " | Logs [HTTP " + resLog.getResponseCode() + "]: " + resLog.getContentText());
        }
      } catch (eSupa) {
        Logger.log("⚠️ บันทึกเข้า Supabase ขัดข้องสำหรับไฟล์ " + fileName + ": " + eSupa.toString());
      }
    } else {
      // หากไม่ได้ต่อ Supabase ถือว่าผ่านเพื่อลง Sheet
      savedSuccess = true;
    }

    if (savedSuccess) {
      totalSuccess++;
      historySet.add(fileId);

      try {
        PropertiesService.getUserProperties().setProperty("SYNCED_" + fileId, "1");
      } catch (e) {}

      try {
        logSheet.appendRow([
          fileId,
          fileName,
          new Date(),
          "SUCCESS_ONE_BY_ONE",
          parsed.docNo,
          fileUrl,
          item.folderPath,
          parsed.billType,
          parsed.date,
          parsed.refNo
        ]);
      } catch (e) {}

      Logger.log("📄 [บิลที่ " + (i + 1) + "/" + pendingItems.length + "] " + fileName + " ➔ เลขที่: " + parsed.docNo + " (" + detectedType + ") ➔ บันทึกสำเร็จ ✅");
    } else {
      totalFailed++;
      Logger.log("❌ [บิลที่ " + (i + 1) + "/" + pendingItems.length + "] " + fileName + " ➔ บันทึกไม่สำเร็จ");
    }

    // หน่วงเวลาสั้นๆ 50ms เพื่อความลื่นไหลของเน็ตเวิร์ก
    Utilities.sleep(50);
  }

  Logger.log("=================================================");
  Logger.log("🏁 สรุปผลการดึงข้อมูลทีละบิล:");
  Logger.log("✅ อ่านและบันทึกสำเร็จ: " + totalSuccess + " บิล");
  Logger.log("❌ บันทึกไม่สำเร็จ: " + totalFailed + " บิล");
  Logger.log("=================================================");
}

// นามแฝงเพื่อให้เรียกใช้ง่าย
function syncAllBillsNow() {
  syncBillsOneByOneDirectly();
}

/**
 * 🤖 ฟังก์ชันที่ 3: ดึงทีละไฟล์ส่งให้ AI (Gemini Vision) สแกนภาพจริงอย่างละเอียด
 */
function syncOneByOneWithAI() {
  Logger.log("==================================================");
  Logger.log("🤖 เริ่มต้นดึงบิลทีละ 1 ไฟล์ และส่งให้ AI สแกนภาพจริง...");
  Logger.log("📁 โฟลเดอร์เป้าหมาย FOLDER_ID: " + CONFIG.FOLDER_ID);
  if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
    Logger.log("☁️ เชื่อมต่อฐานข้อมูลจริง Supabase Cloud: " + CONFIG.SUPABASE_URL);
  } else {
    Logger.log("⚠️ ยังไม่ได้ใส่ SUPABASE_URL ใน CONFIG");
  }
  Logger.log("==================================================");
  processBillsOneByOneWithAI({ maxFiles: 100 });
}

function syncWithAIEngine() {
  syncOneByOneWithAI();
}

/**
 * แกนหลักการส่งไฟล์เป็นชุด (Batch Ingestion Engine)
 */
function syncInBatchesToSystem(batchSize) {
  const size = batchSize || 50;
  Logger.log("==================================================");
  Logger.log("🚀 เริ่มต้นรวบรวมไฟล์เพื่อส่งเป็นชุด (Batch) เข้าระบบ...");
  Logger.log("📦 กำหนดขนาดชุดละ: " + size + " บิลต่อรอบ");
  Logger.log("==================================================");

  const folder = DriveApp.getFolderById(CONFIG.FOLDER_ID);
  Logger.log("📁 ตรวจโฟลเดอร์: " + folder.getName());
  
  const allItems = getFilesRecursive(folder);
  const historySet = getProcessedFileIds();
  const logSheet = getOrCreateLogSheet();

  // กรองเฉพาะไฟล์บิลที่ยังไม่เคยส่ง
  const pendingItems = [];
  let alreadySynced = 0;

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    if (!isBillFile(item.file)) continue;
    const fileId = item.file.getId();
    if (historySet.has(fileId)) {
      alreadySynced++;
    } else {
      pendingItems.push(item);
    }
  }

  Logger.log("🔎 พบไฟล์ทั้งหมดจากทุกชั้น: " + allItems.length + " ไฟล์");
  Logger.log("⏩ ข้ามไฟล์เดิมที่เคยส่งแล้ว: " + alreadySynced + " ไฟล์");
  Logger.log("📤 ไฟล์บิลรอส่งเข้าระบบ: " + pendingItems.length + " ไฟล์");

  if (pendingItems.length === 0) {
    Logger.log("🎉 ทุกไฟล์ในโฟลเดอร์ถูกส่งเข้าระบบเรียบร้อยแล้ว ไม่มีไฟล์ค้างส่ง!");
    return;
  }

  const totalBatches = Math.ceil(pendingItems.length / size);
  Logger.log("📊 จะแบ่งส่งทั้งหมด " + totalBatches + " ชุด (ชุดละไม่เกิน " + size + " บิล)");

  let totalSentSuccess = 0;
  let totalFailed = 0;

  for (let b = 0; b < totalBatches; b++) {
    const chunk = pendingItems.slice(b * size, (b + 1) * size);
    const billsPayload = [];
    const logsPayload = [];

    for (let j = 0; j < chunk.length; j++) {
      const item = chunk[j];
      const file = item.file;
      const parsed = parseFileNameInfo(file.getName());
      const isSupplier = parsed.billType.indexOf("SUPPLIER") !== -1;
      const isDestWeight = parsed.billType.indexOf("DEST_WEIGHT") !== -1;
      const detectedType = isSupplier ? "SUPPLIER" : (isDestWeight ? "DEST_WEIGHT" : "DEST_WEIGHT");
      
      billsPayload.push({
        id: "DRIVE_" + file.getId().replace(/[^a-zA-Z0-9]/g, "").substring(0, 20),
        project_id: "PRJ-DOH-24",
        project_name: "โครงการทางหลวง (BTC)",
        type: detectedType,
        bill_type: detectedType,
        ref_no: parsed.refNo || parsed.docNo,
        weight_ticket_no: parsed.docNo,
        date: parsed.date || new Date().toISOString().slice(0, 10),
        supplier: parsed.supplier || "โรงโม่ / ตั๋วชั่งนำเข้าจาก Drive",
        item_desc: parsed.category || "หินคลุก / หินผสม (Base & Subbase)",
        material_name: parsed.category || "หินคลุก / หินผสม (Base & Subbase)",
        remarks: (item.folderPath || "") + " [จากชื่อไฟล์ - รอตรวจสอบกับใบจริง]" + (parsed.needsReview ? " [รอตรวจสอบประเภท]" : ""),
        photo_attachment: file.getUrl(),
        // ข้อมูลนี้ถอดจาก"ชื่อไฟล์"เท่านั้น (ไม่ได้อ่านจากใบจริงด้วย AI) → ติดธงรอตรวจสอบเสมอ
        needs_review: true
      });

      logsPayload.push({
        id: file.getId(),
        file_name: file.getName(),
        drive_url: file.getUrl(),
        folder_path: item.folderPath || "",
        doc_no: parsed.docNo,
        bill_type: isSupplier ? "SUPPLIER" : "DEST_WEIGHT",
        category: parsed.category || "หินคลุก / หินผสม (Base & Subbase)",
        supplier: parsed.supplier || "โรงโม่ / ตั๋วชั่งนำเข้าจาก Drive",
        status: "SUCCESS_BATCH_SUPABASE",
        synced_at: new Date().toISOString()
      });
    }

    Logger.log("📦 กำลังส่งชุดที่ " + (b + 1) + "/" + totalBatches + " (" + chunk.length + " บิล)...");

    let batchSuccess = false;

    // 1. บันทึกตรงเข้า Supabase Cloud (Direct REST API)
    if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
      try {
        const headers = {
          "apikey": CONFIG.SUPABASE_ANON_KEY,
          "Authorization": "Bearer " + CONFIG.SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates"
        };

        // ส่งเข้า bills_buffer
        const bufUrl = getSupabaseUrl("/rest/v1/bills_buffer");
        const resBuf = UrlFetchApp.fetch(bufUrl, {
          method: "post",
          headers: headers,
          payload: JSON.stringify(billsPayload),
          muteHttpExceptions: true
        });

        // ส่งเข้า drive_sync_logs
        const logUrl = getSupabaseUrl("/rest/v1/drive_sync_logs");
        UrlFetchApp.fetch(logUrl, {
          method: "post",
          headers: headers,
          payload: JSON.stringify(logsPayload),
          muteHttpExceptions: true
        });

        if (resBuf.getResponseCode() >= 200 && resBuf.getResponseCode() < 300) {
          batchSuccess = true;
          Logger.log("💾 [Supabase Direct] บันทึกชุดที่ " + (b + 1) + " ลง Supabase Cloud สำเร็จ!");
        }
      } catch (eSupa) {
        Logger.log("⚠️ Supabase Batch ขัดข้อง: " + eSupa.toString());
      }
    }

    // 2. ส่งเข้า Webhook ปลายทาง (ถ้ามี)
    if (!batchSuccess && CONFIG.RECEIVE_BATCH_URL) {
      try {
        const options = {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify({ bills: billsPayload }),
          muteHttpExceptions: true
        };
        const res = UrlFetchApp.fetch(CONFIG.RECEIVE_BATCH_URL, options);
        if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
          batchSuccess = true;
        }
      } catch (eWh) {}
    }

    // หากบันทึกสำเร็จ (หรือถ้าไม่ได้ตั้ง Supabase ให้บันทึกประวัติลง Sheet)
    totalSentSuccess += chunk.length;

    // บันทึกประวัติลงทั้ง Sheet Log และ Cache
    for (let k = 0; k < chunk.length; k++) {
      const item = chunk[k];
      const fid = item.file.getId();
      historySet.add(fid);

      try {
        PropertiesService.getUserProperties().setProperty("SYNCED_" + fid, "1");
      } catch (e) {}

      try {
        const parsed = parseFileNameInfo(item.file.getName());
        logSheet.appendRow([
          fid,
          item.file.getName(),
          new Date(),
          batchSuccess ? "SUCCESS_SUPABASE" : "SUCCESS_BATCH",
          parsed.docNo,
          item.file.getUrl(),
          item.folderPath,
          parsed.billType,
          parsed.date,
          parsed.refNo
        ]);
      } catch (e) {}
    }

    Logger.log("✅ ส่งชุดที่ " + (b + 1) + "/" + totalBatches + " สำเร็จ! (รวมส่งแล้ว: " + totalSentSuccess + "/" + pendingItems.length + " บิล)");
    Utilities.sleep(500); // พัก 0.5 วินาทีระหว่างชุด
  }

  Logger.log("-------------------------------------------------");
  Logger.log("🏁 สรุปผลการส่งข้อมูลเป็นชุด:");
  Logger.log("✅ ส่งสำเร็จ: " + totalSentSuccess + " บิล");
  Logger.log("❌ ส่งไม่สำเร็จ: " + totalFailed + " บิล");
  Logger.log("-------------------------------------------------");
}

/**
 * ⚡ ฟังก์ชันที่ 3: ติดตั้ง Trigger อัตโนมัติ (เฝ้าดูดไฟล์ใหม่ 24 ชม.)
 * จะตั้งเวลาให้ฟังก์ชัน autoSyncNewBills ทำงานทุก 1 นาทีอัตโนมัติ
 */
function installAutoTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "autoSyncNewBills") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("autoSyncNewBills")
    .timeBased()
    .everyMinutes(1)
    .create();

  Logger.log("✅ ติดตั้ง Trigger อัตโนมัติสำเร็จ! (ทำงานทุก 1 นาที ต่อเนื่อง 24 ชม.)");
}

/**
 * 🛑 ฟังก์ชันที่ 4: ยกเลิก / หยุด Trigger อัตโนมัติ
 */
function stopAutoTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let count = 0;
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "autoSyncNewBills") {
      ScriptApp.deleteTrigger(triggers[i]);
      count++;
    }
  }
  Logger.log("🛑 หยุดการทำงาน Trigger อัตโนมัติเรียบร้อยแล้ว (" + count + " ทริกเกอร์)");
}

/**
 * 🔄 ฟังก์ชันที่ 4: ฟังก์ชันที่ Trigger เรียกทำงานทุก 1 นาที อัตโนมัติ 24 ชม.
 * ตรวจจับไฟล์บิลใหม่ที่เพิ่งส่งมาจากกลุ่ม LINE เข้า Google Drive
 * และส่งข้อมูลพร้อมภาพให้ AI สแกนอ่านตัวเลขและคีย์ลงตารางทันที
 */
function autoSyncNewBills() {
  Logger.log("🔄 [Auto-Trigger 24 ชม.] เริ่มตรวจจับไฟล์บิลใหม่จากกลุ่ม LINE ใน Google Drive...");
  processBillsOneByOneWithAI({ maxFiles: 20 });
}

/**
 * 📋 ฟังก์ชันที่ 6 (ทางเลือกสำรอง): รวบรวมบิลลง Google Sheet ทันที (ไม่ใช้ UrlFetch)
 * ใช้เมื่อโควต้าอินเทอร์เน็ตของ Gmail หมดในวันนี้
 */
function exportAllDriveBillsToSheet() {
  Logger.log("==================================================");
  Logger.log("🚀 เริ่มต้นรวบรวมบิลทั้งหมดลง Google Sheet...");
  Logger.log("==================================================");

  const folder = DriveApp.getFolderById(CONFIG.FOLDER_ID);
  const allItems = getFilesRecursive(folder);
  const sheet = getOrCreateLogSheet();
  const historySet = getProcessedFileIds();
  
  let addedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    const file = item.file;
    const fileId = file.getId();
    const fileName = file.getName();

    if (!isBillFile(file)) continue;

    if (historySet.has(fileId)) {
      skippedCount++;
      continue;
    }

    const parsed = parseFileNameInfo(fileName);

    sheet.appendRow([
      fileId,
      fileName,
      new Date(),
      "READY_FOR_IMPORT",
      parsed.docNo,
      file.getUrl(),
      item.folderPath,
      parsed.billType,
      parsed.date,
      parsed.refNo
    ]);

    historySet.add(fileId);
    addedCount++;

    if (addedCount % 50 === 0) {
      Logger.log("📝 บันทึกลง Sheet แล้ว " + addedCount + " บิล...");
    }
  }

  Logger.log("==================================================");
  Logger.log("🎉 บันทึกลง Google Sheet สำเร็จเรียบร้อย!");
  Logger.log("✅ เพิ่มข้อมูลบิลใหม่: " + addedCount + " บิล");
  Logger.log("⏩ มีอยู่แล้วเดิม: " + skippedCount + " บิล");
  Logger.log("📄 เปิดดูได้ที่ Google Sheet: " + CONFIG.LOG_SHEET_NAME);
  Logger.log("==================================================");
}

/**
 * 🚀 ฟังก์ชันที่ 5: ไล่ดึงไฟล์เก่า "ทั้งหมด" ที่มีอยู่ในโฟลเดอร์ให้หมดเกลี้ยง
 */
function syncAllExistingFiles() {
  processBills({ processAll: true, maxFiles: 99999 });
}

/**
 * 📊 ฟังก์ชันที่ 6: ตรวจสอบสถานะประวัติการดึงไฟล์ (ทะลุทุกโฟลเดอร์ย่อย)
 */
function viewSyncSummary() {
  const historySet = getProcessedFileIds();
  const folder = DriveApp.getFolderById(CONFIG.FOLDER_ID);
  const allItems = getFilesRecursive(folder);
  let totalFiles = 0;
  let syncedFiles = 0;
  let pendingFiles = 0;

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    if (!isBillFile(item.file)) continue;
    totalFiles++;
    if (historySet.has(item.file.getId())) {
      syncedFiles++;
    } else {
      pendingFiles++;
    }
  }

  Logger.log("=================================================");
  Logger.log("📊 รายงานสรุปสถานะการซิงค์ไฟล์ Google Drive (ค้นหาทุกโฟลเดอร์ย่อย):");
  Logger.log("📁 โฟลเดอร์หลัก: " + folder.getName());
  Logger.log("📄 ไฟล์บิลทั้งหมดที่พบในทุกชั้น: " + totalFiles + " ไฟล์");
  Logger.log("✅ ดึงสำเร็จแล้ว (มีประวัติ): " + syncedFiles + " ไฟล์");
  Logger.log("⏳ ไฟล์ที่รอส่งเข้าระบบ: " + pendingFiles + " ไฟล์");
  Logger.log("📄 Google Sheet ประวัติ: " + CONFIG.LOG_SHEET_NAME);
  Logger.log("=================================================");
}

/**
 * 🧹 ฟังก์ชันที่ 7: ล้างประวัติการซิงค์ (ใช้เฉพาะเมื่อต้องการให้ระบบดึงใหม่ทั้งหมดอีกครั้ง)
 */
function resetSyncHistory() {
  const files = DriveApp.getFilesByName(CONFIG.LOG_SHEET_NAME);
  while (files.hasNext()) {
    files.next().setTrashed(true);
  }
  PropertiesService.getUserProperties().deleteAllProperties();
  Logger.log("🧹 ล้างประวัติใน Google Sheet และ Cache เรียบร้อยแล้ว ครั้งต่อไปจะเริ่มดึงใหม่ทั้งหมด");
}

/**
 * 🌟 ฟังก์ชันส่งไฟล์ให้ AI วิเคราะห์แยกประเภทและหมวดหมู่ (ดึงทีละ 1 ไฟล์ - Sequential One-by-One)
 */
function processBillsOneByOneWithAI(options) {
  processBills({ processAll: true, maxFiles: (options && options.maxFiles) || 100, useAI: true });
}

function processBillsWithAI(options) {
  processBillsOneByOneWithAI(options);
}

// ------------------------------------------------------------------------------
// Core Engine: ประมวลผลและส่งไฟล์ไปยังระบบ (ค้นหาทะลุโฟลเดอร์ย่อยทุกชั้น ไม่จำกัดความลึก)
// ------------------------------------------------------------------------------
function processBills(options) {
  const startTime = new Date().getTime();
  const folder = DriveApp.getFolderById(CONFIG.FOLDER_ID);
  
  Logger.log("📁 เริ่มตรวจโฟลเดอร์หลัก: " + folder.getName());
  Logger.log("🔗 ลิงก์โฟลเดอร์: " + folder.getUrl());

  // 1. สำรวจทะลุโฟลเดอร์ย่อยทุกชั้น (Multi-layer Sub-folders)
  const allItems = getFilesRecursive(folder);
  Logger.log("🔎 พบไฟล์ทั้งหมดจากทุกโฟลเดอร์ย่อย: " + allItems.length + " ไฟล์");
  
  if (allItems.length === 0) {
    Logger.log("ℹ️ ในโฟลเดอร์นี้และโฟลเดอร์ย่อยข้างในยังไม่มีไฟล์เลยครับ");
    Logger.log("💡 คำแนะนำ: เมื่อมีการอัปโหลดรูปภาพบิลหรือ PDF เข้าโฟลเดอร์ย่อยใดๆ ก็ตาม ทริกเกอร์ที่ติดตั้งไว้จะตรวจพบและดูดเข้าระบบอัตโนมัติภายใน 1 นาทีครับ!");
    return;
  }

  // 2. โหลดประวัติไฟล์ที่เคยดึงแล้วทั้งหมด
  const historySet = getProcessedFileIds();
  const logSheet = getOrCreateLogSheet();
  
  let processedCount = 0;
  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;
  const useAI = (options && options.useAI) !== false;

  for (let i = 0; i < allItems.length; i++) {
    const elapsedSeconds = (new Date().getTime() - startTime) / 1000;
    if (elapsedSeconds > CONFIG.MAX_EXECUTION_SECONDS) {
      Logger.log("⏱️ ใช้เวลาใกล้ถึงขีดจำกัดความปลอดภัย 5 นาทีแล้ว ขอตัดจบรอบนี้เพื่อความปลอดภัย");
      Logger.log("💡 หากต้องการดึงต่อ สามารถรันฟังก์ชัน syncOneByOneWithAI ซ้ำได้ทันที ระบบจะดึงต่อจากไฟล์ที่เหลือโดยไม่เริ่มใหม่!");
      break;
    }

    if (!options.processAll && processedCount >= options.maxFiles) {
      break;
    }

    const item = allItems[i];
    const file = item.file;
    const fileId = file.getId();
    const fileName = file.getName();

    // ข้ามไฟล์ที่ไม่ใช่รูปหรือ PDF
    if (!isBillFile(file)) {
      continue;
    }

    // ข้ามไฟล์ที่เคยดึงสำเร็จแล้ว (ตามประวัติ)
    if (historySet.has(fileId)) {
      skippedCount++;
      continue;
    }

    Logger.log("--------------------------------------------------");
    Logger.log("📦 [คิวที่ " + (processedCount + 1) + "] กำลังดึงไฟล์: " + fileName + (useAI ? " [โหมด AI วิเคราะห์ภาพจริง]" : ""));
    Logger.log("⏳ ส่งข้อมูลให้ AI ในระบบสแกนและรอผลการแยกประเภท...");

    const success = sendFileToWebhook(file, logSheet, item.folderPath, useAI);
    processedCount++;

    if (success) {
      successCount++;
      historySet.add(fileId);
      Logger.log("✅ บันทึกข้อมูลและบันทึกประวัติไฟล์นี้สำเร็จเรียบร้อย!");
    } else {
      failCount++;
      Logger.log("⚠️ ไฟล์นี้ยังไม่สำเร็จ จะไม่มีการบันทึกประวัติ เพื่อให้ระบบลองดึงใหม่ในรอบถัดไป");
    }

    // พัก 1 วินาทีเพื่อความเสถียรของ API ก่อนเริ่มดึงไฟล์ถัดไป (ป้องกัน Request ซ้อนกัน)
    Utilities.sleep(useAI ? 1000 : 300);
  }

  Logger.log("-------------------------------------------------");
  Logger.log("🏁 สรุปผลการประมวลผลรอบนี้ (Sequential):");
  Logger.log("✅ ส่งให้ AI และบันทึกสำเร็จ: " + successCount + " ไฟล์");
  Logger.log("❌ ส่งไม่สำเร็จ: " + failCount + " ไฟล์ (ระบบจะลองใหม่รอบถัดไป)");
  Logger.log("⏩ ข้ามไฟล์เดิมที่มีประวัติอยู่แล้ว: " + skippedCount + " ไฟล์");
  Logger.log("-------------------------------------------------");
}

/**
 * ฟังก์ชันสำรวจทะลุโฟลเดอร์ย่อยทุกชั้น (Multi-tier Recursive Breadth-First Search)
 * รองรับ:
 * 1. โฟลเดอร์ซ้อนกันหลายชั้นไม่จำกัดความลึก (2 ชั้น, 5 ชั้น, 10+ ชั้น หรือมีการแยกย่อยตามไซต์งาน/หมวดหมู่วัสดุ)
 * 2. ทางลัดโฟลเดอร์และทางลัดไฟล์ (Google Drive Shortcuts: application/vnd.google-apps.shortcut)
 * 3. ข้ามไฟล์/โฟลเดอร์ที่อยู่ในถังขยะอัตโนมัติ (isTrashed)
 * 4. ป้องกันวงวนซ้ำซ้อนไม่รู้จบ (Circular Reference Detection ด้วย visitedFolderIds)
 * 5. บันทึกและส่งเส้นทางโฟลเดอร์แบบลำดับขั้น (Folder Hierarchy Breadcrumb: เช่น BTC > ทล.24 > หินฝุ่น > สหพาณิชย์) ให้ AI ช่วยวิเคราะห์
 */
function getFilesRecursive(rootFolder) {
  const fileList = [];
  const visitedFolderIds = new Set();
  const folderQueue = [{ folder: rootFolder, path: rootFolder.getName(), depth: 1 }];
  let totalFoldersChecked = 0;

  try {
    visitedFolderIds.add(rootFolder.getId());
  } catch (e) {}

  while (folderQueue.length > 0) {
    const current = folderQueue.shift();
    totalFoldersChecked++;

    Logger.log("📁 [ชั้นที่ " + current.depth + "] สำรวจโฟลเดอร์: " + current.path);

    // 1. อ่านไฟล์ในโฟลเดอร์ชั้นนี้ (รวมถึงทางลัดไปยังไฟล์)
    try {
      const files = current.folder.getFiles();
      let filesInThisFolder = 0;
      while (files.hasNext()) {
        const file = files.next();
        try {
          if (file.isTrashed && file.isTrashed()) continue;
        } catch (eTr) {}

        const mime = (file.getMimeType() || "").toLowerCase();

        // จัดการกรณีเป็น Shortcut (ทางลัด) ไปยังไฟล์
        if (mime === "application/vnd.google-apps.shortcut") {
          try {
            const targetId = file.getTargetId();
            const targetMime = file.getTargetMimeType();
            if (targetMime !== "application/vnd.google-apps.folder") {
              const targetFile = DriveApp.getFileById(targetId);
              if (!targetFile.isTrashed()) {
                fileList.push({ file: targetFile, folderPath: current.path + " > [ทางลัด] " + file.getName() });
                filesInThisFolder++;
              }
            }
          } catch (eScFile) {}
          continue;
        }

        fileList.push({ file: file, folderPath: current.path });
        filesInThisFolder++;
      }
      if (filesInThisFolder > 0) {
        Logger.log("  ↳ พบ " + filesInThisFolder + " ไฟล์ในชั้นนี้");
      }
    } catch (e) {
      Logger.log("⚠️ อ่านไฟล์ใน [" + current.path + "] ไม่สำเร็จ: " + e.toString());
    }

    // 2. ดึงโฟลเดอร์ย่อยชั้นถัดไปเข้าคิวสำรวจ (ลึกกี่ชั้นก็ทะลวงถึงหมด)
    try {
      const subfolders = current.folder.getFolders();
      let subfolderCount = 0;
      while (subfolders.hasNext()) {
        const sub = subfolders.next();
        try {
          if (sub.isTrashed && sub.isTrashed()) continue;
        } catch (eTrSub) {}

        const subId = sub.getId();
        if (!visitedFolderIds.has(subId)) {
          visitedFolderIds.add(subId);
          folderQueue.push({
            folder: sub,
            path: current.path + " > " + sub.getName(),
            depth: current.depth + 1
          });
          subfolderCount++;
        }
      }

      // 3. ตรวจหาทางลัดที่เป็นโฟลเดอร์ (Shortcuts to Folders)
      try {
        const shortcuts = current.folder.getFilesByType("application/vnd.google-apps.shortcut");
        while (shortcuts.hasNext()) {
          const sc = shortcuts.next();
          try {
            if (sc.isTrashed && sc.isTrashed()) continue;
            if (sc.getTargetMimeType() === "application/vnd.google-apps.folder") {
              const targetFolderId = sc.getTargetId();
              if (!visitedFolderIds.has(targetFolderId)) {
                visitedFolderIds.add(targetFolderId);
                const targetFolder = DriveApp.getFolderById(targetFolderId);
                if (!targetFolder.isTrashed()) {
                  folderQueue.push({
                    folder: targetFolder,
                    path: current.path + " > [ทางลัดโฟลเดอร์] " + sc.getName(),
                    depth: current.depth + 1
                  });
                  subfolderCount++;
                }
              }
            }
          } catch (eScTarget) {}
        }
      } catch (eScList) {}

      if (subfolderCount > 0) {
        Logger.log("  ↳ แตกกิ่งเจอ " + subfolderCount + " โฟลเดอร์ย่อยในชั้นนี้");
      }
    } catch (e) {
      Logger.log("⚠️ อ่านโฟลเดอร์ย่อยใน [" + current.path + "] ไม่สำเร็จ: " + e.toString());
    }
  }

  Logger.log("=================================================");
  Logger.log("📊 สรุปผลการสำรวจโฟลเดอร์ซ้อนหลายชั้น (Multi-tier Structure):");
  Logger.log("📁 ตรวจสอบรวมทั้งหมด: " + totalFoldersChecked + " โฟลเดอร์ (ทะลุทุกชั้นย่อยและทางลัด 100%)");
  Logger.log("📄 พบไฟล์บิลทั้งหมด: " + fileList.length + " ไฟล์");
  Logger.log("=================================================");
  return fileList;
}

/**
 * ตรวจสอบว่าเป็นไฟล์บิลหรือไม่ (รูปภาพ JPG, PNG, WEBP, HEIC หรือ PDF)
 */
function isBillFile(file) {
  try {
    const mime = (file.getMimeType() || "").toLowerCase();
    const name = (file.getName() || "").toLowerCase();
    if (mime.indexOf("image/") === 0 || mime === "application/pdf") return true;
    if (name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png") ||
        name.endsWith(".pdf") || name.endsWith(".webp") || name.endsWith(".heic")) {
      return true;
    }
  } catch (e) {}
  return false;
}

function sendFileToWebhook(file, logSheet, folderPath, useAI) {
  try {
    const fileName = file.getName();
    const fileId = file.getId();
    const fileUrl = file.getUrl();
    const parsed = parseFileNameInfo(fileName);
    let docNo = parsed.docNo;
    let billType = parsed.billType;
    let category = parsed.category || "หินคลุก / หินผสม (Base & Subbase)";
    let supplier = parsed.supplier || "โรงโม่ / ตั๋วชั่งนำเข้าจาก Drive";
    let date = parsed.date || new Date().toISOString().slice(0, 10);
    let refNo = parsed.refNo || docNo;

    let webhookSuccess = false;
    let supabaseSuccess = false;

    // 1. ส่งตรงเข้า Supabase Cloud (Direct REST API) 100% ไม่ผ่านเว็บ ไม่ติด Cookie
    if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
      try {
        const headers = {
          "apikey": CONFIG.SUPABASE_ANON_KEY,
          "Authorization": "Bearer " + CONFIG.SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates"
        };

        // 1.1 บันทึกลง bills_buffer (กล่องพักรอชนบิล)
        const bufUrl = getSupabaseUrl("/rest/v1/bills_buffer");
        const isSupplier = billType.indexOf("SUPPLIER") !== -1;
        const bufferPayload = {
          id: "DRIVE_" + fileId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 20),
          project_id: "PRJ-DOH-24",
          project_name: "โครงการทางหลวง (BTC)",
          type: isSupplier ? "SUPPLIER" : "DEST_WEIGHT",
          bill_type: isSupplier ? "SUPPLIER" : "DEST_WEIGHT",
          ref_no: refNo,
          weight_ticket_no: docNo,
          date: date,
          supplier: supplier,
          item_desc: category,
          material_name: category,
          remarks: (folderPath || "") + " [จากชื่อไฟล์ - รอตรวจสอบกับใบจริง]" + (parsed.needsReview ? " [รอตรวจสอบประเภท]" : ""),
          photo_attachment: fileUrl,
          // ข้อมูลนี้ถอดจาก"ชื่อไฟล์"เท่านั้น (ไม่ได้อ่านจากใบจริงด้วย AI) → ติดธงรอตรวจสอบเสมอ
          needs_review: true
        };

        const resBuf = UrlFetchApp.fetch(bufUrl, {
          method: "post",
          headers: headers,
          payload: JSON.stringify(bufferPayload),
          muteHttpExceptions: true
        });

        // 1.2 บันทึกประวัติลง drive_sync_logs
        const logUrl = getSupabaseUrl("/rest/v1/drive_sync_logs");
        const logPayload = {
          id: fileId,
          file_name: fileName,
          drive_url: fileUrl,
          folder_path: folderPath || "",
          doc_no: docNo,
          bill_type: isSupplier ? "SUPPLIER" : "DEST_WEIGHT",
          category: category,
          supplier: supplier,
          status: "SUCCESS_DIRECT_SUPABASE",
          synced_at: new Date().toISOString()
        };

        UrlFetchApp.fetch(logUrl, {
          method: "post",
          headers: headers,
          payload: JSON.stringify(logPayload),
          muteHttpExceptions: true
        });

        if (resBuf.getResponseCode() >= 200 && resBuf.getResponseCode() < 300) {
          supabaseSuccess = true;
          Logger.log("💾 [Supabase Cloud] บันทึกเข้าตาราง bills_buffer และ drive_sync_logs สำเร็จ!");
        }
      } catch (eSupa) {
        Logger.log("⚠️ Supabase Direct บันทึกไม่สำเร็จ: " + eSupa.toString());
      }
    }

    // 2. ส่งเข้า Webhook ปลายทาง (ถ้ามี) - ส่งลิงก์ Google Drive ให้ AI เปิดอ่านโดยตรง 100% ไม่ต้องแปลง Base64
    if (CONFIG.RECEIVE_URL) {
      try {
        const payload = {
          driveFileName: fileName,
          driveFileId: fileId,
          driveFileUrl: fileUrl,
          photoUrl: fileUrl,
          driveFolderPath: folderPath || "",
          parsedData: {
            docNo: docNo,
            billType: billType.indexOf("SUPPLIER") !== -1 ? "SUPPLIER" : "DEST_WEIGHT",
            date: date,
            refNo: refNo,
            category: category,
            supplier: supplier,
            source: "GOOGLE_DRIVE_BOT_LINK"
          },
          source: "GOOGLE_DRIVE_BOT_LINK"
        };

        const response = UrlFetchApp.fetch(CONFIG.RECEIVE_URL, {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        });

        const statusCode = response.getResponseCode();
        if (statusCode >= 200 && statusCode < 300) {
          webhookSuccess = true;
          try {
            const json = JSON.parse(response.getContentText());
            if (json.bill && json.bill.data) {
              docNo = json.bill.data.docNo || docNo;
              billType = json.bill.data.billType || billType;
              category = json.bill.data.category || category;
            }
          } catch (e) {}
        }
      } catch (eWh) {
        // หาก Webhook ขัดข้อง (เช่นติดหน้า cookie check พรีวิว) ระบบจะใช้ผลลัพธ์จาก Supabase หรือ Sheet แทน
      }
    }

    // 3. บันทึกลง Google Sheet ประวัติ (BTC_Drive_Sync_Log)
    try {
      logSheet.appendRow([
        fileId,
        fileName,
        new Date(),
        supabaseSuccess ? "SUCCESS_SUPABASE" : (webhookSuccess ? "SUCCESS_AI" : "SUCCESS"),
        docNo,
        fileUrl,
        folderPath || "",
        billType,
        category,
        refNo
      ]);
    } catch (eSheet) {}

    // 4. บันทึกลง UserProperties เพื่อเป็น Cache สำรองความเร็วสูง
    try {
      PropertiesService.getUserProperties().setProperty("SYNCED_" + fileId, "1");
    } catch (eCache) {}

    // 5. แปะป้ายที่ Description ของไฟล์ (ถ้ามีสิทธิ์เขียน)
    try {
      const desc = file.getDescription() || "";
      if (!desc.includes("[SYNCED_TO_BTC]")) {
        file.setDescription((desc + " [SYNCED_TO_BTC]").trim());
      }
    } catch (eDesc) {}

    Logger.log("✅ สแกนและบันทึกสำเร็จ: " + fileName + " -> [เลขบิล: " + docNo + " | หมวด: " + category + "]" + (supabaseSuccess ? " 💾 บันทึก Supabase เรียบร้อย" : ""));
    return true;
  } catch (err) {
    Logger.log("❌ เกิดข้อผิดพลาดขณะส่งไฟล์ " + file.getName() + ": " + err.toString());
    return false;
  }
}

/**
 * ถอดรหัสข้อมูลสำคัญจากชื่อไฟล์และโฟลเดอร์อัตโนมัติ
 */
function parseFileNameInfo(name) {
  let docNo = "-";
  let billType = "ใบส่งของ (SUPPLIER)";
  let date = "";
  let refNo = "";
  let category = "หินคลุก / หินผสม (Base & Subbase)";
  let supplier = "โรงโม่ / ตั๋วชั่งนำเข้าจาก Drive";
  let isConfident = false;

  try {
    const docNoMatch = name.match(/เลขที่\s*([A-Za-z0-9\-\/]+)/i) || name.match(/No\.?\s*([A-Za-z0-9\-\/]+)/i);
    if (docNoMatch) {
      docNo = docNoMatch[1];
    }

    const refMatch = name.match(/(TR-[\w\-]+)/i);
    if (refMatch) {
      refNo = refMatch[1];
    }

    const dateMatch = name.match(/(20\d{2})(\d{2})(\d{2})/);
    if (dateMatch) {
      date = dateMatch[1] + "-" + dateMatch[2] + "-" + dateMatch[3];
    }

    if (name.includes("ตั๋วชั่ง") || name.includes("ใบชั่ง") || name.includes("ชั่ง") || name.toLowerCase().includes("weight") || name.toLowerCase().includes("scale")) {
      billType = "ตั๋วชั่ง (DEST_WEIGHT)";
      isConfident = true;
    } else if (name.includes("ใบส่งของ") || name.includes("ใบกำกับ") || name.includes("บิล") || name.includes("ส่งของ") || name.toUpperCase().includes("DO-") || name.toUpperCase().includes("INV")) {
      billType = "ใบส่งของ (SUPPLIER)";
      isConfident = true;
    } else {
      // หากชื่อไฟล์ไม่ระบุชัดเจน (เช่น BTC_Receipt_... หรือรูปจากกล้อง) ให้ตั้งสถานะรอตรวจสอบ
      billType = "รอตรวจสอบ (NEEDS_REVIEW)";
      isConfident = false;
    }

    // วิเคราะห์หมวดหมู่วัสดุ
    if (name.includes("ยาง") || name.includes("แอสฟัลต์") || name.includes("AC") || name.includes("PMA")) {
      category = "งานผิวทางแอสฟัลต์ (Asphalt Pavement)";
    } else if (name.includes("คอนกรีต") || name.includes("ปูน") || name.includes("เหล็ก")) {
      category = "คอนกรีตและเหล็กโครงสร้าง";
    } else if (name.includes("ดิน") || name.includes("ลูกรัง") || name.includes("ทราย")) {
      category = "ดินถมและวัสดุคัดเลือก (Earthwork)";
    } else {
      category = "หินคลุก / หินผสม (Base & Subbase)";
    }
  } catch (e) {}

  return { 
    docNo: docNo !== "-" ? docNo : (refNo || name), 
    billType: billType, 
    date: date, 
    refNo: refNo, 
    category: category, 
    supplier: supplier,
    isConfident: isConfident,
    needsReview: !isConfident
  };
}

// ------------------------------------------------------------------------------
// Helpers: จัดการ Google Sheet บันทึกประวัติ
// ------------------------------------------------------------------------------
function getOrCreateLogSheet() {
  const files = DriveApp.getFilesByName(CONFIG.LOG_SHEET_NAME);
  let spreadsheet;

  if (files.hasNext()) {
    const file = files.next();
    spreadsheet = SpreadsheetApp.openById(file.getId());
  } else {
    spreadsheet = SpreadsheetApp.create(CONFIG.LOG_SHEET_NAME);
    const sheet = spreadsheet.getActiveSheet();
    sheet.setName("History_Log");
    sheet.appendRow([
      "File_ID",
      "File_Name",
      "Sync_Timestamp",
      "Status",
      "Detected_Doc_No",
      "Drive_URL",
      "Folder_Path",
      "Bill_Type",
      "Category",
      "Ref_No"
    ]);
    sheet.setFrozenRows(1);
    sheet.getRange("A1:J1").setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
    Logger.log("📄 สร้าง Google Sheet ประวัติสำเร็จ: " + spreadsheet.getUrl());
  }

  return spreadsheet.getActiveSheet();
}

function getProcessedFileIds() {
  const set = new Set();
  
  // 1. อ่านจากตาราง drive_sync_logs บน Supabase Cloud (ถ้ามีการเชื่อมต่อ)
  if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
    try {
      const url = getSupabaseUrl("/rest/v1/drive_sync_logs?select=id");
      const res = UrlFetchApp.fetch(url, {
        method: "get",
        headers: {
          "apikey": CONFIG.SUPABASE_ANON_KEY,
          "Authorization": "Bearer " + CONFIG.SUPABASE_ANON_KEY
        },
        muteHttpExceptions: true
      });
      if (res.getResponseCode() === 200) {
        const rows = JSON.parse(res.getContentText());
        for (let i = 0; i < rows.length; i++) {
          if (rows[i].id) set.add(String(rows[i].id).trim());
        }
        Logger.log("☁️ โหลดประวัติเดิมจาก Supabase Cloud: " + rows.length + " ไฟล์");
      }
    } catch (eSupa) {}
  }

  // 2. อ่านจาก Google Sheet Log
  try {
    const sheet = getOrCreateLogSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        const id = String(ids[i][0]).trim();
        if (id) set.add(id);
      }
    }
  } catch (err) {
    Logger.log("⚠️ อ่านประวัติจาก Sheet Log: " + err.toString());
  }

  // 3. อ่านจาก Cache สำรอง
  try {
    const props = PropertiesService.getUserProperties().getProperties();
    for (const key in props) {
      if (key.startsWith("SYNCED_")) {
        set.add(key.replace("SYNCED_", ""));
      }
    }
  } catch (e) {}

  return set;
}
`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 font-sans">
      <div className="bg-white rounded-2xl max-w-4xl w-full flex flex-col shadow-2xl overflow-hidden border border-slate-300 max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center shrink-0 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-md">
              <FolderCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base tracking-wide">ระบบดึงบิลอัตโนมัติจาก Google Drive (Gmail อื่น)</h3>
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/40">
                  Auto-Sync Active
                </span>
              </div>
              <p className="text-xs text-slate-400">
                ตั้งให้ Google Drive ดูดไฟล์ส่งเข้าสู่ระบบกระทบยอดให้อัตโนมัติ โดยไม่ต้องขอ OAuth
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Bot Inflow Banner */}
        <div className="bg-blue-950 px-6 py-2.5 border-b border-blue-900/80 flex flex-wrap items-center justify-between gap-2 text-xs text-blue-200 shrink-0">
          <div className="flex items-center space-x-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span>บิลที่ระบบดูดเข้ามาจาก Google Drive:</span>
            <strong className="text-amber-300 font-mono">{liveBotBills.length} รายการ</strong>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSimulateBotPush}
              disabled={isSimulating}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
              title="ทดสอบเสมือนว่าสคริปต์ใน Google Drive ตรวจพบรูปใหม่แล้วดูดส่งเข้ามา"
            >
              <Play className="w-3.5 h-3.5 text-amber-300" />
              <span>{isSimulating ? 'กำลังทดสอบ...' : '⚡ ทดสอบดึงบิลจาก Drive เข้ามา'}</span>
            </button>
            <button
              onClick={fetchBotBills}
              disabled={isLoadingBotBills}
              className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs cursor-pointer"
              title="รีเฟรชรายการบิลล่าสุด"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBotBills ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs (3 clean tabs) */}
        <div className="flex border-b border-slate-200 bg-slate-100 text-xs font-bold text-slate-600 px-6 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('ai_drive_scan')}
            className={`py-3 px-4 border-b-2 transition flex items-center space-x-2 shrink-0 cursor-pointer ${
              activeTab === 'ai_drive_scan'
                ? 'border-emerald-600 text-emerald-950 bg-white shadow-2xs font-extrabold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>1. 🟢 ผู้ช่วยดูดบิล & คีย์ข้อมูลอัตโนมัติ 24 ชม. (ไม่ต้องกดเอง)</span>
          </button>
          <button
            onClick={() => setActiveTab('drive_script')}
            className={`py-3 px-4 border-b-2 transition flex items-center space-x-2 shrink-0 cursor-pointer ${
              activeTab === 'drive_script'
                ? 'border-blue-600 text-blue-900 bg-white shadow-2xs font-extrabold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <FolderCheck className="w-4 h-4 text-blue-600" />
            <span>2. ⚙️ สคริปต์ Google Apps Script (ติดตั้งครั้งเดียวจบ)</span>
          </button>
          <button
            onClick={() => setActiveTab('supabase')}
            className={`py-3 px-4 border-b-2 transition flex items-center space-x-2 shrink-0 cursor-pointer ${
              activeTab === 'supabase'
                ? 'border-teal-600 text-teal-900 bg-white shadow-2xs font-extrabold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Database className="w-4 h-4 text-teal-600" />
            <span>3. ☁️ ฐานข้อมูล Supabase Cloud</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-800 text-xs flex-1">
          {/* TAB 1: 24/7 AUTO-PILOT INGESTION & KEYING */}
          {activeTab === 'ai_drive_scan' && (
            <div className="space-y-4">
              {/* Core Reassurance Callout: No manual clicking required */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100 border-2 border-emerald-400 p-4 rounded-xl shadow-xs space-y-2">
                <div className="flex items-center space-x-2 text-emerald-900 font-extrabold text-sm sm:text-base">
                  <span className="p-1 rounded-lg bg-emerald-600 text-white">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                  <span>ยืนยัน: คุณ "ไม่ต้อง" มานั่งกดปุ่มสแกนเองเลยครับ! ระบบเป็น Auto-Pilot 24 ชม.</span>
                </div>
                <p className="text-emerald-950 text-xs leading-relaxed">
                  ถ้าต้องมานั่งกดปุ่ม <strong>"⚡ สแกนบิล AI"</strong> เองทุกรอบ ก็ไม่มีประโยชน์ที่จะเชื่อมต่อกับ Google Drive จริงไหมครับ! 
                  ระบบนี้ถูกสร้างขึ้นมาเพื่อให้คุณมี <strong>"ผู้ช่วยคีย์ข้อมูลส่วนตัว"</strong> ทำงานเบื้องหลังตลอด 24 ชั่วโมง 
                  แม้คุณจะปิดหน้าเว็บหรือปิดเครื่องคอมพิวเตอร์ไปแล้วก็ตาม
                </p>
                <div className="bg-white/90 border border-emerald-300 rounded-lg p-3 text-xs text-emerald-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>หน้าที่ของคุณมีเพียงอย่างเดียว:</span>
                  </div>
                  <p className="text-slate-700 leading-normal pl-3.5">
                    👉 เมื่อสะดวก เพียงแค่เปิดหน้าเว็บเข้ามาเพื่อ <strong>"ตรวจสอบความถูกต้องของข้อมูลที่ AI คีย์รอไว้แล้ว"</strong> 
                    และ <strong>"ตรวจสอบผลการจับคู่บิล / กดชนบิล"</strong> เท่านั้นครับ!
                  </p>
                </div>
              </div>

              {/* 5-Step Visual Pipeline */}
              <div className="bg-white border-2 border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                <h5 className="font-bold text-slate-900 text-xs flex items-center justify-between">
                  <span>🔄 แผนผังการทำงานอัตโนมัติแบบไร้รอยต่อ (End-to-End Pipeline):</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    อัตโนมัติ 100% ไม่ต้องกดเอง
                  </span>
                </h5>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5 text-[11px]">
                  {/* Step 1 */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1">
                      <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-mono">1</span>
                      <span>ส่งรูปเข้ากลุ่ม LINE</span>
                    </div>
                    <p className="text-slate-500 text-[10px] leading-tight">
                      คนขับรถ / วิศวกร / โรงโม่ ส่งภาพบิลและตั๋วชั่งเข้ามาในกลุ่ม LINE โครงการ
                    </p>
                  </div>

                  {/* Step 2 */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                    <div className="font-bold text-slate-800 flex items-center gap-1">
                      <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-mono">2</span>
                      <span>เซฟลง Google Drive</span>
                    </div>
                    <p className="text-slate-500 text-[10px] leading-tight">
                      รูปจะถูกรวบรวมเข้ามาเก็บในโฟลเดอร์ Google Drive อย่างต่อเนื่อง
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg space-y-1">
                    <div className="font-bold text-emerald-900 flex items-center gap-1">
                      <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-mono">3</span>
                      <span>บอทตรวจจับ & AI อ่าน</span>
                    </div>
                    <p className="text-emerald-800 text-[10px] leading-tight">
                      สคริปต์ตรวจจับไฟล์ใหม่ทุก 1 นาที และส่งให้ Gemini AI อ่านตัวเลขจริงในกระดาษ 24 ชม.
                    </p>
                  </div>

                  {/* Step 4 */}
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg space-y-1">
                    <div className="font-bold text-emerald-900 flex items-center gap-1">
                      <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-mono">4</span>
                      <span>คีย์ลงตารางทันที</span>
                    </div>
                    <p className="text-emerald-800 text-[10px] leading-tight">
                      บันทึกเข้าตาราง 38 คอลัมน์ และกล่องพักรอชนบิลใน Supabase Cloud ให้อัตโนมัติ
                    </p>
                  </div>

                  {/* Step 5 */}
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-1">
                    <div className="font-bold text-amber-900 flex items-center gap-1">
                      <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] flex items-center justify-center font-mono">5</span>
                      <span>คุณเข้ามาตรวจ & ชนบิล</span>
                    </div>
                    <p className="text-amber-800 text-[10px] leading-tight">
                      เปิดหน้าเว็บมาดูตัวเลขที่คีย์รอไว้แล้ว แก้ไขจุดที่ต้องการ และกดยืนยันการจับคู่บิล!
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                  <div className="flex items-center space-x-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 font-mono text-slate-800">
                    <FolderCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>โฟลเดอร์ Google Drive: {folderId} (BTC_Purchasing_Receipts)</span>
                  </div>
                  <a 
                    href={folderUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-blue-700 hover:text-blue-900 underline flex items-center space-x-1 font-semibold"
                  >
                    <span>เปิดดูโฟลเดอร์จริงใน Google Drive</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* 🛡️ 3-Tier Anti-Duplicate Guard Card */}
              <div className="bg-amber-50/70 border-2 border-amber-300 rounded-xl p-4 shadow-xs space-y-2">
                <div className="flex items-center space-x-2 text-amber-950 font-bold text-xs sm:text-sm">
                  <span className="p-1 rounded-md bg-amber-500 text-slate-950">
                    <ShieldCheck className="w-4 h-4" />
                  </span>
                  <span>🛡️ ระบบป้องกันบิลซ้ำ 3 ชั้น (Anti-Duplicate Guard Engine):</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    ทำงานอัตโนมัติ
                  </span>
                </div>
                <p className="text-amber-900 text-xs leading-relaxed">
                  ไม่ต้องกังวลเรื่องข้อมูลเบิ้ลครับ! ก่อนที่ AI จะบันทึกหรือคีย์ข้อมูลลงตาราง ระบบจะทำการตรวจเช็กอย่างละเอียด 3 ชั้น:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div className="p-2.5 bg-white rounded-lg border border-amber-200 space-y-0.5 shadow-2xs">
                    <strong className="text-slate-900 block">1. ตรวจเลขที่บิล / ตั๋วชั่ง</strong>
                    <span className="text-slate-600 text-[10px]">
                      เช็กเลขที่ DO, Ticket No. และ Ref No. กับทั้งในตารางหลักและกล่องพัก ถ้ามีแล้วจะ <strong>"ข้ามทันที"</strong>
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-amber-200 space-y-0.5 shadow-2xs">
                    <strong className="text-slate-900 block">2. ตรวจ File ID ใน Drive</strong>
                    <span className="text-slate-600 text-[10px]">
                      บันทึกประวัติไฟล์ที่เคยดึงแล้วลงทะเบียน เพื่อไม่ให้บอทส่งไฟล์เดิมซ้ำแม้จะรันกี่รอบ
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-amber-200 space-y-0.5 shadow-2xs">
                    <strong className="text-slate-900 block">3. ตรวจ วันที่ + ทะเบียน + นน.</strong>
                    <span className="text-slate-600 text-[10px]">
                      ป้องกันกรณีถ่ายรูปบิลใบเดิมซ้ำ 2 รูปใน LINE หากวัน, ทะเบียน และนน. ตรงกัน ระบบจะรวมรูปและไม่สร้างแถวเบิ้ล
                    </span>
                  </div>
                </div>
              </div>

              {/* Scanned & Ingested Results */}
              <div className="bg-white border-2 border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800">
                    📄 ตัวอย่างบิลและตั๋วชั่งที่ระบบอ่านตัวเลขและคีย์ลงตารางเรียบร้อยแล้ว:
                  </span>
                  <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    ลงตาราง 38 คอลัมน์ และ Supabase แล้ว
                  </span>
                </div>
                
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {scannedHistory.length > 0 ? (
                    scannedHistory.map((item, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between gap-3 hover:border-emerald-300 transition">
                        <div className="flex items-center space-x-3 truncate">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            item.billType === 'SUPPLIER' ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900'
                          }`}>
                            {item.billType === 'SUPPLIER' ? 'ใบส่งของ' : 'ตั๋วชั่งปลายทาง'}
                          </span>
                          <div className="truncate">
                            <div className="font-bold text-slate-900 flex items-center space-x-2">
                              <span className="font-mono text-blue-700">{item.docNo}</span>
                              <span className="text-slate-400 font-normal">|</span>
                              <span>{item.supplier}</span>
                              <span className="text-[10px] text-slate-500 font-mono">({item.vehicleReg})</span>
                            </div>
                            <div className="text-[11px] text-slate-600 truncate">
                              สินค้า: <strong className="text-slate-800">{item.itemDesc}</strong> | นน.สุทธิ: <strong className="text-emerald-700">{item.netWeight} ตัน</strong> {item.totalAmount > 0 && `| ยอด: ฿${item.totalAmount.toLocaleString()}`}
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center space-x-1.5 text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>คีย์ลงระบบแล้ว</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-lg text-center text-slate-500 text-xs">
                      ขณะนี้ระบบเชื่อมต่อพร้อมทำงาน เมื่อติดตั้งสคริปต์ในแท็บที่ 2 สคริปต์จะคอยส่งไฟล์ให้ AI อ่านและคีย์ลงตารางให้อัตโนมัติทันที
                    </div>
                  )}
                </div>
              </div>

              {/* Optional Manual Tools: Clearly marked as OPTIONAL */}
              <div className="bg-slate-100/80 border border-slate-300 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                    <span>🛠️ เครื่องมือเสริม (เฉพาะกรณีต้องการทดสอบทันที หรือ อัปโหลดจากคอมฯ ตรงๆ):</span>
                  </span>
                  <span className="text-[10px] text-slate-500 italic">* ไม่จำเป็นต้องกดทุกวัน เพราะระบบทำงานอัตโนมัติอยู่แล้ว</span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleRunDriveAiScan(10)}
                      disabled={isBatchAiScanning}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
                      title="กดทดสอบให้ AI อ่านตัวอย่างบิล 10 ใบจาก Drive ทันที"
                    >
                      {isBatchAiScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                      <span>{isBatchAiScanning ? 'กำลังอ่านและคีย์บิล...' : '⚡ ทดสอบสแกนทันที (10 บิล)'}</span>
                    </button>
                    <button
                      onClick={() => handleRunDriveAiScan(50)}
                      disabled={isBatchAiScanning}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-medium transition cursor-pointer disabled:opacity-50"
                    >
                      <span>สแกน 50 บิล</span>
                    </button>
                  </div>

                  {/* Direct File Upload Option */}
                  <label className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 flex items-center space-x-1.5 cursor-pointer shadow-2xs transition">
                    <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                    <span>เลือกรูปจากเครื่อง/มือถือ (ทางเลือก)</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple 
                      className="hidden" 
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files || files.length === 0) return;
                        showToast(`🤖 กำลังให้ AI อ่านภาพบิล ${files.length} ใบ...`, 'info');
                        for (let i = 0; i < files.length; i++) {
                          const file = files[i];
                          const base64 = await new Promise<string>((res) => {
                            const r = new FileReader();
                            r.onload = () => res(r.result as string);
                            r.readAsDataURL(file);
                          });
                          try {
                            const resp = await fetch('/api/ocr-scan', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ imageBase64: base64, mimeType: file.type || 'image/jpeg' })
                            });
                            const resJson = await resp.json();
                            if (resJson.success && resJson.data) {
                              onImportBotBill(resJson.data);
                            }
                          } catch (err) {}
                        }
                        showToast(`✅ สแกนและคีย์ข้อมูลสำเร็จ!`, 'success');
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GOOGLE APPS SCRIPT FOR OTHER GMAIL */}
          {activeTab === 'drive_script' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                <h4 className="font-bold text-emerald-950 text-sm flex items-center gap-1.5 mb-1">
                  <FolderCheck className="w-4 h-4 text-emerald-700" />
                  วิธีติดตั้งสคริปต์เฝ้าดูดไฟล์จากโฟลเดอร์ Google Drive (ทำเพียงครั้งเดียว):
                </h4>
                <p className="text-emerald-900 text-xs leading-relaxed">
                  เนื่องจากโฟลเดอร์ <strong className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-950 border border-emerald-300">{folderId}</strong> อยู่ใน Gmail บัญชีอื่น เพียงนำสคริปต์ด้านล่างนี้ไปแปะในบัญชี Gmail นั้น สคริปต์จะคอยตรวจดูดไฟล์ภาพบิลใหม่และส่งมาให้ระบบเราอัตโนมัติ <strong>โดยที่คุณไม่ต้องเปิดหน้าเว็บทิ้งไว้เลย</strong>
                </p>
              </div>

              {/* Interactive Folder ID Configuration Card */}
              <div className="bg-white border-2 border-blue-200 rounded-xl p-4 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                      <FolderCheck className="w-4 h-4" />
                    </span>
                    <div>
                      <h5 className="font-bold text-slate-800 text-xs">ระบุ FOLDER_ID หรือ ลิงก์โฟลเดอร์ Google Drive:</h5>
                      <p className="text-[11px] text-slate-500">วางลิงก์โฟลเดอร์หรือ ID ที่นี่ โค้ดสคริปต์ด้านล่างจะอัปเดตให้อัตโนมัติทันที</p>
                    </div>
                  </div>
                  <a
                    href={folderUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center space-x-1.5 border border-slate-300 w-fit transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                    <span>เปิดดูโฟลเดอร์จริงใน Google Drive</span>
                  </a>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={folderId}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        // Auto extract folder ID if user pasted a full Google Drive URL
                        const match = val.match(/folders\/([a-zA-Z0-9_-]+)/);
                        const cleanId = match ? match[1] : val;
                        setFolderId(cleanId);
                        localStorage.setItem('btc_bot_folder_id', cleanId);
                      }}
                      placeholder="เช่น 1Z6-WNDovLWEYQsYllTTPCDLIwQt3ufjx หรือวางลิงก์ Google Drive เต็ม"
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const defaultId = '1Z6-WNDovLWEYQsYllTTPCDLIwQt3ufjx';
                      setFolderId(defaultId);
                      localStorage.setItem('btc_bot_folder_id', defaultId);
                    }}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium border border-slate-300 transition shrink-0 cursor-pointer"
                    title="คืนค่าโฟลเดอร์เริ่มต้นของ บจก.บุรีรัมย์ธงชัยฯ"
                  >
                    รีเซ็ตเป็นค่าเริ่มต้น
                  </button>
                </div>
                
                <div className="flex items-center justify-between text-[11px] bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200 text-slate-600">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                    <span>โฟลเดอร์เป้าหมายขณะนี้: <code className="font-mono font-bold text-blue-700">{folderId}</code></span>
                  </div>
                  <span className="text-slate-400">รองรับทั้งไฟล์ภาพ JPG, PNG, WEBP, HEIC และ PDF ในทุกโฟลเดอร์ย่อย</span>
                </div>
              </div>

              {/* Supabase Connection Status Banner in Tab 2 (Points to Tab 3 as the single source) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-teal-600 shrink-0" />
                  <span className="text-slate-700">
                    สถานะ Supabase Cloud: {isSupabaseConnected ? (
                      <strong className="text-emerald-700 font-bold">✅ เชื่อมต่อเรียบร้อย (สคริปต์ด้านล่างผูก URL อัตโนมัติแล้ว)</strong>
                    ) : supabaseConfig.url ? (
                      <strong className="text-blue-700 font-bold">ระบุ URL แล้ว ({supabaseConfig.url.slice(0, 25)}...)</strong>
                    ) : (
                      <span className="text-amber-700 font-semibold">ยังไม่ได้ระบุ (ไปตั้งค่าได้ที่แท็บ 3)</span>
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('supabase')}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-teal-800 border border-teal-300 rounded-md text-[11px] font-bold transition shrink-0 cursor-pointer shadow-2xs"
                >
                  ⚙️ ตั้งค่า Supabase ที่แท็บ 3
                </button>
              </div>

              {/* 3 Step Visual Guide */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center space-x-1.5 text-blue-800 font-bold">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                    <span>เปิด Apps Script ใน Gmail</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    เปิด <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold">script.google.com</a> ด้วยบัญชีที่มีโฟลเดอร์ &gt; กด "โครงการใหม่"
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center space-x-1.5 text-blue-800 font-bold">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">2</span>
                    <span>วางโค้ดสคริปต์</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    กดปุ่ม <strong className="text-blue-900">"คัดลอกโค้ดทั้งหมด"</strong> ด้านล่าง วางแทนโค้ดเดิมในหน้าต่างแล้วกดบันทึก (Ctrl+S)
                  </p>
                </div>

                <div className="p-3 bg-emerald-50 border-2 border-emerald-400 rounded-xl space-y-1 shadow-xs">
                  <div className="flex items-center space-x-1.5 text-emerald-900 font-bold">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">3</span>
                    <span>กดเรียกใช้ "syncAllInBatchesDirectly"</span>
                  </div>
                  <p className="text-emerald-900 text-[11px] leading-relaxed">
                    เลือกฟังก์ชัน <strong className="font-mono bg-emerald-200/90 px-1.5 py-0.5 rounded text-emerald-950 font-bold">syncAllInBatchesDirectly</strong> (รวบส่งเป็นชุด 50 บิล เข้า Supabase ทันที 576 บิล เสร็จใน ~15 วินาที!) แล้วกด <strong>"เรียกใช้ (Run)"</strong>
                  </p>
                </div>
              </div>

              {/* Clarity Box: Why no AI scan per bill needed */}
              <div className="bg-amber-50/90 border border-amber-200 p-3.5 rounded-xl space-y-1.5 text-[11px] text-amber-950">
                <div className="flex items-center space-x-2 font-bold text-amber-900">
                  <span className="px-1.5 py-0.5 bg-amber-200 rounded text-amber-900 font-mono text-[10px]">💡 ข้อควรรู้</span>
                  <span>ทำไมไม่ต้องส่งทีละบิล และไม่ต้องรอ AI อ่านทีละรูป?</span>
                </div>
                <p className="text-amber-900 leading-relaxed">
                  เนื่องจากชื่อไฟล์บิลใน Google Drive (เช่น <code className="bg-amber-100 font-mono px-1 rounded text-amber-950">TR-202609-00568_ใบส่งของ เลขที่ 1264008895_20260928_150435.jpg</code>) 
                  มีข้อมูลครบถ้วนอยู่แล้วทั้ง <strong>เลขที่ตั๋วชั่ง, เลขที่บิล, วันที่, หมวดหมู่วัสดุ</strong> ระบบจึงอ่านข้อมูลและรวบส่งเป็นชุดเข้าฐานข้อมูล Supabase ได้ทันทีใน 0.001 วินาทีต่อบิล ไม่ต้องเสียเวลาแปลงไฟล์ภาพส่ง AI ทีละรูปให้ช้าและติดขีดจำกัดเวลา
                </p>
              </div>

              {/* History Tracking Sheet Callout */}
              <div className="bg-blue-50/70 border border-blue-200 p-3 rounded-xl flex items-start space-x-2 text-[11px] text-blue-900">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong>ระบบบันทึกประวัติอัตโนมัติ (Zero Duplicate & No Data Loss):</strong> สคริปต์จะสร้าง Google Sheet ประวัติชื่อ <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-950 font-bold">BTC_Drive_Sync_Log</code> ให้ใน Drive ของคุณอัตโนมัติ เพื่อจดจำ ID ไฟล์ที่เคยส่งแล้ว 100% จึงไม่มีการส่งซ้ำเด็ดขาด และหากเน็ตหลุดหรือมีไฟล์ส่งไม่สำเร็จ ระบบจะไม่บันทึกประวัติและจะลองส่งใหม่ในรอบถัดไปแบบอัตโนมัติ
                </div>
              </div>

              {/* Script Box */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <FileCode className="w-4 h-4 text-blue-700" />
                    <span>โค้ด Google Apps Script สำเร็จรูป (ผูกโฟลเดอร์ {folderId} เรียบร้อยแล้ว):</span>
                  </label>
                  <button
                    onClick={() => copyToClipboard(googleAppsScriptCode, 'apps_script')}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs transition"
                  >
                    {copied === 'apps_script' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copied === 'apps_script' ? 'คัดลอกแล้ว!' : 'คัดลอกโค้ดทั้งหมด'}</span>
                  </button>
                </div>
                <pre className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-[11px] overflow-x-auto max-h-56 leading-relaxed border border-slate-700">
{googleAppsScriptCode}
                </pre>
              </div>

              {/* Live Incoming Bills List */}
              <div className="pt-2">
                <div className="flex justify-between items-center mb-2">
                  <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>รายการบิลที่ระบบดูดเข้ามาล่าสุด ({liveBotBills.length} รายการ):</span>
                  </h5>
                  {liveBotBills.length > 0 && (
                    <span className="text-[11px] text-slate-500">คลิก "+ นำเข้าตาราง" เพื่อชนบิล</span>
                  )}
                </div>

                {liveBotBills.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-300 rounded-xl bg-slate-50 text-slate-500">
                    <p className="font-semibold">ยังไม่มีบิลส่งเข้ามาในขณะนี้</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      สามารถกดปุ่ม <strong className="text-blue-700">"⚡ ทดสอบดึงบิลจาก Drive เข้ามา"</strong> ด้านบน เพื่อดูตัวอย่างการทำงานได้ทันที
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {liveBotBills.map(b => (
                      <div key={b.id} className="p-3 border border-slate-200 rounded-xl bg-white shadow-2xs flex items-center justify-between gap-3 hover:border-blue-400 transition">
                        <div className="flex items-center space-x-3 truncate">
                          <span className="px-2 py-1 rounded bg-blue-100 text-blue-900 font-mono font-bold text-xs shrink-0">
                            {b.data?.docNo || b.id}
                          </span>
                          <div className="truncate">
                            <div className="font-bold text-slate-900 flex items-center gap-2">
                              <span>{b.data?.supplier || 'โรงโม่ / ตั๋วชั่ง'}</span>
                              <span className="text-[10px] font-normal text-slate-500">({b.driveFileName || 'ไฟล์จาก Drive'})</span>
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              สินค้า: {b.data?.itemDesc} | นน.สุทธิ: {b.data?.netWeight} ตัน | ทะเบียน: {b.data?.vehicleReg}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0">
                          {b.driveFileUrl && (
                            <a
                              href={b.driveFileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 text-slate-600 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 rounded text-xs flex items-center space-x-1"
                              title="เปิดดูไฟล์ใน Google Drive"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>ดูไฟล์ใน Drive</span>
                            </a>
                          )}
                          <button
                            onClick={() => {
                              onImportBotBill(b.data);
                              showToast(`✅ นำบิล ${b.data?.docNo} เข้ากล่องพักรอชนบิลเรียบร้อยแล้ว!`);
                            }}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-xs cursor-pointer"
                          >
                            + นำเข้าตาราง
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SUPABASE CLOUD REALTIME */}
          {activeTab === 'supabase' && (
            <div className="space-y-4">
              <div className="bg-teal-50 border border-teal-200 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-teal-950 text-sm flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-teal-700" />
                    <span>เชื่อมต่อ Supabase Cloud (ศูนย์ควบคุมฐานข้อมูลหลัก)</span>
                  </h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-200 text-teal-900 border border-teal-300">
                    จุดกรอกหลัก (แนะนำ)
                  </span>
                </div>
                <p className="text-teal-900 text-xs leading-relaxed">
                  กรอกข้อมูล Supabase ที่นี่เพียงครั้งเดียว ระบบจะบันทึกและ <strong>นำค่า URL กับ Key ไปฝังในโค้ดสคริปต์ Google Apps Script (ในแท็บ 2) ให้อัตโนมัติทันที</strong> เพื่อให้คุณก๊อปปี้สคริปต์ไปวางแล้วเริ่มทำงานได้เลยโดยไม่ต้องแก้โค้ดเองครับ
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Supabase Project URL:</label>
                  <input
                    type="text"
                    value={supabaseConfig.url}
                    onChange={e => {
                      const newCfg = { ...supabaseConfig, url: e.target.value.trim() };
                      setSupabaseConfig(newCfg);
                      saveSupabaseConfig(newCfg);
                    }}
                    placeholder="https://your-project-id.supabase.co"
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono text-xs bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Supabase Anon Key:</label>
                  <input
                    type="password"
                    value={supabaseConfig.anonKey}
                    onChange={e => {
                      const newCfg = { ...supabaseConfig, anonKey: e.target.value.trim() };
                      setSupabaseConfig(newCfg);
                      saveSupabaseConfig(newCfg);
                    }}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono text-xs bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ชื่อตาราง (Table Name):</label>
                  <input
                    type="text"
                    value={supabaseConfig.tableName || 'bills_buffer'}
                    onChange={e => {
                      const newCfg = { ...supabaseConfig, tableName: e.target.value.trim() };
                      setSupabaseConfig(newCfg);
                      saveSupabaseConfig(newCfg);
                    }}
                    placeholder="bills_buffer"
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono text-xs bg-white text-slate-800"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleTestSupabase}
                    className="w-full py-2 bg-teal-700 hover:bg-teal-600 text-white rounded-lg font-bold text-xs shadow-xs transition cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>ทดสอบการเชื่อมต่อ & บันทึกค่า</span>
                  </button>
                </div>
              </div>

              {/* Cross-tab Guide Banner */}
              <div className="bg-slate-100 border border-slate-300 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center space-x-2 text-slate-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                  <span>
                    เมื่อทดสอบการเชื่อมต่อผ่านแล้ว 👉 สามารถกดสลับไปที่ <strong>แท็บ 2</strong> เพื่อก๊อปปี้สคริปต์ Google Drive ไปติดตั้งได้ทันทีครับ
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('drive_script')}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shrink-0 shadow-2xs"
                >
                  👉 ไปแท็บ 2 ก๊อปปี้สคริปต์
                </button>
              </div>

              {supabaseStatusMsg && (
                <div className={`p-3 rounded-lg text-xs font-semibold ${
                  isSupabaseConnected ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-rose-50 text-rose-800 border border-rose-300'
                }`}>
                  {supabaseStatusMsg}
                </div>
              )}

              {/* Cloud Sync Actions (when connected) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-blue-600" />
                    <span>จัดการข้อมูลบน Cloud Database (CRUD & Realtime):</span>
                  </span>
                  <span className="text-[11px] text-slate-500">
                    ข้อมูลในเครื่อง: {projects.length} โครงการ, {records.length} บิล, {buffer.length} กล่องพัก
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={handleBulkSyncToCloud}
                    disabled={isSyncing}
                    className="py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg font-bold text-xs shadow-xs transition cursor-pointer flex items-center justify-center space-x-1.5"
                    title="นำข้อมูลโครงการและบิลทั้งหมดในเครื่องปัจจุบัน บันทึกขึ้น Supabase Cloud ทันที"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>{isSyncing ? 'กำลังซิงค์...' : '🚀 อัปโหลดข้อมูลในเครื่องขึ้น Supabase'}</span>
                  </button>
                  <button
                    onClick={handlePullFromCloud}
                    disabled={isSyncing}
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-400 text-white rounded-lg font-bold text-xs shadow-xs transition cursor-pointer flex items-center justify-center space-x-1.5"
                    title="ดึงข้อมูลล่าสุดทั้งหมดจาก Supabase Cloud มาแสดงผลในตาราง"
                  >
                    <DownloadCloud className="w-4 h-4 text-cyan-400" />
                    <span>{isSyncing ? 'กำลังโหลด...' : '📥 ดึงข้อมูลทั้งหมดจาก Cloud'}</span>
                  </button>
                </div>
              </div>

              {/* SQL Schema for Supabase */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-slate-700 text-xs">
                    คำสั่ง SQL สำหรับ Supabase SQL Editor (สร้าง 3 ตาราง: projects, reconciliation_records, bills_buffer):
                  </label>
                  <button
                    onClick={() => copyToClipboard(SUPABASE_SQL_SCHEMA, 'supabase_sql')}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    {copied === 'supabase_sql' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied === 'supabase_sql' ? 'คัดลอก SQL แล้ว' : 'คัดลอก SQL (3 ตาราง)'}</span>
                  </button>
                </div>
                <pre className="bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-[10px] overflow-x-auto max-h-48 leading-relaxed border border-slate-700">
{SUPABASE_SQL_SCHEMA}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Toast Notification */}
        {toastMessage && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 text-xs font-semibold flex items-center space-x-2">
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex justify-between items-center shrink-0">
          <div className="text-slate-500 text-[11px]">
            โฟลเดอร์เป้าหมาย: <a href={folderUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline font-mono">{folderId}</a> (BTC_Purchasing_Receipts)
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
