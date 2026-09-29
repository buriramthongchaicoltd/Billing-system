import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json({ limit: '20mb' }));

const ai = new GoogleGenAI({});

// API endpoint for OCR Document Parsing
app.post('/api/ocr-scan', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
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
ประเภทโครงการหลัก: งานก่อสร้างขยายถนนสายหลัก (ทล.), สะพานคอนกรีตอัดแรง/สะพานเหล็ก, อุโมงค์ทางลอด, สะพานทางยกระดับ (Flyover), ระบบระบายน้ำขนาดใหญ่ และงานผิวทางคอนกรีต/แอสฟัลต์

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

    const parsedData = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('OCR Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to scan document' 
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
      source = 'GOOGLE_DRIVE_BOT',
      projectId = 'PRJ-DOH-24'
    } = req.body;

    let parsedData: any = {};

    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { data: cleanBase64, mimeType } },
              { text: `วิเคราะห์เอกสารใบชั่ง/บิลนี้แบบละเอียด เพื่อนำเข้าสู่ระบบกระทบยอดงานก่อสร้าง DOH/DRR คืนค่า docNo, billType, supplier, vehicleReg, itemDesc, grossWeight, tareWeight, netWeight, pricePerUnit, totalAmount, isSubcontractorDeduction, subcontractorName, remarks` }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json'
        }
      });
      parsedData = JSON.parse(response.text || '{}');
    } else {
      parsedData = req.body.parsedData || {
        docNo: req.body.docNo || `DRIVE-${Date.now().toString().slice(-5)}`,
        billType: req.body.billType || 'DEST_WEIGHT',
        supplier: req.body.supplier || 'โรงโม่ / ตั๋วชั่งนำเข้าจาก Drive',
        vehicleReg: req.body.vehicleReg || '82-9988 บร',
        itemDesc: req.body.itemDesc || 'หินคลุก / หินฝุ่น',
        netWeight: Number(req.body.netWeight || 30.5)
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

    console.log(`[Bot Ingestion] Received bill from ${source}: ${newBotBill.id} (${newBotBill.driveFileName})`);
    return res.json({ success: true, bill: newBotBill });
  } catch (err: any) {
    console.error('Error importing bill from bot:', err);
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
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer();
