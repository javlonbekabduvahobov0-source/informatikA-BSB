import React from 'react';
import { X, Download, FileText, ExternalLink } from 'lucide-react';

interface PdfViewerModalProps {
  pdfData: string; // base64 or data url
  fileName?: string;
  onClose: () => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  pdfData,
  fileName = 'BSB_Hujjati.pdf',
  onClose,
}) => {
  // Ensure valid data url
  const fullDataUrl = pdfData.startsWith('data:')
    ? pdfData
    : `data:application/pdf;base64,${pdfData}`;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fullDataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 md:p-6">
      <div className="bg-white rounded-3xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm md:text-base line-clamp-1">
                {fileName}
              </h3>
              <p className="text-[11px] text-slate-500">
                Yuklangan BSB / CHSB topshiriqlari va baholash mezonlari hujjati
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Yuklab olish</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 transition"
              title="Yopish"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Embed / Preview */}
        <div className="flex-1 bg-slate-100 p-2 overflow-hidden flex flex-col">
          <iframe
            src={fullDataUrl}
            title={fileName}
            className="w-full h-full rounded-2xl border border-slate-200 bg-white"
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>
            💡 Ushbu PDF dagi topshiriqlar, yechimlar va baholash mezonlari tizimga biriktirilgan
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
};
