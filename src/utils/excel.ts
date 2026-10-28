import * as XLSX from 'xlsx';
import { TestItem, StudentSubmission } from '../types';

export interface ExcelExportOptions {
  schoolName?: string;
  teacherName?: string;
  academicYear?: string;
}

export function exportTestResultsToExcel(
  test: TestItem,
  submissions: StudentSubmission[],
  options?: ExcelExportOptions
) {
  const schoolName = options?.schoolName?.trim() || "Umumta'lim maktabi";
  const teacherName = options?.teacherName?.trim() || test.teacherName || "Fan o'qituvchisi";
  const academicYear = options?.academicYear?.trim() || '2024-2025';

  // Sort submissions by student name alphabetically (school journal standard) or score
  const sortedSubs = [...submissions].sort((a, b) =>
    a.studentName.localeCompare(b.studentName, 'uz')
  );

  // Statistics
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

  // 1. Build Header in official Uzbekistan Ministry of Pre-school and School Education format
  const rows: any[] = [
    ["O'ZBEKISTON RESPUBLIKASI MAKTABGACHA VA MAKTAB TA'LIMI VAZIRLIGI"],
    [`${schoolName.toUpperCase()}`],
    [`${academicYear}-O'QUV YILI • ${test.term.toUpperCase()}`],
    [
      `${test.grade.toUpperCase()} O'QUVCHILARINING "${test.subject.toUpperCase()}" FANIDAN ${test.testType.toUpperCase()} BAHOLASH PROTOKOLI (BAYONNOMASI)`,
    ],
    [''],
    [
      'Fan:',
      test.subject,
      'Sinf:',
      test.grade,
      'Nazorat turi:',
      test.testType,
      'Test kodi:',
      test.code,
    ],
    [
      'Mavzu / Nomi:',
      test.title,
      '',
      '',
      'Maksimal ball:',
      `${test.totalPoints} ball`,
      'Ajratilgan vaqt:',
      `${test.durationMinutes} daqiqa`,
    ],
    [
      'O\'qituvchi:',
      teacherName,
      '',
      '',
      'O\'tkazilgan sana:',
      new Date().toLocaleDateString('uz-UZ'),
      'Qatnashganlar soni:',
      `${total} nafar`,
    ],
    [''],
  ];

  // 2. Build Dynamic Table Header: includes individual columns for EACH question/task!
  const tableHeader = [
    '№',
    'O\'quvchining Familiyasi, Ismi (F.I.Sh)',
    'Sinf',
    'PIN-kod',
  ];

  // Add a column for each question
  test.questions.forEach((q, idx) => {
    tableHeader.push(`${idx + 1}-topshiriq (${q.points} b.)`);
  });

  tableHeader.push(
    'Jami ball',
    'Maks. ball',
    'Foiz (%)',
    'Baho (5/4/3/2)',
    'Baho darajasi',
    'Sarflangan vaqt',
    'Topshirilgan vaqt',
    'Imzo'
  );

  rows.push(tableHeader);

  // 3. Populate each student's row with question-by-question breakdown
  sortedSubs.forEach((sub, idx) => {
    const mins = Math.floor(sub.timeSpentSeconds / 60);
    const secs = sub.timeSpentSeconds % 60;
    const timeFormatted = `${mins} daq ${secs} son`;

    let gradeLevel = 'Qoniqarsiz';
    if (sub.gradeScore === 5) gradeLevel = "A'lo (5)";
    else if (sub.gradeScore === 4) gradeLevel = "Yaxshi (4)";
    else if (sub.gradeScore === 3) gradeLevel = "Qoniqarli (3)";

    const rosterMatch = test.roster?.find(
      (r) => r.name.trim().toLowerCase() === sub.studentName.trim().toLowerCase()
    );
    const pinCode = sub.studentCode || rosterMatch?.studentCode || '-';

    const rowData: any[] = [
      idx + 1,
      sub.studentName,
      sub.studentClass,
      pinCode,
    ];

    // Compute or fetch score for EACH question
    test.questions.forEach((q) => {
      if (q.type === 'multiple_choice') {
        const studentAns = (sub.answers[q.id] || '').trim().toUpperCase();
        const correctAns = (q.correctAnswer || '').trim().toUpperCase();
        if (studentAns && studentAns === correctAns) {
          rowData.push(q.points);
        } else {
          rowData.push(0);
        }
      } else {
        const fb = sub.writtenFeedback?.[q.id];
        if (fb && typeof fb.score === 'number') {
          rowData.push(fb.score);
        } else {
          rowData.push(0);
        }
      }
    });

    rowData.push(
      sub.score,
      sub.maxScore,
      `${sub.percentage}%`,
      sub.gradeScore,
      gradeLevel,
      timeFormatted,
      new Date(sub.submittedAt).toLocaleTimeString('uz-UZ', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      '' // Imzo column left blank for physical signature
    );

    rows.push(rowData);
  });

  // 4. Official Summary & Metodik Ko'rsatkichlar (Statistics block)
  rows.push(['']);
  rows.push(['RASMIY METODIK NATIJALAR VA STATISTIKA:']);
  rows.push([
    'Jami o\'quvchilar soni:',
    `${total} nafar`,
    '',
    'Sifat ko\'rsatkichi ("4" va "5"):',
    `${qualityRate}%`,
  ]);
  rows.push([
    '"A\'lo" (5) baho olganlar:',
    `${count5} nafar (${total > 0 ? Math.round((count5 / total) * 100) : 0}%)`,
    '',
    'O\'zlashtirish ko\'rsatkichi ("3", "4", "5"):',
    `${passRate}%`,
  ]);
  rows.push([
    '"Yaxshi" (4) baho olganlar:',
    `${count4} nafar (${total > 0 ? Math.round((count4 / total) * 100) : 0}%)`,
    '',
    'O\'rtacha ball:',
    `${avgScore} ball`,
  ]);
  rows.push([
    '"Qoniqarli" (3) baho olganlar:',
    `${count3} nafar (${total > 0 ? Math.round((count3 / total) * 100) : 0}%)`,
    '',
    'O\'rtacha baho:',
    `${avgGrade}`,
  ]);
  rows.push([
    '"Qoniqarsiz" (2) baho olganlar:',
    `${count2} nafar (${total > 0 ? Math.round((count2 / total) * 100) : 0}%)`,
  ]);

  // 5. Official Signatures (Maktab rahbariyati tasdiqlash bloki)
  rows.push(['']);
  rows.push(['TASDIQLASH VA IMZOLAR:']);
  rows.push(['Fan o\'qituvchisi:', '____________________', teacherName]);
  rows.push(['Metodbirlashma rahbari:', '____________________', 'F.I.Sh: ______________________']);
  rows.push([
    'O\'quv ishlari bo\'yicha direktor o\'rinbosari:',
    '____________________',
    'F.I.Sh: ______________________',
  ]);
  rows.push(['Sana:', `${new Date().toLocaleDateString('uz-UZ')} yil`]);

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Column width calculations
  const cols = [
    { wch: 5 }, // №
    { wch: 32 }, // F.I.Sh
    { wch: 10 }, // Sinf
    { wch: 12 }, // PIN-kod
  ];

  test.questions.forEach(() => {
    cols.push({ wch: 14 }); // Each question
  });

  cols.push(
    { wch: 12 }, // Jami ball
    { wch: 12 }, // Maks ball
    { wch: 10 }, // Foiz
    { wch: 14 }, // Baho
    { wch: 16 }, // Baho darajasi
    { wch: 16 }, // Sarflangan vaqt
    { wch: 16 }, // Topshirgan vaqt
    { wch: 14 }  // Imzo
  );

  worksheet['!cols'] = cols;

  // Sheet 2: BSB Savollari va Baholash Mezonlari (Spetsifikatsiya)
  const specRows: any[] = [
    ['BSB / CHSB TOPSHIRIQLARI VA BAHOLASH MEZONLARI (SPETSIFIKATSIYA)'],
    [`Fan: ${test.subject} • Sinf: ${test.grade} • ${test.testType}`],
    ['Mavzu:', test.title],
    [''],
    [
      '№',
      'Savol / Topshiriq matni',
      'Topshiriq turi',
      'Ajratilgan ball',
      'To\'g\'ri javob / Namuna yechim',
      'Baholash mezoni (Rubrika)',
      'O\'zlashtirish (%)',
    ],
  ];

  test.questions.forEach((q, idx) => {
    let correctCount = 0;
    sortedSubs.forEach((sub) => {
      if (q.type === 'multiple_choice') {
        if ((sub.answers[q.id] || '').toUpperCase() === (q.correctAnswer || '').toUpperCase()) {
          correctCount++;
        }
      } else {
        const feedback = sub.writtenFeedback?.[q.id];
        if (feedback && feedback.score >= q.points * 0.7) {
          correctCount++;
        }
      }
    });

    const mastery = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    specRows.push([
      idx + 1,
      q.question,
      q.type === 'multiple_choice' ? 'Test (A, B, C, D)' : 'Ochiq yozma masala',
      q.points,
      q.correctAnswer || '-',
      q.criteria || q.explanation || 'Standart baholash',
      `${mastery}% (${correctCount}/${total} nafar)`,
    ]);
  });

  const specSheet = XLSX.utils.aoa_to_sheet(specRows);
  specSheet['!cols'] = [
    { wch: 5 },
    { wch: 45 },
    { wch: 20 },
    { wch: 14 },
    { wch: 35 },
    { wch: 35 },
    { wch: 20 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'BSB Bayonnomasi');
  XLSX.utils.book_append_sheet(workbook, specSheet, 'Savollar va Mezonlar');

  const cleanFileName =
    `${test.testType}_${test.grade}_${test.subject}_${test.code}_Protokoli.xlsx`
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_\-\.]/g, '');

  XLSX.writeFile(workbook, cleanFileName);
}

export interface MatchedRosterRow {
  index: number;
  studentName: string;
  studentClass: string;
  matchedSubmission?: StudentSubmission | null;
  taskScores: Record<string, number>;
  totalScore: number;
  maxScore: number;
  percentage: number;
  gradeScore: number;
  status: 'matched' | 'manual' | 'absent';
  notes?: string;
}

export function matchStudentName(pdfName: string, submissions: StudentSubmission[]) {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/['`ʻ’ʼ]/g, "'")
      .replace(/[\.,\-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const normPdf = normalize(pdfName);
  const pdfParts = normPdf.split(' ').filter(Boolean);

  // 1. Exact match
  let found = submissions.find((sub) => normalize(sub.studentName) === normPdf);
  if (found) return { matched: found, matchType: 'exact' as const };

  // 2. Reversed name: e.g. "Valiyev Ali" vs "Ali Valiyev"
  found = submissions.find((sub) => {
    const subParts = normalize(sub.studentName).split(' ').filter(Boolean);
    if (subParts.length >= 2 && pdfParts.length >= 2) {
      return (
        (subParts[0] === pdfParts[0] && subParts[1] === pdfParts[1]) ||
        (subParts[0] === pdfParts[1] && subParts[1] === pdfParts[0])
      );
    }
    return false;
  });
  if (found) return { matched: found, matchType: 'reversed' as const };

  // 3. Substring match: e.g. "Abduvahobov Javlon" in "Abduvahobov Javlonbek"
  found = submissions.find((sub) => {
    const normSub = normalize(sub.studentName);
    return (
      (normPdf.length >= 4 && normSub.includes(normPdf)) ||
      (normSub.length >= 4 && normPdf.includes(normSub))
    );
  });
  if (found) return { matched: found, matchType: 'fuzzy' as const };

  return { matched: null, matchType: 'none' as const };
}

export function exportMatchedRosterToExcel(
  test: TestItem,
  matchedRows: MatchedRosterRow[],
  options?: ExcelExportOptions
) {
  const schoolName = options?.schoolName?.trim() || "Umumta'lim maktabi";
  const teacherName = options?.teacherName?.trim() || test.teacherName || "Fan o'qituvchisi";
  const academicYear = options?.academicYear?.trim() || '2024-2025';

  const total = matchedRows.length;
  const participated = matchedRows.filter((r) => r.status !== 'absent');
  const countParticipated = participated.length;
  const countAbsent = matchedRows.filter((r) => r.status === 'absent').length;

  const count5 = participated.filter((s) => s.gradeScore === 5).length;
  const count4 = participated.filter((s) => s.gradeScore === 4).length;
  const count3 = participated.filter((s) => s.gradeScore === 3).length;
  const count2 = participated.filter((s) => s.gradeScore === 2).length;

  const qualityRate = countParticipated > 0 ? Math.round(((count5 + count4) / countParticipated) * 100) : 0;
  const passRate =
    countParticipated > 0
      ? Math.round(((count5 + count4 + count3) / countParticipated) * 100)
      : 0;
  const avgScore =
    countParticipated > 0
      ? (participated.reduce((acc, s) => acc + s.totalScore, 0) / countParticipated).toFixed(1)
      : '0';
  const avgGrade =
    countParticipated > 0
      ? (participated.reduce((acc, s) => acc + s.gradeScore, 0) / countParticipated).toFixed(2)
      : '0';

  // Header rows
  const rows: any[] = [
    ["O'ZBEKISTON RESPUBLIKASI MAKTABGACHA VA MAKTAB TA'LIMI VAZIRLIGI"],
    [`${schoolName.toUpperCase()}`],
    [`${academicYear}-O'QUV YILI • ${test.term.toUpperCase()}`],
    [
      `${test.grade.toUpperCase()} O'QUVCHILARINING "${test.subject.toUpperCase()}" FANIDAN ${test.testType.toUpperCase()} BAHOLASH PROTOKOLI (BAYONNOMASI)`,
    ],
    [''],
    [
      'Fan:',
      test.subject,
      'Sinf:',
      test.grade,
      'Nazorat turi:',
      test.testType,
      'Test kodi:',
      test.code,
    ],
    [
      'Mavzu / Nomi:',
      test.title,
      '',
      '',
      'Maksimal ball:',
      `${test.totalPoints} ball`,
      'Ajratilgan vaqt:',
      `${test.durationMinutes} daqiqa`,
    ],
    [
      'O\'qituvchi:',
      teacherName,
      '',
      '',
      'O\'tkazilgan sana:',
      new Date().toLocaleDateString('uz-UZ'),
      'Jami o\'quvchilar:',
      `${total} nafar (Qatnashdi: ${countParticipated}, Kelmadi: ${countAbsent})`,
    ],
    [''],
  ];

  // Table header
  const tableHeader = [
    '№',
    'O\'quvchining Familiyasi, Ismi (F.I.Sh)',
    'Sinf',
  ];

  test.questions.forEach((q, idx) => {
    tableHeader.push(`${idx + 1}-topshiriq (${q.points} b.)`);
  });

  tableHeader.push(
    'Jami ball',
    'Maks. ball',
    'Foiz (%)',
    'Baho (5/4/3/2)',
    'Baho darajasi',
    'Holati',
    'Imzo'
  );

  rows.push(tableHeader);

  // Student rows
  matchedRows.forEach((row, idx) => {
    let gradeLevel = 'Kelmadi';
    if (row.status !== 'absent') {
      if (row.gradeScore === 5) gradeLevel = "A'lo (5)";
      else if (row.gradeScore === 4) gradeLevel = "Yaxshi (4)";
      else if (row.gradeScore === 3) gradeLevel = "Qoniqarli (3)";
      else gradeLevel = 'Qoniqarsiz (2)';
    }

    let statusText = 'Topshirgan';
    if (row.status === 'absent') statusText = 'Kelmadi';
    else if (row.status === 'manual') statusText = "Qo'lda kiritildi";

    const rowData: any[] = [
      idx + 1,
      row.studentName,
      row.studentClass || test.grade,
    ];

    test.questions.forEach((q) => {
      const score = row.taskScores[q.id];
      rowData.push(typeof score === 'number' ? score : (row.status === 'absent' ? 0 : 0));
    });

    rowData.push(
      row.status === 'absent' ? 0 : row.totalScore,
      row.maxScore,
      row.status === 'absent' ? '0%' : `${row.percentage}%`,
      row.status === 'absent' ? '-' : row.gradeScore,
      gradeLevel,
      statusText,
      ''
    );

    rows.push(rowData);
  });

  // Summary
  rows.push(['']);
  rows.push(['RASMIY METODIK NATIJALAR VA STATISTIKA:']);
  rows.push([
    'Jami ro\'yxatdagi o\'quvchilar:',
    `${total} nafar`,
    '',
    'Sifat ko\'rsatkichi ("4" va "5"):',
    `${qualityRate}%`,
  ]);
  rows.push([
    'Sinovda qatnashganlar:',
    `${countParticipated} nafar`,
    '',
    'O\'zlashtirish ko\'rsatkichi ("3","4","5"):',
    `${passRate}%`,
  ]);
  rows.push([
    'Kelmagan o\'quvchilar:',
    `${countAbsent} nafar`,
    '',
    'O\'rtacha ball:',
    `${avgScore} ball`,
  ]);
  rows.push([
    'A\'lo ("5") baholar:',
    `${count5} nafar (${total > 0 ? Math.round((count5 / total) * 100) : 0}%)`,
    '',
    'O\'rtacha baho:',
    `${avgGrade}`,
  ]);
  rows.push([
    'Yaxshi ("4") baholar:',
    `${count4} nafar (${total > 0 ? Math.round((count4 / total) * 100) : 0}%)`,
  ]);
  rows.push([
    'Qoniqarli ("3") baholar:',
    `${count3} nafar (${total > 0 ? Math.round((count3 / total) * 100) : 0}%)`,
  ]);
  rows.push([
    'Qoniqarsiz ("2") baholar:',
    `${count2} nafar (${total > 0 ? Math.round((count2 / total) * 100) : 0}%)`,
  ]);

  rows.push(['']);
  rows.push(['MAS\'ULLAR VA TASDIQ:']);
  rows.push([
    'Fan o\'qituvchisi:',
    `________________ / ${teacherName} /`,
    '',
    'Sana: ' + new Date().toLocaleDateString('uz-UZ'),
  ]);
  rows.push(['Metodbirlashma rahbari:', '________________ / _____________________ /']);
  rows.push(['O\'quv ishlari bo\'yicha dir. o\'rinbosari:', '________________ / _____________________ /']);

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  const colWidths: { wch: number }[] = [
    { wch: 5 },
    { wch: 32 },
    { wch: 10 },
  ];
  test.questions.forEach(() => {
    colWidths.push({ wch: 18 });
  });
  colWidths.push(
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
    { wch: 18 },
    { wch: 16 },
    { wch: 15 }
  );
  worksheet['!cols'] = colWidths;

  // Question specs sheet
  const specRows: any[] = [
    [`${test.title.toUpperCase()} - SAVOLLAR VA MEZONLAR XARITASI (SPETSIFIKATSIYA)`],
    [`Fan: ${test.subject} • Sinf: ${test.grade} • Kod: ${test.code}`],
    [''],
    [
      'T/r',
      'Topshiriq mazmuni',
      'Topshiriq turi',
      'Ajratilgan ball',
      'To\'g\'ri javob / Namuna',
      'Baholash mezoni',
    ],
  ];

  test.questions.forEach((q, idx) => {
    specRows.push([
      idx + 1,
      q.question,
      q.type === 'multiple_choice' ? 'Test (A, B, C, D)' : 'Ochiq yozma masala',
      q.points,
      q.correctAnswer || '-',
      q.criteria || q.explanation || 'Standart baholash',
    ]);
  });

  const specSheet = XLSX.utils.aoa_to_sheet(specRows);
  specSheet['!cols'] = [
    { wch: 5 },
    { wch: 45 },
    { wch: 20 },
    { wch: 14 },
    { wch: 35 },
    { wch: 35 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'To\'ldirilgan BSB Bayonnomasi');
  XLSX.utils.book_append_sheet(workbook, specSheet, 'Savollar va Mezonlar');

  const cleanFileName =
    `Toldirilgan_${test.testType}_${test.grade}_${test.subject}_${test.code}.xlsx`
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_\-\.]/g, '');

  XLSX.writeFile(workbook, cleanFileName);
}

export function exportRosterPinCodesToExcel(
  test: TestItem,
  options?: ExcelExportOptions
) {
  const schoolName = options?.schoolName?.trim() || "Umumta'lim maktabi";
  const teacherName = options?.teacherName?.trim() || test.teacherName || "Fan o'qituvchisi";
  const academicYear = options?.academicYear?.trim() || '2024-2025';

  const rosterList =
    test.roster && test.roster.length > 0
      ? test.roster
      : [
          {
            id: '1',
            name: "Hozircha shaxsiy ro'yxat kiritilmagan (Umumiy test kodi bilan kirishadi)",
            studentCode: test.code,
            studentClass: test.grade,
          },
        ];

  const rows: any[] = [
    ["O'ZBEKISTON RESPUBLIKASI MAKTABGACHA VA MAKTAB TA'LIMI VAZIRLIGI"],
    [`${schoolName.toUpperCase()}`],
    [`${academicYear}-O'QUV YILI • ${test.term.toUpperCase()}`],
    [
      `${test.grade.toUpperCase()} O'QUVCHILARINING "${test.subject.toUpperCase()}" FANIDAN ${test.testType.toUpperCase()} UCHUN SHAXSIY PIN-KODLARI RO'YXATI`,
    ],
    [''],
    [
      'Fan:',
      test.subject,
      'Sinf:',
      test.grade,
      'Nazorat turi:',
      test.testType,
      'Umumiy Test Kodi:',
      test.code,
    ],
    [
      'Mavzu / Nomi:',
      test.title,
      '',
      '',
      'Maksimal ball:',
      `${test.totalPoints} ball`,
      'Ajratilgan vaqt:',
      `${test.durationMinutes} daqiqa`,
    ],
    [
      'Fan o\'qituvchisi:',
      teacherName,
      '',
      '',
      'Sana:',
      new Date().toLocaleDateString('uz-UZ'),
      'Jami o\'quvchilar:',
      `${rosterList.length} nafar`,
    ],
    [''],
    [
      'YO\'RIQNOMA: O\'quvchi saytga kirib, o\'zining "Shaxsiy PIN-kodi"ni kiritadi. Yozma topshiriqlar va masalalarni daftarga qo\'lda yozib, telefon orqali rasmini yuklaydi. AI daftardagi yechimni BSB mezonlari asosida tekshiradi va o\'qituvchiga yuboradi.',
    ],
    [''],
    [
      '№',
      'O\'quvchining Familiyasi, Ismi (F.I.Sh)',
      'Sinf',
      'Umumiy Test Kodi',
      'Shaxsiy Kirish PIN-kodi',
      'O\'quvchi imzosi (PIN-kodni olganligi haqida)',
      'Eslatma / Izoh',
    ],
  ];

  rosterList.forEach((r, idx) => {
    rows.push([
      idx + 1,
      r.name,
      r.studentClass || test.grade,
      test.code,
      r.studentCode,
      '',
      'Daftarga yozilgan yechim rasmini yuklashi mumkin',
    ]);
  });

  rows.push(['']);
  rows.push(['TASDIQLASH VA MAS\'ULLAR:']);
  rows.push(['Fan o\'qituvchisi:', '____________________', teacherName]);
  rows.push(['Metodbirlashma rahbari:', '____________________', 'F.I.Sh: ______________________']);
  rows.push(['Sana:', `${new Date().toLocaleDateString('uz-UZ')} yil`]);

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 5 },  // №
    { wch: 34 }, // F.I.Sh
    { wch: 10 }, // Sinf
    { wch: 18 }, // Test Kodi
    { wch: 24 }, // PIN-kod
    { wch: 28 }, // Imzo
    { wch: 42 }, // Eslatma
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'PIN-kodlar Jadvali');

  const cleanFileName =
    `PIN_KODLAR_${test.testType}_${test.grade}_${test.subject}_${test.code}.xlsx`
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_\-\.]/g, '');

  XLSX.writeFile(workbook, cleanFileName);
}

