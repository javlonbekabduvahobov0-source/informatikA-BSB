import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  CheckCircle,
  Copy,
  Download,
  Users,
  Award,
  Plus,
  Trash2,
  Eye,
  Printer,
  TrendingUp,
  Percent,
  Search,
  Filter,
  Check,
  FileSpreadsheet,
  KeyRound,
  Edit2,
  Lock,
  LogOut,
  FileType,
  UserPlus,
  Save,
  X,
  Camera,
} from 'lucide-react';
import { TestItem, Question, StudentSubmission, StudentRosterItem } from '../types';
import { exportTestResultsToExcel, exportRosterPinCodesToExcel } from '../utils/excel';
import { SubmissionModal } from './SubmissionModal';
import { PdfViewerModal } from './PdfViewerModal';
import { OfficialPdfBayonnomaModal } from './OfficialPdfBayonnomaModal';
import { ExcelPdfImportModal } from './ExcelPdfImportModal';

interface TeacherPortalProps {
  onStartStudentTest: (code: string) => void;
  onPrintTest: (test: TestItem) => void;
  onLogout: () => void;
}

export const TeacherPortal: React.FC<TeacherPortalProps> = ({
  onStartStudentTest,
  onPrintTest,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'tests' | 'results'>('create');
  const [tests, setTests] = useState<TestItem[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);

  // Creation Form State
  const [subject, setSubject] = useState('Matematika');
  const [grade, setGrade] = useState('7-sinf');
  const [testType, setTestType] = useState<'BSB' | 'CHSB' | 'Nazorat ishi'>('BSB');
  const [term, setTerm] = useState('1-chorak');
  const [format, setFormat] = useState<'multiple_choice' | 'written' | 'mixed'>('mixed');
  const [questionCount, setQuestionCount] = useState(5);
  const [durationMinutes, setDurationMinutes] = useState(40);
  const [customTestCode, setCustomTestCode] = useState('');
  const [promptText, setPromptText] = useState('');

  // File Upload state (Image or PDF)
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileMime, setFileMime] = useState('image/jpeg');
  const [isPdfFile, setIsPdfFile] = useState(false);

  const [parsingAI, setParsingAI] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Editor for test before saving
  const [editingTest, setEditingTest] = useState<{
    id?: string;
    title: string;
    code: string;
    questions: Question[];
    roster?: StudentRosterItem[];
    pdfData?: string;
    pdfName?: string;
  } | null>(null);

  const [savingTest, setSavingTest] = useState(false);
  const [createdSuccessTest, setCreatedSuccessTest] = useState<TestItem | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Quick Code Edit Modal
  const [codeEditTarget, setCodeEditTarget] = useState<TestItem | null>(null);
  const [newCodeInput, setNewCodeInput] = useState('');
  const [codeEditError, setCodeEditError] = useState<string | null>(null);
  const [savingCode, setSavingCode] = useState(false);

  // Student Roster Manager Modal
  const [rosterTarget, setRosterTarget] = useState<TestItem | null>(null);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentCode, setNewStudentCode] = useState('');
  const [newStudentClass, setNewStudentClass] = useState('');

  // Results Tab State
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [searchStudent, setSearchStudent] = useState('');
  const [filterGrade, setFilterGrade] = useState<number | 'all'>('all');
  const [inspectSubmission, setInspectSubmission] = useState<StudentSubmission | null>(null);

  // Modals for PDF Viewer and Official PDF Bayonnoma
  const [viewPdfTarget, setViewPdfTarget] = useState<{ pdfData: string; fileName?: string } | null>(
    null
  );
  const [showOfficialPdfModal, setShowOfficialPdfModal] = useState(false);
  const [showExcelPdfImportModal, setShowExcelPdfImportModal] = useState(false);

  // Official Excel Export Settings Modal
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [schoolName, setSchoolName] = useState("14-sonli umumiy o'rta ta'lim maktabi");
  const [teacherFullName, setTeacherFullName] = useState('Sobirova Nilufar');
  const [academicYear, setAcademicYear] = useState('2024-2025');

  // Fast AI Parsing Timer
  const [parseSeconds, setParseSeconds] = useState(0);

  useEffect(() => {
    let interval: any;
    if (parsingAI) {
      setParseSeconds(0);
      interval = setInterval(() => {
        setParseSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [parsingAI]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch tests
  const fetchTests = async () => {
    try {
      setLoadingTests(true);
      const res = await fetch('/api/tests');
      const data = await res.json();
      if (data.success && data.tests) {
        setTests(data.tests);
        if (data.tests.length > 0 && !selectedTestId) {
          setSelectedTestId(data.tests[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching tests:', err);
    } finally {
      setLoadingTests(false);
    }
  };

  useEffect(() => {
    fetchTests();
  }, []);

  // Fetch submissions when selectedTestId changes
  useEffect(() => {
    if (!selectedTestId) return;
    const fetchSubmissions = async () => {
      try {
        setLoadingSubmissions(true);
        const res = await fetch(`/api/tests/${selectedTestId}/submissions`);
        const data = await res.json();
        if (data.success) {
          setSubmissions(data.submissions || []);
        }
      } catch (err) {
        console.error('Error fetching submissions:', err);
      } finally {
        setLoadingSubmissions(false);
      }
    };
    fetchSubmissions();
  }, [selectedTestId]);

  // Handle Image or PDF upload
  const handleFileUpload = (file: File) => {
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    setIsPdfFile(isPdf);
    setFileName(file.name);
    setFileMime(isPdf ? 'application/pdf' : file.type || 'image/jpeg');

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setFileBase64(result);
      setFilePreview(isPdf ? null : result);
    };
    reader.readAsDataURL(file);
  };

  // Sample prompt fillers
  const loadPresetSample = (presetType: 'math' | 'physics' | 'lang') => {
    if (presetType === 'math') {
      setSubject('Matematika');
      setGrade('7-sinf');
      setTestType('BSB');
      setCustomTestCode('7A-MAT');
      setTerm('1-chorak');
      setFormat('mixed');
      setPromptText(
        "7-sinf Matematika kursi bo'yicha 1-BSB: Chiziqli tenglamalar, burchaklar, kasrlar va to'g'ri to'rtburchak perimetri bo'yicha amaliy masalalar tuzilsin."
      );
    } else if (presetType === 'physics') {
      setSubject('Fizika');
      setGrade('9-sinf');
      setTestType('CHSB');
      setCustomTestCode('9B-FIZ');
      setTerm('2-chorak');
      setFormat('mixed');
      setPromptText(
        "9-sinf Fizika 2-CHSB: Nyuton qonunlari, butun olam tortishish qonuni, mexanik ish va quvvat mavzularidan 4 ta test va 1 ta yozma masala."
      );
    } else {
      setSubject('Ona tili va adabiyot');
      setGrade('8-sinf');
      setTestType('BSB');
      setCustomTestCode('8A-ONA');
      setTerm('1-chorak');
      setFormat('mixed');
      setPromptText(
        "8-sinf Ona tili 1-BSB: So'z birikmalari, ergashgan qo'shma gaplar, orfografiya va kichik ijodiy yozma fikr bildirish topshirig'i."
      );
    }
  };

  // Trigger Gemini AI to parse PDF, Image or Text
  const handleParseWithGemini = async () => {
    if (!promptText && !fileBase64) {
      setParseError('Iltimos, rasm yoki PDF yuklang yoki savollar matnini kiriting.');
      return;
    }

    try {
      setParsingAI(true);
      setParseError(null);

      const res = await fetch('/api/gemini/parse-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptText,
          imageData: fileBase64,
          mimeType: fileMime,
          subject,
          grade,
          testType,
          format,
          questionCount,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Sun'iy intellekt orqali test yaratib bo'lmadi.");
      }

      const generated = data.data;
      const initialCode = customTestCode.trim()
        ? customTestCode.trim().toUpperCase()
        : `${testType}-${Math.floor(100 + Math.random() * 900)}`;

      setEditingTest({
        title: generated.title || `${grade} ${subject}: ${testType} sinovi`,
        code: initialCode,
        questions: (generated.questions || []).map((q: any, i: number) => {
          let cogLevel: 'Bilish' | "Qo'llash" | 'Mulohaza' = q.cognitiveLevel;
          if (!cogLevel) {
            if (i < 6) cogLevel = 'Bilish';
            else if (i < 12) cogLevel = "Qo'llash";
            else cogLevel = 'Mulohaza';
          }
          return {
            id: q.id || `q_${i + 1}`,
            type: q.type || 'multiple_choice',
            cognitiveLevel: cogLevel,
            question: q.question || '',
            options: q.options || [
              { key: 'A', text: 'Variant A' },
              { key: 'B', text: 'Variant B' },
              { key: 'C', text: 'Variant C' },
              { key: 'D', text: 'Variant D' },
            ],
            correctAnswer: q.correctAnswer || 'A',
            points: Number(q.points) || (cogLevel === 'Bilish' ? 2 : cogLevel === "Qo'llash" ? 3 : 4),
            explanation: q.explanation || '',
            criteria: q.criteria || '',
            rubricSteps: q.rubricSteps || [],
          };
        }),
        roster: [],
        pdfData: fileBase64 || undefined,
        pdfName: fileName || undefined,
      });
    } catch (err: any) {
      setParseError(err.message || 'Xatolik yuz berdi.');
    } finally {
      setParsingAI(false);
    }
  };

  // Save new test or update existing
  const handleSaveAndPublish = async () => {
    if (!editingTest || editingTest.questions.length === 0) return;

    try {
      setSavingTest(true);
      const totalPts = editingTest.questions.reduce((acc, q) => acc + (q.points || 0), 0);

      const payload = {
        code: editingTest.code.trim().toUpperCase(),
        title: editingTest.title.trim(),
        subject,
        grade,
        term,
        testType,
        format,
        durationMinutes,
        totalPoints: totalPts || 25,
        teacherName: teacherFullName || "Sobirova Nilufar O'qituvchi",
        showInstantResult: true,
        allowReview: true,
        questions: editingTest.questions,
        roster: editingTest.roster || [],
        pdfData: editingTest.pdfData || fileBase64 || undefined,
        pdfName: editingTest.pdfName || fileName || undefined,
      };

      const url = editingTest.id ? `/api/tests/${editingTest.id}` : '/api/tests';
      const method = editingTest.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Testni saqlashda xatolik yuz berdi.');
      }

      setCreatedSuccessTest(data.test);
      setEditingTest(null);
      setFileBase64(null);
      setFilePreview(null);
      setFileName(null);
      setPromptText('');
      setCustomTestCode('');
      fetchTests();
    } catch (err: any) {
      alert(err.message || 'Xatolik yuz berdi');
    } finally {
      setSavingTest(false);
    }
  };

  // Save updated test code
  const handleSaveNewCode = async () => {
    if (!codeEditTarget || !newCodeInput.trim()) return;
    try {
      setSavingCode(true);
      setCodeEditError(null);
      const res = await fetch(`/api/tests/${codeEditTarget.id}/code`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newCode: newCodeInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Kodni o\'zgartirishda xatolik.');
      }

      setCodeEditTarget(null);
      setNewCodeInput('');
      fetchTests();
    } catch (err: any) {
      setCodeEditError(err.message);
    } finally {
      setSavingCode(false);
    }
  };

  // Add student to roster
  const handleAddStudentToRoster = async () => {
    if (!rosterTarget || !newStudentName.trim() || !newStudentCode.trim()) return;
    const currentRoster = rosterTarget.roster || [];

    const newRosterItem: StudentRosterItem = {
      id: 'rost-' + Date.now(),
      name: newStudentName.trim(),
      studentCode: newStudentCode.trim().toUpperCase(),
      studentClass: newStudentClass.trim() || rosterTarget.grade,
    };

    const updatedRoster = [...currentRoster, newRosterItem];

    try {
      const res = await fetch(`/api/tests/${rosterTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roster: updatedRoster }),
      });
      const data = await res.json();
      if (data.success) {
        setRosterTarget(data.test);
        setNewStudentName('');
        setNewStudentCode('');
        fetchTests();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Remove student from roster
  const handleRemoveStudentFromRoster = async (studentId: string) => {
    if (!rosterTarget) return;
    const updatedRoster = (rosterTarget.roster || []).filter((r) => r.id !== studentId);
    try {
      const res = await fetch(`/api/tests/${rosterTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roster: updatedRoster }),
      });
      const data = await res.json();
      if (data.success) {
        setRosterTarget(data.test);
        fetchTests();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Auto-generate roster codes (e.g. 1..30)
  const handleAutoGenerateRoster = async () => {
    if (!rosterTarget) return;
    const prefix = rosterTarget.grade.replace(/[^0-9A-Za-z]/g, '') || 'S';
    const sampleNames = [
      'Aliyev Vali',
      'Karimov Jasur',
      'Sobirova Madina',
      'Toshmatov Bobur',
      'Ismoilova Sevara',
      'Rahmonov Diyor',
      'Hakimova Nilufar',
      'Yusupov Jamshid',
    ];

    const generatedRoster: StudentRosterItem[] = sampleNames.map((name, i) => ({
      id: 'rost-' + Date.now() + '-' + i,
      name,
      studentCode: `${prefix}-${(i + 1).toString().padStart(2, '0')}`,
      studentClass: rosterTarget.grade,
    }));

    try {
      const res = await fetch(`/api/tests/${rosterTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roster: generatedRoster }),
      });
      const data = await res.json();
      if (data.success) {
        setRosterTarget(data.test);
        fetchTests();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Copy code helper
  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Delete test
  const handleDeleteTest = async (testId: string) => {
    if (!window.confirm("Testni o'chirishni tasdiqlaysizmi?")) return;
    try {
      await fetch(`/api/tests/${testId}`, { method: 'DELETE' });
      fetchTests();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Open existing test in editor
  const handleEditExistingTest = (test: TestItem) => {
    setSubject(test.subject);
    setGrade(test.grade);
    setTestType(test.testType);
    setTerm(test.term);
    setDurationMinutes(test.durationMinutes);
    setEditingTest({
      id: test.id,
      title: test.title,
      code: test.code,
      questions: test.questions,
      roster: test.roster,
      pdfData: test.pdfData,
      pdfName: test.pdfName,
    });
    setActiveTab('create');
  };

  // Filtered Submissions
  const currentTest = tests.find((t) => t.id === selectedTestId);
  const filteredSubmissions = submissions.filter((sub) => {
    const matchesSearch =
      sub.studentName.toLowerCase().includes(searchStudent.toLowerCase()) ||
      sub.studentClass.toLowerCase().includes(searchStudent.toLowerCase());
    const matchesGrade = filterGrade === 'all' || sub.gradeScore === filterGrade;
    return matchesSearch && matchesGrade;
  });

  const totalStudents = submissions.length;
  const count5 = submissions.filter((s) => s.gradeScore === 5).length;
  const count4 = submissions.filter((s) => s.gradeScore === 4).length;
  const count3 = submissions.filter((s) => s.gradeScore === 3).length;
  const count2 = submissions.filter((s) => s.gradeScore === 2).length;

  const qualityPercentage =
    totalStudents > 0 ? Math.round(((count5 + count4) / totalStudents) * 100) : 0;
  const masteryPercentage =
    totalStudents > 0 ? Math.round(((count5 + count4 + count3) / totalStudents) * 100) : 0;
  const avgScore =
    totalStudents > 0
      ? (submissions.reduce((a, s) => a + s.score, 0) / totalStudents).toFixed(1)
      : '0';

  return (
    <div className="space-y-6">
      {/* Top Bar with Teacher Info & Lock/Logout */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-slate-800">
                O'qituvchi Kabineti (Boshqaruv)
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                Himoyalangan
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Siz istalgan kompyuterdan o'z parolingiz bilan kirib testlarni tahrirlashingiz mumkin
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onLogout}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Kabinetni qulflash (Chiqish)</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-2xl p-1.5 border border-slate-200 shadow-xs flex flex-wrap gap-1">
        <button
          onClick={() => setActiveTab('create')}
          className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition ${
            activeTab === 'create'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Yangi BSB / CHSB Yaratish (PDF & Rasm)</span>
        </button>

        <button
          onClick={() => setActiveTab('tests')}
          className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition ${
            activeTab === 'tests'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Mening Testlarim & Kodlar ({tests.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('results')}
          className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition ${
            activeTab === 'results'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Natijalar & Excel Jadvali</span>
        </button>
      </div>

      {/* TAB 1: CREATE OR EDIT TEST */}
      {activeTab === 'create' && (
        <div className="space-y-6">
          {/* Success Banner */}
          {createdSuccessTest && (
            <div className="p-6 rounded-3xl bg-linear-to-r from-emerald-500 to-teal-600 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-center md:text-left">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">
                    Test muvaffaqiyatli saqlandi va faollashtirildi!
                  </h3>
                  <p className="text-xs text-emerald-100 mt-0.5">
                    {createdSuccessTest.title} • O'quvchilarga beriladigan kod:
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20">
                <span className="font-mono font-black text-xl px-3 py-1 bg-white text-emerald-800 rounded-xl">
                  {createdSuccessTest.code}
                </span>
                <button
                  onClick={() => handleCopy(createdSuccessTest.code)}
                  className="p-2.5 bg-white/20 hover:bg-white/30 rounded-xl text-white transition flex items-center gap-1 text-xs font-bold"
                >
                  {copiedCode === createdSuccessTest.code ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  Nusxalash
                </button>
                <button
                  onClick={() => onStartStudentTest(createdSuccessTest.code)}
                  className="px-3.5 py-2 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl font-bold text-xs shadow-xs transition"
                >
                  Sinab ko'rish →
                </button>
              </div>
            </div>
          )}

          {/* Test Editor if questions ready */}
          {editingTest ? (
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold uppercase text-slate-500">
                      O'quvchi kirish kodi:
                    </span>
                    <input
                      type="text"
                      value={editingTest.code}
                      onChange={(e) =>
                        setEditingTest({
                          ...editingTest,
                          code: e.target.value.toUpperCase(),
                        })
                      }
                      className="px-3 py-1 text-sm font-black font-mono bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg w-36 uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-[11px] text-slate-400">
                      (Xohlagan kodni yozishingiz mumkin)
                    </span>
                  </div>

                  <input
                    type="text"
                    value={editingTest.title}
                    onChange={(e) =>
                      setEditingTest({ ...editingTest, title: e.target.value })
                    }
                    className="block text-xl font-bold text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none w-full"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Savollarni ko'rib chiqing, kerak bo'lsa variantlarni yoki ballarni o'zgartiring.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingTest(null)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
                  >
                    Bekor qilish
                  </button>
                  <button
                    disabled={savingTest}
                    onClick={handleSaveAndPublish}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {savingTest ? 'Saqlanmoqda...' : 'Testni Saqlash va Kod Olish'}
                  </button>
                </div>
              </div>

              {/* Taxonomy Summary Bar (CHSB Bilish, Qo'llash, Mulohaza) */}
              <div className="bg-gradient-to-r from-slate-50 via-indigo-50/50 to-slate-50 border border-indigo-100 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-700">Jami savollar:</span>
                  <span className="px-3 py-1 bg-white border border-slate-200 rounded-xl font-black text-indigo-700 shadow-xs">
                    {editingTest.questions.length} ta
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="font-bold text-slate-700">Jami ball:</span>
                  <span className="px-3 py-1 bg-white border border-slate-200 rounded-xl font-black text-emerald-700 shadow-xs">
                    {editingTest.questions.reduce((acc, q) => acc + (q.points || 0), 0)} ball
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    Taksonomiya darajalari:
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100/80 text-blue-800 border border-blue-200 rounded-lg font-bold">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    Bilish: {editingTest.questions.filter((q) => (q.cognitiveLevel || 'Bilish') === 'Bilish').length} ta
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100/80 text-amber-900 border border-amber-200 rounded-lg font-bold">
                    <span className="w-2 h-2 rounded-full bg-amber-600" />
                    Qo'llash: {editingTest.questions.filter((q) => q.cognitiveLevel === "Qo'llash").length} ta
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100/80 text-purple-900 border border-purple-200 rounded-lg font-bold">
                    <span className="w-2 h-2 rounded-full bg-purple-600" />
                    Mulohaza: {editingTest.questions.filter((q) => q.cognitiveLevel === 'Mulohaza').length} ta
                  </span>
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-6">
                {editingTest.questions.map((q, qIndex) => (
                  <div
                    key={q.id}
                    className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">
                          {qIndex + 1}
                        </span>
                        <select
                          value={q.type}
                          onChange={(e) => {
                            const newQs = [...editingTest.questions];
                            newQs[qIndex].type = e.target.value as any;
                            setEditingTest({ ...editingTest, questions: newQs });
                          }}
                          className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white font-semibold"
                        >
                          <option value="multiple_choice">Ko'p tanlovli test (A, B, C, D)</option>
                          <option value="written">Ochiq yozma savol / Masala</option>
                        </select>

                        <select
                          value={q.cognitiveLevel || (qIndex < 6 ? 'Bilish' : qIndex < 12 ? "Qo'llash" : 'Mulohaza')}
                          onChange={(e) => {
                            const newQs = [...editingTest.questions];
                            newQs[qIndex].cognitiveLevel = e.target.value as any;
                            setEditingTest({ ...editingTest, questions: newQs });
                          }}
                          className={`px-2.5 py-1 text-xs border rounded-lg font-bold ${
                            (q.cognitiveLevel || 'Bilish') === 'Bilish'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : q.cognitiveLevel === "Qo'llash"
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-purple-50 text-purple-800 border-purple-200'
                          }`}
                        >
                          <option value="Bilish">🟦 Bilish (1-daraja)</option>
                          <option value="Qo'llash">🟨 Qo'llash (2-daraja)</option>
                          <option value="Mulohaza">🟪 Mulohaza (3-daraja)</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <label className="text-xs text-slate-500 font-semibold">Ball:</label>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={q.points}
                            onChange={(e) => {
                              const newQs = [...editingTest.questions];
                              newQs[qIndex].points = Number(e.target.value) || 1;
                              setEditingTest({ ...editingTest, questions: newQs });
                            }}
                            className="w-14 px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white font-bold text-center"
                          />
                        </div>

                        <button
                          onClick={() => {
                            const newQs = editingTest.questions.filter((_, idx) => idx !== qIndex);
                            setEditingTest({ ...editingTest, questions: newQs });
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <textarea
                        rows={2}
                        value={q.question}
                        onChange={(e) => {
                          const newQs = [...editingTest.questions];
                          newQs[qIndex].question = e.target.value;
                          setEditingTest({ ...editingTest, questions: newQs });
                        }}
                        className="w-full p-3 border border-slate-300 rounded-xl text-sm text-slate-800 bg-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        placeholder="Savol matnini kiriting..."
                      />
                    </div>

                    {q.type === 'multiple_choice' && q.options && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {q.options.map((opt, optIndex) => {
                          const isCorrect = (q.correctAnswer || '').toUpperCase() === opt.key;
                          return (
                            <div
                              key={opt.key}
                              className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                                isCorrect
                                  ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  const newQs = [...editingTest.questions];
                                  newQs[qIndex].correctAnswer = opt.key;
                                  setEditingTest({ ...editingTest, questions: newQs });
                                }}
                                className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition ${
                                  isCorrect
                                    ? 'bg-emerald-600 text-white'
                                    : 'border border-slate-300 text-slate-600 hover:bg-slate-100'
                                }`}
                                title="To'g'ri javob sifatida belgilash"
                              >
                                {opt.key}
                              </button>
                              <input
                                type="text"
                                value={opt.text}
                                onChange={(e) => {
                                  const newQs = [...editingTest.questions];
                                  if (newQs[qIndex].options) {
                                    newQs[qIndex].options![optIndex].text = e.target.value;
                                    setEditingTest({ ...editingTest, questions: newQs });
                                  }
                                }}
                                className="flex-1 text-xs text-slate-800 border-none bg-transparent focus:outline-none font-medium"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {q.type === 'written' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-slate-600 block mb-1">
                            To'g'ri namuna / Yechim:
                          </label>
                          <input
                            type="text"
                            value={q.correctAnswer}
                            onChange={(e) => {
                              const newQs = [...editingTest.questions];
                              newQs[qIndex].correctAnswer = e.target.value;
                              setEditingTest({ ...editingTest, questions: newQs });
                            }}
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                            placeholder="To'g'ri yechim va yakuniy javob..."
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 block mb-1">
                            Baholash mezoni (Rubrika):
                          </label>
                          <input
                            type="text"
                            value={q.criteria || ''}
                            onChange={(e) => {
                              const newQs = [...editingTest.questions];
                              newQs[qIndex].criteria = e.target.value;
                              setEditingTest({ ...editingTest, questions: newQs });
                            }}
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                            placeholder="Masalan: formula 2 ball, hisoblash 3 ball..."
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <input
                        type="text"
                        value={q.explanation || ''}
                        onChange={(e) => {
                          const newQs = [...editingTest.questions];
                          newQs[qIndex].explanation = e.target.value;
                          setEditingTest({ ...editingTest, questions: newQs });
                        }}
                        className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-100/70 text-slate-600"
                        placeholder="O'quvchi uchun tushuntirish (ixtiyoriy)..."
                      />
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => {
                    const newQ: Question = {
                      id: `q_${Date.now()}`,
                      type: 'multiple_choice',
                      cognitiveLevel: 'Bilish',
                      question: 'Yangi savol matni',
                      options: [
                        { key: 'A', text: 'Variant A' },
                        { key: 'B', text: 'Variant B' },
                        { key: 'C', text: 'Variant C' },
                        { key: 'D', text: 'Variant D' },
                      ],
                      correctAnswer: 'A',
                      points: 2,
                    };
                    setEditingTest({
                      ...editingTest,
                      questions: [...editingTest.questions, newQ],
                    });
                  }}
                  className="w-full py-3 border-2 border-dashed border-slate-300 rounded-2xl text-xs font-bold text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Yangi savol qo'shish
                </button>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  disabled={savingTest}
                  onClick={handleSaveAndPublish}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg transition flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  {savingTest ? 'Saqlanmoqda...' : 'Testni Saqlash va Kod Olish'}
                </button>
              </div>
            </div>
          ) : (
            /* Creation Form */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form & Presets */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-800">
                        BSB va CHSB Test Konstruktori
                      </h2>
                      <p className="text-xs text-slate-500">
                        PDF hujjat, rasm yoki matndan bir zumda test savollarini shakllantiring
                      </p>
                    </div>
                  </div>

                  {/* Settings grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                        Fan
                      </label>
                      <select
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-white"
                      >
                        <option value="Matematika">Matematika</option>
                        <option value="Fizika">Fizika</option>
                        <option value="Ona tili va adabiyot">Ona tili va adabiyot</option>
                        <option value="Kimyo">Kimyo</option>
                        <option value="Biologiya">Biologiya</option>
                        <option value="Ingliz tili">Ingliz tili</option>
                        <option value="Tarix">Tarix</option>
                        <option value="Geografiya">Geografiya</option>
                        <option value="Informatika">Informatika</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                        Sinf
                      </label>
                      <select
                        value={grade}
                        onChange={(e) => setGrade(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-white"
                      >
                        <option value="5-sinf">5-sinf</option>
                        <option value="6-sinf">6-sinf</option>
                        <option value="7-sinf">7-sinf</option>
                        <option value="8-sinf">8-sinf</option>
                        <option value="9-sinf">9-sinf</option>
                        <option value="10-sinf">10-sinf</option>
                        <option value="11-sinf">11-sinf</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                        Turi
                      </label>
                      <select
                        value={testType}
                        onChange={(e) => {
                          const newType = e.target.value as any;
                          setTestType(newType);
                          if (newType === 'CHSB') {
                            setQuestionCount(15);
                            setDurationMinutes(45);
                            setFormat('mixed');
                          } else if (newType === 'BSB') {
                            setQuestionCount(5);
                            setDurationMinutes(40);
                          }
                        }}
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white"
                      >
                        <option value="BSB">BSB (Baholash sinovi)</option>
                        <option value="CHSB">CHSB (Choraklik yakuniy - 15 ta savol)</option>
                        <option value="Nazorat ishi">Nazorat ishi</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                        Chorak
                      </label>
                      <select
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-white"
                      >
                        <option value="1-chorak">1-chorak</option>
                        <option value="2-chorak">2-chorak</option>
                        <option value="3-chorak">3-chorak</option>
                        <option value="4-chorak">4-chorak</option>
                      </select>
                    </div>
                  </div>

                  {/* Format, Question Count, Custom Code & Duration */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                        Test formati
                      </label>
                      <select
                        value={format}
                        onChange={(e) => setFormat(e.target.value as any)}
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-white"
                      >
                        <option value="mixed">Aralash (Test + Yozma)</option>
                        <option value="multiple_choice">Faqat testlar (A, B, C, D)</option>
                        <option value="written">Faqat ochiq yozma savollar</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1 flex items-center justify-between">
                        <span>Savollar soni</span>
                        {testType === 'CHSB' && (
                          <span className="text-[10px] text-indigo-700 bg-indigo-50 font-black px-1.5 py-0.5 rounded">
                            CHSB 15 ta
                          </span>
                        )}
                      </label>
                      <select
                        value={questionCount}
                        onChange={(e) => setQuestionCount(Number(e.target.value))}
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white"
                      >
                        {testType === 'CHSB' ? (
                          <>
                            <option value={15}>15 ta (CHSB standarti: Bilish, Qo'llash, Mulohaza)</option>
                            <option value={20}>20 ta savol</option>
                            <option value={25}>25 ta savol</option>
                            <option value={10}>10 ta savol</option>
                          </>
                        ) : (
                          <>
                            <option value={5}>5 ta (BSB standarti)</option>
                            <option value={10}>10 ta savol</option>
                            <option value={15}>15 ta savol</option>
                            <option value={20}>20 ta savol</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                        O'quvchi uchun Kod
                      </label>
                      <input
                        type="text"
                        placeholder="Masalan: 7A-CHSB yoki 701"
                        value={customTestCode}
                        onChange={(e) => setCustomTestCode(e.target.value.toUpperCase())}
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                        Ajratilgan vaqt
                      </label>
                      <select
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(Number(e.target.value))}
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-white"
                      >
                        <option value={20}>20 daqiqa</option>
                        <option value={30}>30 daqiqa</option>
                        <option value={40}>40 daqiqa (Dars soati)</option>
                        <option value={45}>45 daqiqa (CHSB tavsiya)</option>
                        <option value={60}>60 daqiqa</option>
                      </select>
                    </div>
                  </div>

                  {/* Informational banner when CHSB is active */}
                  {testType === 'CHSB' && (
                    <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-2xl flex items-start gap-3">
                      <div className="p-2 bg-indigo-600 text-white rounded-xl flex-shrink-0">
                        <Award className="w-5 h-5" />
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="font-bold text-indigo-950 flex items-center gap-2">
                          <span>CHSB (Choraklik summativ baholash) 15 talik mezon standarti faollashtirildi</span>
                          <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-black rounded-full">
                            15 TA SAVOL
                          </span>
                        </div>
                        <p className="text-indigo-700 leading-relaxed">
                          PDF hujjat yuklanganda barcha <strong>15 ta savol</strong> (yoki PDFdagi barcha savollar) to'liq ajratib olinadi va 3 ta bilish darajasi (taksonomiya) bo'yicha taqsimlanadi:
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <span className="px-2.5 py-1 bg-blue-100 text-blue-900 rounded-lg font-bold text-[11px] border border-blue-300 shadow-xs">
                            🟦 Bilish: 1–6 savollar (Qoida, atama, faktlar)
                          </span>
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-lg font-bold text-[11px] border border-amber-300 shadow-xs">
                            🟨 Qo'llash: 7–12 savollar (Formulalar, hisob-kitob)
                          </span>
                          <span className="px-2.5 py-1 bg-purple-100 text-purple-900 rounded-lg font-bold text-[11px] border border-purple-300 shadow-xs">
                            🟪 Mulohaza: 13–15 savollar (Tahliliy masalalar / Ochiq)
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Presets */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                      Tezkor Namunalar (1-klikda sinab ko'rish):
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => loadPresetSample('math')}
                        className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition"
                      >
                        📐 7-sinf Matematika BSB
                      </button>
                      <button
                        type="button"
                        onClick={() => loadPresetSample('physics')}
                        className="px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold transition"
                      >
                        ⚡ 9-sinf Fizika CHSB
                      </button>
                      <button
                        type="button"
                        onClick={() => loadPresetSample('lang')}
                        className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-semibold transition"
                      >
                        📖 8-sinf Ona tili BSB
                      </button>
                    </div>
                  </div>

                  {/* Text Prompt */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
                      Savollar matni yoki qo'shimcha topshiriq:
                    </label>
                    <textarea
                      rows={3}
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      placeholder="Masalan: Test savollarini shu yerga yozing yoki 'PDF fayldagi 1-variant BSB savollarini ajratib ber' deb yozing..."
                      className="w-full p-4 border border-slate-300 rounded-2xl text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {parseError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-800 rounded-xl">
                      {parseError}
                    </div>
                  )}

                  <button
                    disabled={parsingAI}
                    onClick={handleParseWithGemini}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-2xl text-sm shadow-xl shadow-indigo-100 transition flex items-center justify-center gap-2"
                  >
                    {parsingAI ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>
                          Tezkor AI tahlil qilmoqda ({parseSeconds} soniya)... PDF savollari ajratilmoqda
                        </span>
                      </div>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        <span>AI orqali savollarni ajratib olish va test shakllantirish</span>
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-center text-slate-400 flex items-center justify-center gap-1 font-medium">
                    <span>⚡ Gemini 3.8 Flash tezkor rejimi faollashtirilgan (2-4 soniyada tayyor bo'ladi)</span>
                  </p>
                </div>
              </div>

              {/* Right Column: PDF or Image Dropzone */}
              <div className="space-y-6">
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <FileType className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-bold text-slate-800 text-sm">
                      PDF Fayl yoki Rasm yuklash
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    BSB topshiriq kitobi (PDF), test varaqasi, kitob sahifasi yoki daftardagi masala
                    rasmini yuklang.
                  </p>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*,application/pdf,.pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  {fileBase64 ? (
                    <div className="space-y-3">
                      {isPdfFile ? (
                        <div className="p-6 rounded-2xl border-2 border-indigo-200 bg-indigo-50/50 flex flex-col items-center justify-center text-center">
                          <div className="w-14 h-14 rounded-2xl bg-rose-600 text-white flex items-center justify-center mb-3 shadow-md">
                            <FileText className="w-8 h-8" />
                          </div>
                          <p className="font-bold text-sm text-slate-800 line-clamp-1">{fileName}</p>
                          <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold mt-1">
                            PDF Hujjat yuklandi
                          </span>
                        </div>
                      ) : (
                        <div className="relative rounded-2xl overflow-hidden border border-slate-200 max-h-64 flex items-center justify-center bg-slate-100">
                          <img
                            src={filePreview!}
                            alt="Uploaded sheet"
                            className="object-contain max-h-64 w-full"
                          />
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
                        >
                          Boshqa fayl tanlash
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFileBase64(null);
                            setFilePreview(null);
                            setFileName(null);
                          }}
                          className="px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition"
                        >
                          O'chirish
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-8 text-center cursor-pointer transition hover:bg-indigo-50/20 group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 group-hover:bg-indigo-100 text-slate-500 group-hover:text-indigo-600 flex items-center justify-center mx-auto mb-3 transition">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-slate-700">
                        PDF yoki Rasm yuklash uchun bosing
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        .PDF, .PNG, .JPG, .JPEG (telefon kamerasi)
                      </p>
                    </div>
                  )}

                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      💡 BSB va CHSB PDF haqida:
                    </p>
                    <p className="leading-relaxed">
                      Maktab ta'limi vazirligi bergan rasmiy CHSB yoki BSB spetsifikatsiyasini PDF holida yuklasangiz, AI undagi barcha <strong>15 ta savolni</strong>, to'g'ri javoblar kalitini hamda <strong>Bilish, Qo'llash va Mulohaza</strong> mezonlarini avtomatik to'liq ajratib beradi.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY TESTS & CODES */}
      {activeTab === 'tests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800">
              Mening Testlarim ({tests.length})
            </h2>
            <button
              onClick={() => setActiveTab('create')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-4 h-4" /> Yangi test yaratish
            </button>
          </div>

          {loadingTests ? (
            <div className="p-12 text-center text-slate-400 text-sm">Testlar yuklanmoqda...</div>
          ) : tests.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-600">Hozircha testlar mavjud emas.</p>
              <button
                onClick={() => setActiveTab('create')}
                className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl"
              >
                Birinchi testni yaratish
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {tests.map((t) => (
                <div
                  key={t.id}
                  className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {t.testType}
                      </span>
                      <span className="text-xs text-slate-400">
                        {t.grade} • {t.term}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-800 text-base line-clamp-2">{t.title}</h3>

                    {/* PIN Code Box with Edit Code button */}
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          O'quvchi Kiritish Kodi
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-lg text-slate-800 tracking-wider">
                            {t.code}
                          </span>
                          <button
                            onClick={() => {
                              setCodeEditTarget(t);
                              setNewCodeInput(t.code);
                              setCodeEditError(null);
                            }}
                            className="p-1 text-slate-400 hover:text-indigo-600 transition"
                            title="Kodni o'zgartirish"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCopy(t.code)}
                          className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                        >
                          {copiedCode === t.code ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          Nusxa
                        </button>
                      </div>
                    </div>

                    {/* Stats & Roster info */}
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 rounded-xl bg-slate-50">
                        <span className="text-slate-400 block text-[10px]">Savollar</span>
                        <span className="font-bold text-slate-700">{t.questions.length} ta</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50">
                        <span className="text-slate-400 block text-[10px]">Maks. Ball</span>
                        <span className="font-bold text-slate-700">{t.totalPoints}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50">
                        <span className="text-slate-400 block text-[10px]">Topshirgan</span>
                        <span className="font-bold text-indigo-600">
                          {t.submissionCount || 0} nafar
                        </span>
                      </div>
                    </div>

                    {/* Student personal PIN codes count & Excel download */}
                    <div className="flex items-center justify-between text-xs pt-1 gap-2">
                      <button
                        onClick={() => setRosterTarget(t)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                        title="O'quvchilar ro'yxati va PIN-kodlarini ko'rish"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>
                          PIN-kodlar ({t.roster?.length || 0})
                        </span>
                      </button>

                      <button
                        onClick={() =>
                          exportRosterPinCodesToExcel(t, {
                            schoolName,
                            teacherName: teacherFullName,
                            academicYear,
                          })
                        }
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1 transition shadow-2xs"
                        title="O'quvchilar PIN-kodlari ro'yxatini Excel (.xlsx) faylda yuklab olish"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>PIN Excel (.xlsx)</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-wrap">
                    <button
                      onClick={() => {
                        setSelectedTestId(t.id);
                        setActiveTab('results');
                      }}
                      className="flex-1 min-w-[90px] py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Natijalar
                    </button>

                    {t.pdfData && (
                      <button
                        onClick={() =>
                          setViewPdfTarget({
                            pdfData: t.pdfData!,
                            fileName: t.pdfName || `${t.subject}_${t.testType}.pdf`,
                          })
                        }
                        className="px-2.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition flex items-center gap-1 text-xs font-bold border border-rose-200"
                        title="Yuklangan asl BSB PDF faylini ko'rish"
                      >
                        <FileText className="w-3.5 h-3.5 text-rose-600" />
                        <span>PDF</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleEditExistingTest(t)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
                      title="Savollarni tahrirlash"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onPrintTest(t)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
                      title="Qog'ozga chop etish"
                    >
                      <Printer className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteTest(t.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                      title="O'chirish"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RESULTS & EXCEL */}
      {activeTab === 'results' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="w-full md:w-auto">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Testni tanlang:
              </label>
              <select
                value={selectedTestId}
                onChange={(e) => setSelectedTestId(e.target.value)}
                className="w-full md:w-80 p-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 bg-white"
              >
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.code}] {t.grade} {t.subject} ({t.testType})
                  </option>
                ))}
              </select>
            </div>

            {currentTest && (
              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
                {currentTest.pdfData && (
                  <button
                    onClick={() =>
                      setViewPdfTarget({
                        pdfData: currentTest.pdfData!,
                        fileName:
                          currentTest.pdfName ||
                          `${currentTest.subject}_${currentTest.testType}.pdf`,
                      })
                    }
                    className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-2xs"
                    title="Yuklangan asl BSB PDF faylini ko'rish"
                  >
                    <FileText className="w-4 h-4 text-rose-600" />
                    <span>Asl BSB PDF</span>
                  </button>
                )}

                <button
                  onClick={() => setShowExcelPdfImportModal(true)}
                  className="px-4 py-2.5 bg-linear-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2"
                  title="Tayyor PDF/Excel jadvalni yuklab, familiyalarni o'zi topib baholarni to'ldirish"
                >
                  <Sparkles className="w-4 h-4 text-emerald-200" />
                  <span>PDF Jadval orqali To'ldirish</span>
                </button>

                <button
                  onClick={() => setShowOfficialPdfModal(true)}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2"
                  title="O'zbekiston Respublikasi Vazirlik standarti bo'yicha rasmiy bayonnoma"
                >
                  <FileSpreadsheet className="w-4 h-4 text-indigo-200" />
                  <span>Rasmiy PDF Bayonnoma</span>
                </button>

                <button
                  onClick={() =>
                    exportRosterPinCodesToExcel(currentTest, {
                      schoolName,
                      teacherName: teacherFullName,
                      academicYear,
                    })
                  }
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2"
                  title="O'quvchilarning shaxsiy PIN-kodlari ro'yxatini Excelda yuklab olish"
                >
                  <KeyRound className="w-4 h-4 text-amber-100" />
                  <span>PIN-kodlar Jadvali (.xlsx)</span>
                </button>

                <button
                  onClick={() => onPrintTest(currentTest)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" /> Savolnoma (PDF)
                </button>

                <button
                  onClick={() => setShowExcelModal(true)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Rasmiy Excel (.xlsx)
                </button>
              </div>
            )}
          </div>

          {currentTest && (
            <>
              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-bold uppercase">Topshirganlar</span>
                    <Users className="w-5 h-5 text-indigo-600" />
                  </div>
                  <p className="text-2xl font-black text-slate-800">{totalStudents} nafar</p>
                  <span className="text-xs text-slate-400 mt-1 block">
                    Maksimal: {currentTest.totalPoints} ball
                  </span>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-bold uppercase">O'rtacha Ball</span>
                    <Award className="w-5 h-5 text-amber-500" />
                  </div>
                  <p className="text-2xl font-black text-slate-800">{avgScore} ball</p>
                  <span className="text-xs text-slate-400 mt-1 block">
                    {totalStudents > 0
                      ? Math.round((Number(avgScore) / currentTest.totalPoints) * 100)
                      : 0}
                    % o'zlashtirish
                  </span>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-bold uppercase">Sifat Ko'rsatkichi</span>
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <p className="text-2xl font-black text-emerald-600">{qualityPercentage}%</p>
                  <span className="text-xs text-slate-500 mt-1 block">
                    "4" va "5" baholar ulushi
                  </span>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-bold uppercase">O'zlashtirish</span>
                    <Percent className="w-5 h-5 text-purple-600" />
                  </div>
                  <p className="text-2xl font-black text-purple-600">{masteryPercentage}%</p>
                  <span className="text-xs text-slate-500 mt-1 block">
                    "3", "4", "5" baholar ulushi
                  </span>
                </div>
              </div>

              {/* Table search & filter */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="O'quvchi ismi yoki sinf bo'yicha qidirish..."
                      value={searchStudent}
                      onChange={(e) => setSearchStudent(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select
                      value={filterGrade}
                      onChange={(e) =>
                        setFilterGrade(e.target.value === 'all' ? 'all' : Number(e.target.value))
                      }
                      className="p-2 text-xs border border-slate-300 rounded-xl bg-white font-semibold"
                    >
                      <option value="all">Barcha baholar</option>
                      <option value="5">Faqat 5 (A'lo)</option>
                      <option value="4">Faqat 4 (Yaxshi)</option>
                      <option value="3">Faqat 3 (Qoniqarli)</option>
                      <option value="2">Faqat 2 (Qoniqarsiz)</option>
                    </select>
                  </div>
                </div>

                {/* Submissions Table with question breakdown */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-3">T/r</th>
                        <th className="py-3 px-3">Familiya va Ismi</th>
                        <th className="py-3 px-2">Sinf</th>
                        {currentTest.questions.map((q, qIdx) => (
                          <th key={q.id} className="py-3 px-2 text-center whitespace-nowrap">
                            {qIdx + 1}-topsh. ({q.points}b)
                          </th>
                        ))}
                        <th className="py-3 px-3 text-center">Jami</th>
                        <th className="py-3 px-2 text-center">Foiz</th>
                        <th className="py-3 px-2 text-center">Baho</th>
                        <th className="py-3 px-3">Sarflangan Vaqt</th>
                        <th className="py-3 px-3 text-right">Amallar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSubmissions.length === 0 ? (
                        <tr>
                          <td
                            colSpan={currentTest.questions.length + 8}
                            className="py-8 text-center text-slate-400"
                          >
                            Hozircha natijalar mavjud emas yoki qidiruv bo'yicha topilmadi.
                          </td>
                        </tr>
                      ) : (
                        filteredSubmissions.map((sub, idx) => {
                          let badgeBg = 'bg-rose-100 text-rose-800 border-rose-300';
                          if (sub.gradeScore === 5)
                            badgeBg = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                          else if (sub.gradeScore === 4)
                            badgeBg = 'bg-blue-100 text-blue-800 border-blue-300';
                          else if (sub.gradeScore === 3)
                            badgeBg = 'bg-amber-100 text-amber-800 border-amber-300';

                          return (
                            <tr key={sub.id} className="hover:bg-slate-50/80 transition">
                              <td className="py-3 px-3 font-bold text-slate-400">{idx + 1}</td>
                              <td className="py-3 px-3 font-bold text-slate-800 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span>{sub.studentName}</span>
                                  {sub.writtenImages && Object.keys(sub.writtenImages).length > 0 && (
                                    <span
                                      title="O'quvchi daftarga yozib, fotosuratini yuklagan (AI tahlil qildi)"
                                      className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-700 flex items-center gap-1 border border-purple-200"
                                    >
                                      <Camera className="w-3 h-3" /> Daftardan rasm
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-2 font-semibold text-slate-600">
                                {sub.studentClass}
                              </td>
                              {currentTest.questions.map((q) => {
                                let score = 0;
                                if (q.type === 'multiple_choice') {
                                  if (
                                    (sub.answers[q.id] || '').trim().toUpperCase() ===
                                    (q.correctAnswer || '').trim().toUpperCase()
                                  ) {
                                    score = q.points;
                                  }
                                } else {
                                  score = sub.writtenFeedback?.[q.id]?.score || 0;
                                }
                                return (
                                  <td key={q.id} className="py-3 px-2 text-center font-bold">
                                    <span
                                      className={
                                        score > 0 ? 'text-emerald-700' : 'text-slate-400'
                                      }
                                    >
                                      {score}
                                    </span>
                                  </td>
                                );
                              })}
                              <td className="py-3 px-3 text-center font-bold text-slate-800 whitespace-nowrap">
                                {sub.score}{' '}
                                <span className="text-slate-400 text-[10px]">/{sub.maxScore}</span>
                              </td>
                              <td className="py-3 px-2 text-center font-bold text-indigo-600">
                                {sub.percentage}%
                              </td>
                              <td className="py-3 px-2 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full font-black text-xs ${badgeBg}`}
                                >
                                  {sub.gradeScore}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                                {Math.floor(sub.timeSpentSeconds / 60)} daq{' '}
                                {sub.timeSpentSeconds % 60} son
                              </td>
                              <td className="py-3 px-3 text-right whitespace-nowrap">
                                <button
                                  onClick={() => setInspectSubmission(sub)}
                                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition text-[11px]"
                                >
                                  Ko'rish
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {inspectSubmission && currentTest && (
            <SubmissionModal
              test={currentTest}
              submission={inspectSubmission}
              onClose={() => setInspectSubmission(null)}
              onUpdateScore={(updated) => {
                setSubmissions((prev) =>
                  prev.map((s) => (s.id === updated.id ? updated : s))
                );
                setInspectSubmission(updated);
              }}
            />
          )}
        </div>
      )}

      {/* QUICK CODE EDIT MODAL */}
      {codeEditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-base">Test Kodini O'zgartirish</h3>
              </div>
              <button
                onClick={() => setCodeEditTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Test: <span className="font-semibold text-slate-700">{codeEditTarget.title}</span>.
              O'quvchilar ushbu kodni kiritib testga kirishadi.
            </p>

            {codeEditError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
                {codeEditError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                Yangi Kodni kiriting:
              </label>
              <input
                type="text"
                value={newCodeInput}
                onChange={(e) => setNewCodeInput(e.target.value.toUpperCase())}
                placeholder="Masalan: 7A-BSB yoki MAT-10"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-lg font-mono font-black text-slate-800 uppercase tracking-widest focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCodeEditTarget(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                disabled={savingCode}
                onClick={handleSaveNewCode}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                {savingCode ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT ROSTER / PERSONAL CODES MODAL */}
      {rosterTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  O'quvchilar Ro'yxati va Shaxsiy Kodlari
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Test: {rosterTarget.title} (Umumiy kod: <span className="font-bold font-mono text-indigo-600">{rosterTarget.code}</span>)
                </p>
              </div>
              <button
                onClick={() => setRosterTarget(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              <p className="text-xs text-slate-600">
                O'quvchilar umumiy test kodi (<span className="font-mono font-bold text-indigo-700">{rosterTarget.code}</span>) bilan kirishlari mumkin, yoki har biriga quyidagi shaxsiy kodlarni berishingiz mumkin:
              </p>

              {/* Add Student Form */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <span className="text-xs font-bold uppercase text-slate-500 block">
                  Yangi o'quvchi va kod qo'shish:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="F.I.Sh (Ism Familiya)"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    className="p-2 border border-slate-300 rounded-xl text-xs bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Shaxsiy Kod (masalan: 7A-01)"
                    value={newStudentCode}
                    onChange={(e) => setNewStudentCode(e.target.value.toUpperCase())}
                    className="p-2 border border-slate-300 rounded-xl text-xs font-mono font-bold bg-white uppercase"
                  />
                  <button
                    onClick={handleAddStudentToRoster}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Qo'shish
                  </button>
                </div>
              </div>

              {/* Info banner about saved PIN codes in Excel */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <KeyRound className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold">PIN-kodlar qayerda saqlanadi?</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Har bir o'quvchining shaxsiy PIN-kodi ushbu test bazasida saqlanadi. O'quvchilarga tarqatish yoki chop etish uchun quyidagi tugma orqali Excel jadvalini yuklab oling.
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700">
                  Biriktirilgan o'quvchilar ({rosterTarget.roster?.length || 0} nafar):
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      exportRosterPinCodesToExcel(rosterTarget, {
                        schoolName,
                        teacherName: teacherFullName,
                        academicYear,
                      })
                    }
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                    title="Barcha PIN-kodlarni Excel jadvalida yuklab olish"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PIN-kodlarni Excelda yuklab olish (.xlsx)</span>
                  </button>

                  <button
                    onClick={handleAutoGenerateRoster}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                  >
                    ⚡ Namunaviy generatsiya
                  </button>
                </div>
              </div>

              {/* Roster Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">T/r</th>
                      <th className="py-2.5 px-3">O'quvchi Ismi</th>
                      <th className="py-2.5 px-3">Shaxsiy Kirish Kodi</th>
                      <th className="py-2.5 px-3 text-right">O'chirish</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(!rosterTarget.roster || rosterTarget.roster.length === 0) ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400">
                          Hozircha shaxsiy kodlar biriktirilmagan. O'quvchilar umumiy "{rosterTarget.code}" kodi bilan kirishlari mumkin.
                        </td>
                      </tr>
                    ) : (
                      rosterTarget.roster.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 text-slate-400 font-bold">{idx + 1}</td>
                          <td className="py-2 px-3 font-semibold text-slate-800">{item.name}</td>
                          <td className="py-2 px-3 font-mono font-bold text-indigo-700">
                            {item.studentCode}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              onClick={() => handleRemoveStudentFromRoster(item.id)}
                              className="text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setRosterTarget(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
      {/* OFFICIAL EXCEL EXPORT MODAL */}
      {showExcelModal && currentTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden space-y-4">
            <div className="p-6 border-b border-slate-200 bg-linear-to-r from-emerald-500 to-teal-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Rasmiy Excel (.xlsx) Bayonnoma</h3>
                  <p className="text-xs text-emerald-100">
                    Vazirlik standarti bo'yicha har bir savol ballari alohida ustunlarda
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExcelModal(false)}
                className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span className="font-semibold">Fan & Sinf:</span>
                  <span className="font-bold text-slate-800">
                    {currentTest.grade} • {currentTest.subject} ({currentTest.testType})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Topshiriqlar soni:</span>
                  <span className="font-bold text-indigo-600">
                    {currentTest.questions.length} ta (har biri alohida ustunda)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Topshirgan o'quvchilar:</span>
                  <span className="font-bold text-emerald-700">{submissions.length} nafar</span>
                </div>
              </div>

              <div
                onClick={() => {
                  setShowExcelModal(false);
                  setShowExcelPdfImportModal(true);
                }}
                className="p-3 rounded-2xl bg-teal-50 border border-teal-200 cursor-pointer hover:bg-teal-100/70 transition flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2 text-teal-900">
                  <Sparkles className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>
                    <strong>Tayyor PDF jadvalingiz bormi?</strong> AI familiyalarni o'zi topib, baholarni joylashtirib beradi.
                  </span>
                </div>
                <span className="font-bold text-teal-700 whitespace-nowrap">Ochish →</span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Maktabingiz nomi:
                </label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="Masalan: 14-sonli umumiy o'rta ta'lim maktabi"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Fan o'qituvchisi F.I.Sh:
                </label>
                <input
                  type="text"
                  value={teacherFullName}
                  onChange={(e) => setTeacherFullName(e.target.value)}
                  placeholder="Masalan: Sobirova Nilufar"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  O'quv yili:
                </label>
                <input
                  type="text"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="Masalan: 2024-2025"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowExcelModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                >
                  Bekor qilish
                </button>

                <button
                  type="button"
                  onClick={() => {
                    exportTestResultsToExcel(currentTest, submissions, {
                      schoolName,
                      teacherName: teacherFullName,
                      academicYear,
                    });
                    setShowExcelModal(false);
                  }}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Excel (.xlsx) Yuklab Olish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OFFICIAL PDF BAYONNOMA MODAL */}
      {showOfficialPdfModal && currentTest && (
        <OfficialPdfBayonnomaModal
          test={currentTest}
          submissions={submissions}
          schoolName={schoolName}
          teacherName={teacherFullName}
          academicYear={academicYear}
          onClose={() => setShowOfficialPdfModal(false)}
        />
      )}

      {/* ORIGINAL PDF VIEWER MODAL */}
      {viewPdfTarget && (
        <PdfViewerModal
          pdfData={viewPdfTarget.pdfData}
          fileName={viewPdfTarget.fileName}
          onClose={() => setViewPdfTarget(null)}
        />
      )}

      {/* EXCEL PDF IMPORT & MATCH MODAL */}
      {showExcelPdfImportModal && currentTest && (
        <ExcelPdfImportModal
          test={currentTest}
          submissions={submissions}
          initialSchoolName={schoolName}
          initialTeacherName={teacherFullName}
          initialAcademicYear={academicYear}
          onClose={() => setShowExcelPdfImportModal(false)}
          onUpdateRoster={() => fetchTests()}
        />
      )}
    </div>
  );
};
