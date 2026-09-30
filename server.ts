import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '20mb' }));

const ai = new GoogleGenAI({});

// Optional server-side Supabase client for auto-persisting sync logs
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServerClient = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Shared function for AI Document Parsing & Classification (Gemini with Resilient Fallback)
async function performBillAiExtraction(
  cleanBase64: string, 
  mimeType: string = 'image/jpeg',
  contextInfo?: { fileName?: string; folderPath?: string }
) {
  const folderContextText = contextInfo?.folderPath 
    ? `\n\n📌 ข้อมูลโครงสร้างโฟลเดอร์ที่เก็บไฟล์ใน Google Drive (Multi-layer Path):\n- โฟลเดอร์ซ้อนหลายชั้น: "${contextInfo.folderPath}"\n- ชื่อไฟล์ต้นฉบับ: "${contextInfo.fileName || ''}"\n(คำแนะนำ AI: โปรดนำชื่อโฟลเดอร์แต่ละชั้น เช่น ชื่อโครงการ, หมวดวัสดุ, ชื่อผู้จำหน่าย หรือช่างผู้รับเหมาช่วง มาร่วมวิเคราะห์ยืนยันกับภาพจริง เพื่อให้ได้หมวดหมู่และประเภทเอกสารที่ถูกต้องที่สุด)` 
    : '';

  // 🔒 ล็อกโมเดลเดียวตามนโยบายของระบบ: gemini-3.1-flash-lite
  // เหตุผล: ป้องกันการอ่านข้อมูล"ไม่เหมือนเดิม"เมื่อมีการเปลี่ยนรุ่นโมเดล
  // (เดิมลองหลายโมเดล: ถ้าโมเดลหลักโควต้าเต็มชั่วคราว ระบบจะสลับไปโมเดลอื่น → ผลการอ่านอาจเพี้ยนข้ามรุ่น)
  // หากโมเดลนี้ล้มเหลว → ใช้ fallback จากชื่อไฟล์ + ติดธง needsReview ให้ผู้ใช้ตรวจเอง แทนการเดาด้วยโมเดลอื่น
  const candidateModels = ['gemini-3.1-flash-lite'];
  
  for (const modelName of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: mimeType
              }
            },
            {
              text: `คุณคือผู้เชี่ยวชาญด้านการตรวจสอบและคัดแยกเอกสารงานจัดซื้อ ตั๋วชั่ง และบัญชีวิศวกรรมโยธา
บริษัทผู้ซื้อ (เจ้าของระบบ): "บจก. บุรีรัมย์ธงชัยก่อสร้าง" (BTC)
ลักษณะธุรกิจ: ผู้รับเหมาชั้นพิเศษ ก่อสร้างโครงสร้างพื้นฐานขนาดใหญ่ งานกรมทางหลวง (DOH), ทางหลวงชนบท (DRR)
ประเภทโครงการหลัก: งานก่อสร้างขยายถนนสายหลัก (ทล.), สะพานคอนกรีตอัดแรง/สะพานเหล็ก, อุโมงค์ทางลอด, สะพานทางยกระดับ (Flyover), ระบบระบายน้ำขนาดใหญ่ และงานผิวทางคอนกรีต/แอสฟัลต์${folderContextText}

โปรดวิเคราะห์ภาพเอกสารนี้อย่างละเอียด และแยกแยะตามมาตรฐานงานกรมทางหลวง:
1. แหล่งที่มาของเอกสาร (issuer):
   - 'BUYER_INTERNAL': เอกสารที่ออกจากบริษัทผู้ซื้อเอง (บจก. บุรีรัมย์ธงชัยก่อสร้าง) เช่น ใบสั่งเขียนมือของช่างหน้างาน, ใบชั่งน้ำหนักปลายทางหน้างานของ BTC, ใบตรวจรับของ (RR)
   - 'SUPPLIER_DO': บิลที่ออกจากร้านค้า/โรงโม่/โรงงาน/ผู้จำหน่ายภายนอก (เช่น บิลโรงโม่หิน, บิลแพลนท์ยาง AC, บิลโรงคอนกรีต Qmix, ร้านเหล็ก, คลังน้ำมัน)

2. จำแนกประเภทเอกสาร (billType):
   - 'SUPPLIER': บิลส่งของ/ใบแจ้งหนี้/ใบจ่ายสินค้า จากร้านค้า/โรงโม่ (DO ต้นทาง)
   - 'DEST_WEIGHT': ตั๋วใบชั่งน้ำหนักหน้างานปลายทาง (ออกโดยตาชั่ง บจก. บุรีรัมย์ธงชัยก่อสร้าง)
   - 'PO': ใบสั่งซื้อ หรือ ใบสั่งจ่ายของภายใน (เช่น ใบสั่งเล่ม BTC)
   - 'RR': ใบตรวจรับพัสดุหน้างาน (Receiving Report)

3. จัดหมวดหมู่วัสดุตามมาตรฐานงานทางหลวง (category):
   ให้วิเคราะห์จากชื่อรายการสินค้าและสเปก แล้วจัดหมวดหมู่ให้ตรงกับโครงสร้างงานกรมทางหลวง เช่น:
   - 'งานดินและคันทาง (Earthwork)': ดินถมคันทาง, ดินลูกรังคัดเลือก (Select Material), วัสดุกรอง (Geotextile/Drainage)
   - 'งานชั้นรองพื้นทางและพื้นทาง (Subbase & Base)': หินคลุก (Crushed Rock Base), หินผุ, หินลูกรัง, ดินซีเมนต์
   - 'งานผิวทางแอสฟัลต์ (Asphalt Pavement)': แอสฟัลต์คอนกรีต (Wearing Course, Binder Course), Prime Coat, Tack Coat, Slurry Seal
   - 'งานผิวทางและโครงสร้างคอนกรีต (Concrete & Paver)': คอนกรีต Paver 35 Mpa (สำหรับผิวทาง Concrete Pavement), Lean Concrete, คอนกรีตโครงสร้างสะพาน 30-45 Mpa
   - 'งานสะพาน ทางยกระดับ และอุโมงค์ (Bridge & Structures)': คานสะพาน (Girder/Plank), แบริเออร์คอนกรีต, เสาเข็มคอนกรีตอัดแรง (Spun/I-Pile), พรีสเตรส ลวดสลิง PC Strand, ยางรองคานสะพาน (Bearing Pad), Expansion Joint
   - 'งานเหล็กเสริมและเหล็กรูปพรรณ (Reinforcing Steel)': เหล็กข้ออ้อย (DB), เหล็กเส้นกลม (RB), ลวดผูกเหล็ก, ตะแกรงเหล็ก Wire Mesh, แผ่นชีทไพล์ (Sheet Pile)
   - 'งานระบบระบายน้ำทางหลวง (Drainage System)': ท่อ คสล. คมล. (มอก.ชั้น 2, 3), บ่อพักสำเร็จรูป (Manhole), รางระบายน้ำรูปตัว U, ฝาตะแกรงเหล็ก
   - 'งานไฟฟ้า ป้าย และความปลอดภัยทางหลวง (Traffic Safety)': เสาไฟกิ่งทางหลวง, การ์ดเรล (Guardrail ราวเหล็กลูกฟูก), ป้ายจราจร, สีตีเส้นเทอร์โมพลาสติก, หมุดสะท้อนแสง
   - 'น้ำมันเชื้อเพลิงและพลังงาน (Fuel & Energy)': น้ำมันดีเซล B7 (สำหรับรถดั๊มพ์, รถแบคโฮ, รถบด, รถเกรดเดอร์, แพลนท์ผสม)
   - 'งานซ่อมบำรุง เครื่องจักร และวัสดุสิ้นเปลือง': อะไหล่, ฟันบุ้งกี๋, ใบมีดเกรดเดอร์, ลวดเชื่อม, ฮาร์ดแวร์ทั่วไป

4. ตรวจสอบการอ้างอิงถึงกัน (Reference Tracking):
   - หากเป็นบิลร้านค้า (DO): มีการอ้างถึงเลขที่ใบสั่ง PO ของผู้ซื้อหรือไม่?
   - หากเป็นตั๋วชั่งปลายทาง: ช่างหน้างานมีจดเลขที่ DO ของโรงโม่/ร้านค้ากำกับไว้หรือไม่ (เช่น ช่างจด DO 690920/00048 บนตั๋วชั่ง)?

5. ตรวจสอบการซื้อของให้ผู้รับเหมาช่วง (Subcontractor Backcharge Deduction):
   - มีข้อความ ลายมือ หรือชื่อช่าง/ผู้รับเหมาช่วง ที่ระบุว่าซื้อของให้ หรือให้หักเงินค่างวดหรือไม่ (เช่น 'ช่างโก้', 'หักเงินค่างวด', 'ซื้อให้ผู้รับเหมา', 'ช่างรับของ')?
   - ระบุ isSubcontractorDeduction (true/false) พร้อมชื่อผู้รับเหมาช่วง (subcontractorName)

6. ดึงข้อมูลฟิลด์สำคัญ:
   - docNo: เลขที่เอกสารหลักบนหัวใบ (เลขที่บิล DO, เลขที่ใบชั่ง, หรือเลขที่ PO)
   - refDocNo: เลขที่เอกสารที่อ้างอิงถึง
   - poRef: เลขที่ PO ที่อ้างอิง (ถ้ามี)
   - date: วันที่บนเอกสาร (YYYY-MM-DD หรือตามที่ปรากฏ)
   - supplier: ชื่อร้านค้า/ผู้จำหน่าย/โรงโม่/แพลนท์
   - vehicleReg: ทะเบียนรถขนส่ง
   - itemDesc: รายการสินค้า/วัสดุ
   - spec: สเปกงานทางหลวง เช่น Slump, กำลังอัด ksc/Mpa, ชนิดยาง AC, มาตรฐาน มอก. หรือ กม.หน้างาน
   - qty: ปริมาณ/จำนวน
   - unit: หน่วยนับ (ตัน, คิว, ลิตร, เส้น, ท่อน, ชุด, ตร.ม.)
   - grossWeight: น้ำหนักรวม/ชั่งหนัก (กก.)
   - tareWeight: น้ำหนักรถเปล่า/ชั่งเบา (กก.)
   - netWeight: น้ำหนักสุทธิ (ตัน หรือ กก.)
   - pricePerUnit: ราคาต่อหน่วย (ถ้ามี)
   - totalAmount: ยอดเงินรวม (ถ้ามี)
   - remarks: หมายเหตุ ลายมือจดท้ายใบ หรือข้อความตรวจรับหน้างาน (เช่น กม.ที่ลง, ชื่อช่างผู้ควบคุมงาน)`
            }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            issuer: {
              type: Type.STRING,
              description: "BUYER_INTERNAL (ออกจาก บจก.บุรีรัมย์ธงชัยฯ) หรือ SUPPLIER_DO (บิลร้านค้า)"
            },
            billType: { 
              type: Type.STRING, 
              description: "ประเภทเอกสาร: SUPPLIER, DEST_WEIGHT, PO, RR" 
            },
            category: {
              type: Type.STRING,
              description: "หมวดหมู่วัสดุที่ AI วิเคราะห์และจัดหมวดให้อัตโนมัติ เช่น หินฝุ่น, คอนกรีตผสมเสร็จ, เหล็ก, น้ำมันเชื้อเพลิง, ยางมะตอย ฯลฯ"
            },
            docNo: { type: Type.STRING, description: "เลขที่เอกสารหลัก" },
            refDocNo: { type: Type.STRING, description: "เลขที่เอกสารอื่นที่ใบนี้เขียนอ้างอิงถึง" },
            poRef: { type: Type.STRING, description: "เลขที่ PO อ้างอิง" },
            date: { type: Type.STRING, description: "วันที่" },
            supplier: { type: Type.STRING, description: "ชื่อผู้จำหน่าย/ร้านค้า" },
            vehicleReg: { type: Type.STRING, description: "ทะเบียนรถ" },
            itemDesc: { type: Type.STRING, description: "ชื่อสินค้า/วัสดุ" },
            spec: { type: Type.STRING, description: "สเปกวัสดุ หรือ มาตรฐาน มอก./ทล." },
            qty: { type: Type.NUMBER, description: "ปริมาณ" },
            unit: { type: Type.STRING, description: "หน่วยนับ" },
            grossWeight: { type: Type.NUMBER, description: "น้ำหนักชั่งหนัก (กก.)" },
            tareWeight: { type: Type.NUMBER, description: "น้ำหนักชั่งเบา (กก.)" },
            netWeight: { type: Type.NUMBER, description: "น้ำหนักสุทธิ" },
            pricePerUnit: { type: Type.NUMBER, description: "ราคาต่อหน่วย" },
            totalAmount: { type: Type.NUMBER, description: "ยอดเงินรวม" },
            isSubcontractorDeduction: { type: Type.BOOLEAN, description: "ซื้อวัสดุให้ผู้รับเหมาช่วงที่ต้องหักเงินค่างวดหรือไม่" },
            subcontractorName: { type: Type.STRING, description: "ชื่อช่างหรือผู้รับเหมาช่วงที่ต้องนำบิลนี้ไปหักค่างวดงาน" },
            remarks: { type: Type.STRING, description: "หมายเหตุบนใบ" }
          },
          required: ["issuer", "billType", "docNo", "itemDesc", "category"]
        }
      }
    });

      if (response.text) {
        return JSON.parse(response.text);
      }
    } catch (error: any) {
      console.warn(`⚠️ Model ${modelName} failed:`, error.message || error);
    }
  }

  // 🔒 นโยบาย "ห้ามเดา": หาก AI อ่านใบจริงไม่ได้ ห้ามใช้ข้อมูลจากชื่อไฟล์ (อาจไม่ตรงกับใบจริง)
  // ส่ง error กลับไปให้ caller ทราบและข้ามใบนั้นแทน (ผู้ใช้จะเห็นรายการที่ต้องสแกนซ้ำ)
  const aiError: any = new Error('AI_UNAVAILABLE: ไม่สามารถอ่านใบด้วย AI ได้ (โควต้าเต็ม/บริการไม่ตอบสนอง) — ระบบจะไม่เดาข้อมูลจากชื่อไฟล์');
  aiError.code = 'AI_UNAVAILABLE';
  throw aiError;
}

// API endpoint for OCR Document Parsing
app.post('/api/ocr-scan', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', fileName } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64' });
    }  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const parsedData = await performBillAiExtraction(cleanBase64, mimeType, { fileName });
    return res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('OCR Error:', error);
    // 🔒 นโยบาย "ห้ามเดา": AI อ่านไม่ได้ = ไม่มีข้อมูลให้ — ส่ง 422 ให้ UI แจ้งผู้ใช้สแกนใหม่ ไม่เดาจากชื่อไฟล์
    return res.status(422).json({
      success: false,
      error: 'AI อ่านใบไม่สำเร็จ — ระบบไม่เดาข้อมูลจากชื่อไฟล์ โปรดลองอีกครั้งภายหลัง (ตรวจ GEMINI_API_KEY / โควต้า)',
      code: 'AI_UNAVAILABLE'
    });
  }
});

// Storage for live bills received from Google Drive Bot / Webhook
interface BotBill {
  id: string;
  source: string;
  driveFileName?: string;
  driveFileId?: string;
  driveFileUrl?: string;
  receivedAt: string;
  status: 'PENDING_MATCH' | 'MATCHED';
  data: any;
  thumbnailBase64?: string;
}

const botBillsBuffer: BotBill[] = [];

// Webhook endpoint for external Bot or Google Apps Script to auto-push bills
app.post('/api/bot-import-bill', async (req, res) => {
  try {
    const { 
      imageBase64, 
      mimeType = 'image/jpeg', 
      driveFileName = 'bill_from_drive.jpg',
      driveFileId,
      driveFileUrl,
      driveFolderPath = '',
      source = 'GOOGLE_DRIVE_BOT',
      projectId = 'PRJ-DOH-24'
    } = req.body;

    let parsedData: any = {};

    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      parsedData = await performBillAiExtraction(cleanBase64, mimeType, {
        fileName: driveFileName,
        folderPath: driveFolderPath
      });
    } else {
      // 🔒 นโยบาย "ห้ามเดา": ไม่มีรูปให้ AI อ่าน = ไม่มีข้อมูลจริง — ห้ามปลอมค่า default (น้ำหนัก/ทะเบียน/โครงการ)
      // ใช้ค่าว่าง + ติดธง needsReview ให้ผู้ใช้กรอกจากใบจริงเอง (ตรงกับ GAS ที่ตั้ง needs_review: true แล้ว)
      parsedData = req.body.parsedData || {
        docNo: req.body.docNo || '',
        billType: req.body.billType || 'DEST_WEIGHT',
        category: req.body.category || 'ทั่วไป',
        supplier: req.body.supplier || '',
        vehicleReg: req.body.vehicleReg || '',
        itemDesc: req.body.itemDesc || '',
        netWeight: req.body.netWeight !== undefined ? Number(req.body.netWeight) : 0,
        remarks: req.body.remarks || `รอตรวจสอบ: ข้อมูลจากชื่อไฟล์ "${driveFileName}" อาจไม่ตรงกับใบจริง — โปรดกรอกข้อมูลจากใบก่อนชนบิล`,
        needsReview: true
      };
    }

    const newBotBill: BotBill = {
      id: `BOT-${Date.now().toString().slice(-6)}`,
      source,
      driveFileName,
      driveFileId,
      driveFileUrl: driveFileUrl || (driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view` : undefined),
      receivedAt: new Date().toISOString(),
      status: 'PENDING_MATCH',
      data: {
        ...parsedData,
        projectId: parsedData.projectId || projectId
      },
      thumbnailBase64: imageBase64 ? imageBase64.slice(0, 1000) : undefined
    };

    botBillsBuffer.unshift(newBotBill);
    if (botBillsBuffer.length > 50) botBillsBuffer.pop();

    // Auto-record history into Supabase drive_sync_logs and bills_buffer if database is connected
    let isDuplicate = false;
    let duplicateReason = '';

    if (supabaseServerClient) {
      try {
        const isSupplier = parsedData.billType === 'SUPPLIER';
        const bufferId = driveFileId 
          ? `DRIVE_${driveFileId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)}` 
          : newBotBill.id;

        const checkDocNo = parsedData.docNo;
        if (checkDocNo && checkDocNo !== '-' && checkDocNo.length > 2) {
          // Check if already in bills_buffer
          const { data: dupBuffer } = await supabaseServerClient
            .from('bills_buffer')
            .select('id, ref_no, weight_ticket_no')
            .or(`ref_no.eq.${checkDocNo},weight_ticket_no.eq.${checkDocNo}`)
            .limit(1);

          if (dupBuffer && dupBuffer.length > 0 && dupBuffer[0].id !== bufferId) {
            isDuplicate = true;
            duplicateReason = `มีอยู่ในกล่องพักรอชนบิลแล้ว (${dupBuffer[0].id})`;
          } else {
            // Check if already in reconciliation_records
            const { data: dupRecord } = await supabaseServerClient
              .from('reconciliation_records')
              .select('id, do_no, dest_ticket_no')
              .or(`do_no.eq.${checkDocNo},dest_ticket_no.eq.${checkDocNo}`)
              .limit(1);

            if (dupRecord && dupRecord.length > 0) {
              isDuplicate = true;
              duplicateReason = `มีอยู่ในตารางหลัก 38 คอลัมน์แล้ว (${dupRecord[0].id})`;
            }
          }
        }

        if (isDuplicate) {
          console.log(`[Duplicate Prevented] Bill ${checkDocNo} skipped: ${duplicateReason}`);
          // Record skip log in drive_sync_logs
          await supabaseServerClient.from('drive_sync_logs').upsert({
            id: driveFileId || newBotBill.id,
            file_name: driveFileName,
            drive_url: newBotBill.driveFileUrl || null,
            folder_path: req.body.driveFolderPath || null,
            doc_no: parsedData.docNo || null,
            bill_type: parsedData.billType || null,
            category: parsedData.category || null,
            supplier: parsedData.supplier || null,
            net_weight: parsedData.netWeight ? Number(parsedData.netWeight) : null,
            status: 'SKIPPED_DUPLICATE',
            synced_at: new Date().toISOString()
          });
        } else {
          // 1. บันทึกลง bills_buffer พร้อมข้อมูลตัวเลขจริงที่ AI อ่านได้
          await supabaseServerClient.from('bills_buffer').upsert({
            id: bufferId,
            project_id: parsedData.projectId || projectId || 'PRJ-DOH-24',
            project_name: 'โครงการทางหลวง (BTC)',
            type: isSupplier ? 'SUPPLIER' : 'DEST_WEIGHT',
            bill_type: isSupplier ? 'SUPPLIER' : 'DEST_WEIGHT',
            ref_no: parsedData.refDocNo || parsedData.docNo,
            weight_ticket_no: parsedData.docNo,
            date: parsedData.date || new Date().toISOString().slice(0, 10),
            supplier: parsedData.supplier || 'โรงโม่ / ตั๋วชั่งนำเข้าจาก Drive',
            vehicle_reg: parsedData.vehicleReg || '-',
            item_desc: parsedData.itemDesc || parsedData.category || 'หิน / วัสดุ',
            material_name: parsedData.itemDesc || parsedData.category || 'หิน / วัสดุ',
            origin_gross: parsedData.grossWeight || null,
            origin_tare: parsedData.tareWeight || null,
            origin_net: parsedData.netWeight || null,
            dest_gross: parsedData.grossWeight || null,
            dest_tare: parsedData.tareWeight || null,
            dest_net: parsedData.netWeight || null,
            qty: parsedData.qty || parsedData.netWeight || null,
            price_per_unit: parsedData.pricePerUnit || null,
            total_material: parsedData.totalAmount || null,
            photo_attachment: newBotBill.driveFileUrl || null,
            remarks: req.body.driveFolderPath || '',
            // ธงตรวจสอบ: หากไม่มีรูปส่งเข้ามา = ข้อมูลมาจากชื่อไฟล์/ค่า default (ไม่ได้อ่านใบจริงด้วย AI) → ให้ติดธงรอตรวจสอบเสมอ
            needs_review: imageBase64 ? Boolean(parsedData.isAiFallback || parsedData.quotaExceeded) : true
          });

          // 2. บันทึกประวัติลง drive_sync_logs
          await supabaseServerClient.from('drive_sync_logs').upsert({
            id: driveFileId || newBotBill.id,
            file_name: driveFileName,
            drive_url: newBotBill.driveFileUrl || null,
            folder_path: req.body.driveFolderPath || null,
            doc_no: parsedData.docNo || null,
            bill_type: parsedData.billType || null,
            category: parsedData.category || null,
            supplier: parsedData.supplier || null,
            net_weight: parsedData.netWeight ? Number(parsedData.netWeight) : null,
            status: imageBase64 ? 'SUCCESS_AI' : 'SUCCESS_BOT',
            synced_at: new Date().toISOString()
          });
        }
      } catch (dbErr) {
        console.error('Failed to log to Supabase:', dbErr);
      }
    }

    console.log(`[Bot Ingestion] Received bill from ${source}: ${newBotBill.id} (${newBotBill.driveFileName})${isDuplicate ? ' [DUPLICATE SKIPPED]' : ''}`);
    return res.json({ 
      success: true, 
      bill: newBotBill, 
      isDuplicate, 
      message: isDuplicate ? `ตรวจพบบิลซ้ำ: ${duplicateReason} ระบบข้ามการบันทึกเพื่อป้องกันข้อมูลซ้ำซ้อน` : undefined 
    });
  } catch (err: any) {
    console.error('Error importing bill from bot:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint: ดึง"รายชื่อไฟล์จริง"จากโฟลเดอร์ Google Drive (โฟลเดอร์ต้องเปิดแชร์ลิงก์ Anyone with the link)
// ใช้ Drive public embeddedfolderview — ไม่ต้องมี Google API Key (เข้าถึงได้เฉพาะไฟล์/โฟลเดอร์ที่แชร์ลิงก์สาธารณะเท่านั้น)
// สำรวจ"ทะลุโฟลเดอร์ย่อยทุกชั้น" (BFS + visited set กันวงวน ตรงกับ logic getFilesRecursive ของ GAS)
app.post('/api/drive-list-files', async (req, res) => {
  try {
    const { folderId, limit = 20 } = req.body || {};
    if (!folderId) {
      return res.status(400).json({ success: false, error: 'Missing folderId' });
    }

    const maxFetch = Number(limit || 20);
    const visited = new Set<string>();
    const queue: { id: string; path: string; depth: number }[] = [{ id: folderId, path: '', depth: 1 }];
    const billFiles: { fileId: string; fileName: string; folderPath: string }[] = [];
    const MAX_FOLDERS = 50;   // กันยิง Drive ถี่เกิน (แต่ละโฟลเดอร์ = 1 request)
    const MAX_DEPTH = 6;      // กันโครงสร้างลึกผิดปกติ
    let foldersChecked = 0;

    while (queue.length > 0 && billFiles.length < maxFetch && foldersChecked < MAX_FOLDERS) {
      const cur = queue.shift()!;
      if (visited.has(cur.id)) continue;
      visited.add(cur.id);
      foldersChecked++;

      const resp = await fetch(
        `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(cur.id)}#list`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' }
      );
      if (!resp.ok) continue;
      const html = await resp.text();

      // แต่ละ entry: id="entry-<id>" ... ชื่อใน div.flip-entry-title ... ถ้าเป็น"โฟลเดอร์"จะมีลิงก์ /drive/folders/<id>
      const entryRegex = /id="entry-([A-Za-z0-9_-]+)"([\s\S]*?)<div class="flip-entry-title">([\s\S]*?)<\/div>/g;
      let m: RegExpExecArray | null;
      while ((m = entryRegex.exec(html)) !== null) {
        const entryId = m[1];
        const entryBlock = m[2];
        const fileName = m[3]
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
        const isFolder = entryBlock.includes('/drive/folders/') || !fileName.includes('.');

        if (isFolder) {
          if (cur.depth < MAX_DEPTH && !visited.has(entryId)) {
            queue.push({ id: entryId, path: cur.path ? `${cur.path} > ${fileName}` : fileName, depth: cur.depth + 1 });
          }
        } else if (/\.(jpe?g|png|webp|heic|pdf)$/i.test(fileName)) {
          billFiles.push({ fileId: entryId, fileName, folderPath: cur.path });
          if (billFiles.length >= maxFetch) break;
        }
      }
    }

    if (foldersChecked === 0) {
      return res.status(404).json({
        success: false,
        error: 'ไม่สามารถเข้าถึงโฟลเดอร์ Drive — โปรดตรวจว่าโฟลเดอร์เปิดแชร์ลิงก์ "Anyone with the link" แล้ว'
      });
    }

    return res.json({ success: true, count: billFiles.length, foldersChecked, files: billFiles });
  } catch (error: any) {
    console.error('Drive list files Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to list Drive folder' });
  }
});

// 🔁 Full Sync: ดึง"ครบทุกไฟล์"จากโฟลเดอร์ Drive (ทะลุทุกโฟลเดอร์ย่อย ไม่จำกัดจำนวน)
// เทียบกับ drive_sync_logs แล้วทำเฉพาะไฟล์ที่ยังไม่เคย sync — ทีละไฟล์: ดึงลิงก์→แปลงเป็นภาพ→AI อ่าน→บันทึกประวัติ
// รับประกัน"ไม่ตกหล่นแม้แต่ไฟล์เดียว": สรุปผลแยกชัดเจน success / duplicate / failed (ให้ผู้ใช้กด sync ซ้ำเอาไฟล์ที่พลาด)
app.post('/api/drive-sync-all', async (req, res) => {
  try {
    const { folderId, limit = 0 } = req.body || {};
    if (!folderId) {
      return res.status(400).json({ success: false, error: 'Missing folderId' });
    }

    // ---- Phase 1: สำรวจโฟลเดอร์ครบทุกชั้น (BFS ไม่จำกัดจำนวนไฟล์) ----
    const visited = new Set<string>();
    const queue: { id: string; path: string; depth: number }[] = [{ id: folderId, path: '', depth: 1 }];
    const allFiles: { fileId: string; fileName: string; folderPath: string }[] = [];
    const MAX_DEPTH = 6;
    let foldersChecked = 0;

    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visited.has(cur.id)) continue;
      visited.add(cur.id);
      foldersChecked++;

      try {
        const resp = await fetch(
          `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(cur.id)}#list`,
          { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' }
        );
        if (!resp.ok) continue;
        const html = await resp.text();

        const entryRegex = /id="entry-([A-Za-z0-9_-]+)"([\s\S]*?)<div class="flip-entry-title">([\s\S]*?)<\/div>/g;
        let m: RegExpExecArray | null;
        while ((m = entryRegex.exec(html)) !== null) {
          const entryId = m[1];
          const entryBlock = m[2];
          const fileName = m[3]
            .replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')
            .replace(/"/g, '"').replace(/'/g, "'").trim();
          const isFolder = entryBlock.includes('/drive/folders/') || !fileName.includes('.');

          if (isFolder) {
            if (cur.depth < MAX_DEPTH && !visited.has(entryId)) {
              queue.push({ id: entryId, path: cur.path ? `${cur.path} > ${fileName}` : fileName, depth: cur.depth + 1 });
            }
          } else if (/\.(jpe?g|png|webp|heic|pdf)$/i.test(fileName)) {
            allFiles.push({ fileId: entryId, fileName, folderPath: cur.path });
          }
        }
      } catch {}
    }

    if (foldersChecked === 0) {
      return res.status(404).json({ success: false, error: 'ไม่สามารถเข้าถึงโฟลเดอร์ Drive — โปรดตรวจว่าโฟลเดอร์เปิดแชร์ลิงก์ "Anyone with the link" แล้ว' });
    }

    // ---- Phase 2: กรองไฟล์ที่เคย sync สำเร็จ/ซ้ำออก (จาก drive_sync_logs) ----
    let alreadySynced: Set<string> = new Set();
    if (supabaseServerClient) {
      try {
        const ids = allFiles.map(f => f.fileId);
        const pageSize = 500;
        for (let i = 0; i < ids.length; i += pageSize) {
          const { data } = await supabaseServerClient
            .from('drive_sync_logs')
            .select('id,status')
            .in('id', ids.slice(i, i + pageSize));
          for (const row of (data || []) as { id: string; status: string }[]) {
            // สถานะที่"จบแล้ว" = ข้าม; สถานะ FAILED_AI = ลองใหม่ (เพราะครั้งก่อน AI อ่านไม่ได้)
            if (row.status === 'SUCCESS_AI' || row.status === 'SKIPPED_DUPLICATE') alreadySynced.add(row.id);
          }
        }
      } catch (e) { console.warn('drive_sync_logs check failed (จะ sync ทุกไฟล์ใหม่):', e); }
    }

    const pending = allFiles.filter(f => !alreadySynced.has(f.fileId));
    const capped = limit && Number(limit) > 0 ? pending.slice(0, Number(limit)) : pending;

    return res.json({
      success: true,
      totalInDrive: allFiles.length,
      alreadySyncedCount: alreadySynced.size && allFiles.filter(f => alreadySynced.has(f.fileId)).length,
      pendingCount: pending.length,
      processingNow: capped.length,
      foldersChecked,
      files: capped
    });
  } catch (error: any) {
    console.error('Drive Sync All Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to sync Drive folder' });
  }
});

// Endpoint to scan a file from Google Drive directly by driveFileId or driveUrl
// 🔁 บันทึกประวัติลง drive_sync_logs อัตโนมัติทุกครั้ง (SUCCESS_AI / FAILED_AI / FETCH_FAILED)
// เพื่อให้รอบ sync ถัดไปข้ามไฟล์ที่ทำสำเร็จแล้ว และลองใหม่เฉพาะไฟล์ที่พลาด = ไม่ตกหล่น
app.post('/api/scan-drive-file', async (req, res) => {
  try {
    const { driveFileId, driveFileUrl, fileName = 'drive_bill.jpg', folderPath = '' } = req.body;
    let targetId = driveFileId;

    if (!targetId && driveFileUrl) {
      const match = driveFileUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || driveFileUrl.match(/id=([a-zA-Z0-9_-]+)/);
      if (match) targetId = match[1];
    }

    if (!targetId) {
      return res.status(400).json({ error: 'Missing driveFileId or driveFileUrl' });
    }

    // Try fetching image from Google Drive thumbnail or direct download
    const fetchUrls = [
      `https://lh3.googleusercontent.com/d/${targetId}=w2000`,
      `https://drive.google.com/uc?export=download&id=${targetId}`
    ];

    let imageBuffer: Buffer | null = null;
    let mimeType = 'image/jpeg';

    for (const u of fetchUrls) {
      try {
        const resp = await fetch(u, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          redirect: 'follow'
        });
        if (resp.ok) {
          const contentType = resp.headers.get('content-type') || '';
          if (contentType.includes('image') || contentType.includes('octet-stream')) {
            const arrayBuffer = await resp.arrayBuffer();
            if (arrayBuffer.byteLength > 1000) {
              imageBuffer = Buffer.from(arrayBuffer);
              mimeType = contentType.includes('image') ? contentType : 'image/jpeg';
              break;
            }
          }
        }
      } catch (err) {}
    }

    if (!imageBuffer) {
      // บันทึกประวัติ: ดึงรูปไม่สำเร็จ (ส่วนใหญ่ไฟล์ไม่ได้เปิดแชร์ลิงก์) — รอบหน้าลองใหม่
      if (supabaseServerClient) {
        try {
          await supabaseServerClient.from('drive_sync_logs').upsert({
            id: targetId, file_name: fileName, folder_path: folderPath || null,
            status: 'FETCH_FAILED', synced_at: new Date().toISOString()
          });
        } catch {}
      }
      return res.status(404).json({
        success: false,
        error: `ไม่สามารถดึงรูปภาพจาก Google Drive สำหรับไฟล์ ID ${targetId} ได้ (โปรดตรวจสอบว่าเปิดการแชร์ลิงก์แล้ว)`
      });
    }

    const cleanBase64 = imageBuffer.toString('base64');
    let parsedData: any;
    try {
      parsedData = await performBillAiExtraction(cleanBase64, mimeType, {
        fileName: fileName
      });
    } catch (aiErr: any) {
      // บันทึกประวัติ: AI อ่านไม่สำเร็จ (โควต้าเต็ม/บริการล่ม) — รอบหน้า sync จะลองใหม่ให้อัตโนมัติ
      if (supabaseServerClient) {
        try {
          await supabaseServerClient.from('drive_sync_logs').upsert({
            id: targetId, file_name: fileName, folder_path: folderPath || null,
            status: 'FAILED_AI', synced_at: new Date().toISOString()
          });
        } catch {}
      }
      return res.status(422).json({ success: false, code: 'AI_UNAVAILABLE', error: aiErr.message || 'AI read failed' });
    }

    // บันทึกประวัติ: สำเร็จ — รอบหน้า sync จะข้ามไฟล์นี้
    if (supabaseServerClient) {
      try {
        await supabaseServerClient.from('drive_sync_logs').upsert({
          id: targetId,
          file_name: fileName,
          drive_url: `https://drive.google.com/file/d/${targetId}/view`,
          folder_path: folderPath || null,
          doc_no: parsedData.docNo || null,
          bill_type: parsedData.billType || null,
          category: parsedData.category || null,
          supplier: parsedData.supplier || null,
          net_weight: parsedData.netWeight ? Number(parsedData.netWeight) : null,
          status: 'SUCCESS_AI',
          synced_at: new Date().toISOString()
        });
      } catch (e) { console.warn('drive_sync_logs upsert failed:', e); }
    }

    return res.json({
      success: true,
      data: parsedData,
      driveFileId: targetId,
      thumbnailBase64: `data:${mimeType};base64,${cleanBase64.slice(0, 1500)}`
    });
  } catch (error: any) {
    console.error('Scan Drive File Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to scan Drive file'
    });
  }
});

// Batch import multiple bills from Drive / Sheet
app.post('/api/bot-import-batch', async (req, res) => {
  try {
    const { bills = [] } = req.body;
    let added = 0;
    for (const b of bills) {
      const newBotBill: BotBill = {
        id: `BOT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`,
        source: b.source || 'GOOGLE_DRIVE_SHEET_BATCH',
        driveFileName: b.driveFileName || b.fileName,
        driveFileId: b.driveFileId || b.fileId,
        driveFileUrl: b.driveFileUrl || (b.fileId ? `https://drive.google.com/file/d/${b.fileId}/view` : undefined),
        receivedAt: new Date().toISOString(),
        status: 'PENDING_MATCH',
        data: {
          docNo: b.docNo || '',
          billType: b.billType || 'DEST_WEIGHT',
          supplier: b.supplier || '',
          date: b.date || b.documentDate || '',
          vehicleReg: b.vehicleReg || '',
          itemDesc: b.itemDesc || '',
          netWeight: b.netWeight !== undefined ? Number(b.netWeight) : 0,
          projectId: b.projectId || '',
          remarks: b.remarks || b.folderPath || `รอตรวจสอบ: ข้อมูลจากชื่อไฟล์ "${b.driveFileName || b.fileName || ''}" อาจไม่ตรงกับใบจริง — โปรดกรอกจากใบก่อนชนบิล`,
          needsReview: true
        }
      };
      botBillsBuffer.unshift(newBotBill);
      added++;
    }
    if (botBillsBuffer.length > 2000) botBillsBuffer.length = 2000;
    console.log(`[Batch Ingestion] Successfully imported ${added} bills. Buffer now has ${botBillsBuffer.length} bills.`);
    return res.json({ success: true, count: added });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint to fetch bills pushed by the Bot
app.get('/api/bot-bills', (req, res) => {
  return res.json({ 
    success: true, 
    count: botBillsBuffer.length,
    bills: botBillsBuffer 
  });
});

// Clear or acknowledge bot bills
app.post('/api/bot-bills/ack', (req, res) => {
  const { id } = req.body;
  if (id) {
    const idx = botBillsBuffer.findIndex(b => b.id === id);
    if (idx !== -1) botBillsBuffer.splice(idx, 1);
  } else {
    botBillsBuffer.length = 0;
  }
  return res.json({ success: true });
});

// Simulate incoming bot push from Google Drive folder 1Z6-WNDovLWEYQsYllTTPCDLIwQt3ufjx
app.post('/api/simulate-bot-push', (req, res) => {
  const mockTickets = [
    {
      docNo: '690920/00088',
      billType: 'DEST_WEIGHT',
      supplier: 'บจก. บุรีรัมย์ธงชัยก่อสร้าง (ตาชั่งหน้างาน)',
      vehicleReg: '82-9988 บร',
      itemDesc: 'หินคลุก ชั่งหน้างาน ทล.24',
      grossWeight: 44850,
      tareWeight: 14220,
      netWeight: 30.63,
      isSubcontractorDeduction: false,
      remarks: 'ตรวจรับเข้าหน้างาน ทล.24 ตอน 2 อ้างอิง DO 690920/00030'
    },
    {
      docNo: 'DO-BTC-9011',
      billType: 'SUPPLIER',
      supplier: 'บจก. สหพาณิชย์ คอนกรีต',
      vehicleReg: '83-1122 นม',
      itemDesc: 'คอนกรีตผสมเสร็จ Lean 180 ksc',
      qty: 12,
      unit: 'คิว',
      pricePerUnit: 1750,
      totalAmount: 21000,
      isSubcontractorDeduction: true,
      subcontractorName: 'ช่างสมชาย (เทลีนท่อ)',
      remarks: 'หักเงินค่างวดช่างสมชาย งวดที่ 2'
    }
  ];

  const chosen = mockTickets[Math.floor(Math.random() * mockTickets.length)];
  const simulatedBill: BotBill = {
    id: `BOT-${Date.now().toString().slice(-6)}`,
    source: 'GOOGLE_DRIVE_FOLDER (1Z6-WNDovLWEYQsYllTTPCDLIwQt3ufjx)',
    driveFileName: `IMG_${Date.now().toString().slice(-4)}_receipt.jpg`,
    driveFileId: '1Z6-WNDovLWEYQsYllTTPCDLIwQt3ufjx',
    driveFileUrl: 'https://drive.google.com/drive/folders/1Z6-WNDovLWEYQsYllTTPCDLIwQt3ufjx?usp=sharing',
    receivedAt: new Date().toISOString(),
    status: 'PENDING_MATCH',
    data: {
      ...chosen,
      projectId: 'PRJ-DOH-24',
      projectName: 'ทล.24 ตอน 2'
    }
  };

  botBillsBuffer.unshift(simulatedBill);
  return res.json({ success: true, bill: simulatedBill });
});

// Mount Vite middleware in development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer();
