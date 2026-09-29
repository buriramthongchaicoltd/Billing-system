import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Save, Upload, Camera, ZoomIn, ZoomOut, RotateCcw, RotateCw, 
  Check, AlertTriangle, CheckCircle2, Clock, Trash2, FileText, 
  FileSpreadsheet, Edit3, RefreshCw, Scissors, Building2, Truck
} from 'lucide-react';
import { RecordItem, Project } from '../types';

interface BillDetailEditModalProps {
  record: RecordItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedRecord: RecordItem) => void;
  onDelete?: (id: string) => void;
  projects?: Project[];
}

const DEFAULT_RECORD: RecordItem = {
  id: '',
  category: '',
  billType: 'SUPPLIER',
  poNo: '',
  rrNo: '',
  date: '',
  doNo: '',
  supplier: '',
  contractor: '',
  vehicleReg: '',
  itemDesc: '',
  spec: '',
  originGross: 0,
  originTare: 0,
  originNet: 0,
  destDate: '',
  destTicketNo: '',
  destGross: 0,
  destTare: 0,
  destNet: 0,
  weightDiff: 0,
  qty: 0,
  unit: 'ตัน',
  pricePerUnit: 0,
  totalMaterial: 0,
  transportType: '',
  freightRate: 0,
  totalFreight: 0,
  grandTotal: 0,
  paymentMethod: '',
  paidSupplier: 0,
  balanceSupplier: 0,
  paidHauler: 0,
  balanceHauler: 0,
  totalPaid: 0,
  totalOutstanding: 0,
  jobStation: '',
  remarks: '',
  status: 'PENDING'
};

export const BillDetailEditModal: React.FC<BillDetailEditModalProps> = ({
  record,
  isOpen,
  onClose,
  onSave,
  onDelete,
  projects = []
}) => {
  // Local form state cloned from record - all hooks MUST run unconditionally at top
  const [formData, setFormData] = useState<RecordItem>(() => record || DEFAULT_RECORD);
  
  // Image viewer state
  const [photoZoom, setPhotoZoom] = useState<number>(1);
  const [photoRotation, setPhotoRotation] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'ALL' | 'WEIGHT' | 'FINANCE'>('ALL');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if active record changes
  useEffect(() => {
    if (record) {
      setFormData({ ...record });
      setPhotoZoom(1);
      setPhotoRotation(0);
    }
  }, [record]);

  if (!isOpen || !record) return null;

  // Derived live calculations
  const calcOriginNet = formData.originGross && formData.originTare
    ? Math.max(0, (formData.originGross - formData.originTare) / 1000)
    : formData.originNet || 0;

  const calcDestNet = formData.destGross && formData.destTare
    ? Math.max(0, (formData.destGross - formData.destTare) / 1000)
    : formData.destNet || 0;

  const calcWeightDiff = calcDestNet > 0 && calcOriginNet > 0
    ? Math.round((calcDestNet - calcOriginNet) * 1000)
    : formData.weightDiff || 0;

  const calcTotalMaterial = (formData.qty || 0) * (formData.pricePerUnit || 0);
  const calcTotalFreight = (formData.qty || 0) * (formData.freightRate || 0);
  const calcGrandTotal = calcTotalMaterial + calcTotalFreight;

  const calcBalanceSupplier = Math.max(0, calcTotalMaterial - (formData.paidSupplier || 0));
  const calcBalanceHauler = Math.max(0, calcTotalFreight - (formData.paidHauler || 0));
  const calcTotalPaid = (formData.paidSupplier || 0) + (formData.paidHauler || 0);
  const calcTotalOutstanding = calcGrandTotal - calcTotalPaid;

  const isWeightAlert = calcDestNet > 0 && Math.abs(calcWeightDiff) > 100;

  // Image Upload Handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      setFormData(prev => ({
        ...prev,
        photoAttachment: base64Data
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemovePhoto = () => {
    if (confirm('ต้องการลบภาพเอกสารที่แนบไว้ใช่หรือไม่?')) {
      setFormData(prev => ({
        ...prev,
        photoAttachment: null
      }));
    }
  };

  const handleZoomIn = () => setPhotoZoom(prev => Math.min(3, +(prev + 0.25).toFixed(2)));
  const handleZoomOut = () => setPhotoZoom(prev => Math.max(0.5, +(prev - 0.25).toFixed(2)));
  const handleRotateLeft = () => setPhotoRotation(prev => (prev - 90 + 360) % 360);
  const handleRotateRight = () => setPhotoRotation(prev => (prev + 90) % 360);
  const handleResetView = () => {
    setPhotoZoom(1);
    setPhotoRotation(0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Determine appropriate status based on weights
    let updatedStatus = formData.status;
    if (calcDestNet > 0) {
      updatedStatus = isWeightAlert ? 'ALERT' : 'MATCHED';
    }

    const updatedRecord: RecordItem = {
      ...formData,
      originNet: calcOriginNet,
      destNet: calcDestNet,
      weightDiff: calcWeightDiff,
      totalMaterial: calcTotalMaterial,
      totalFreight: calcTotalFreight,
      grandTotal: calcGrandTotal,
      balanceSupplier: calcBalanceSupplier,
      balanceHauler: calcBalanceHauler,
      totalPaid: calcTotalPaid,
      totalOutstanding: calcTotalOutstanding,
      status: updatedStatus
    };

    onSave(updatedRecord);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-7xl w-full h-[94vh] flex flex-col shadow-2xl overflow-hidden border border-slate-300 font-sans animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Header Bar */}
        <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-blue-600 rounded-md text-white shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-amber-400 text-base">{formData.id}</span>
                <span className="text-slate-400">|</span>
                <h3 className="font-bold text-sm sm:text-base text-slate-100 truncate max-w-md">
                  {formData.supplier} — บิล DO: <span className="font-mono text-blue-300">{formData.doNo || '-'}</span>
                </h3>
                {formData.projectName && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    📁 {formData.projectName}
                  </span>
                )}
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  formData.status === 'MATCHED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                  formData.status === 'ALERT' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                  'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {formData.status === 'MATCHED' ? '● ชนบิลสำเร็จ' : formData.status === 'ALERT' ? '▲ นน.ขาดเกิน ALERT' : '○ รอชนบิล PENDING'}
                </span>
                {formData.isSubcontractorDeduction && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    ✂️ หักค่างวดผู้รับเหมาช่วง
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                ระบบกระทบยอดบิล &amp; ตรวจสอบเอกสาร 38 คอลัมน์ (ภาพบิลคู่ขนานฟอร์มแก้ไข)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onDelete && (
              <button 
                type="button"
                onClick={() => {
                  if (confirm(`ยืนยันการลบรายการ ${formData.id}?`)) {
                    onDelete(formData.id);
                    onClose();
                  }
                }}
                className="px-2.5 py-1.5 text-rose-400 hover:text-rose-200 hover:bg-rose-950/50 rounded text-xs flex items-center space-x-1 border border-rose-800/60 transition-colors"
                title="ลบรายการนี้"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ลบรายการ</span>
              </button>
            )}
            <button 
              type="button"
              onClick={onClose} 
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="ปิดหน้าต่าง (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content: Split 2 Columns */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-slate-100">
          
          {/* ======================================================== */}
          {/* LEFT COLUMN: Photo Viewer & Bill Document Preview (5 cols) */}
          {/* ======================================================== */}
          <div className="lg:col-span-5 bg-slate-950 flex flex-col border-r border-slate-800 h-full overflow-hidden select-none">
            {/* Viewer Control Toolbar */}
            <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300 shrink-0">
              <div className="flex items-center space-x-1">
                <span className="font-semibold text-slate-200 text-xs flex items-center gap-1.5 mr-2">
                  <Camera className="w-4 h-4 text-blue-400" />
                  <span>ภาพบิล / ตั๋วชั่ง</span>
                </span>
                {formData.photoAttachment && (
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/80">
                    แนบไฟล์แล้ว
                  </span>
                )}
              </div>

              {/* Zoom & Rotation Controls */}
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  title="ย่อขนาด (-)"
                  className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded border border-slate-700/60"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono px-1 min-w-[3rem] text-center text-slate-400">
                  {Math.round(photoZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  title="ขยายขนาด (+)"
                  className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded border border-slate-700/60"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>

                <div className="h-4 w-px bg-slate-700 mx-1" />

                <button
                  type="button"
                  onClick={handleRotateLeft}
                  title="หมุนซ้าย 90°"
                  className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded border border-slate-700/60"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleRotateRight}
                  title="หมุนขวา 90°"
                  className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded border border-slate-700/60"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleResetView}
                  title="รีเซ็ตมุมมองภาพ"
                  className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded border border-slate-700/60"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>

                <div className="h-4 w-px bg-slate-700 mx-1" />

                {/* Upload or Change Image */}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="image/*" 
                  onChange={handlePhotoUpload} 
                  className="hidden" 
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-medium flex items-center space-x-1 shadow-xs transition-colors"
                  title="อัปโหลดหรือเปลี่ยนภาพบิล"
                >
                  <Upload className="w-3 h-3" />
                  <span>{formData.photoAttachment ? 'เปลี่ยนภาพ' : 'อัปโหลดภาพ'}</span>
                </button>
                {formData.photoAttachment && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="p-1 hover:bg-rose-950 text-rose-400 hover:text-rose-300 rounded border border-rose-800/50"
                    title="ลบรูปภาพนี้"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Photo Canvas / Viewport */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 relative bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
              {formData.photoAttachment ? (
                <div 
                  className="transition-transform duration-100 ease-out origin-center flex items-center justify-center cursor-grab active:cursor-grabbing max-w-full max-h-full"
                  style={{
                    transform: `scale(${photoZoom}) rotate(${photoRotation}deg)`
                  }}
                >
                  <img 
                    src={formData.photoAttachment} 
                    alt={`บิล ${formData.doNo || formData.id}`}
                    className="max-h-[75vh] w-auto max-w-full object-contain rounded shadow-2xl border border-slate-700" 
                  />
                </div>
              ) : (
                /* High-fidelity Bill Facsimile / Voucher Slip when photo is not yet uploaded */
                <div 
                  className="transition-transform duration-100 ease-out origin-center flex flex-col items-center max-w-md w-full"
                  style={{
                    transform: `scale(${photoZoom}) rotate(${photoRotation}deg)`
                  }}
                >
                  {/* Digital Construction Bill Slip */}
                  <div className="w-full bg-[#fdfdfc] text-slate-800 p-5 rounded-md shadow-2xl border border-amber-200/60 font-mono text-[11px] relative overflow-hidden select-text">
                    {/* Top Stamp / Header */}
                    <div className="border-b-2 border-dashed border-slate-300 pb-3 mb-3 text-center">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                        <span>ORIGINAL SLIP</span>
                        <span>{formData.date || '2026-09-20'}</span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 tracking-wide">
                        {formData.supplier || 'ใบส่งสินค้า / ใบจ่ายวัสดุ'}
                      </h4>
                      <div className="text-[10px] text-slate-600 font-sans">
                        คู่สัญญา: {formData.contractor}
                      </div>
                    </div>

                    {/* Bill Key Data Table */}
                    <div className="space-y-1.5 text-[11px] border-b-2 border-dashed border-slate-300 pb-3 mb-3">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">โครงการก่อสร้าง:</span>
                        <strong className="text-blue-800 font-bold bg-blue-50 px-1 rounded">{formData.projectName || 'ทั่วไป'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">เลขที่ DO / ใบจ่าย:</span>
                        <strong className="text-blue-700 font-bold">{formData.doNo || '-'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">เลขที่ PO อ้างอิง:</span>
                        <strong>{formData.poNo || '-'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">ทะเบียนรถบรรทุก:</span>
                        <strong className="text-slate-900 bg-amber-100 px-1 rounded">{formData.vehicleReg || '-'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">รายการสินค้า:</span>
                        <strong className="text-slate-900 text-right truncate max-w-[200px]">{formData.itemDesc}</strong>
                      </div>
                      {formData.spec && formData.spec !== '-' && (
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-500 font-sans">สเปก/มาตรฐาน:</span>
                          <span className="text-slate-700">{formData.spec}</span>
                        </div>
                      )}
                    </div>

                    {/* Weight Tickets Comparison */}
                    <div className="bg-slate-50 p-2.5 rounded border border-slate-200 mb-3 space-y-1">
                      <div className="text-[10px] font-bold text-slate-700 font-sans flex justify-between border-b border-slate-200 pb-1">
                        <span>⚖️ ข้อมูลตั๋วชั่งน้ำหนัก</span>
                        <span>สุทธิ (ตัน)</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="font-sans text-slate-600">ต้นทาง ({formData.supplier}):</span>
                        <span className="font-bold text-teal-800">{calcOriginNet > 0 ? `${calcOriginNet.toFixed(3)} ตัน` : '-'}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="font-sans text-slate-600">ปลายทาง (ตั๋ว #{formData.destTicketNo || '-'}):</span>
                        <span className="font-bold text-emerald-800">{calcDestNet > 0 ? `${calcDestNet.toFixed(3)} ตัน` : '-'}</span>
                      </div>
                      <div className="flex justify-between text-[11px] pt-1 border-t border-slate-200">
                        <span className="font-sans font-bold text-slate-700">ผลต่างน้ำหนักสุทธิ:</span>
                        <span className={`font-bold ${isWeightAlert ? 'text-rose-600' : 'text-slate-800'}`}>
                          {calcDestNet > 0 ? `${calcWeightDiff > 0 ? '+' : ''}${calcWeightDiff} กก.` : 'รอตั๋วปลายทาง'}
                        </span>
                      </div>
                    </div>

                    {/* Pricing / Amounts */}
                    <div className="flex justify-between text-xs font-bold pt-1 mb-2">
                      <span className="font-sans text-slate-700">ยอดรวมทั้งสิ้น (28):</span>
                      <span className="text-blue-900 text-sm">฿{calcGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>

                    {/* Subcontractor Stamp */}
                    {formData.isSubcontractorDeduction && (
                      <div className="p-2 bg-purple-50 border border-purple-200 rounded text-purple-900 text-[10px] font-sans my-2">
                        ✂️ หักค่างวดผู้รับเหมาช่วง: <strong>{formData.subcontractorName || '-'}</strong> ({formData.subcontractorWorkPeriod || '-'})
                      </div>
                    )}

                    {/* Remarks / Hand notes */}
                    {formData.remarks && (
                      <div className="text-[10px] text-slate-600 font-sans bg-amber-50/60 p-2 rounded border border-amber-200/50 mt-2">
                        <span className="font-bold text-slate-700">บันทึกหน้างาน:</span> {formData.remarks}
                      </div>
                    )}

                    {/* Bottom barcode simulation */}
                    <div className="pt-3 mt-3 border-t border-dashed border-slate-300 text-center">
                      <div className="tracking-[0.3em] font-bold text-slate-400 text-[9px] mb-1">
                        ||||| | |||||| |||| | ||||||| ||| |||||
                      </div>
                      <div className="text-[9px] text-slate-400">
                        DOC ID: {formData.id} • AUTH VERIFIED
                      </div>
                    </div>
                  </div>

                  {/* Dropzone Upload Button */}
                  <div className="w-full mt-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2.5 px-3 bg-blue-900/60 hover:bg-blue-800/80 text-blue-200 hover:text-white rounded-lg border border-dashed border-blue-500/60 text-xs flex items-center justify-center space-x-2 transition-all group cursor-pointer"
                    >
                      <Camera className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                      <span>📸 คลิกเพื่อแนบภาพถ่ายบิลจริง (JPG / PNG)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom info helper */}
            <div className="px-3 py-1.5 bg-slate-900/90 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between shrink-0">
              <span>เลื่อนเพื่อซูม หรือคลิกปุ่มหมุนภาพหากบิลเอียง</span>
              <span className="font-mono text-slate-500">ID: {formData.id}</span>
            </div>
          </div>

          {/* ======================================================== */}
          {/* RIGHT COLUMN: 38-Column Inspection & Edit Form (7 cols) */}
          {/* ======================================================== */}
          <div className="lg:col-span-7 flex flex-col h-full overflow-hidden bg-slate-50">
            
            {/* Form Filter / Section Tabs */}
            <div className="px-5 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-1">
                <span className="text-xs font-bold text-slate-800 mr-2 flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-amber-600" />
                  <span>ฟอร์มตรวจสอบ &amp; แก้ไขข้อมูล 38 คอลัมน์</span>
                </span>
              </div>
              <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('ALL')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    activeTab === 'ALL' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ครบ 38 คอลัมน์
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('WEIGHT')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    activeTab === 'WEIGHT' ? 'bg-white text-teal-800 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ⚖️ ตั๋วชั่งน้ำหนัก
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('FINANCE')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    activeTab === 'FINANCE' ? 'bg-white text-indigo-800 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  💰 การเงิน &amp; หักค่างวด
                </button>
              </div>
            </div>

            {/* Scrollable Form Body */}
            <form id="viewEditForm" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              
              {/* Notice Banner */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-2.5 text-amber-900 text-xs flex items-start space-x-2">
                <span className="text-base shrink-0">💡</span>
                <div>
                  <span className="font-bold">ตรวจสอบควบคู่กับภาพบิลทางซ้าย:</span> สามารถแก้ไขตัวเลขและข้อความได้ทุกช่อง ระบบจะคำนวณน้ำหนักสุทธิ ผลต่างน้ำหนัก และยอดเงินคงค้างให้อัตโนมัติทันที
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* SECTION 1: ข้อมูลหัวบิล & การอ้างอิงเอกสาร (คอลัมน์ 1 - 9) */}
              {/* ------------------------------------------------------------- */}
              {(activeTab === 'ALL') && (
                <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>1. ข้อมูลหัวบิล &amp; การอ้างอิงเอกสาร (คอลัมน์ 1-9)</span>
                    </h4>
                    <span className="font-mono text-slate-400 text-[11px]">ID: {formData.id}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-blue-900 mb-0.5">
                        📁 โครงการก่อสร้าง (Project):
                      </label>
                      <select 
                        value={formData.projectId || ''} 
                        onChange={e => {
                          const selectedPrj = projects.find(p => p.id === e.target.value);
                          setFormData({ 
                            ...formData, 
                            projectId: e.target.value,
                            projectName: selectedPrj ? selectedPrj.code : ''
                          });
                        }}
                        className="w-full border border-blue-300 rounded px-2.5 py-1.5 bg-blue-50/50 font-bold text-blue-950 focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">-- ไม่ระบุโครงการ (ส่วนกลาง) --</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.code} ({p.name})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-0.5">2. หมวดหมู่วัสดุ:</label>
                      <input 
                        type="text" 
                        value={formData.category} 
                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-medium focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="เช่น หินฝุ่น / วัสดุก่อสร้าง"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-0.5">
                        5. เลขที่บิล / DO (*หลัก):
                      </label>
                      <input 
                        type="text" 
                        required
                        value={formData.doNo} 
                        onChange={e => setFormData({ ...formData, doNo: e.target.value })}
                        className="w-full border border-blue-300 rounded px-2.5 py-1.5 bg-blue-50/50 font-mono font-bold text-blue-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="เช่น 690920/00048"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-0.5">6. วันที่บนบิล:</label>
                      <input 
                        type="date" 
                        value={formData.date} 
                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-mono focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-0.5">3. เลขที่ PO อ้างอิง:</label>
                      <input 
                        type="text" 
                        value={formData.poNo} 
                        onChange={e => setFormData({ ...formData, poNo: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-mono focus:ring-1 focus:ring-blue-500"
                        placeholder="เช่น PO-69020 หรือ -"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-0.5">4. เลขที่ใบตรวจรับ (RR):</label>
                      <input 
                        type="text" 
                        value={formData.rrNo} 
                        onChange={e => setFormData({ ...formData, rrNo: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-mono focus:ring-1 focus:ring-blue-500"
                        placeholder="เช่น RR-1020 หรือ -"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-0.5">9. ทะเบียนรถขนส่ง:</label>
                      <input 
                        type="text" 
                        value={formData.vehicleReg} 
                        onChange={e => setFormData({ ...formData, vehicleReg: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-amber-50/50 font-mono font-bold text-slate-900 focus:ring-1 focus:ring-blue-500"
                        placeholder="เช่น 83-0790 บุรีรัมย์"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-0.5">7. ผู้จำหน่าย / แพลนท์ / ร้านค้า:</label>
                      <input 
                        type="text" 
                        required
                        value={formData.supplier} 
                        onChange={e => setFormData({ ...formData, supplier: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-bold text-slate-800 focus:ring-1 focus:ring-blue-500"
                        placeholder="เช่น RNK-SURIN, สหพาณิชย์, คิวมิกซ์"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-0.5">8. ผู้รับเหมาหลัก (ผู้ซื้อ):</label>
                      <input 
                        type="text" 
                        value={formData.contractor} 
                        onChange={e => setFormData({ ...formData, contractor: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-slate-50 text-slate-600 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SECTION 2: รายการสินค้า & สเปก (คอลัมน์ 10 - 11) */}
              {/* ------------------------------------------------------------- */}
              {(activeTab === 'ALL') && (
                <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-2xs space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs border-b border-slate-100 pb-2">
                    📦 2. รายการวัสดุ &amp; สเปกงานทาง (คอลัมน์ 10-11)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-0.5">10. รายการสินค้า / วัสดุ (*):</label>
                      <input 
                        type="text" 
                        required
                        value={formData.itemDesc} 
                        onChange={e => setFormData({ ...formData, itemDesc: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-bold text-slate-900 focus:ring-1 focus:ring-blue-500"
                        placeholder="เช่น หินฝุ่น (43.78 คิว), เหล็กฉาก, คอนกรีต Paver 35 Mpa"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-0.5">11. สเปก / มาตรฐาน มอก. / ทางหลวง:</label>
                      <input 
                        type="text" 
                        value={formData.spec} 
                        onChange={e => setFormData({ ...formData, spec: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800 focus:ring-1 focus:ring-blue-500"
                        placeholder="เช่น นน./คิว 1,600 กก., Slump 5.0 ซม., มอก.ชั้น 3"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SECTION 3: ระบบชั่งน้ำหนัก & การกระทบยอดผลต่าง (คอลัมน์ 12 - 20) */}
              {/* ------------------------------------------------------------- */}
              {(activeTab === 'ALL' || activeTab === 'WEIGHT') && (
                <div className="bg-white rounded-lg border border-teal-200 p-3.5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-teal-100 pb-2">
                    <h4 className="font-bold text-teal-950 text-xs flex items-center space-x-1.5">
                      <span>⚖️ 3. ระบบชั่งน้ำหนักต้นทาง-ปลายทาง &amp; ผลต่าง (คอลัมน์ 12-20)</span>
                    </h4>
                    <span className="text-[11px] text-teal-700 font-medium">คำนวณสุทธิและผลต่างอัตโนมัติ</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* ต้นทาง (12-14) */}
                    <div className="bg-teal-50/60 p-3 rounded-lg border border-teal-200 space-y-2">
                      <div className="font-bold text-teal-900 text-xs border-b border-teal-200/80 pb-1 flex justify-between">
                        <span>น้ำหนักต้นทาง (โรงโม่ / ร้านค้า)</span>
                        <span className="text-teal-700">คอลัมน์ 12-14</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-0.5">12. ชั่งหนัก (กก.):</label>
                          <input 
                            type="number" 
                            value={formData.originGross || ''} 
                            onChange={e => setFormData({ ...formData, originGross: parseFloat(e.target.value) || 0 })}
                            className="w-full border border-slate-300 rounded px-2 py-1 bg-white font-mono text-right"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-0.5">13. ชั่งเบา (กก.):</label>
                          <input 
                            type="number" 
                            value={formData.originTare || ''} 
                            onChange={e => setFormData({ ...formData, originTare: parseFloat(e.target.value) || 0 })}
                            className="w-full border border-slate-300 rounded px-2 py-1 bg-white font-mono text-right"
                            placeholder="0"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-1.5 border-t border-teal-200/60 text-xs">
                        <span className="font-semibold text-teal-900">14. สุทธิ ต้นทาง:</span>
                        <span className="font-mono font-bold text-teal-800 text-sm">
                          {calcOriginNet > 0 ? `${calcOriginNet.toFixed(3)} ตัน` : '-'}
                        </span>
                      </div>
                    </div>

                    {/* ปลายทาง (15-20) */}
                    <div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-200 space-y-2">
                      <div className="font-bold text-emerald-900 text-xs border-b border-emerald-200/80 pb-1 flex justify-between">
                        <span>น้ำหนักปลายทาง (ตาชั่ง BTC หน้างาน)</span>
                        <span className="text-emerald-700">คอลัมน์ 15-20</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-0.5">16. เลขตั๋วปลายทาง:</label>
                          <input 
                            type="text" 
                            value={formData.destTicketNo} 
                            onChange={e => setFormData({ ...formData, destTicketNo: e.target.value })}
                            className="w-full border border-slate-300 rounded px-2 py-1 bg-white font-mono font-bold text-emerald-800"
                            placeholder="เช่น 48661 หรือ -"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-0.5">15. วันที่ชั่งปลายทาง:</label>
                          <input 
                            type="text" 
                            value={formData.destDate} 
                            onChange={e => setFormData({ ...formData, destDate: e.target.value })}
                            className="w-full border border-slate-300 rounded px-2 py-1 bg-white font-mono text-xs"
                            placeholder="2026-09-20 หรือ -"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-0.5">17. ชั่งหนัก ปลายทาง (กก.):</label>
                          <input 
                            type="number" 
                            value={formData.destGross || ''} 
                            onChange={e => setFormData({ ...formData, destGross: parseFloat(e.target.value) || 0 })}
                            className="w-full border border-slate-300 rounded px-2 py-1 bg-white font-mono text-right"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-0.5">18. ชั่งเบา ปลายทาง (กก.):</label>
                          <input 
                            type="number" 
                            value={formData.destTare || ''} 
                            onChange={e => setFormData({ ...formData, destTare: parseFloat(e.target.value) || 0 })}
                            className="w-full border border-slate-300 rounded px-2 py-1 bg-white font-mono text-right"
                            placeholder="0"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-1.5 border-t border-emerald-200/60 text-xs">
                        <span className="font-semibold text-emerald-900">19. สุทธิ ปลายทาง:</span>
                        <span className="font-mono font-bold text-emerald-800 text-sm">
                          {calcDestNet > 0 ? `${calcDestNet.toFixed(3)} ตัน` : '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Weight Difference Indicator Box (คอลัมน์ 20) */}
                  <div className={`p-3 rounded-lg border flex items-center justify-between transition-colors ${
                    isWeightAlert 
                      ? 'bg-rose-50 border-rose-300 text-rose-900' 
                      : calcDestNet > 0 
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
                      : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}>
                    <div className="flex items-center space-x-2">
                      {isWeightAlert ? (
                        <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                      ) : calcDestNet > 0 ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      ) : (
                        <Clock className="w-5 h-5 text-slate-400 shrink-0" />
                      )}
                      <div>
                        <div className="font-bold text-xs">
                          {calcDestNet > 0 
                            ? (isWeightAlert ? '⚠️ ผลต่างน้ำหนักผิดปกติเกินเกณฑ์ (คอลัมน์ 20)' : '✅ ผลต่างน้ำหนักอยู่ในเกณฑ์ปกติ (คอลัมน์ 20)')
                            : 'ยังไม่มีตั๋วชั่งปลายทางเพื่อเปรียบเทียบ'}
                        </div>
                        <div className="text-[11px] opacity-80">
                          {calcDestNet > 0 
                            ? `ปลายทาง ${calcDestNet.toFixed(3)} ตัน - ต้นทาง ${calcOriginNet.toFixed(3)} ตัน`
                            : 'หากสินค้าไม่ใช้ตาชั่ง (เช่น คอนกรีต/เหล็ก) หรือยังไม่ชั่งปลายทาง ให้เว้น 0 หรือ -'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] font-medium text-slate-500">20. ผลต่างน้ำหนัก (กก.):</div>
                      <div className={`font-mono text-base font-bold ${
                        isWeightAlert ? 'text-rose-700' : calcDestNet > 0 ? 'text-emerald-700' : 'text-slate-500'
                      }`}>
                        {calcDestNet > 0 ? `${calcWeightDiff > 0 ? '+' : ''}${calcWeightDiff.toLocaleString()} กก.` : '-'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SECTION 4: ปริมาณ ราคา และค่าขนส่ง (คอลัมน์ 21 - 28) */}
              {/* ------------------------------------------------------------- */}
              {(activeTab === 'ALL' || activeTab === 'FINANCE') && (
                <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="font-bold text-slate-800 text-xs">
                      💰 4. ปริมาณ ราคา และค่าบรรทุกขนส่ง (คอลัมน์ 21-28)
                    </h4>
                    <span className="text-[11px] text-slate-500 font-mono">คำนวณรวมเงินอัตโนมัติ</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-0.5">21. ปริมาณ (*):</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        required
                        value={formData.qty || ''} 
                        onChange={e => setFormData({ ...formData, qty: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-mono text-right font-bold text-slate-900 focus:ring-1 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-0.5">22. หน่วยนับ:</label>
                      <input 
                        type="text" 
                        value={formData.unit} 
                        onChange={e => setFormData({ ...formData, unit: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-center focus:ring-1 focus:ring-blue-500"
                        placeholder="เช่น ตัน, คิว, เส้น"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-0.5">23. ราคา/หน่วย (บาท):</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={formData.pricePerUnit || ''} 
                        onChange={e => setFormData({ ...formData, pricePerUnit: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-indigo-300 rounded px-2.5 py-1.5 bg-indigo-50/40 font-mono text-right font-bold text-indigo-700 focus:ring-1 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-0.5">24. ค่าสินค้า (บาท):</label>
                      <div className="w-full border border-slate-200 rounded px-2.5 py-1.5 bg-slate-100 font-mono text-right font-bold text-slate-800">
                        ฿{calcTotalMaterial.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-0.5">25. ประเภทรถขนส่ง:</label>
                      <input 
                        type="text" 
                        value={formData.transportType} 
                        onChange={e => setFormData({ ...formData, transportType: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
                        placeholder="เช่น สิบล้อพ่วง, รถโม่"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-0.5">26. ค่าบรรทุก/หน่วย:</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={formData.freightRate || ''} 
                        onChange={e => setFormData({ ...formData, freightRate: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-mono text-right focus:ring-1 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-0.5">27. ค่าขนส่งรวม (บาท):</label>
                      <div className="w-full border border-slate-200 rounded px-2.5 py-1.5 bg-slate-100 font-mono text-right font-bold text-slate-800">
                        ฿{calcTotalFreight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-blue-900 mb-0.5">28. รวมเงินทั้งสิ้น (บาท):</label>
                      <div className="w-full border border-blue-300 rounded px-2.5 py-1.5 bg-blue-50 font-mono text-right font-bold text-blue-900 text-sm">
                        ฿{calcGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SECTION 5: การชำระเงิน & หนี้ค้างชำระ (คอลัมน์ 29 - 35) */}
              {/* ------------------------------------------------------------- */}
              {(activeTab === 'ALL' || activeTab === 'FINANCE') && (
                <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-2xs space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs border-b border-slate-100 pb-2">
                    💳 5. การชำระเงิน &amp; ยอดหนี้ค้างชำระ (คอลัมน์ 29-35)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-0.5">29. รูปแบบการชำระเงิน:</label>
                      <input 
                        type="text" 
                        value={formData.paymentMethod} 
                        onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                        placeholder="เช่น เครดิต 30 วัน, เงินสด"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-0.5">30. จ่ายผู้ขายแล้ว (30):</label>
                      <input 
                        type="number" 
                        value={formData.paidSupplier || ''} 
                        onChange={e => setFormData({ ...formData, paidSupplier: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-mono text-right text-emerald-700 font-bold"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-0.5">32. จ่ายขนส่งแล้ว (32):</label>
                      <input 
                        type="number" 
                        value={formData.paidHauler || ''} 
                        onChange={e => setFormData({ ...formData, paidHauler: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-mono text-right text-emerald-700 font-bold"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                    <div className="bg-slate-50 p-2 rounded border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">31. ค้างจ่ายผู้ขาย:</span>
                      <strong className="font-mono text-amber-700">฿{calcBalanceSupplier.toLocaleString()}</strong>
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-200">
                      <span className="text-slate-500 block text-[11px]">33. ค้างจ่ายขนส่ง:</span>
                      <strong className="font-mono text-amber-700">฿{calcBalanceHauler.toLocaleString()}</strong>
                    </div>
                    <div className="bg-emerald-50 p-2 rounded border border-emerald-200">
                      <span className="text-emerald-700 block text-[11px]">34. รวมจ่ายแล้ว:</span>
                      <strong className="font-mono text-emerald-800">฿{calcTotalPaid.toLocaleString()}</strong>
                    </div>
                    <div className="bg-rose-50 p-2 rounded border border-rose-200">
                      <span className="text-rose-700 block text-[11px] font-bold">35. คงค้างสุทธิ:</span>
                      <strong className="font-mono text-rose-800 text-sm font-bold">฿{calcTotalOutstanding.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SECTION 6: การหักเงินผู้รับเหมาช่วง (Subcontractor Backcharge) */}
              {/* ------------------------------------------------------------- */}
              {(activeTab === 'ALL' || activeTab === 'FINANCE') && (
                <div className="bg-purple-50/70 border border-purple-300 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-center space-x-2">
                    <input 
                      type="checkbox" 
                      id="subcontractorCheck"
                      checked={!!formData.isSubcontractorDeduction}
                      onChange={e => setFormData({ ...formData, isSubcontractorDeduction: e.target.checked })}
                      className="rounded border-purple-400 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="subcontractorCheck" className="font-bold text-purple-950 text-xs flex items-center space-x-1 cursor-pointer">
                      <Scissors className="w-3.5 h-3.5 text-purple-700" />
                      <span>ซื้อวัสดุให้ผู้รับเหมาช่วง (ต้องนำไปหักเงินค่างวดงาน Subcontractor)</span>
                    </label>
                  </div>

                  {formData.isSubcontractorDeduction && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-purple-200">
                      <div>
                        <label className="block text-[11px] font-bold text-purple-900 mb-0.5">
                          ชื่อช่าง / ผู้รับเหมาช่วงที่ถูกหักเงิน:
                        </label>
                        <input 
                          type="text" 
                          value={formData.subcontractorName || ''} 
                          onChange={e => setFormData({ ...formData, subcontractorName: e.target.value })}
                          placeholder="เช่น ช่างโก้ (ทีมวางท่อระบายน้ำ)"
                          className="w-full border border-purple-300 rounded px-2.5 py-1.5 bg-white font-semibold text-purple-950 focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-purple-900 mb-0.5">
                          งวดงานที่ต้องนำไปหักเงิน:
                        </label>
                        <input 
                          type="text" 
                          value={formData.subcontractorWorkPeriod || ''} 
                          onChange={e => setFormData({ ...formData, subcontractorWorkPeriod: e.target.value })}
                          placeholder="เช่น งวดที่ 2 / ก.ย. 69"
                          className="w-full border border-purple-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-purple-900 mb-0.5">
                          ยอดเงินวัสดุที่ต้องนำไปหัก (คอลัมน์ 24):
                        </label>
                        <div className="w-full border border-purple-300 rounded px-2.5 py-1.5 bg-purple-100/80 font-mono text-right font-bold text-rose-700 text-sm">
                          ฿{calcTotalMaterial.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SECTION 7: หน้างาน & หมายเหตุ (คอลัมน์ 36 - 37) */}
              {/* ------------------------------------------------------------- */}
              {(activeTab === 'ALL') && (
                <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-2xs space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs border-b border-slate-100 pb-2">
                    📍 6. สถานที่ส่งมอบ &amp; บันทึกประวัติ (คอลัมน์ 36-37)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-0.5">36. งาน/กม./ตำแหน่งลงของ:</label>
                      <input 
                        type="text" 
                        value={formData.jobStation} 
                        onChange={e => setFormData({ ...formData, jobStation: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
                        placeholder="เช่น ทางหลวง 24 อ.ปราสาท - กม.2"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-0.5">37. หมายเหตุ &amp; บันทึกตรวจรับ:</label>
                      <input 
                        type="text" 
                        value={formData.remarks} 
                        onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-blue-500"
                        placeholder="บันทึกข้อความหน้างาน ลายมือ หรือเหตุผลน้ำหนักขาด"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Status Selector */}
              <div className="bg-slate-100 p-3 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-700 text-xs">สถานะการกระทบยอด (Status):</span>
                  <select 
                    value={formData.status} 
                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                    className={`font-bold text-xs rounded px-2.5 py-1 border ${
                      formData.status === 'MATCHED' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                      formData.status === 'ALERT' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                      'bg-amber-100 text-amber-800 border-amber-300'
                    }`}
                  >
                    <option value="MATCHED">● MATCHED (ชนบิลสมบูรณ์)</option>
                    <option value="ALERT">▲ ALERT (ตรวจพบน้ำหนักขาดเกินผิดปกติ)</option>
                    <option value="PENDING">○ PENDING (รอตั๋วชั่งปลายทาง/รอชนบิล)</option>
                  </select>
                </div>
                <div className="text-[11px] text-slate-500">
                  {formData.status === 'MATCHED' ? 'พร้อมตั้งเบิกและวางบิลในระบบบัญชี Express' :
                   formData.status === 'ALERT' ? 'ระงับจ่ายชั่วคราว รอตรวจส่วนต่างน้ำหนัก' : 'อยู่ระหว่างรอตั๋วปลายทางหน้างาน'}
                </div>
              </div>

            </form>

            {/* Bottom Action Footer */}
            <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <span>บันทึกล่าสุด: {new Date().toLocaleTimeString('th-TH')}</span>
              </div>

              <div className="flex items-center space-x-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                >
                  ปิดหน้าต่าง
                </button>
                <button
                  type="submit"
                  form="viewEditForm"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>บันทึกการแก้ไข</span>
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
