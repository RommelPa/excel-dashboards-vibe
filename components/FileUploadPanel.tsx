import React, { useRef } from 'react';
import { FileUp, CheckCircle, AlertCircle } from 'lucide-react';
import { FileType } from '../types';

interface FileUploadPanelProps {
  files: Record<FileType, File | null>;
  onFileUpload: (type: FileType, file: File) => void;
  errors: Record<FileType, string | null>;
}

const FileUploadPanel: React.FC<FileUploadPanelProps> = ({ files, onFileUpload, errors }) => {
  
  // Refs to trigger inputs programmatically
  const facturacionInputRef = useRef<HTMLInputElement>(null);
  const balanceInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (type: FileType) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      onFileUpload(type, file);
    }
  };

  const triggerClick = (type: FileType) => {
    if (type === 'facturacion') facturacionInputRef.current?.click();
    if (type === 'balance') balanceInputRef.current?.click();
  };

  const renderZone = (type: FileType, label: string, hint: string, ref: React.RefObject<HTMLInputElement>) => {
    const isUploaded = !!files[type];
    const hasError = !!errors[type];

    return (
      <div 
        onClick={() => triggerClick(type)}
        className={`relative flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg transition-all cursor-pointer select-none
        ${hasError ? 'border-red-300 bg-red-50 hover:bg-red-100' : isUploaded ? 'border-green-300 bg-green-50 hover:bg-green-100' : 'border-gray-300 bg-white hover:bg-gray-50 hover:border-indigo-300 shadow-sm hover:shadow-md'}
      `}>
        {/* Hidden Input managed by Ref */}
        <input 
          ref={ref}
          type="file" 
          accept=".xlsx, .xls"
          onChange={handleFileChange(type)}
          className="hidden" 
        />
        
        {isUploaded ? (
          <CheckCircle className="w-10 h-10 text-green-500 mb-2" />
        ) : hasError ? (
            <AlertCircle className="w-10 h-10 text-red-500 mb-2" />
        ) : (
          <FileUp className="w-10 h-10 text-indigo-400 mb-2" />
        )}

        <h3 className="text-sm font-semibold text-gray-700">{label}</h3>
        <p className="text-xs text-gray-500 mt-1 text-center">
            {isUploaded ? files[type]?.name : hint}
        </p>
        
        {hasError && (
            <p className="text-xs text-red-600 mt-2 font-medium">{errors[type]}</p>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      {renderZone('facturacion', 'Facturación 2025.xlsx', 'Clic para seleccionar archivo', facturacionInputRef)}
      {renderZone('balance', 'Balance 2025.xlsx', 'Clic para seleccionar archivo', balanceInputRef)}
    </div>
  );
};

export default FileUploadPanel;
