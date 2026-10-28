import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, Edit3, Save, Award, Camera, Maximize2, FileImage } from 'lucide-react';
import { TestItem, StudentSubmission } from '../types';

interface SubmissionModalProps {
  test: TestItem;
  submission: StudentSubmission;
  onClose: () => void;
  onUpdateScore: (updatedSub: StudentSubmission) => void;
}

export const SubmissionModal: React.FC<SubmissionModalProps> = ({
  test,
  submission,
  onClose,
  onUpdateScore,
}) => {
  const [subData, setSubData] = useState<StudentSubmission>(submission);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editScore, setEditScore] = useState<number>(0);
  const [editComment, setEditComment] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const startEdit = (qId: string, currentScore: number, currentComment: string) => {
    setEditingQuestionId(qId);
    setEditScore(currentScore);
    setEditComment(currentComment);
  };

  const handleSaveScore = async (qId: string) => {
    try {
      setSaving(true);
      const res = await fetch(`/api/tests/${test.id}/submissions/${subData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: qId,
          score: editScore,
          comment: editComment,
        }),
      });
      const data = await res.json();
      if (data.success && data.submission) {
        setSubData(data.submission);
        onUpdateScore(data.submission);
        setEditingQuestionId(null);
      }
    } catch (err) {
      console.error('Error saving score:', err);
    } finally {
      setSaving(false);
    }
  };

  const getGradeBadge = (grade: number) => {
    switch (grade) {
      case 5:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 4:
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 3:
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-rose-100 text-rose-800 border-rose-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-800">{subData.studentName}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                {subData.studentClass}
              </span>
              <span
                className={`px-3 py-0.5 rounded-full text-sm font-bold border ${getGradeBadge(
                  subData.gradeScore
                )}`}
              >
                Baho: {subData.gradeScore} ({subData.percentage}%)
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {test.title} • {subData.score} / {subData.maxScore} ball • Sarflangan vaqt:{' '}
              {Math.floor(subData.timeSpentSeconds / 60)} daq {subData.timeSpentSeconds % 60} son
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {test.questions.map((q, idx) => {
            const studentAns = subData.answers[q.id] || '';
            const isMultiple = q.type === 'multiple_choice';
            const isCorrect =
              isMultiple && studentAns.toUpperCase() === (q.correctAnswer || '').toUpperCase();
            const feedback = subData.writtenFeedback?.[q.id];

            return (
              <div
                key={q.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-200 font-bold text-sm text-slate-700 flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-medium text-slate-800">{q.question}</p>
                      <span className="inline-block mt-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {isMultiple ? 'Ko\'p tanlovli test' : 'Ochiq yozma savol'} • {q.points} ball
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isMultiple ? (
                      isCorrect ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle className="w-3.5 h-3.5" /> +{q.points} ball
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-100 text-rose-800">
                          <AlertCircle className="w-3.5 h-3.5" /> 0 ball
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-100 text-indigo-800">
                        <Award className="w-3.5 h-3.5" />
                        {feedback ? feedback.score : 0} / {q.points} ball
                      </span>
                    )}
                  </div>
                </div>

                {/* Options if multiple choice */}
                {isMultiple && q.options && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    {q.options.map((opt) => {
                      const isChosen = studentAns.toUpperCase() === opt.key;
                      const isTargetCorrect = (q.correctAnswer || '').toUpperCase() === opt.key;

                      let style = 'bg-white border-slate-200 text-slate-700';
                      if (isTargetCorrect) {
                        style = 'bg-emerald-50 border-emerald-400 text-emerald-900 font-semibold';
                      } else if (isChosen && !isTargetCorrect) {
                        style = 'bg-rose-50 border-rose-300 text-rose-900 line-through';
                      }

                      return (
                        <div
                          key={opt.key}
                          className={`p-2.5 rounded-lg border text-sm flex items-center justify-between ${style}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{opt.key})</span>
                            <span>{opt.text}</span>
                          </div>
                          {isChosen && (
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-semibold">
                              O'quvchi javobi
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Written Answer View */}
                {!isMultiple && (
                  <div className="space-y-3 mt-2">
                    {/* Notebook Photo if submitted */}
                    {subData.writtenImages?.[q.id] && (
                      <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                            <Camera className="w-4 h-4 text-indigo-600" />
                            O'quvchi daftarga yozgan qo'lyozma yechimi (fotosurat):
                          </span>
                          <button
                            type="button"
                            onClick={() => setZoomedImage(subData.writtenImages![q.id])}
                            className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                          >
                            <Maximize2 className="w-3.5 h-3.5" /> Kattalashtirish
                          </button>
                        </div>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                          <img
                            src={subData.writtenImages[q.id]}
                            alt="O'quvchi daftar fotosurati"
                            className="h-28 max-w-[200px] object-cover rounded-xl border border-slate-300 shadow-xs cursor-pointer hover:opacity-90"
                            onClick={() => setZoomedImage(subData.writtenImages![q.id])}
                          />
                          <p className="text-xs text-slate-600 leading-relaxed">
                            O'quvchi topshiriqni daftarga qo'lda yozib, fotosuratini yuborgan. Sun'iy intellekt (AI) daftardagi formulalar va hisob-kitoblarni BSB mezonlari asosida tahlil qildi. Rasmni to'liq ko'rish uchun ustiga bosing.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <p className="text-xs font-semibold text-slate-500 mb-1">
                        O'quvchining yozgan matnli izohi:
                      </p>
                      <p className="text-sm text-slate-800 whitespace-pre-wrap font-medium">
                        {studentAns || (
                          <span className="text-slate-400 italic">
                            {subData.writtenImages?.[q.id]
                              ? 'Faqat daftardan rasm yuklangan (matn kiritilmagan)'
                              : 'Javob yozilmagan'}
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="p-3 bg-emerald-50/70 rounded-lg border border-emerald-200 text-xs text-emerald-900">
                      <span className="font-bold">To'g'ri namuna / Yechim:</span> {q.correctAnswer}
                      {q.criteria && (
                        <div className="mt-1 text-slate-600">
                          <span className="font-semibold">Baholash mezoni:</span> {q.criteria}
                        </div>
                      )}
                    </div>

                    {/* Teacher / AI evaluation comment & score */}
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                          AI / O'qituvchi bahosi: {feedback?.score || 0} ball
                        </span>
                        {editingQuestionId !== q.id ? (
                          <button
                            onClick={() =>
                              startEdit(q.id, feedback?.score || 0, feedback?.comment || '')
                            }
                            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Ballni o'zgartirish
                          </button>
                        ) : null}
                      </div>

                      {editingQuestionId === q.id ? (
                        <div className="space-y-2 mt-2 pt-2 border-t border-amber-200">
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-slate-700">Qo'yiladigan ball:</label>
                            <input
                              type="number"
                              min="0"
                              max={q.points}
                              value={editScore}
                              onChange={(e) => setEditScore(Number(e.target.value))}
                              className="w-20 px-2 py-1 text-sm border border-slate-300 rounded bg-white font-bold"
                            />
                            <span className="text-xs text-slate-500">/ {q.points}</span>
                          </div>
                          <input
                            type="text"
                            placeholder="Izoh yoki tavsiya..."
                            value={editComment}
                            onChange={(e) => setEditComment(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              disabled={saving}
                              onClick={() => handleSaveScore(q.id)}
                              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded flex items-center gap-1"
                            >
                              <Save className="w-3.5 h-3.5" /> Saqlash
                            </button>
                            <button
                              onClick={() => setEditingQuestionId(null)}
                              className="px-3 py-1 bg-slate-200 text-slate-700 text-xs font-semibold rounded"
                            >
                              Bekor qilish
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-800 italic">
                          "{feedback?.comment || 'Tekshirilgan'}"
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex justify-end bg-slate-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl transition"
          >
            Yopish
          </button>
        </div>
      </div>

      {/* Fullscreen Zoom Modal for Notebook Image */}
      {zoomedImage && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
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
              O'quvchining daftarga yozgan qo'lyozma yechimi fotosurati
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
