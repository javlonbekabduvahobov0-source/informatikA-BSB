import React from 'react';
import { Printer, ArrowLeft } from 'lucide-react';
import { TestItem } from '../types';

interface PrintableTestProps {
  test: TestItem;
  onBack: () => void;
}

export const PrintableTest: React.FC<PrintableTestProps> = ({ test, onBack }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      {/* Top action bar - hidden on print */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Orqaga qaytish
        </button>

        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md transition"
        >
          <Printer className="w-4 h-4" /> Qog'ozga chop etish (Print / PDF)
        </button>
      </div>

      {/* Printable Sheet */}
      <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0">
        {/* School Header */}
        <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
          <p className="text-xs uppercase tracking-widest text-slate-600 font-bold mb-1">
            O'ZBEKISTON RESPUBLIKASI MAKTABGACHA VA MAKTAB TA'LIMI VAZIRLIGI
          </p>
          <h1 className="text-xl font-black text-slate-900 uppercase">
            {test.grade} • {test.subject} • {test.testType} ({test.term})
          </h1>
          <p className="text-sm font-medium text-slate-700 mt-1">{test.title}</p>
        </div>

        {/* Student info blanks */}
        <div className="grid grid-cols-2 gap-4 p-4 border border-slate-300 rounded-lg mb-6 text-sm">
          <div>
            <span className="font-semibold text-slate-700">O'quvchi F.I.Sh:</span>{' '}
            <span className="inline-block border-b border-slate-400 w-48"></span>
          </div>
          <div>
            <span className="font-semibold text-slate-700">Sinf:</span>{' '}
            <span className="inline-block border-b border-slate-400 w-24"></span>
          </div>
          <div>
            <span className="font-semibold text-slate-700">Ajratilgan vaqt:</span> {test.durationMinutes} daqiqa
          </div>
          <div>
            <span className="font-semibold text-slate-700">Maksimal ball:</span> {test.totalPoints} ball
          </div>
        </div>

        {/* Questions list */}
        <div className="space-y-6">
          {test.questions.map((q, idx) => (
            <div key={q.id} className="pb-4 border-b border-slate-200 print:border-slate-300 last:border-b-0">
              <div className="flex items-start justify-between gap-4 mb-2">
                <p className="font-semibold text-slate-900 text-sm">
                  {idx + 1}. {q.question}
                </p>
                <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 rounded text-slate-600 print:border print:border-slate-300">
                  {q.points} ball
                </span>
              </div>

              {q.type === 'multiple_choice' && q.options && (
                <div className="grid grid-cols-2 gap-2 mt-2 ml-4">
                  {q.options.map((opt) => (
                    <div key={opt.key} className="text-sm text-slate-800 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full border border-slate-400 flex items-center justify-center text-xs font-bold">
                        {opt.key}
                      </span>
                      <span>{opt.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {q.type === 'written' && (
                <div className="mt-3 ml-4">
                  <div className="h-24 border border-dashed border-slate-300 rounded-lg p-2 text-xs text-slate-400 print:h-28">
                    Javob va yechilish yo'li uchun joy:
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Score section */}
        <div className="mt-8 pt-4 border-t-2 border-slate-800 flex items-center justify-between text-xs text-slate-600">
          <div>O'qituvchi imzosi: ______________</div>
          <div>To'plangan ball: _____ / {test.totalPoints}</div>
          <div>Qo'yilgan baho: ______</div>
        </div>
      </div>
    </div>
  );
};
