import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Users,
  School,
  Lock,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { TeacherPortal } from './components/TeacherPortal';
import { StudentPortal } from './components/StudentPortal';
import { PrintableTest } from './components/PrintableTest';
import { TeacherAuthModal } from './components/TeacherAuthModal';
import { TestItem } from './types';

export default function App() {
  // Default landing mode is 'student' (Kod so'rash oynasi)
  const [currentMode, setCurrentMode] = useState<'student' | 'teacher' | 'print'>('student');
  const [studentTestCode, setStudentTestCode] = useState<string>('BSB-701');
  const [testToPrint, setTestToPrint] = useState<TestItem | null>(null);

  // Teacher Authentication Modal state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isTeacherAuthenticated, setIsTeacherAuthenticated] = useState(false);

  // Check stored auth session
  useEffect(() => {
    const token =
      localStorage.getItem('teacher_token') || sessionStorage.getItem('teacher_token');
    if (token === 'teacher_authenticated_session_token') {
      setIsTeacherAuthenticated(true);
    }
  }, []);

  const handleOpenTeacherPortal = () => {
    const token =
      localStorage.getItem('teacher_token') || sessionStorage.getItem('teacher_token');
    if (token === 'teacher_authenticated_session_token') {
      setIsTeacherAuthenticated(true);
      setCurrentMode('teacher');
    } else {
      setIsAuthModalOpen(true);
    }
  };

  const handleTeacherAuthSuccess = () => {
    setIsTeacherAuthenticated(true);
    setIsAuthModalOpen(false);
    setCurrentMode('teacher');
  };

  const handleTeacherLogout = () => {
    localStorage.removeItem('teacher_token');
    sessionStorage.removeItem('teacher_token');
    setIsTeacherAuthenticated(false);
    setCurrentMode('student');
  };

  const handleStartStudentTest = (code: string) => {
    setStudentTestCode(code);
    setCurrentMode('student');
  };

  const handlePrintTest = (test: TestItem) => {
    setTestToPrint(test);
    setCurrentMode('print');
  };

  // If in Print Preview
  if (currentMode === 'print' && testToPrint) {
    return <PrintableTest test={testToPrint} onBack={() => setCurrentMode('teacher')} />;
  }

  // If in Student Test Taking or Landing Entry (default screen)
  if (currentMode === 'student') {
    return (
      <>
        <StudentPortal
          initialCode={studentTestCode}
          onExit={() => setCurrentMode('student')}
          onOpenTeacherLogin={handleOpenTeacherPortal}
        />
        <TeacherAuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={handleTeacherAuthSuccess}
        />
      </>
    );
  }

  // Teacher Portal (Password Protected)
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-linear-to-tr from-indigo-600 to-indigo-800 text-white flex items-center justify-center shadow-md shadow-indigo-100">
              <School className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-lg md:text-xl tracking-tight text-slate-900">
                  Maktab <span className="text-indigo-600">BSB & CHSB</span>
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  O'qituvchi Boshqaruvi
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Onlayn nazorat ishlari, baholash va Excel bayonnomasi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMode('student')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-1.5 transition"
              title="O'quvchi xonasini ko'rish"
            >
              <GraduationCap className="w-4 h-4 text-indigo-600" />
              <span>O'quvchi oynasi</span>
            </button>

            <button
              onClick={handleTeacherLogout}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 flex items-center gap-1.5 transition"
              title="Chiqish va qulflash"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Qulflash (Chiqish)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <TeacherPortal
          onStartStudentTest={handleStartStudentTest}
          onPrintTest={handlePrintTest}
          onLogout={handleTeacherLogout}
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              O'zbekiston Respublikasi Maktabgacha va maktab ta'limi vazirligi standartlari (BSB va CHSB)
            </span>
          </div>
          <div>
            <span>O'qituvchi boshqaruvi paroli: himoyalangan</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
