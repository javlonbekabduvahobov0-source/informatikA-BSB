import React from 'react';
import { X, Printer, Download, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { TestItem, StudentSubmission } from '../types';
import { exportTestResultsToExcel } from '../utils/excel';

interface OfficialPdfBayonnomaModalProps {
  test: TestItem;
  submissions: StudentSubmission[];
  schoolName: string;
  teacherName: string;
  academicYear: string;
  onClose: () => void;
}

export const OfficialPdfBayonnomaModal: React.FC<OfficialPdfBayonnomaModalProps> = ({
  test,
  submissions,
  schoolName,
  teacherName,
  academicYear,
  onClose,
}) => {
  // Sort alphabetically by student name (standard school journal order)
  const sortedSubs = [...submissions].sort((a, b) =>
    a.studentName.localeCompare(b.studentName, 'uz')
  );

  const total = sortedSubs.length;
  const count5 = sortedSubs.filter((s) => s.gradeScore === 5).length;
  const count4 = sortedSubs.filter((s) => s.gradeScore === 4).length;
  const count3 = sortedSubs.filter((s) => s.gradeScore === 3).length;
  const count2 = sortedSubs.filter((s) => s.gradeScore === 2).length;

  const qualityRate = total > 0 ? Math.round(((count5 + count4) / total) * 100) : 0;
  const passRate = total > 0 ? Math.round(((count5 + count4 + count3) / total) * 100) : 0;
  const avgScore =
    total > 0
      ? (sortedSubs.reduce((acc, s) => acc + s.score, 0) / total).toFixed(1)
      : '0';
  const avgGrade =
    total > 0
      ? (sortedSubs.reduce((acc, s) => acc + s.gradeScore, 0) / total).toFixed(2)
      : '0';

  const handlePrint = () => {
    window.print();
  };

  const handleExcelExport = () => {
    exportTestResultsToExcel(test, submissions, {
      schoolName,
      teacherName,
      academicYear,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 md:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[95vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Top Action Bar (hidden when printing) */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold">
              Rasmiy Maktab Bayonnomasi
            </span>
            <span className="text-xs text-slate-500">
              Chop etish yoki PDF sifatida saqlashga tayyor
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExcelExport}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel (.xlsx) yuklab olish</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Chop etish / PDF saqlash</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet */}
        <div className="p-8 md:p-12 overflow-y-auto flex-1 font-serif text-slate-900 bg-white print:p-0 print:overflow-visible">
          {/* Header */}
          <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
            <p className="text-xs uppercase tracking-widest font-bold text-slate-600 mb-1">
              O'ZBEKISTON RESPUBLIKASI MAKTABGACHA VA MAKTAB TA'LIMI VAZIRLIGI
            </p>
            <h2 className="text-base md:text-lg font-black uppercase text-slate-900">
              {schoolName}
            </h2>
            <p className="text-xs font-bold text-slate-700 mt-0.5">
              {academicYear}-O'QUV YILI • {test.term.toUpperCase()}
            </p>
            <h1 className="text-lg md:text-xl font-black text-slate-900 uppercase mt-2">
              {test.grade} O'QUVCHILARINING "{test.subject}" FANIDAN {test.testType} BAHOLASH BAYONNOMASI (PROTOKOLI)
            </h1>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs border border-slate-300 p-3 rounded-lg mb-6 font-sans">
            <div>
              <span className="font-semibold text-slate-500">Fan:</span>{' '}
              <span className="font-bold text-slate-800">{test.subject}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-500">Sinf:</span>{' '}
              <span className="font-bold text-slate-800">{test.grade}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-500">Nazorat turi:</span>{' '}
              <span className="font-bold text-slate-800">{test.testType}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-500">Maksimal ball:</span>{' '}
              <span className="font-bold text-slate-800">{test.totalPoints} ball</span>
            </div>
            <div>
              <span className="font-semibold text-slate-500">O'tkazilgan sana:</span>{' '}
              <span className="font-bold text-slate-800">{new Date().toLocaleDateString('uz-UZ')}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-500">Fan o'qituvchisi:</span>{' '}
              <span className="font-bold text-slate-800">{teacherName}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-500">Qatnashganlar:</span>{' '}
              <span className="font-bold text-indigo-700">{total} nafar</span>
            </div>
            <div>
              <span className="font-semibold text-slate-500">Test kodi:</span>{' '}
              <span className="font-mono font-bold text-slate-800">{test.code}</span>
            </div>
          </div>

          {/* Official Scores Table with Question breakdown */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-left border-collapse border border-slate-400 text-xs font-sans">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold uppercase text-[10px]">
                  <th className="border border-slate-400 p-2 text-center w-8">№</th>
                  <th className="border border-slate-400 p-2">O'quvchi F.I.Sh</th>
                  <th className="border border-slate-400 p-2 text-center w-12">Sinf</th>
                  {test.questions.map((q, idx) => (
                    <th key={q.id} className="border border-slate-400 p-2 text-center whitespace-nowrap">
                      {idx + 1}-savol ({q.points}b)
                    </th>
                  ))}
                  <th className="border border-slate-400 p-2 text-center">Jami</th>
                  <th className="border border-slate-400 p-2 text-center">Foiz</th>
                  <th className="border border-slate-400 p-2 text-center">Baho</th>
                  <th className="border border-slate-400 p-2 text-center">Daraja</th>
                  <th className="border border-slate-400 p-2 text-center w-24">Imzo</th>
                </tr>
              </thead>
              <tbody>
                {sortedSubs.map((sub, idx) => {
                  let gradeText = "Qoniqarsiz (2)";
                  if (sub.gradeScore === 5) gradeText = "A'lo (5)";
                  else if (sub.gradeScore === 4) gradeText = "Yaxshi (4)";
                  else if (sub.gradeScore === 3) gradeText = "Qoniqarli (3)";

                  return (
                    <tr key={sub.id} className="hover:bg-slate-50">
                      <td className="border border-slate-400 p-2 text-center font-bold">{idx + 1}</td>
                      <td className="border border-slate-400 p-2 font-bold">{sub.studentName}</td>
                      <td className="border border-slate-400 p-2 text-center">{sub.studentClass}</td>
                      {test.questions.map((q) => {
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
                          <td key={q.id} className="border border-slate-400 p-2 text-center font-bold">
                            {score}
                          </td>
                        );
                      })}
                      <td className="border border-slate-400 p-2 text-center font-bold bg-slate-50">
                        {sub.score}
                      </td>
                      <td className="border border-slate-400 p-2 text-center font-bold">
                        {sub.percentage}%
                      </td>
                      <td className="border border-slate-400 p-2 text-center font-black">
                        {sub.gradeScore}
                      </td>
                      <td className="border border-slate-400 p-2 text-center text-[11px]">
                        {gradeText}
                      </td>
                      <td className="border border-slate-400 p-2 text-center"></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Metodik Ko'rsatkichlar & Statistika */}
          <div className="border border-slate-400 p-4 rounded-lg mb-8 font-sans text-xs space-y-2">
            <h4 className="font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
              Metodik Ko'rsatkichlar va Xulosalar:
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              <div>
                <span className="text-slate-500">Jami o'quvchilar:</span>{' '}
                <span className="font-bold">{total} nafar</span>
              </div>
              <div>
                <span className="text-slate-500">"A'lo" (5) baho:</span>{' '}
                <span className="font-bold text-emerald-700">
                  {count5} nafar ({total > 0 ? Math.round((count5 / total) * 100) : 0}%)
                </span>
              </div>
              <div>
                <span className="text-slate-500">"Yaxshi" (4) baho:</span>{' '}
                <span className="font-bold text-blue-700">
                  {count4} nafar ({total > 0 ? Math.round((count4 / total) * 100) : 0}%)
                </span>
              </div>
              <div>
                <span className="text-slate-500">"Qoniqarli" (3) baho:</span>{' '}
                <span className="font-bold text-amber-700">
                  {count3} nafar ({total > 0 ? Math.round((count3 / total) * 100) : 0}%)
                </span>
              </div>
              <div>
                <span className="text-slate-500">"Qoniqarsiz" (2) baho:</span>{' '}
                <span className="font-bold text-rose-700">
                  {count2} nafar ({total > 0 ? Math.round((count2 / total) * 100) : 0}%)
                </span>
              </div>
              <div>
                <span className="text-slate-500">Sifat ko'rsatkichi ("4" va "5"):</span>{' '}
                <span className="font-black text-emerald-800">{qualityRate}%</span>
              </div>
              <div>
                <span className="text-slate-500">O'zlashtirish ko'rsatkichi:</span>{' '}
                <span className="font-black text-indigo-800">{passRate}%</span>
              </div>
              <div>
                <span className="text-slate-500">O'rtacha ball / baho:</span>{' '}
                <span className="font-bold">
                  {avgScore} b. / {avgGrade}
                </span>
              </div>
            </div>
          </div>

          {/* Official Signatures Block */}
          <div className="pt-4 border-t-2 border-slate-900 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs font-sans">
            <div>
              <p className="font-semibold text-slate-600 mb-1">Fan o'qituvchisi:</p>
              <div className="border-b border-slate-500 h-6 mb-1"></div>
              <p className="font-bold text-slate-800">{teacherName}</p>
            </div>

            <div>
              <p className="font-semibold text-slate-600 mb-1">Metodbirlashma rahbari:</p>
              <div className="border-b border-slate-500 h-6 mb-1"></div>
              <p className="text-slate-400">F.I.Sh: ______________________</p>
            </div>

            <div>
              <p className="font-semibold text-slate-600 mb-1">O'quv ishlari bo'yicha direktor o'rinbosari:</p>
              <div className="border-b border-slate-500 h-6 mb-1"></div>
              <p className="text-slate-400">F.I.Sh: ______________________</p>
            </div>
          </div>

          <div className="text-right text-[10px] text-slate-400 mt-6 font-sans">
            Sana: {new Date().toLocaleDateString('uz-UZ')} yil • BSB Onlayn Nazorat Tizimi
          </div>
        </div>
      </div>
    </div>
  );
};
