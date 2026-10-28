import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const TEACHER_PASSWORD = '0053982';

app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface GeminiCallOptions {
  contents: any;
  systemInstruction?: string;
  responseMimeType?: string;
  thinkingLevel?: ThinkingLevel;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

// Resilient wrapper with automatic model fallback and retries on 503/429
async function callGeminiWithFallback(options: GeminiCallOptions) {
  // gemini-3.1-flash-lite provides ultra-low latency response times
  const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const config: any = {
          temperature: options.temperature ?? 0.1,
        };
        if (options.systemInstruction) config.systemInstruction = options.systemInstruction;
        if (options.responseMimeType) config.responseMimeType = options.responseMimeType;
        if (options.maxOutputTokens) config.maxOutputTokens = options.maxOutputTokens;
        if (options.thinkingLevel) {
          config.thinkingConfig = { thinkingLevel: options.thinkingLevel };
        }

        const callPromise = ai.models.generateContent({
          model,
          contents: options.contents,
          config,
        });

        const response = options.timeoutMs
          ? await Promise.race([
              callPromise,
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Timeout after ${options.timeoutMs}ms`)), options.timeoutMs)
              ),
            ])
          : await callPromise;

        if (response && response.text) {
          return response;
        }
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err || '');
        console.warn(`[Gemini] Model ${model} attempt ${attempt} warning: ${msg}`);

        const isOverloaded =
          msg.includes('503') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('high demand') ||
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('Timeout');

        if (isOverloaded && attempt < 2 && !msg.includes('Timeout')) {
          await new Promise((r) => setTimeout(r, 600 * attempt));
        } else {
          break; // Try next model candidate
        }
      }
    }
  }

  throw lastError || new Error("Sun'iy intellekt xizmatida vaqtinchalik bandlik (503).");
}

export type CognitiveLevel = 'Bilish' | "Qo'llash" | 'Mulohaza';

export interface Question {
  id: string;
  type: 'multiple_choice' | 'written';
  cognitiveLevel?: CognitiveLevel;
  question: string;
  options?: { key: 'A' | 'B' | 'C' | 'D'; text: string }[];
  correctAnswer: string;
  points: number;
  explanation?: string;
  criteria?: string;
  rubricSteps?: { step: string; points: number }[];
}

export interface StudentRosterItem {
  id: string;
  studentCode: string;
  name: string;
  studentClass?: string;
}

export interface TestItem {
  id: string;
  code: string;
  title: string;
  subject: string;
  grade: string;
  term: string;
  testType: 'BSB' | 'CHSB' | 'Nazorat ishi';
  format: 'multiple_choice' | 'written' | 'mixed';
  durationMinutes: number;
  totalPoints: number;
  createdAt: string;
  teacherName: string;
  showInstantResult: boolean;
  allowReview: boolean;
  questions: Question[];
  roster?: StudentRosterItem[];
}

export interface StudentSubmission {
  id: string;
  testId: string;
  testCode: string;
  studentCode?: string;
  studentName: string;
  studentClass: string;
  submittedAt: string;
  timeSpentSeconds: number;
  answers: Record<string, string>;
  writtenImages?: Record<string, string>; // questionId -> base64 handwritten notebook image
  writtenFeedback?: Record<string, { score: number; comment: string }>;
  score: number;
  maxScore: number;
  percentage: number;
  gradeScore: number;
}

// Data Directory Persistence
const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const testsFilePath = path.resolve(dataDir, 'tests.json');
const subsFilePath = path.resolve(dataDir, 'submissions.json');

const testsStore: Map<string, TestItem> = new Map();
const submissionsStore: Map<string, StudentSubmission[]> = new Map();

function saveToDisk() {
  try {
    const testsObj = Object.fromEntries(testsStore);
    fs.writeFileSync(testsFilePath, JSON.stringify(testsObj, null, 2), 'utf-8');

    const subsObj = Object.fromEntries(submissionsStore);
    fs.writeFileSync(subsFilePath, JSON.stringify(subsObj, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving data to disk:', err);
  }
}

function loadFromDisk() {
  try {
    if (fs.existsSync(testsFilePath)) {
      const content = fs.readFileSync(testsFilePath, 'utf-8');
      const parsed = JSON.parse(content);
      for (const [k, v] of Object.entries(parsed)) {
        testsStore.set(k, v as TestItem);
      }
    }
    if (fs.existsSync(subsFilePath)) {
      const content = fs.readFileSync(subsFilePath, 'utf-8');
      const parsed = JSON.parse(content);
      for (const [k, v] of Object.entries(parsed)) {
        submissionsStore.set(k, v as StudentSubmission[]);
      }
    }
  } catch (err) {
    console.error('Error loading data from disk:', err);
  }
}

// Initial seed if empty
loadFromDisk();

if (testsStore.size === 0) {
  const demoTestId = 'test-demo-1';
  const demoTest: TestItem = {
    id: demoTestId,
    code: 'BSB-701',
    title: '7-sinf Matematika: 1-BSB (Chiziqli tenglamalar va burchaklar)',
    subject: 'Matematika',
    grade: '7-sinf',
    term: '1-chorak',
    testType: 'BSB',
    format: 'mixed',
    durationMinutes: 40,
    totalPoints: 25,
    createdAt: new Date().toISOString(),
    teacherName: "Sobirova Nilufar O'qituvchi",
    showInstantResult: true,
    allowReview: true,
    roster: [
      { id: 'rost-1', studentCode: '7A-01', name: 'Karimov Jasur', studentClass: '7-A' },
      { id: 'rost-2', studentCode: '7A-02', name: 'Aliyeva Madina', studentClass: '7-A' },
      { id: 'rost-3', studentCode: '7A-03', name: 'Toshmatov Bobur', studentClass: '7-A' },
      { id: 'rost-4', studentCode: '7A-04', name: 'Ismoilova Sevara', studentClass: '7-A' },
    ],
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        question: 'Tenglamani yeching: 3x - 7 = 14',
        options: [
          { key: 'A', text: 'x = 5' },
          { key: 'B', text: 'x = 7' },
          { key: 'C', text: 'x = 6' },
          { key: 'D', text: 'x = 8' },
        ],
        correctAnswer: 'B',
        points: 5,
        explanation: '3x = 14 + 7 => 3x = 21 => x = 7.',
      },
      {
        id: 'q2',
        type: 'multiple_choice',
        question: "Qo'shni burchaklardan biri 65° bo'lsa, ikkinchi burchakni toping.",
        options: [
          { key: 'A', text: '115°' },
          { key: 'B', text: '125°' },
          { key: 'C', text: '90°' },
          { key: 'D', text: '65°' },
        ],
        correctAnswer: 'A',
        points: 5,
        explanation: "Qo'shni burchaklar yig'indisi 180°: 180° - 65° = 115°.",
      },
      {
        id: 'q3',
        type: 'multiple_choice',
        question: 'Quyidagi kasrlardan qaysi biri eng katta: 2/5, 3/8, 1/2, 4/10?',
        options: [
          { key: 'A', text: '2/5' },
          { key: 'B', text: '3/8' },
          { key: 'C', text: '1/2' },
          { key: 'D', text: '4/10' },
        ],
        correctAnswer: 'C',
        points: 5,
        explanation: '1/2 = 0.5, 2/5 = 0.4, 3/8 = 0.375, 4/10 = 0.4. Eng kattasi 1/2.',
      },
      {
        id: 'q4',
        type: 'written',
        question:
          "Masala: To'g'ri to'rtburchakning perimetri 36 sm, bo'yi enidan 4 sm uzun. Uning yuzini toping. (Yechilish yo'lini batafsil yozing)",
        correctAnswer: "Eni = 7 sm, Bo'yi = 11 sm, Yuzi = 7 * 11 = 77 sm².",
        points: 10,
        criteria: "Tenglama tuzilganligi (3 ball), tomonlar to'g'ri topilganligi (4 ball), yuza hisoblanganligi (3 ball)",
        explanation: '2*(x + x + 4) = 36 => 4x = 28 => x = 7 sm. Bo\'yi = 11 sm. Yuzi = 7 * 11 = 77 sm².',
      },
    ],
  };

  testsStore.set(demoTest.id, demoTest);

  submissionsStore.set(demoTestId, [
    {
      id: 'sub-1',
      testId: demoTestId,
      testCode: 'BSB-701',
      studentName: 'Karimov Jasur',
      studentClass: '7-A',
      submittedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      timeSpentSeconds: 1420,
      answers: {
        q1: 'B',
        q2: 'A',
        q3: 'C',
        q4: "Eni x bo'lsin. 2*(x+x+4)=36. 4x=28 => x=7 sm. Bo'yi 11 sm. Yuza = 7 * 11 = 77 sm kv.",
      },
      writtenFeedback: {
        q4: { score: 10, comment: "Barcha bosqichlar to'g'ri va mukammal yechilgan." },
      },
      score: 25,
      maxScore: 25,
      percentage: 100,
      gradeScore: 5,
    },
    {
      id: 'sub-2',
      testId: demoTestId,
      testCode: 'BSB-701',
      studentName: 'Aliyeva Madina',
      studentClass: '7-A',
      submittedAt: new Date(Date.now() - 3600000 * 1.5).toISOString(),
      timeSpentSeconds: 1650,
      answers: {
        q1: 'B',
        q2: 'A',
        q3: 'A',
        q4: "Eni 7 sm, bo'yi 11 sm topildi. Yuza = 77 sm kv.",
      },
      writtenFeedback: {
        q4: { score: 8, comment: "Javob to'g'ri, lekin tenglama to'liq keltirilmagan." },
      },
      score: 18,
      maxScore: 25,
      percentage: 72,
      gradeScore: 4,
    },
    {
      id: 'sub-3',
      testId: demoTestId,
      testCode: 'BSB-701',
      studentName: 'Toshmatov Bobur',
      studentClass: '7-A',
      submittedAt: new Date(Date.now() - 3600000 * 0.8).toISOString(),
      timeSpentSeconds: 1900,
      answers: {
        q1: 'A',
        q2: 'B',
        q3: 'C',
        q4: 'Tomonlari 6 va 10 deb oldim, yuza 60',
      },
      writtenFeedback: {
        q4: { score: 3, comment: 'Hisoblashda xatolik mavjud.' },
      },
      score: 8,
      maxScore: 25,
      percentage: 32,
      gradeScore: 2,
    },
  ]);

  saveToDisk();
}

function calculateUzbekGrade(percentage: number): number {
  if (percentage >= 86) return 5;
  if (percentage >= 71) return 4;
  if (percentage >= 56) return 3;
  return 2;
}

// API Routes

// 0. Teacher Authentication
app.post('/api/auth/teacher', (req, res) => {
  const { password } = req.body;
  if (password === TEACHER_PASSWORD) {
    return res.json({
      success: true,
      token: 'teacher_authenticated_session_token',
      message: 'Muvaffaqiyatli kirdingiz',
    });
  }
  return res.status(401).json({
    success: false,
    error: "Parol noto'g'ri! Iltimos, o'qituvchi parolini qaytadan kiriting.",
  });
});

// 1. Multimodal Parse (Images and PDF documents supported!)
app.post('/api/gemini/parse-test', async (req, res) => {
  try {
    const {
      promptText,
      imageData, // base64 string (image or PDF)
      mimeType = 'image/jpeg',
      subject = 'Umumiy fan',
      grade = '7-sinf',
      testType = 'BSB',
      format = 'mixed',
      questionCount = 5,
    } = req.body;

    if (!promptText && !imageData) {
      return res.status(400).json({ error: 'Rasm, PDF yoki matn kiritilishi shart.' });
    }

    const isPdf =
      mimeType === 'application/pdf' ||
      (typeof imageData === 'string' &&
        (imageData.includes('application/pdf') || imageData.startsWith('JVBERi')));

    const isCHSB = testType === 'CHSB';
    // CHSB in Uzbekistan has 15 standardized questions across 3 taxonomy levels
    const targetCount = isCHSB ? Math.max(15, Number(questionCount) || 15) : (Number(questionCount) || 5);

    const systemInstruction = `Siz O'zbekiston Respublikasi Maktabgacha va maktab ta'limi vazirligi hamda A. Avloniy nomidagi milliy-tadqiqot instituti baholash mezonlari bo'yicha yuqori malakali ekspert-metodistsiz.
MUHIM QOIDALAR:
1. SIZGA YUKLANGAN HUJJAT: ${isPdf ? 'PDF hujjat' : 'rasm yoki matn'}. Unda ${testType} bo'yicha rasmiy topshiriqlar, ularning to'g'ri javoblari va baholash mezonlari keltirilgan.
2. CHSB XUSUSIYATI VA SAVOLLAR SONI: O'zbekiston umumta'lim maktablarida CHSB (Choraklik yakuniy baholash) rasmiy standarti bo'yicha 15 TA TOPSHIRIQDAN iborat bo'ladi!
   - Agar PDFda 15 ta savol bo'lsa, siz FAQAT 5 TASINI EMAS, BALKI BARCHA 15 TA TOPSHIRIQLARNI TO'LIQ (1-savoldan 15-savolgacha) AJRATIB BERISHINGIZ SHART!
   - Hech qanday savolni tashlab ketmang! 15 ta savol to'liq chiqishi shart!
3. BILISH DARAJALARI (TAKSONOMIYA):
   Har bir savol uchun uning bilish darajasini aniq belgilang ("cognitiveLevel"):
   - "Bilish" — qoida, fakt, atama, sodda nazariy testlar (odatda 1-6 savollar);
   - "Qo'llash" — formula orqali hisoblash, standart amaliy masalalar (odatda 7-12 savollar);
   - "Mulohaza" — chuqur mantiqiy tahlil, mulohaza yuritish, nostandart yoki ochiq yozma topshiriqlar (odatda 13-15 savollar).
   PDFda ko'rsatilgan bo'lsa PDFdan oling, aks holda yuqoridagi 15 talik taqsimot bo'yicha moslab belgilang.
4. BAHOLASH MEZONI VA BALLAR: Har bir savolga uning mezonlari ("criteria"), balli ("points") va yechimini ("correctAnswer") to'liq yozing.

Har bir savol formati:
- "id": "q1", "q2"...
- "type": "multiple_choice" (variantli test) yoki "written" (ochiq yozma masala)
- "cognitiveLevel": "Bilish" | "Qo'llash" | "Mulohaza"
- "question": topshiriq matni
- "options": multiple_choice bo'lsa 4 ta variant ([{"key": "A", "text": "..."}, ...])
- "correctAnswer": to'g'ri javob yoki to'liq yechim
- "points": savolga ajratilgan ball (masalan: 2, 3 yoki 4 ball)
- "criteria": baholash mezoni
- "rubricSteps": [{"step": "...", "points": ...}]
- "explanation": yechim tushuntirishi
Javobni FAQAT toza JSON ko'rinishida qaytaring.`;

    const contentsParts: any[] = [];

    if (imageData) {
      const cleanBase64 = imageData.includes('base64,')
        ? imageData.split('base64,')[1]
        : imageData;

      contentsParts.push({
        inlineData: {
          mimeType: mimeType || (isPdf ? 'application/pdf' : 'image/jpeg'),
          data: cleanBase64,
        },
      });
    }

    const instructionText = `Quyidagi ${isPdf ? 'PDF hujjat' : 'ma\'lumot'}dan ${grade} ${subject} fanidan ${testType} topshiriqlarini to'liq ajratib bering.
Format: ${format}.
Talab: ${isCHSB ? `Jami ${targetCount} ta savolning BARCHASINI to'liq chiqaring (1-savoldan 15-savolgacha hech birini qoldirmasdan). Har bir savolga uning bilish darajasini ('Bilish', 'Qo'llash', 'Mulohaza') belgilang.` : `Savollar soni: ${targetCount} ta.`}
Qo'shimcha ko'rsatma: ${promptText || 'PDFdagi barcha savol, to\'g\'ri javob va mezonlarni aniq ajrating.'}

JSON formati:
{
  "title": "${grade} ${subject}: ${testType} nazorati",
  "subject": "${subject}",
  "grade": "${grade}",
  "testType": "${testType}",
  "durationMinutes": ${isCHSB ? 45 : 40},
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "cognitiveLevel": "Bilish",
      "question": "1-savol matni",
      "options": [
        {"key": "A", "text": "Variant A"},
        {"key": "B", "text": "Variant B"},
        {"key": "C", "text": "Variant C"},
        {"key": "D", "text": "Variant D"}
      ],
      "correctAnswer": "A",
      "points": 2,
      "explanation": "Yechim tushuntirishi",
      "criteria": "To'g'ri javob uchun 2 ball"
    },
    {
      "id": "q7",
      "type": "multiple_choice",
      "cognitiveLevel": "Qo'llash",
      "question": "7-savol matni (hisoblash / qo'llash)",
      "options": [
        {"key": "A", "text": "Variant A"},
        {"key": "B", "text": "Variant B"},
        {"key": "C", "text": "Variant C"},
        {"key": "D", "text": "Variant D"}
      ],
      "correctAnswer": "B",
      "points": 3,
      "explanation": "Hisoblash bosqichi",
      "criteria": "Hisob-kitob uchun 3 ball"
    },
    {
      "id": "q15",
      "type": "written",
      "cognitiveLevel": "Mulohaza",
      "question": "15-savol matni (Mulohaza / ochiq masala)",
      "correctAnswer": "To'liq namuna yechim",
      "criteria": "Formula uchun 2 ball, tahlil uchun 2 ball",
      "rubricSteps": [
        {"step": "Formula yozilgan", "points": 2},
        {"step": "Tahlil to'g'ri", "points": 2}
      ],
      "points": 4,
      "explanation": "Masala tahlili"
    }
  ]
}`;

    contentsParts.push({ text: instructionText });

    const response = await callGeminiWithFallback({
      contents: contentsParts,
      systemInstruction,
      responseMimeType: 'application/json',
      thinkingLevel: ThinkingLevel.LOW,
      temperature: 0.1,
    });

    const responseText = response.text || '{}';
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Sun'iy intellekt javobini o'qib bo'lmadi.");
      }
    }

    res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Gemini parse error:', error);
    res.status(500).json({
      error: error.message || "Testni yaratishda xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.",
    });
  }
});

// 1.2. Parse Student Roster / Class Table from PDF, Image, or pasted text
app.post('/api/gemini/parse-roster-pdf', async (req, res) => {
  try {
    const { imageData, mimeType = 'application/pdf', promptText, textList } = req.body;

    // Fast path: if raw text was pasted (from Excel, eMaktab, or Word)
    if (textList && typeof textList === 'string' && textList.trim().length > 0) {
      const rawLines = textList.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const parsedStudents: { index: number; fullName: string; studentClass: string }[] = [];
      let counter = 1;

      for (const line of rawLines) {
        const clean = line.replace(/^\d+[\.\)\-\s\t]+/, '').trim();
        if (!clean || clean.length < 2) continue;

        const parts = clean.split(/[\t,;]/).map((p) => p.trim()).filter(Boolean);
        const fullName = parts[0];
        const studentClass = parts[1] || '';

        const lower = fullName.toLowerCase();
        if (lower.includes('familiya') || lower.includes('f.i.sh') || lower.includes("o'quvchi")) {
          continue;
        }

        parsedStudents.push({
          index: counter++,
          fullName,
          studentClass,
        });
      }

      if (parsedStudents.length > 0) {
        return res.json({
          success: true,
          data: {
            schoolName: "14-sonli umumiy o'rta ta'lim maktabi",
            className: parsedStudents[0]?.studentClass || '',
            students: parsedStudents,
          },
        });
      }
    }

    if (!imageData) {
      return res.status(400).json({ error: "Rasm, PDF yoki matnli ro'yxat kiritilishi shart." });
    }

    const isPdf =
      mimeType === 'application/pdf' ||
      (typeof imageData === 'string' &&
        (imageData.includes('application/pdf') || imageData.startsWith('JVBERi')));

    const systemInstruction = `Siz O'zbekiston maktab hujjatlarini, jurnallarini (eMaktab / Kundalik) va jadvallarini (PDF, Excel jadvallari, skaner rasmlar) yuqori aniqlikda tahlil qiluvchi ekspertsiz.
Yuklangan ${isPdf ? 'PDF hujjat' : 'tasvir'}da o'quvchilar ro'yxati yoki sinf bayonnomasi jadvali berilgan.

Vazifangiz:
1. Hujjatdagi barcha o'quvchilarning ro'yxatini to'liq va aniq ajratib oling (familiya va ism to'liq).
2. Har bir o'quvchi uchun:
   - "index": tartib raqami (1, 2, 3...)
   - "fullName": o'quvchining to'liq Familiyasi va Ismi (masalan: "Abdurahmonov Jasur")
   - "studentClass": sinfi (agar hujjatda bo'lsa, masalan "7-A", bo'lmasa "")
3. Umumiy ma'lumotlar:
   - "schoolName": maktab nomi (agar aniqlansa)
   - "className": sinf nomi (masalan: "7-A")
   - "subject": fan nomi (agar aniqlansa)
   - "academicYear": o'quv yili (agar aniqlansa)

Javobni FAQAT toza JSON formatida quyidagicha qaytaring:
{
  "schoolName": "...",
  "className": "...",
  "subject": "...",
  "academicYear": "...",
  "students": [
    {
      "index": 1,
      "fullName": "Familiya Ism",
      "studentClass": "7-A"
    }
  ]
}`;

    const cleanBase64 = imageData.includes('base64,')
      ? imageData.split('base64,')[1]
      : imageData;

    const contentsParts: any[] = [
      {
        inlineData: {
          mimeType: mimeType || (isPdf ? 'application/pdf' : 'image/jpeg'),
          data: cleanBase64,
        },
      },
      {
        text: `Ushbu ${isPdf ? 'PDF hujjat' : 'tasvir'}dan barcha o'quvchilar ro'yxatini (tartib raqami, Familiya va Ismlari, sinfi) to'liq ajratib bering. Qo'shimcha: ${promptText || ''}`,
      },
    ];

    const response = await callGeminiWithFallback({
      contents: contentsParts,
      systemInstruction,
      responseMimeType: 'application/json',
      thinkingLevel: ThinkingLevel.LOW,
      temperature: 0.1,
    });

    const responseText = response.text || '{}';
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Sun'iy intellekt javobini o'qib bo'lmadi.");
      }
    }

    res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Roster parse error:', error);
    const msg = String(error?.message || '');
    const isOverloaded = msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE');

    res.status(isOverloaded ? 503 : 500).json({
      error: isOverloaded
        ? "Google AI serverlarida qisqa muddatli yuqori yuklama (503). Iltimos, 5-10 soniya kutib qayta urinib ko'ring yoki 'Matn / Ro'yxat' orqali kiriting."
        : error.message || "Ro'yxatni tahlil qilishda xatolik yuz berdi.",
      isOverloaded,
    });
  }
});

// 2. Save a new test
app.post('/api/tests', (req, res) => {
  try {
    const testData: Omit<TestItem, 'id' | 'createdAt'> = req.body;
    const id = 'test-' + Date.now();

    const chosenCode = testData.code && testData.code.trim()
      ? testData.code.trim().toUpperCase()
      : `${testData.testType || 'BSB'}-${Math.floor(100 + Math.random() * 900)}`;

    // Check if code taken
    const existing = Array.from(testsStore.values()).find(
      (t) => t.code.toUpperCase() === chosenCode
    );
    if (existing) {
      return res.status(400).json({
        error: `"${chosenCode}" kodi boshqa testda allaqachon ishlatilmoqda. Iltimos, boshqa kod tanlang.`,
      });
    }

    const newTest: TestItem = {
      ...testData,
      id,
      code: chosenCode,
      createdAt: new Date().toISOString(),
    };

    testsStore.set(id, newTest);
    submissionsStore.set(id, []);
    saveToDisk();

    res.json({ success: true, test: newTest });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Edit / Update existing test (e.g. modify title, questions, roster, etc.)
app.put('/api/tests/:id', (req, res) => {
  try {
    const id = req.params.id;
    const test = testsStore.get(id);
    if (!test) return res.status(404).json({ error: 'Test topilmadi' });

    const newCode = (req.body.code || test.code).trim().toUpperCase();
    if (newCode !== test.code) {
      const codeTaken = Array.from(testsStore.values()).find(
        (t) => t.id !== id && t.code.toUpperCase() === newCode
      );
      if (codeTaken) {
        return res.status(400).json({
          error: `"${newCode}" kodi boshqa testda mavjud! Boshqa kod kiriting.`,
        });
      }
    }

    const updated: TestItem = {
      ...test,
      ...req.body,
      id,
      code: newCode,
    };

    testsStore.set(id, updated);
    saveToDisk();

    res.json({ success: true, test: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Update ONLY test code (Quick edit from teacher UI)
app.put('/api/tests/:id/code', (req, res) => {
  try {
    const id = req.params.id;
    const { newCode } = req.body;
    if (!newCode || !newCode.trim()) {
      return res.status(400).json({ error: 'Kodni kiritish shart' });
    }
    const cleanCode = newCode.trim().toUpperCase();

    const existing = Array.from(testsStore.values()).find(
      (t) => t.id !== id && t.code.toUpperCase() === cleanCode
    );
    if (existing) {
      return res.status(400).json({
        error: `"${cleanCode}" kodi boshqa testda band! Boshqa kod tanlang.`,
      });
    }

    const test = testsStore.get(id);
    if (!test) return res.status(404).json({ error: 'Test topilmadi' });

    test.code = cleanCode;
    testsStore.set(id, test);
    saveToDisk();

    res.json({ success: true, test });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. List all tests for teacher
app.get('/api/tests', (_req, res) => {
  const tests = Array.from(testsStore.values()).map((t) => {
    const subs = submissionsStore.get(t.id) || [];
    return {
      ...t,
      submissionCount: subs.length,
      averageScore: subs.length
        ? Math.round((subs.reduce((acc, s) => acc + s.score, 0) / subs.length) * 10) / 10
        : 0,
    };
  });
  res.json({ success: true, tests });
});

// 6. Get test by code (Student portal - supports Test Code OR individual Student Code)
app.get('/api/tests/by-code/:code', (req, res) => {
  const inputCode = req.params.code.trim().toUpperCase();

  let matchedTest: TestItem | undefined;
  let matchedStudent: StudentRosterItem | undefined;

  // 1. Direct test code match
  matchedTest = Array.from(testsStore.values()).find(
    (t) => t.code.toUpperCase() === inputCode
  );

  // 2. Or search within student roster codes
  if (!matchedTest) {
    for (const t of testsStore.values()) {
      if (t.roster) {
        const found = t.roster.find(
          (r) => r.studentCode.trim().toUpperCase() === inputCode
        );
        if (found) {
          matchedTest = t;
          matchedStudent = found;
          break;
        }
      }
    }
  }

  if (!matchedTest) {
    return res.status(404).json({
      error: `"${inputCode}" kodli test yoki o'quvchi topilmadi. O'qituvchingiz bergan kodni to'g'ri kiritganingizni tekshiring.`,
    });
  }

  const sanitizedQuestions = matchedTest.questions.map((q) => ({
    id: q.id,
    type: q.type,
    question: q.question,
    options: q.options,
    points: q.points,
    criteria: q.criteria,
  }));

  res.json({
    success: true,
    matchedStudent: matchedStudent || null,
    test: {
      id: matchedTest.id,
      code: matchedTest.code,
      title: matchedTest.title,
      subject: matchedTest.subject,
      grade: matchedTest.grade,
      term: matchedTest.term,
      testType: matchedTest.testType,
      durationMinutes: matchedTest.durationMinutes,
      totalPoints: matchedTest.totalPoints,
      showInstantResult: matchedTest.showInstantResult,
      allowReview: matchedTest.allowReview,
      questions: sanitizedQuestions,
    },
  });
});

// 7. Get test by ID (Teacher full details)
app.get('/api/tests/:id', (req, res) => {
  const test = testsStore.get(req.params.id);
  if (!test) return res.status(404).json({ error: 'Test topilmadi.' });
  res.json({ success: true, test });
});

// 8. Delete test
app.delete('/api/tests/:id', (req, res) => {
  const id = req.params.id;
  testsStore.delete(id);
  submissionsStore.delete(id);
  saveToDisk();
  res.json({ success: true });
});

// 9. Submit student answers
app.post('/api/tests/:id/submit', async (req, res) => {
  try {
    const testId = req.params.id;
    const test = testsStore.get(testId);
    if (!test) return res.status(404).json({ error: 'Test topilmadi.' });

    const {
      studentName,
      studentClass,
      answers,
      timeSpentSeconds,
      writtenImages = {},
      studentCode,
    } = req.body;
    if (!studentName || !studentName.trim()) {
      return res.status(400).json({ error: 'Familiya va ism kiritilishi shart.' });
    }

    let calculatedScore = 0;
    const writtenFeedback: Record<string, { score: number; comment: string }> = {};

    // 1. Instant check for multiple choice questions
    for (const q of test.questions) {
      if (q.type === 'multiple_choice') {
        const studentAns = (answers[q.id] || '').trim().toUpperCase();
        if (studentAns === (q.correctAnswer || '').trim().toUpperCase()) {
          calculatedScore += q.points;
        }
      }
    }

    // 2. Parallel evaluation for all written questions
    const writtenQuestions = test.questions.filter((q) => q.type === 'written');

    if (writtenQuestions.length > 0) {
      const evaluationTasks = writtenQuestions.map(async (q) => {
        const studentAns = (answers[q.id] || '').trim();
        const studentImg = (writtenImages[q.id] || '').trim();

        if (!studentAns && !studentImg) {
          return {
            id: q.id,
            score: 0,
            comment: 'Javob yozilmadi va daftardan rasm yuklanmadi.',
          };
        }

        if (studentImg) {
          // Multimodal notebook image evaluation using Gemini
          try {
            let mimeType = 'image/jpeg';
            let cleanBase64 = studentImg;
            if (studentImg.startsWith('data:')) {
              const commaIndex = studentImg.indexOf(',');
              const meta = studentImg.substring(0, commaIndex);
              cleanBase64 = studentImg.substring(commaIndex + 1);
              const match = meta.match(/data:([^;]+);base64/);
              if (match) mimeType = match[1];
            }

            const promptText = `Siz maktab o'qituvchisisiz. O'quvchining daftarga yozgan qo'lyozma yechimi fotosuratini BSB rasmiy mezonlari bo'yicha tezkor baholang:
Savol: ${q.question}
Rasmiy javob: ${q.correctAnswer}
BSB mezon (rubrika): ${q.criteria || "Bosqichma-bosqich yechim"}
Maksimal ball: ${q.points}
O'quvchi izohi: "${studentAns || 'Izohsiz'}"

Faqat qisqa JSON qaytaring:
{"score": <0-${q.points}>, "comment": "<mezon asosidagi 1 jumla qisqa tahlil>"}`;

            const aiEval = await callGeminiWithFallback({
              contents: [
                {
                  inlineData: {
                    mimeType,
                    data: cleanBase64,
                  },
                },
                {
                  text: promptText,
                },
              ],
              responseMimeType: 'application/json',
              thinkingLevel: ThinkingLevel.MINIMAL,
              temperature: 0.1,
              maxOutputTokens: 150,
              timeoutMs: 8000,
            });

            const parsed = JSON.parse(aiEval.text || '{}');
            const awarded = Math.min(q.points, Math.max(0, Number(parsed.score) || 0));
            return {
              id: q.id,
              score: awarded,
              comment: parsed.comment || "Daftardagi yechim BSB mezonlari bo'yicha tekshirildi.",
            };
          } catch (err: any) {
            console.warn(`[Notebook Grading] Fallback for ${q.id}:`, err?.message || err);
            const fallbackScore = Math.round(q.points * 0.7);
            return {
              id: q.id,
              score: fallbackScore,
              comment: "Daftar rasmi qabul qilindi. O'qituvchi tomonidan tasdiqlanishi kutilmoqda.",
            };
          }
        } else {
          // Text-only written answer evaluation
          try {
            const prompt = `Siz maktab o'qituvchisisiz. O'quvchi yozma javobini BSB mezoni bo'yicha tezkor baholang:
Savol: ${q.question}
Rasmiy javob: ${q.correctAnswer}
Mezon: ${q.criteria || "To'g'ri yondashuv"}
Maksimal ball: ${q.points}
O'quvchi javobi: "${studentAns}"

Faqat JSON qaytaring:
{"score": <0-${q.points}>, "comment": "<mezon asosidagi qisqa izoh>"}`;

            const aiEval = await callGeminiWithFallback({
              contents: prompt,
              responseMimeType: 'application/json',
              thinkingLevel: ThinkingLevel.MINIMAL,
              temperature: 0.1,
              maxOutputTokens: 120,
              timeoutMs: 6500,
            });

            const parsed = JSON.parse(aiEval.text || '{}');
            const awarded = Math.min(q.points, Math.max(0, Number(parsed.score) || 0));
            return {
              id: q.id,
              score: awarded,
              comment: parsed.comment || 'Tekshirildi.',
            };
          } catch (err: any) {
            const fallbackScore = Math.round(q.points * 0.7);
            return {
              id: q.id,
              score: fallbackScore,
              comment: "O'qituvchi tomonidan tasdiqlanishi kutilmoqda.",
            };
          }
        }
      });

      const evaluatedResults = await Promise.all(evaluationTasks);
      for (const res of evaluatedResults) {
        calculatedScore += res.score;
        writtenFeedback[res.id] = {
          score: res.score,
          comment: res.comment,
        };
      }
    }

    const percentage = Math.round((calculatedScore / test.totalPoints) * 100);
    const gradeScore = calculateUzbekGrade(percentage);

    const submission: StudentSubmission = {
      id: 'sub-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      testId: test.id,
      testCode: test.code,
      studentCode: studentCode ? String(studentCode).trim().toUpperCase() : undefined,
      studentName: studentName.trim(),
      studentClass: (studentClass || test.grade).trim(),
      submittedAt: new Date().toISOString(),
      timeSpentSeconds: timeSpentSeconds || 0,
      answers,
      writtenImages: Object.keys(writtenImages).length > 0 ? writtenImages : undefined,
      writtenFeedback,
      score: calculatedScore,
      maxScore: test.totalPoints,
      percentage,
      gradeScore,
    };

    const existingSubs = submissionsStore.get(testId) || [];
    existingSubs.unshift(submission);
    submissionsStore.set(testId, existingSubs);
    saveToDisk();

    res.json({
      success: true,
      submission: {
        ...submission,
        reviewQuestions: test.allowReview ? test.questions : undefined,
      },
    });
  } catch (err: any) {
    console.error('Submit error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 10. Get all submissions for a test (Teacher)
app.get('/api/tests/:id/submissions', (req, res) => {
  const testId = req.params.id;
  const subs = submissionsStore.get(testId) || [];
  res.json({ success: true, submissions: subs });
});

// 11. Update student grade manually (Teacher)
app.put('/api/tests/:testId/submissions/:subId', (req, res) => {
  const { testId, subId } = req.params;
  const { score, comment, questionId } = req.body;

  const subs = submissionsStore.get(testId) || [];
  const subIndex = subs.findIndex((s) => s.id === subId);

  if (subIndex === -1) {
    return res.status(404).json({ error: 'Natija topilmadi.' });
  }

  const sub = subs[subIndex];
  if (questionId && sub.writtenFeedback) {
    sub.writtenFeedback[questionId] = {
      score: Number(score),
      comment: comment || sub.writtenFeedback[questionId]?.comment || '',
    };
    const test = testsStore.get(testId);
    if (test) {
      let total = 0;
      for (const q of test.questions) {
        if (q.type === 'multiple_choice') {
          if (sub.answers[q.id]?.toUpperCase() === q.correctAnswer?.toUpperCase()) {
            total += q.points;
          }
        } else if (q.type === 'written') {
          total += sub.writtenFeedback[q.id]?.score || 0;
        }
      }
      sub.score = total;
      sub.percentage = Math.round((total / test.totalPoints) * 100);
      sub.gradeScore = calculateUzbekGrade(sub.percentage);
    }
  } else if (score !== undefined) {
    sub.score = Number(score);
    sub.percentage = Math.round((sub.score / sub.maxScore) * 100);
    sub.gradeScore = calculateUzbekGrade(sub.percentage);
  }

  subs[subIndex] = sub;
  submissionsStore.set(testId, subs);
  saveToDisk();

  res.json({ success: true, submission: sub });
});

// Vite Middleware
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
