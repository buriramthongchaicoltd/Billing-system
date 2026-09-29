import React, { useState, useEffect } from 'react';
import { 
  X, Bot, FolderCheck, Check, Copy, RefreshCw, 
  ExternalLink, CheckCircle2, Database, Play, ArrowRight, Clock, FileCode
} from 'lucide-react';
import { 
  getSavedSupabaseConfig, 
  saveSupabaseConfig, 
  getSupabaseClient, 
  SupabaseConfig 
} from '../lib/supabaseClient';

interface AutoBotSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportBotBill: (billData: any) => void;
}

export const AutoBotSyncModal: React.FC<AutoBotSyncModalProps> = ({
  isOpen,
  onClose,
  onImportBotBill
}) => {
  // Only 2 clear tabs now: drive_script (Default) & supabase
  const [activeTab, setActiveTab] = useState<'drive_script' | 'supabase'>('drive_script');
  const [copied, setCopied] = useState<string | null>(null);

  // Supabase state
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>(getSavedSupabaseConfig());
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const [supabaseStatusMsg, setSupabaseStatusMsg] = useState('');

  // Live Bot Bills state
  const [liveBotBills, setLiveBotBills] = useState<any[]>([]);
  const [isLoadingBotBills, setIsLoadingBotBills] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/bot-import-bill` : '/api/bot-import-bill';
  const folderId = '1Z6-WNDovLWEYQsYllTTPCDLIwQt3ufjx';
  const folderUrl = `https://drive.google.com/drive/folders/${folderId}?usp=sharing`;

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
      const { data, error } = await client.from(supabaseConfig.tableName || 'bills_buffer').select('*').limit(1);
      if (error && error.code !== 'PGRST116') {
        if (error.message.includes('relation') || error.message.includes('does not exist')) {
          setIsSupabaseConnected(true);
          setSupabaseStatusMsg('⚠️ เชื่อมต่อ Supabase สำเร็จ! (แต่ยังไม่พบตารางตามชื่อนี้ โปรดรัน SQL ด้านล่าง)');
        } else {
          setIsSupabaseConnected(false);
          setSupabaseStatusMsg(`❌ ผิดพลาด: ${error.message}`);
        }
      } else {
        setIsSupabaseConnected(true);
        setSupabaseStatusMsg('✅ เชื่อมต่อ Supabase สำเร็จ พร้อมรับข้อมูล Realtime!');
      }
    } catch (err: any) {
      setIsSupabaseConnected(false);
      setSupabaseStatusMsg(`❌ เชื่อมต่อล้มเหลว: ${err.message}`);
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
 * Google Apps Script เฝ้าดูดไฟล์จาก Google Drive อัตโนมัติ 24 ชม.
 * สำหรับนำไปวางในบัญชี Gmail ที่เป็นเจ้าของโฟลเดอร์ Drive
 * โฟลเดอร์: ${folderId} (BTC_Purchasing_Receipts)
 */
function autoPushBillsToReconciliation() {
  const FOLDER_ID = "${folderId}";
  const RECEIVE_URL = "${webhookUrl}";
  
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const files = folder.getFiles();
  const processedTag = "[SYNCED_TO_SYSTEM]";
  
  let count = 0;
  
  while (files.hasNext()) {
    const file = files.next();
    const desc = file.getDescription() || "";
    
    // ข้ามไฟล์ที่เคยดูดส่งไปแล้ว
    if (desc.includes(processedTag)) continue;
    
    const mimeType = file.getMimeType();
    // คัดกรองเฉพาะไฟล์ภาพ (JPG, PNG) หรือเอกสาร PDF
    if (mimeType.indexOf("image/") !== 0 && mimeType !== "application/pdf") {
      continue;
    }
    
    Logger.log("กำลังส่งไฟล์: " + file.getName());
    const bytes = file.getBlob().getBytes();
    const base64 = Utilities.base64Encode(bytes);
    
    const payload = {
      imageBase64: base64,
      mimeType: mimeType,
      driveFileName: file.getName(),
      driveFileId: file.getId(),
      driveFileUrl: file.getUrl(),
      source: "GOOGLE_DRIVE_BOT_AUTO"
    };
    
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    try {
      const response = UrlFetchApp.fetch(RECEIVE_URL, options);
      Logger.log("ส่งสำเร็จ: " + response.getContentText());
      // แปะป้ายไว้ที่รายละเอียดไฟล์ เพื่อไม่ให้ส่งซ้ำ
      file.setDescription(desc + " " + processedTag);
      count++;
      if (count >= 5) break; // ทยอยส่งรอบละ 5 ไฟล์
    } catch (err) {
      Logger.log("ส่งไม่สำเร็จ: " + err.toString());
    }
  }
}
`;

  const supabaseSqlSchema = `-- สร้างตารางจัดเก็บข้อมูลตั๋วชั่งและบิลสำหรับ Realtime Sync
create table if not exists bills_buffer (
  id text primary key,
  doc_no text not null,
  bill_type text default 'DEST_WEIGHT',
  supplier text,
  vehicle_reg text,
  item_desc text,
  net_weight numeric,
  gross_weight numeric,
  tare_weight numeric,
  price_per_unit numeric,
  total_amount numeric,
  project_id text default 'PRJ-DOH-24',
  project_name text default 'ทล.24 ตอน 2',
  is_subcontractor_deduction boolean default false,
  subcontractor_name text,
  drive_file_url text,
  remarks text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- เปิดใช้งาน Realtime
alter publication supabase_realtime add table bills_buffer;`;

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

        {/* Navigation Tabs (Only 2 tabs now) */}
        <div className="flex border-b border-slate-200 bg-slate-100 text-xs font-bold text-slate-600 px-6 shrink-0">
          <button
            onClick={() => setActiveTab('drive_script')}
            className={`py-3 px-5 border-b-2 transition flex items-center space-x-2 cursor-pointer ${
              activeTab === 'drive_script'
                ? 'border-blue-600 text-blue-900 bg-white shadow-2xs font-extrabold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <FolderCheck className="w-4 h-4 text-emerald-600" />
            <span>1. Google Apps Script เฝ้า Drive (Gmail อื่น) ⭐ แนะนำ</span>
          </button>
          <button
            onClick={() => setActiveTab('supabase')}
            className={`py-3 px-5 border-b-2 transition flex items-center space-x-2 cursor-pointer ${
              activeTab === 'supabase'
                ? 'border-blue-600 text-blue-900 bg-white shadow-2xs font-extrabold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Database className="w-4 h-4 text-teal-600" />
            <span>2. Supabase Cloud (Realtime Database)</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-800 text-xs flex-1">
          {/* TAB 1: GOOGLE APPS SCRIPT FOR OTHER GMAIL */}
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

              {/* 3 Step Visual Guide */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center space-x-1.5 text-blue-800 font-bold">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                    <span>เปิด Apps Script ใน Gmail นั้น</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    ล็อกอิน Gmail ที่มีโฟลเดอร์ แล้วเปิด <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold">script.google.com</a> &gt; กด "โครงการใหม่"
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center space-x-1.5 text-blue-800 font-bold">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">2</span>
                    <span>วางโค้ดด้านล่างนี้</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    กดปุ่ม <strong className="text-blue-900">"คัดลอกโค้ดทั้งหมด"</strong> ด้านล่าง ลบโค้ดเดิมในหน้าต่างออกแล้วกดวาง (Ctrl+V) แล้วกดบันทึก (Ctrl+S)
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center space-x-1.5 text-blue-800 font-bold">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">3</span>
                    <span>ตั้งเวลาทำงานอัตโนมัติ (Trigger)</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    กดไอคอนรูปนาฬิกา (Triggers) แถบซ้าย &gt; เพิ่มทริกเกอร์เลือก <strong>"ตามเวลา (Time-driven)"</strong> ทุก 1 หรือ 5 นาที เสร็จสิ้น!
                  </p>
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
                              alert(`✅ นำบิล ${b.data?.docNo} เข้ากล่องพักรอชนบิลเรียบร้อยแล้ว!`);
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
              <div className="bg-teal-50 border border-teal-200 p-4 rounded-xl">
                <h4 className="font-bold text-teal-950 text-sm flex items-center gap-1.5 mb-1">
                  <Database className="w-4 h-4 text-teal-700" />
                  เชื่อมต่อ Supabase Cloud (Core Transactional Database) แบบ Realtime
                </h4>
                <p className="text-teal-900 text-xs">
                  เมื่อคุณหรือระบบบันทึกข้อมูลตั๋วชั่งและบิลลงตารางใน Supabase Cloud ระบบเว็บแอปนี้จะอัปเดตข้อมูลขึ้นหน้าจอและแจ้งเตือนเข้ากล่องพักรอชนบิลทันทีแบบ Realtime ผ่าน Supabase WebSocket
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Supabase Project URL:</label>
                  <input
                    type="text"
                    value={supabaseConfig.url}
                    onChange={e => setSupabaseConfig(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="https://your-project-id.supabase.co"
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Supabase Anon Key:</label>
                  <input
                    type="password"
                    value={supabaseConfig.anonKey}
                    onChange={e => setSupabaseConfig(prev => ({ ...prev, anonKey: e.target.value }))}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ชื่อตาราง (Table Name):</label>
                  <input
                    type="text"
                    value={supabaseConfig.tableName || 'bills_buffer'}
                    onChange={e => setSupabaseConfig(prev => ({ ...prev, tableName: e.target.value }))}
                    placeholder="bills_buffer"
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono text-xs bg-white"
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

              {supabaseStatusMsg && (
                <div className={`p-3 rounded-lg text-xs font-semibold ${
                  isSupabaseConnected ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-rose-50 text-rose-800 border border-rose-300'
                }`}>
                  {supabaseStatusMsg}
                </div>
              )}

              {/* SQL Schema for Supabase */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-slate-700">คำสั่ง SQL สำหรับรันใน Supabase SQL Editor (สร้างตาราง & เปิด Realtime):</label>
                  <button
                    onClick={() => copyToClipboard(supabaseSqlSchema, 'supabase_sql')}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    {copied === 'supabase_sql' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied === 'supabase_sql' ? 'คัดลอก SQL แล้ว' : 'คัดลอก SQL'}</span>
                  </button>
                </div>
                <pre className="bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48 leading-relaxed border border-slate-700">
{supabaseSqlSchema}
                </pre>
              </div>
            </div>
          )}
        </div>

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
