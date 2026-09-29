import React, { useState } from 'react';
import { 
  X, Plus, Building2, FolderKanban, Check, Trash2, Edit3, 
  MapPin, FileText, DollarSign, PieChart, Layers
} from 'lucide-react';
import { Project, RecordItem } from '../types';

interface ProjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  records: RecordItem[];
  currentProjectId: string;
  onSelectProject: (projectId: string) => void;
  onAddProject: (project: Project) => void;
  onUpdateProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
}

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
  isOpen,
  onClose,
  projects,
  records,
  currentProjectId,
  onSelectProject,
  onAddProject,
  onUpdateProject,
  onDeleteProject
}) => {
  if (!isOpen) return null;

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  // Form state
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formClient, setFormClient] = useState('กรมทางหลวง (DOH)');
  const [formContractNo, setFormContractNo] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formBudget, setFormBudget] = useState<number>(0);
  const [formColor, setFormColor] = useState('blue');

  const resetForm = () => {
    setFormCode('');
    setFormName('');
    setFormClient('กรมทางหลวง (DOH)');
    setFormContractNo('');
    setFormLocation('');
    setFormBudget(0);
    setFormColor('blue');
    setIsAddingNew(false);
    setEditingProjectId(null);
  };

  const handleStartEdit = (p: Project) => {
    setEditingProjectId(p.id);
    setIsAddingNew(true);
    setFormCode(p.code);
    setFormName(p.name);
    setFormClient(p.client);
    setFormContractNo(p.contractNo);
    setFormLocation(p.location);
    setFormBudget(p.budget);
    setFormColor(p.color || 'blue');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim() || !formName.trim()) {
      alert('กรุณากรอกรหัสย่อโครงการและชื่อโครงการ');
      return;
    }

    if (editingProjectId) {
      const updated: Project = {
        id: editingProjectId,
        code: formCode.trim(),
        name: formName.trim(),
        client: formClient.trim(),
        contractNo: formContractNo.trim(),
        location: formLocation.trim(),
        budget: formBudget || 0,
        color: formColor
      };
      onUpdateProject(updated);
    } else {
      const newId = `PRJ-${Date.now().toString().slice(-6)}`;
      const newPrj: Project = {
        id: newId,
        code: formCode.trim(),
        name: formName.trim(),
        client: formClient.trim(),
        contractNo: formContractNo.trim(),
        location: formLocation.trim(),
        budget: formBudget || 0,
        color: formColor
      };
      onAddProject(newPrj);
    }
    resetForm();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-300 font-sans animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-amber-500 rounded-lg text-slate-950 shadow-xs">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100 flex items-center space-x-2">
                <span>จัดการโครงการก่อสร้าง (Multi-Project Management)</span>
                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-normal">
                  {projects.length} โครงการ
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                สลับดูบิล แยกงบประมาณ และกระทบยอดตั๋ววัสดุแยกตามแต่ละสัญญาโครงการ
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50 space-y-4">
          
          {/* Top Actions: Add Project Button or Form */}
          {!isAddingNew ? (
            <div className="flex justify-between items-center bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div>
                <span className="font-bold text-xs text-slate-800 block">เลือกโครงการที่ต้องการทำงาน:</span>
                <span className="text-[11px] text-slate-500">คลิกที่โครงการเพื่อกรองตารางหลักและคำนวณยอดเงินเฉพาะโครงการนั้น</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setIsAddingNew(true);
                }}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มโครงการใหม่</span>
              </button>
            </div>
          ) : (
            /* Add / Edit Form */
            <form onSubmit={handleSave} className="bg-white p-4 sm:p-5 rounded-xl border-2 border-blue-200 shadow-md space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="font-bold text-sm text-blue-900 flex items-center space-x-1.5">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>{editingProjectId ? 'แก้ไขข้อมูลโครงการ' : 'สร้างโครงการก่อสร้างใหม่'}</span>
                </h4>
                <button 
                  type="button" 
                  onClick={resetForm} 
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  ยกเลิก
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">รหัสย่อโครงการ (*):</label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={e => setFormCode(e.target.value)}
                    placeholder="เช่น ทล.24 ตอน 2 หรือ สะพาน บร.3001"
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-bold text-blue-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-0.5">ชื่อเต็มโครงการ (*):</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="เช่น งานก่อสร้างขยาย ทล.24 สายปราสาท - สังขะ ตอน 2"
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">หน่วยงานเจ้าของโครงการ (Client):</label>
                  <input
                    type="text"
                    value={formClient}
                    onChange={e => setFormClient(e.target.value)}
                    placeholder="เช่น กรมทางหลวง (DOH), DRR, อบจ."
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">เลขที่สัญญาจ้าง:</label>
                  <input
                    type="text"
                    value={formContractNo}
                    onChange={e => setFormContractNo(e.target.value)}
                    placeholder="เช่น สพ.12/2567"
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">งบประมาณโครงการ (บาท):</label>
                  <input
                    type="number"
                    value={formBudget || ''}
                    onChange={e => setFormBudget(parseFloat(e.target.value) || 0)}
                    placeholder="เช่น 540000000"
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-mono text-right"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-0.5">สถานที่ตั้งโครงการ / กม.:</label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={e => setFormLocation(e.target.value)}
                    placeholder="เช่น ทล.24 กม.145+000 - 180+000 จ.สุรินทร์"
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">ธีมสีสัญลักษณ์:</label>
                  <select
                    value={formColor}
                    onChange={e => setFormColor(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-medium"
                  >
                    <option value="blue">🟦 น้ำเงิน (Blue - งานทางหลวง DOH)</option>
                    <option value="emerald">🟩 เขียวมรกต (Emerald - ทางหลวงชนบท DRR)</option>
                    <option value="amber">🟨 ทอง/ส้ม (Amber - เทศบาล/ผังเมือง)</option>
                    <option value="purple">🟪 ม่วง (Purple - อบจ./ระบายน้ำ)</option>
                    <option value="rose">🟥 แดงกุหลาบ (Rose - งานเร่งด่วน)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingProjectId ? 'บันทึกการแก้ไข' : 'บันทึกสร้างโครงการ'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Project List Cards */}
          {projects.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 text-slate-500 space-y-3">
              <FolderKanban className="w-10 h-10 mx-auto text-slate-400" />
              <div>
                <h4 className="font-bold text-slate-800 text-sm">ยังไม่มีโครงการในระบบ (ล้างข้อมูลตัวอย่างหมดแล้ว)</h4>
                <p className="text-xs text-slate-500 mt-1">คุณสามารถเริ่มเพิ่มโครงการก่อสร้างจริงของคุณได้ทันที</p>
              </div>
              <button
                type="button"
                onClick={() => { resetForm(); setIsAddingNew(true); }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer inline-flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>+ สร้างโครงการจริงแรกของคุณ</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {projects.map(p => {
              const projectRecords = records.filter(r => r.projectId === p.id);
              const totalBills = projectRecords.length;
              const totalMaterialSpent = projectRecords.reduce((sum, r) => sum + (r.totalMaterial || 0), 0);
              const totalFreightSpent = projectRecords.reduce((sum, r) => sum + (r.totalFreight || 0), 0);
              const totalSpent = totalMaterialSpent + totalFreightSpent;
              const alertCount = projectRecords.filter(r => r.status === 'ALERT').length;
              const isSelected = currentProjectId === p.id;

              return (
                <div 
                  key={p.id}
                  className={`rounded-xl border p-4 bg-white shadow-2xs transition-all relative ${
                    isSelected 
                      ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded-md font-bold text-xs ${
                        p.color === 'emerald' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        p.color === 'amber' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        p.color === 'purple' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                        p.color === 'rose' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                        'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {p.code}
                      </span>
                      {isSelected && (
                        <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          เลือกใช้งานอยู่
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(p)}
                        className="p-1 text-slate-400 hover:text-amber-600 rounded hover:bg-slate-100"
                        title="แก้ไขข้อมูลโครงการ"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {projects.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`ยืนยันการลบโครงการ "${p.code}" หรือไม่? (บิลที่มีอยู่จะไม่ถูกลบ แต่จะถูกเปลี่ยนเป็นโครงการส่วนกลาง)`)) {
                              onDeleteProject(p.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100"
                          title="ลบโครงการ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h4 className="font-bold text-sm text-slate-900 mt-2 line-clamp-1" title={p.name}>
                    {p.name}
                  </h4>

                  <div className="space-y-1 text-xs text-slate-600 mt-2">
                    <div className="flex items-center space-x-1.5 text-[11px]">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{p.client} {p.contractNo ? `(สัญญา ${p.contractNo})` : ''}</span>
                    </div>
                    {p.location && (
                      <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{p.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Financial & Bills Stats */}
                  <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">จำนวนเอกสารบิล:</span>
                      <div className="flex items-center space-x-1 font-bold">
                        <span className="text-slate-800">{totalBills} ใบ</span>
                        {alertCount > 0 && (
                          <span className="text-[10px] bg-rose-100 text-rose-700 px-1 rounded">
                            {alertCount} ALERT
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-2 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">เบิกจ่ายวัสดุ &amp; ขนส่ง:</span>
                      <strong className="text-blue-900 font-mono text-[11px]">
                        ฿{totalSpent.toLocaleString()}
                      </strong>
                    </div>
                  </div>

                  {/* Select button */}
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectProject(p.id);
                        onClose();
                      }}
                      className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        isSelected 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700'
                      }`}
                    >
                      {isSelected ? '✓ กรองตารางดูเฉพาะโครงการนี้' : 'สลับดูกระทบยอดโครงการนี้'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onSelectProject('ALL');
              onClose();
            }}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center space-x-1.5"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>แสดงข้อมูลรวมทุกโครงการ (All Projects)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
};
