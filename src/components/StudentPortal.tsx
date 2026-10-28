import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  HelpCircle,
  Award,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Lock,
  KeyRound,
  Check,
  Camera,
  UploadCloud,
  Trash2,
  Maximize2,
  X,
  FileImage,
  Zap,
  Loader2,
} from 'lucide-react';
import { TestItem, Question, StudentSubmission } from '../types';

interface StudentPortalProps {
  initialCode?: string;
  onExit?: () => void;
  onOpenTeacherLogin?: () => void;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({
  initialCode = '',
  onExit,
  onOpenTeacherLogin,
}) => {
  // Step 1: Login / Join
  const [testCode, setTestCode] = useState(initialCode);
  const [studentPin, setStudentPin] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('7-A');
  const [loadingTest, setLoadingTest] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [verifiedTest, setVerifiedTest] = useState<TestItem | null>(null);
  const [matchedStudentInfo, setMatchedStudentInfo] = useState<{
    name: string;
    studentCode?: string;
    studentClass?: string;
  } | null>(null);

  // Step 2: In-test state
  const [test, setTest] = useState<TestItem | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [writtenImages, setWrittenImages] = useState<Record<string, string>>({});
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);

  // File input ref for camera / notebook photo
  const notebookFileInputRef = useRef<HTMLInputElement>(null);

  // Step 3: Finished result state
  const [result, setResult] = useState<
    (StudentSubmission & { reviewQuestions?: Question[] }) | null
  >(null);

  // Timer effect
  useEffect(() => {
    if (!test || result || timeLeftSeconds <= 0) return;

    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [test, result, timeLeftSeconds]);

  // Check code validity and pre-fill if personal code
  const handleVerifyCode = async (codeToCheck: string) => {
    const clean = codeToCheck.trim().toUpperCase();
    if (!clean) return;

    try {
      setLoadingTest(true);
      setJoinError(null);
      const res = await fetch(`/api/tests/by-code/${encodeURIComponent(clean)}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Bunday kodli test topilmadi.');
      }

      setVerifiedTest(data.test);
      if (data.matchedStudent) {
        setMatchedStudentInfo(data.matchedStudent);
        setStudentName(data.matchedStudent.name);
        setStudentPin(data.matchedStudent.studentCode || clean);
        if (data.matchedStudent.studentClass) {
          setStudentClass(data.matchedStudent.studentClass);
        }
      }
    } catch (err: any) {
      setJoinError(err.message || 'Xatolik yuz berdi.');
      setVerifiedTest(null);
      setMatchedStudentInfo(null);
    } finally {
      setLoadingTest(false);
    }
  };

  // Start test
  const handleStartTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testCode.trim()) {
      setJoinError('Iltimos, test kodini kiriting.');
      return;
    }

    if (!studentName.trim()) {
      setJoinError('Iltimos, familiyangiz va ismingizni kiriting.');
      return;
    }

    try {
      setLoadingTest(true);
      setJoinError(null);
      const res = await fetch(`/api/tests/by-code/${encodeURIComponent(testCode.trim())}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Test topilmadi.');
      }

      setTest(data.test);
      setTimeLeftSeconds(data.test.durationMinutes * 60);
      setStartTime(Date.now());
      setCurrentIdx(0);
      setAnswers({});
      setWrittenImages({});
      setResult(null);
    } catch (err: any) {
      setJoinError(err.message || 'Xatolik yuz berdi.');
    } finally {
      setLoadingTest(false);
    }
  };

  const handleSelectOption = (questionId: string, optionKey: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionKey,
    }));
  };

  const handleWrittenChange = (questionId: string, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: text,
    }));
  };

  // Fast client-side image compression to ensure instant uploads and snappy AI analysis
  const compressImage = (file: File, maxDim = 1280, quality = 0.82): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve((e.target?.result as string) || '');
        img.src = (e.target?.result as string) || '';
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  // Handle notebook image file upload or photo capture with instant compression
  const handleNotebookImageFile = async (questionId: string, file: File) => {
    if (!file) return;
    try {
      const compressedB64 = await compressImage(file, 1280, 0.82);
      if (compressedB64) {
        setWrittenImages((prev) => ({
          ...prev,
          [questionId]: compressedB64,
        }));
      }
    } catch {
      const reader = new FileReader();
      reader.onloadend = () => {
        const b64 = reader.result as string;
        setWrittenImages((prev) => ({
          ...prev,
          [questionId]: b64,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveNotebookImage = (questionId: string) => {
    setWrittenImages((prev) => {
      const updated = { ...prev };
      delete updated[questionId];
      return updated;
    });
  };

  const handleFinalSubmit = async () => {
    if (!test || submitting) return;
    try {
      setSubmitting(true);
      setShowConfirmModal(false);

      const timeSpentSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));

      const res = await fetch(`/api/tests/${test.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: studentName.trim(),
          studentClass: studentClass.trim(),
          studentCode: studentPin || (matchedStudentInfo ? testCode.trim().toUpperCase() : undefined),
          answers,
          writtenImages,
          timeSpentSeconds,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Natijani saqlashda xatolik.');
      }

      setResult(data.submission);
    } catch (err: any) {
      alert(err.message || 'Xatolik yuz berdi.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // STEP 3: RESULT VIEW
  if (result && test) {
    let gradeBadgeColor = 'bg-rose-500 text-white';
    let gradeTitle = "Qoniqarsiz (2)";

    if (result.gradeScore === 5) {
      gradeBadgeColor = 'bg-emerald-500 text-white';
      gradeTitle = "A'lo (5)";
    } else if (result.gradeScore === 4) {
      gradeBadgeColor = 'bg-blue-500 text-white';
      gradeTitle = "Yaxshi (4)";
    } else if (result.gradeScore === 3) {
      gradeBadgeColor = 'bg-amber-500 text-white';
      gradeTitle = "Qoniqarli (3)";
    }

    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden text-center p-8 md:p-12 relative">
            <div className="absolute top-0 left-0 right-0 h-3 bg-linear-to-r from-emerald-400 via-indigo-500 to-purple-600" />

            <div className="inline-flex p-4 rounded-full bg-indigo-50 text-indigo-600 mb-4">
              <Award className="w-12 h-12" />
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-slate-800">
              Sinov yakunlandi!
            </h1>
            <p className="text-slate-600 mt-1 font-medium">
              {result.studentName} ({result.studentClass}) • {test.title}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-8 max-w-lg mx-auto">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                  To'plangan Ball
                </span>
                <p className="text-3xl font-black text-slate-800 mt-1">
                  {result.score}{' '}
                  <span className="text-base text-slate-400 font-semibold">/ {result.maxScore}</span>
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                  Foiz
                </span>
                <p className="text-3xl font-black text-indigo-600 mt-1">{result.percentage}%</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                  Baho
                </span>
                <div className="mt-1">
                  <span
                    className={`inline-block px-3 py-1 rounded-xl text-lg font-black shadow-xs ${gradeBadgeColor}`}
                  >
                    {gradeTitle}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-500">
              Sarflangan vaqt: {Math.floor(result.timeSpentSeconds / 60)} daqiqa{' '}
              {result.timeSpentSeconds % 60} soniya • Natija o'qituvchi jurnaliga yozildi.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => {
                  setTest(null);
                  setResult(null);
                  setTestCode('');
                }}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition flex items-center gap-2 shadow-md"
              >
                <RotateCcw className="w-4 h-4" /> Boshqa test topshirish
              </button>
              {onExit && (
                <button
                  onClick={onExit}
                  className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition"
                >
                  Bosh sahifa
                </button>
              )}
            </div>
          </div>

          {result.reviewQuestions && (
            <div className="bg-white rounded-3xl shadow-md border border-slate-200 p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                <Sparkles className="w-6 h-6 text-indigo-600" />
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Savollar Tahlili va Javoblar</h2>
                  <p className="text-xs text-slate-500">
                    O'z xatolaringizni o'rganing va tushuntirishlarni o'qing
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {result.reviewQuestions.map((q, idx) => {
                  const studentAns = result.answers[q.id] || '';
                  const isMultiple = q.type === 'multiple_choice';
                  const isCorrect =
                    isMultiple &&
                    studentAns.toUpperCase() === (q.correctAnswer || '').toUpperCase();
                  const feedback = result.writtenFeedback?.[q.id];

                  return (
                    <div
                      key={q.id}
                      className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-200 text-slate-700 text-sm font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {q.cognitiveLevel && (
                                <span
                                  className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                                    q.cognitiveLevel === 'Bilish'
                                      ? 'bg-blue-50 text-blue-800 border-blue-200'
                                      : q.cognitiveLevel === "Qo'llash"
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-purple-50 text-purple-800 border-purple-200'
                                  }`}
                                >
                                  {q.cognitiveLevel === 'Bilish'
                                    ? '🟦 Bilish'
                                    : q.cognitiveLevel === "Qo'llash"
                                    ? '🟨 Qo\'llash'
                                    : '🟪 Mulohaza'}
                                </span>
                              )}
                              <span className="text-xs text-slate-500 font-medium">Maksimal: {q.points} ball</span>
                            </div>
                            <p className="font-semibold text-slate-800">{q.question}</p>
                          </div>
                        </div>

                        <div>
                          {isMultiple ? (
                            isCorrect ? (
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> To'g'ri (+{q.points})
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" /> Noto'g'ri (0)
                              </span>
                            )
                          ) : (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 flex items-center gap-1">
                              <Award className="w-3.5 h-3.5" /> {feedback ? feedback.score : 0} /{' '}
                              {q.points} ball
                            </span>
                          )}
                        </div>
                      </div>

                      {isMultiple && q.options && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                          {q.options.map((opt) => {
                            const isChosen = studentAns.toUpperCase() === opt.key;
                            const isAnsCorrect = (q.correctAnswer || '').toUpperCase() === opt.key;

                            let optStyle = 'bg-white border-slate-200 text-slate-700';
                            if (isAnsCorrect) {
                              optStyle =
                                'bg-emerald-50 border-emerald-400 text-emerald-900 font-semibold';
                            } else if (isChosen && !isAnsCorrect) {
                              optStyle = 'bg-rose-50 border-rose-300 text-rose-800 line-through';
                            }

                            return (
                              <div
                                key={opt.key}
                                className={`p-2.5 rounded-xl border text-sm flex items-center justify-between ${optStyle}`}
                              >
                                <span className="flex items-center gap-2">
                                  <span className="font-bold">{opt.key})</span> {opt.text}
                                </span>
                                {isChosen && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-semibold">
                                    Sizning javobingiz
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {!isMultiple && (
                        <div className="space-y-2 mt-2">
                          {(result.writtenImages?.[q.id] || writtenImages[q.id]) && (
                            <div className="p-3 bg-white rounded-xl border border-indigo-200 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <img
                                  src={result.writtenImages?.[q.id] || writtenImages[q.id]}
                                  alt="Daftar yechimi"
                                  className="w-14 h-14 object-cover rounded-lg border border-slate-200 cursor-pointer shadow-2xs hover:opacity-90"
                                  onClick={() =>
                                    setZoomedImage(
                                      result.writtenImages?.[q.id] || writtenImages[q.id]
                                    )
                                  }
                                />
                                <div>
                                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                                    <Camera className="w-3.5 h-3.5 text-indigo-600" /> Daftarga yozilgan yechim rasmi
                                  </span>
                                  <p className="text-[11px] text-slate-500">
                                    AI BSB rasmiy mezonlari bo'yicha tahlil qildi
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setZoomedImage(
                                    result.writtenImages?.[q.id] || writtenImages[q.id]
                                  )
                                }
                                className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition"
                              >
                                Ko'rish
                              </button>
                            </div>
                          )}
                          {studentAns && (
                            <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700">
                              <span className="font-bold">Siz yozgan matnli javob:</span>{' '}
                              {studentAns}
                            </div>
                          )}
                          {feedback?.comment && (
                            <p className="text-xs text-indigo-700 bg-indigo-50/70 p-2.5 rounded-lg border border-indigo-100">
                              <span className="font-bold">O'qituvchi / AI tahlili:</span>{' '}
                              {feedback.comment}
                            </p>
                          )}
                        </div>
                      )}

                      {q.explanation && (
                        <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-900">
                          <span className="font-bold">Tushuntirish:</span> {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // STEP 2: TAKING THE TEST
  if (test) {
    const currentQ = test.questions[currentIdx];
    const answeredCount = test.questions.filter(
      (q) => (answers[q.id] || '').trim() || (writtenImages[q.id] || '').trim()
    ).length;
    const progress = Math.round((answeredCount / test.questions.length) * 100);
    const isLast = currentIdx === test.questions.length - 1;
    const isUrgent = timeLeftSeconds < 300;

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs">
                  {test.code}
                </span>
                <h1 className="font-bold text-slate-800 text-sm md:text-base line-clamp-1">
                  {test.title}
                </h1>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {studentName} ({studentClass}) • {answeredCount} / {test.questions.length} ta
                topshirildi
              </p>
            </div>

            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono font-bold text-sm md:text-base ${
                isUrgent
                  ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                  : 'bg-slate-50 text-slate-700 border-slate-300'
              }`}
            >
              <Clock className="w-4 h-4 text-slate-500" />
              <span>{formatTime(timeLeftSeconds)}</span>
            </div>
          </div>

          <div className="w-full bg-slate-100 h-1">
            <div
              className="bg-indigo-600 h-1 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </header>

        <div className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1 order-2 md:order-1">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs sticky top-20">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Savollar ro'yxati
              </h3>
              <div className="grid grid-cols-5 gap-2">
                {test.questions.map((q, idx) => {
                  const isAnswered =
                    !!(answers[q.id] || '').trim() || !!(writtenImages[q.id] || '').trim();
                  const isCurrent = idx === currentIdx;

                  let btnStyle = 'bg-slate-100 text-slate-700 hover:bg-slate-200';
                  if (isCurrent) {
                    btnStyle = 'ring-2 ring-indigo-600 bg-indigo-50 text-indigo-800 font-black';
                  } else if (isAnswered) {
                    btnStyle = 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300';
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIdx(idx)}
                      className={`h-9 rounded-xl text-xs font-bold flex items-center justify-center transition ${btnStyle}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-md bg-emerald-100 border border-emerald-300" />
                  <span>Javob berilgan</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-md bg-slate-100" />
                  <span>Javob berilmagan</span>
                </div>
              </div>

              <button
                onClick={() => setShowConfirmModal(true)}
                className="w-full mt-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                <Send className="w-3.5 h-3.5" /> Testni topshirish
              </button>
            </div>
          </div>

          <main className="md:col-span-3 order-1 md:order-2">
            <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-bold text-sm flex items-center justify-center">
                    {currentIdx + 1}
                  </span>
                  <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">
                    {currentQ.type === 'multiple_choice' ? 'Test savoli' : 'Yozma javob'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {currentQ.cognitiveLevel && (
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                        currentQ.cognitiveLevel === 'Bilish'
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : currentQ.cognitiveLevel === "Qo'llash"
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-purple-50 text-purple-800 border-purple-200'
                      }`}
                    >
                      {currentQ.cognitiveLevel === 'Bilish'
                        ? '🟦 Bilish'
                        : currentQ.cognitiveLevel === "Qo'llash"
                        ? '🟨 Qo\'llash'
                        : '🟪 Mulohaza'}
                    </span>
                  )}
                  <span className="text-xs font-bold px-3 py-1 bg-amber-50 text-amber-800 rounded-full border border-amber-200">
                    {currentQ.points} ball
                  </span>
                </div>
              </div>

              <div className="text-base md:text-lg text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
                {currentQ.question}
              </div>

              {currentQ.type === 'multiple_choice' && currentQ.options && (
                <div className="space-y-3 pt-2">
                  {currentQ.options.map((opt) => {
                    const isSelected = (answers[currentQ.id] || '').toUpperCase() === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => handleSelectOption(currentQ.id, opt.key)}
                        className={`w-full text-left p-4 rounded-2xl border-2 transition flex items-center gap-4 ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-semibold shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-800'
                        }`}
                      >
                        <span
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {opt.key}
                        </span>
                        <span className="text-sm md:text-base">{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQ.type === 'written' && (
                <div className="space-y-4 pt-2">
                  {/* Notebook Photo Upload Card */}
                  <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-indigo-600 text-white">
                          <Camera className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">
                            Daftarga yozilgan yechim rasmini yuklash
                          </h4>
                          <p className="text-xs text-slate-500">
                            Masalani daftaringizga to'liq yechib, fotosuratini yuklang yoki rasmga oling
                          </p>
                        </div>
                      </div>

                      {writtenImages[currentQ.id] ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 shrink-0">
                          <Check className="w-3.5 h-3.5" /> Rasm biriktirildi
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 shrink-0">
                          Ixtiyoriy / Tavsiya etiladi
                        </span>
                      )}
                    </div>

                    {/* Image Preview or Upload Button */}
                    {writtenImages[currentQ.id] ? (
                      <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <img
                            src={writtenImages[currentQ.id]}
                            alt="Daftar yechimi"
                            className="w-16 h-16 object-cover rounded-lg border border-slate-200 shadow-2xs cursor-pointer hover:opacity-90 transition"
                            onClick={() => setZoomedImage(writtenImages[currentQ.id])}
                          />
                          <div>
                            <p className="text-xs font-bold text-slate-800">
                              Daftaringizdagi yechim fotosurati
                            </p>
                            <p className="text-[11px] text-slate-500">
                              AI daftardagi har bir qadamni tekshirib, o'qituvchiga yuboradi
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <button
                            type="button"
                            onClick={() => setZoomedImage(writtenImages[currentQ.id])}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition flex items-center gap-1.5"
                          >
                            <Maximize2 className="w-3.5 h-3.5" /> Kattalashtirish
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveNotebookImage(currentQ.id)}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg transition flex items-center gap-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> O'chirish
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition">
                          <Camera className="w-4 h-4" />
                          <span>Daftardan rasm olish / Yuklash</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleNotebookImageFile(currentQ.id, f);
                            }}
                          />
                        </label>
                        <span className="text-xs text-slate-500">
                          (JPG, PNG, smartfon kamerasi)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Text Solution Textarea */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Yoki matn ko'rinishida yozing (yoki daftardagi yechimga qo'shimcha izoh):
                    </label>
                    <textarea
                      rows={5}
                      value={answers[currentQ.id] || ''}
                      onChange={(e) => handleWrittenChange(currentQ.id, e.target.value)}
                      placeholder="Masala yechish bosqichlari, formulalar, javob yoki daftar fotosuratiga qo'shimcha izoh..."
                      className="w-full p-4 border border-slate-300 rounded-2xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>

                  {currentQ.criteria && (
                    <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900">
                      <span className="font-bold">Rasmiy BSB baholash mezoni:</span> {currentQ.criteria}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                <button
                  disabled={currentIdx === 0}
                  onClick={() => setCurrentIdx((p) => Math.max(0, p - 1))}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold disabled:opacity-30 hover:bg-slate-50 transition flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Oldingi
                </button>

                {isLast ? (
                  <button
                    onClick={() => setShowConfirmModal(true)}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-md transition flex items-center gap-2"
                  >
                    Testni topshirish <Send className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentIdx((p) => Math.min(test.questions.length - 1, p + 1))}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md transition flex items-center gap-2"
                  >
                    Keyingi <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </main>
        </div>

        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-200 text-center space-y-4">
              <div className="inline-flex p-3 rounded-full bg-amber-100 text-amber-700">
                <HelpCircle className="w-8 h-8" />
              </div>

              <h3 className="text-xl font-bold text-slate-800">Testni topshirasizmi?</h3>

              <p className="text-sm text-slate-600">
                Jami {test.questions.length} ta savoldan{' '}
                <span className="font-bold text-indigo-600">{answeredCount} tasiga</span> javob
                berildi.
                {test.questions.length - answeredCount > 0 && (
                  <span className="text-rose-600 block mt-1 font-semibold">
                    Diqqat: {test.questions.length - answeredCount} ta savolga javob berilmadi!
                  </span>
                )}
              </p>

              <div className="flex items-center justify-center gap-3 pt-4">
                <button
                  disabled={submitting}
                  onClick={handleFinalSubmit}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md transition"
                >
                  {submitting ? 'Yuborilmoqda...' : 'Ha, topshirish'}
                </button>
                <button
                  disabled={submitting}
                  onClick={() => setShowConfirmModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition"
                >
                  Qaytish
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Fullscreen Zoom Modal for Notebook Photo */}
        {zoomedImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
            <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center">
              <button
                type="button"
                onClick={() => setZoomedImage(null)}
                className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full transition z-10"
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={zoomedImage}
                alt="Daftar fotosurati kattalashtirilgan"
                className="max-h-[85vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl border border-white/20"
              />
              <p className="text-white/80 text-xs mt-2 font-medium">
                Daftardagi yechim fotosurati (AI ushbu yechimni BSB mezonlari bo'yicha baholaydi)
              </p>
            </div>
          </div>
        )}

        {/* Real-time Fast AI Verification / Submitting Overlay */}
        {submitting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center space-y-5">
              <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-200 animate-ping opacity-30" />
                <div className="w-16 h-16 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
                <Zap className="w-7 h-7 text-indigo-600 absolute" />
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-800">
                  Natijalar hisoblanmoqda...
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Sun'iy intellekt BSB baholash mezonlari va daftardagi qo'lyozma yechimlarni tezkor tahlil qilmoqda.
                </p>
              </div>

              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 h-2 rounded-full animate-pulse w-4/5" />
              </div>

              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-indigo-700 bg-indigo-50 py-2 px-3 rounded-xl border border-indigo-100">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Bir necha soniyada yakuniy ball chiqariladi...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // STEP 1: DEFAULT LANDING LOGIN SCREEN (KOD SO'RASH OYNASI)
  return (
    <div className="min-h-screen bg-linear-to-b from-indigo-50/60 via-white to-slate-100 flex flex-col justify-between py-8 px-4 sm:px-6 lg:px-8">
      {/* Top Header with Teacher Lock */}
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between pb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 tracking-tight leading-tight">
              Maktab <span className="text-indigo-600">BSB & CHSB</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-medium">Onlayn Sinov Portali</p>
          </div>
        </div>

        {onOpenTeacherLogin && (
          <button
            onClick={onOpenTeacherLogin}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 shadow-2xs transition flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5 text-indigo-600" />
            <span>O'qituvchi Kabineti</span>
          </button>
        )}
      </div>

      {/* Main Login Card */}
      <div className="max-w-md w-full mx-auto my-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex p-3 rounded-2xl bg-indigo-100 text-indigo-700 mb-2">
            <KeyRound className="w-7 h-7" />
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
            Testga Kirish
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            O'qituvchingiz bergan <strong>shaxsiy PIN-kodingiz</strong> yoki test kodini kiriting
          </p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 space-y-5">
          {joinError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{joinError}</span>
            </div>
          )}

          {matchedStudentInfo && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1 font-medium">
              <div className="flex items-center gap-2 font-bold text-emerald-800 text-sm">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Salom, {matchedStudentInfo.name}!</span>
              </div>
              <p className="text-emerald-700">
                Sizning shaxsiy PIN-kodingiz ({matchedStudentInfo.studentCode || testCode}) tasdiqlandi.
              </p>
            </div>
          )}

          {verifiedTest && !matchedStudentInfo && (
            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900">
              <span className="font-bold">Test topildi:</span> {verifiedTest.title} (
              {verifiedTest.durationMinutes} daqiqa)
            </div>
          )}

          <form onSubmit={handleStartTest} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center justify-between">
                <span>Shaxsiy PIN-kod (yoki Test Kodi)</span>
                <span className="text-[10px] text-indigo-600 font-bold lowercase">
                  masalan: 7a-01 yoki bsb-701
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Shaxsiy PIN-kod yoki Test kodi..."
                  value={testCode}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setTestCode(val);
                    if (val.length >= 2) {
                      handleVerifyCode(val);
                    }
                  }}
                  className="w-full px-4 py-3.5 border-2 border-indigo-200 focus:border-indigo-600 rounded-xl text-base font-bold font-mono text-slate-800 uppercase tracking-wider placeholder:normal-case placeholder:font-sans placeholder:tracking-normal focus:outline-none"
                  required
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                O'qituvchingiz ro'yxatda bergan PIN-kodni yozsangiz, ismingiz avtomatik chiqadi.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Familiya va Ismingiz
              </label>
              <input
                type="text"
                placeholder="Masalan: Karimov Jasur"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Sinfingiz
              </label>
              <input
                type="text"
                placeholder="Masalan: 7-A yoki 8-B"
                value={studentClass}
                onChange={(e) => setStudentClass(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                required
              />
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2">
              <Camera className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>
                <strong>Daftardan rasm topshirish mumkin:</strong> Yozma topshiriqlarni daftarga yozib, telefoningizda fotosuratini yuklaysiz. AI mezonlar asosida tekshiradi.
              </span>
            </div>

            <button
              type="submit"
              disabled={loadingTest}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-200 transition flex items-center justify-center gap-2"
            >
              {loadingTest ? 'Tekshirilmoqda...' : 'Testni Boshlash'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-md w-full mx-auto text-center text-xs text-slate-400 pt-6">
        BSB va CHSB baholash tizimi • O'qituvchi kabinetiga kirish uchun yuqoridagi tugmani bosing
      </div>

      {/* Zoom Modal if opened on landing (for any reason) */}
      {zoomedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setZoomedImage(null)}
              className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full transition z-10"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={zoomedImage}
              alt="Kattalashtirilgan rasm"
              className="max-h-[85vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl border border-white/20"
            />
          </div>
        </div>
      )}
    </div>
  );
};
