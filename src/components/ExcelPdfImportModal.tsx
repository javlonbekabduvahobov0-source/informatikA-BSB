import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Download,
  Save,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  Check,
  ClipboardPaste,
  HelpCircle,
} from 'lucide-react';
import { TestItem, StudentSubmission, StudentRosterItem } from '../types';
import {
  exportMatchedRosterToExcel,
  matchStudentName,
  MatchedRosterRow,
  ExcelExportOptions,
} from '../utils/excel';

interface ExcelPdfImportModalProps {
  test: TestItem;
  submissions: StudentSubmission[];
  initialSchoolName?: string;
  initialTeacherName?: string;
  initialAcademicYear?: string;
  onClose: () => void;
  onUpdateRoster?: (updatedRoster: StudentRosterItem[]) => void;
}

export const ExcelPdfImportModal: React.FC<ExcelPdfImportModalProps> = ({
  test,
  submissions,
  initialSchoolName = "14-sonli umumiy o'rta ta'lim maktabi",
  initialTeacherName = "Sobirova Nilufar",
  initialAcademicYear = "2024-2025",
  onClose,
  onUpdateRoster,
}) => {
  // Step: 'upload' -> 'match_review'
  const [step, setStep] = useState<'upload' | 'review'>('upload');

  // Input method: 'file' (PDF/Image) or 'text' (pasted text list)
  const [inputMethod, setInputMethod] = useState<'file' | 'text'>('file');

  // File upload state
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileMime, setFileMime] = useState<string>('application/pdf');
  const [isPdf, setIsPdf] = useState(true);
  const [uploadNote, setUploadNote] = useState('');

  // Pasted text state
  const [rawTextList, setRawTextList] = useState('');

  // AI Extraction state
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [is503Error, setIs503Error] = useState(false);
  const [parseSeconds, setParseSeconds] = useState(0);

  // Metadata
  const [schoolName, setSchoolName] = useState(initialSchoolName);
  const [teacherName, setTeacherName] = useState(initialTeacherName);
  const [academicYear, setAcademicYear] = useState(initialAcademicYear);
  const [className, setClassName] = useState(test.grade);

  // Matched rows
  const [rows, setRows] = useState<MatchedRosterRow[]>([]);
  const [savingRoster, setSavingRoster] = useState(false);
  const [rosterSavedSuccess, setRosterSavedSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file select
  const handleFileChange = (file: File) => {
    const isPdfFile = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    setIsPdf(isPdfFile);
    setFileName(file.name);
    setFileMime(isPdfFile ? 'application/pdf' : file.type || 'image/jpeg');

    const reader = new FileReader();
    reader.onloadend = () => {
      setFileBase64(reader.result as string);
      setParseError(null);
      setIs503Error(false);
    };
    reader.readAsDataURL(file);
  };

  // Sample pasted roster
  const handleLoadSampleText = () => {
    setRawTextList(
      "1. Abdurahmonov Ali\n2. Boboyeva Madina\n3. Karimova Dilnoza\n4. Omonov Sardor\n5. Yo'ldoshev Jasur"
    );
  };

  // Run extraction & matching
  const handleParseDocument = async () => {
    if (inputMethod === 'file' && !fileBase64) {
      setParseError('Iltimos, PDF yoki jadval rasmini yuklang.');
      return;
    }
    if (inputMethod === 'text' && !rawTextList.trim()) {
      setParseError("Iltimos, o'quvchilar ro'yxati matnini kiriting yoki nusxalab tashlang.");
      return;
    }

    try {
      setParsing(true);
      setParseError(null);
      setIs503Error(false);
      setParseSeconds(0);

      const timer = setInterval(() => {
        setParseSeconds((prev) => prev + 1);
      }, 1000);

      const bodyPayload =
        inputMethod === 'text'
          ? { textList: rawTextList }
          : {
              imageData: fileBase64,
              mimeType: fileMime,
              promptText: uploadNote,
            };

      const res = await fetch('/api/gemini/parse-roster-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      clearInterval(timer);

      const data = await res.json();
      if (!res.ok || !data.success || !data.data) {
        if (res.status === 503 || data.isOverloaded) {
          setIs503Error(true);
          throw new Error(
            "Google AI serverlarida qisqa muddatli yuqori yuklama (503). 5-10 soniya kutib 'Qayta urinish' tugmasini bosing yoki 'Matn orqali ro'yxat kiritish' bo'limidan foydalaning."
          );
        }
        throw new Error(data.error || 'Hujjatdan o\'quvchilar ro\'yxatini ajratib bo\'lmadi.');
      }

      const extracted = data.data;
      if (extracted.schoolName && extracted.schoolName.trim()) {
        setSchoolName(extracted.schoolName.trim());
      }
      if (extracted.className && extracted.className.trim()) {
        setClassName(extracted.className.trim());
      }
      if (extracted.academicYear && extracted.academicYear.trim()) {
        setAcademicYear(extracted.academicYear.trim());
      }

      const rawStudents: { index: number; fullName: string; studentClass?: string }[] =
        extracted.students || [];

      if (rawStudents.length === 0) {
        throw new Error("Hujjatdan o'quvchilar topilmadi. Iltimos sifatliroq PDF yoki rasm yuklang.");
      }

      // Match each student with submissions
      const matchedRowsList: MatchedRosterRow[] = rawStudents.map((st, idx) => {
        const studentFullName = st.fullName.trim();
        const { matched } = matchStudentName(studentFullName, submissions);

        const taskScores: Record<string, number> = {};
        let totalScore = 0;

        test.questions.forEach((q) => {
          if (matched) {
            if (q.type === 'multiple_choice') {
              const studentAns = (matched.answers[q.id] || '').trim().toUpperCase();
              const correctAns = (q.correctAnswer || '').trim().toUpperCase();
              const pt = studentAns && studentAns === correctAns ? q.points : 0;
              taskScores[q.id] = pt;
              totalScore += pt;
            } else {
              const fb = matched.writtenFeedback?.[q.id];
              const pt = fb && typeof fb.score === 'number' ? fb.score : 0;
              taskScores[q.id] = pt;
              totalScore += pt;
            }
          } else {
            taskScores[q.id] = 0;
          }
        });

        const maxPoints = test.totalPoints || 25;
        const score = matched ? matched.score : totalScore;
        const percentage = Math.round((score / maxPoints) * 100);

        let gradeScore = 2;
        if (percentage >= 85) gradeScore = 5;
        else if (percentage >= 70) gradeScore = 4;
        else if (percentage >= 50) gradeScore = 3;

        return {
          index: st.index || idx + 1,
          studentName: studentFullName,
          studentClass: st.studentClass || extracted.className || test.grade,
          matchedSubmission: matched || null,
          taskScores,
          totalScore: score,
          maxScore: maxPoints,
          percentage: matched ? matched.percentage : percentage,
          gradeScore: matched ? matched.gradeScore : gradeScore,
          status: matched ? 'matched' : 'absent',
        };
      });

      setRows(matchedRowsList);
      setStep('review');
    } catch (err: any) {
      setParseError(err.message || 'Xatolik yuz berdi');
    } finally {
      setParsing(false);
    }
  };

  // Change matched submission manually for a row
  const handleSelectSubmission = (rowIndex: number, submissionId: string) => {
    const targetSub = submissions.find((s) => s.id === submissionId);
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== rowIndex) return r;

        if (!targetSub) {
          // Unlink
          return {
            ...r,
            matchedSubmission: null,
            status: 'absent',
            totalScore: 0,
            percentage: 0,
            gradeScore: 2,
            taskScores: {},
          };
        }

        const taskScores: Record<string, number> = {};
        test.questions.forEach((q) => {
          if (q.type === 'multiple_choice') {
            const studentAns = (targetSub.answers[q.id] || '').trim().toUpperCase();
            const correctAns = (q.correctAnswer || '').trim().toUpperCase();
            taskScores[q.id] = studentAns && studentAns === correctAns ? q.points : 0;
          } else {
            const fb = targetSub.writtenFeedback?.[q.id];
            taskScores[q.id] = fb && typeof fb.score === 'number' ? fb.score : 0;
          }
        });

        return {
          ...r,
          matchedSubmission: targetSub,
          status: 'matched',
          taskScores,
          totalScore: targetSub.score,
          percentage: targetSub.percentage,
          gradeScore: targetSub.gradeScore,
        };
      })
    );
  };

  // Change single task score
  const handleScoreChange = (rowIndex: number, questionId: string, newScore: number) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== rowIndex) return r;

        const updatedScores = { ...r.taskScores, [questionId]: Math.max(0, newScore) };
        const totalScore = Object.values(updatedScores).reduce((acc, v) => acc + (v || 0), 0);
        const maxScore = test.totalPoints || 25;
        const percentage = Math.round((totalScore / maxScore) * 100);

        let gradeScore = 2;
        if (percentage >= 85) gradeScore = 5;
        else if (percentage >= 70) gradeScore = 4;
        else if (percentage >= 50) gradeScore = 3;

        return {
          ...r,
          taskScores: updatedScores,
          totalScore,
          percentage,
          gradeScore,
          status: r.status === 'absent' ? 'manual' : r.status,
        };
      })
    );
  };

  // Toggle absent/present
  const handleToggleAbsent = (rowIndex: number) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== rowIndex) return r;
        if (r.status === 'absent') {
          return { ...r, status: 'manual' };
        } else {
          return {
            ...r,
            status: 'absent',
            totalScore: 0,
            percentage: 0,
            gradeScore: 2,
            matchedSubmission: null,
          };
        }
      })
    );
  };

  // Add extra student row
  const handleAddRow = () => {
    const nextIdx = rows.length + 1;
    const newRow: MatchedRosterRow = {
      index: nextIdx,
      studentName: "Yangi O'quvchi",
      studentClass: className || test.grade,
      taskScores: {},
      totalScore: 0,
      maxScore: test.totalPoints || 25,
      percentage: 0,
      gradeScore: 2,
      status: 'manual',
    };
    setRows([...rows, newRow]);
  };

  // Delete row
  const handleDeleteRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  // Export matched results to official Excel
  const handleExportExcel = () => {
    const options: ExcelExportOptions = {
      schoolName,
      teacherName,
      academicYear,
    };
    exportMatchedRosterToExcel(test, rows, options);
  };

  // Save to test roster database
  const handleSaveToRoster = async () => {
    try {
      setSavingRoster(true);
      const newRoster: StudentRosterItem[] = rows.map((r, idx) => ({
        id: 'rost-' + (idx + 1) + '-' + Date.now(),
        name: r.studentName,
        studentCode: String(idx + 1).padStart(2, '0'),
        studentClass: r.studentClass || test.grade,
      }));

      const res = await fetch(`/api/tests/${test.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roster: newRoster }),
      });
      const data = await res.json();
      if (data.success) {
        setRosterSavedSuccess(true);
        if (onUpdateRoster) {
          onUpdateRoster(newRoster);
        }
        setTimeout(() => setRosterSavedSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Save roster error:', err);
    } finally {
      setSavingRoster(false);
    }
  };

  const matchedCount = rows.filter((r) => r.status === 'matched').length;
  const absentCount = rows.filter((r) => r.status === 'absent').length;
  const manualCount = rows.filter((r) => r.status === 'manual').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 md:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-6xl max-h-[96vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-linear-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base md:text-lg">
                  Tayyor PDF/Excel Jadval orqali Baholash
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                  Avtomatik Moslashtirish
                </span>
              </div>
              <p className="text-xs text-emerald-100">
                PDF jadvaldagi familiyalarni topib, test ballarini to'g'ri joylashtirish
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: UPLOAD / PASTE */}
        {step === 'upload' && (
          <div className="p-6 md:p-8 space-y-6 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-6 text-center">
              {/* Informative Banner */}
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-left flex items-start gap-3 text-xs text-emerald-900">
                <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-sm mb-1 text-emerald-950">
                    O'quvchilar ro'yxatini yuklash yoki nusxalash
                  </span>
                  Maktab jurnali (eMaktab), sinf ro'yxati yoki tayyor Excel jadvalini PDF/rasm qilib
                  tashlang yoki ro'yxat matnini to'g'ridan-to'g'ri nusxalab qo'ying. Tizim
                  familiyalarni o'zi topib, test ballarini to'g'ri qo'yib beradi!
                </div>
              </div>

              {/* Input Method Switcher */}
              <div className="flex p-1 bg-slate-100 rounded-2xl max-w-md mx-auto">
                <button
                  type="button"
                  onClick={() => {
                    setInputMethod('file');
                    setParseError(null);
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    inputMethod === 'file'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>PDF yoki Jadval Rasmi</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInputMethod('text');
                    setParseError(null);
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    inputMethod === 'text'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ClipboardPaste className="w-4 h-4" />
                  <span>Matn / Nusxalash (Tezkor)</span>
                </button>
              </div>

              {/* TAB 1: FILE UPLOAD */}
              {inputMethod === 'file' && (
                <div className="space-y-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-3xl p-8 cursor-pointer transition text-center ${
                      fileBase64
                        ? 'border-emerald-500 bg-emerald-50/40'
                        : 'border-slate-300 hover:border-emerald-400 bg-slate-50 hover:bg-slate-100/60'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                      className="hidden"
                    />

                    {fileBase64 ? (
                      <div className="space-y-3">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                          {isPdf ? (
                            <FileText className="w-8 h-8" />
                          ) : (
                            <ImageIcon className="w-8 h-8" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{fileName}</p>
                          <p className="text-xs text-emerald-700 font-semibold">
                            Fayl tanlandi. Boshqasini tanlash uchun bosing.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-200/80 text-slate-500 flex items-center justify-center">
                          <UploadCloud className="w-8 h-8" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-700 text-sm">
                            PDF yoki Jadval Rasmini tanlang
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            PDF hujjat, eMaktab jurnali skaneri yoki jadval fotosurati
                          </p>
                        </div>
                        <span className="inline-block px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xs">
                          Faylni tanlash
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="text-left">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Qo'shimcha ko'rsatma (ixtiyoriy):
                    </label>
                    <input
                      type="text"
                      value={uploadNote}
                      onChange={(e) => setUploadNote(e.target.value)}
                      placeholder="Masalan: 7-A sinf o'quvchilari ro'yxati"
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: TEXT COPY-PASTE */}
              {inputMethod === 'text' && (
                <div className="space-y-3 text-left">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                      O'quvchilar ro'yxatini nusxalab qo'ying (eMaktab / Excel / Word):
                    </label>
                    <button
                      type="button"
                      onClick={handleLoadSampleText}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-800"
                    >
                      Namuna to'ldirish
                    </button>
                  </div>
                  <textarea
                    rows={7}
                    value={rawTextList}
                    onChange={(e) => setRawTextList(e.target.value)}
                    placeholder={`Masalan:\n1. Abdurahmonov Ali\n2. Boboyeva Madina\n3. Karimova Dilnoza\n...`}
                    className="w-full p-3.5 border border-slate-300 rounded-2xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                  <p className="text-[11px] text-slate-400">
                    💡 Har bir qatorga bitta o'quvchi F.I.Sh yoziladi. Tartib raqami bo'lsa ham,
                    bo'lmasa ham tizim to'g'ri ajratib oladi.
                  </p>
                </div>
              )}

              {/* Error Display */}
              {parseError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-2 text-left">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    <span className="font-semibold">{parseError}</span>
                  </div>
                  {is503Error && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleParseDocument}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs flex items-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Qayta urinib ko'rish
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setInputMethod('text');
                          setParseError(null);
                        }}
                        className="px-3 py-1.5 bg-white border border-rose-300 text-rose-700 rounded-lg font-bold text-xs hover:bg-rose-100"
                      >
                        Matn orqali tezkor kiritish
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Submit button */}
              <button
                type="button"
                onClick={handleParseDocument}
                disabled={parsing || (inputMethod === 'file' && !fileBase64) || (inputMethod === 'text' && !rawTextList.trim())}
                className={`w-full py-3.5 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md ${
                  parsing || (inputMethod === 'file' && !fileBase64) || (inputMethod === 'text' && !rawTextList.trim())
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {parsing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Tahlil qilinmoqda ({parseSeconds} soniya)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Familiyalarni Topish va Baholarni Qo'yish</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: REVIEW & MATCHED TABLE */}
        {step === 'review' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Toolbar / Metadata */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-500">Maktab:</span>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="px-2.5 py-1 border border-slate-300 rounded-lg font-bold text-slate-800 bg-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-500">Sinf:</span>
                  <input
                    type="text"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    className="w-20 px-2.5 py-1 border border-slate-300 rounded-lg font-bold text-slate-800 bg-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-500">O'qituvchi:</span>
                  <input
                    type="text"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    className="px-2.5 py-1 border border-slate-300 rounded-lg font-bold text-slate-800 bg-white"
                  />
                </div>
              </div>

              {/* Match Stats Badges */}
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-xl bg-slate-200 text-slate-800 font-bold">
                  Jami: {rows.length} nafar
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 font-bold">
                  Topildi: {matchedCount}
                </span>
                {absentCount > 0 && (
                  <span className="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-800 font-bold">
                    Kelmadi: {absentCount}
                  </span>
                )}
                {manualCount > 0 && (
                  <span className="px-2.5 py-1 rounded-xl bg-indigo-100 text-indigo-800 font-bold">
                    Qo'lda: {manualCount}
                  </span>
                )}
              </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto p-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 font-bold w-10 text-center">№</th>
                    <th className="py-2.5 px-3 font-bold">O'quvchi F.I.Sh (Ro'yxatdan)</th>
                    <th className="py-2.5 px-3 font-bold w-48">Test Topshirgan Natijasi</th>
                    {test.questions.map((q, qIdx) => (
                      <th
                        key={q.id}
                        className="py-2.5 px-2 font-bold text-center w-20 bg-slate-50/80"
                        title={q.question}
                      >
                        {qIdx + 1}-topsh. ({q.points}b)
                      </th>
                    ))}
                    <th className="py-2.5 px-3 font-bold text-center w-16">Jami</th>
                    <th className="py-2.5 px-3 font-bold text-center w-14">Foiz</th>
                    <th className="py-2.5 px-3 font-bold text-center w-14">Baho</th>
                    <th className="py-2.5 px-2 font-bold text-center w-20">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, rIdx) => {
                    const isMatched = row.status === 'matched';
                    const isAbsent = row.status === 'absent';

                    return (
                      <tr
                        key={rIdx}
                        className={`hover:bg-slate-50/70 transition ${
                          isAbsent ? 'bg-slate-50/40 text-slate-400' : ''
                        }`}
                      >
                        <td className="py-2 px-3 text-center font-bold text-slate-500">
                          {rIdx + 1}
                        </td>

                        {/* Student Name */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.studentName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRows((prev) =>
                                prev.map((item, i) =>
                                  i === rIdx ? { ...item, studentName: val } : item
                                )
                              );
                            }}
                            className={`w-full px-2 py-1 border rounded-lg font-bold text-xs ${
                              isAbsent
                                ? 'text-slate-400 border-slate-200'
                                : 'text-slate-800 border-slate-300 bg-white'
                            }`}
                          />
                        </td>

                        {/* Match Dropdown */}
                        <td className="py-2 px-3">
                          <select
                            value={row.matchedSubmission?.id || ''}
                            onChange={(e) => handleSelectSubmission(rIdx, e.target.value)}
                            className={`w-full p-1.5 border rounded-lg text-xs font-semibold ${
                              isMatched
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                : isAbsent
                                ? 'bg-slate-100 border-slate-200 text-slate-500'
                                : 'bg-amber-50 border-amber-300 text-amber-800'
                            }`}
                          >
                            <option value="">
                              {isAbsent ? '— Kelmadi / Topshirmadi —' : '— Qo\'lda baholash —'}
                            </option>
                            {submissions.map((sub) => (
                              <option key={sub.id} value={sub.id}>
                                {sub.studentName} ({sub.score} ball, {sub.gradeScore}-baho)
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Question-by-question Scores */}
                        {test.questions.map((q) => {
                          const score = row.taskScores[q.id] || 0;
                          return (
                            <td key={q.id} className="py-2 px-2 text-center">
                              <input
                                type="number"
                                min={0}
                                max={q.points}
                                disabled={isAbsent}
                                value={isAbsent ? '' : score}
                                onChange={(e) =>
                                  handleScoreChange(rIdx, q.id, Number(e.target.value))
                                }
                                placeholder="0"
                                className={`w-14 text-center py-1 border rounded-lg text-xs font-bold ${
                                  isAbsent
                                    ? 'bg-slate-100 text-slate-300 border-slate-200'
                                    : 'bg-white text-slate-800 border-slate-300 focus:ring-1 focus:ring-emerald-500'
                                }`}
                              />
                            </td>
                          );
                        })}

                        {/* Total Score */}
                        <td className="py-2 px-3 text-center font-black text-slate-800">
                          {isAbsent ? '-' : `${row.totalScore}/${test.totalPoints}`}
                        </td>

                        {/* Percentage */}
                        <td className="py-2 px-3 text-center font-bold text-slate-600">
                          {isAbsent ? '-' : `${row.percentage}%`}
                        </td>

                        {/* Grade (5/4/3/2) */}
                        <td className="py-2 px-3 text-center">
                          {isAbsent ? (
                            <span className="text-slate-400 font-bold">-</span>
                          ) : (
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md font-black text-xs ${
                                row.gradeScore === 5
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : row.gradeScore === 4
                                  ? 'bg-blue-100 text-blue-800'
                                  : row.gradeScore === 3
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {row.gradeScore}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleToggleAbsent(rIdx)}
                              className={`p-1.5 rounded-lg text-[10px] font-bold transition ${
                                isAbsent
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                              title={isAbsent ? "Qatnashdi deb belgilash" : "Kelmadi deb belgilash"}
                            >
                              {isAbsent ? 'Keltirish' : 'Kelmadi'}
                            </button>
                            <button
                              onClick={() => handleDeleteRow(rIdx)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                              title="O'chirish"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="px-3 py-1.5 rounded-xl border border-dashed border-slate-300 hover:border-emerald-500 text-slate-600 hover:text-emerald-700 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Qator qo'shish</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Boshqa ro'yxat kiritish</span>
                </button>
              </div>
            </div>

            {/* Footer Action Bar */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveToRoster}
                  disabled={savingRoster || rows.length === 0}
                  className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 border border-indigo-200"
                >
                  {rosterSavedSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Ro'yxatga saqlandi!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Sinf ro'yxatiga (PIN kodlar bilan) saqlash</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Yopish
                </button>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>To'ldirilgan Rasmiy Excel (.xlsx) Yuklab Olish</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
