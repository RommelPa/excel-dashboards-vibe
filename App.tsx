import React, { Suspense, useCallback, useState } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { FileType, WorkbookMap, ParsedChartData } from './types';
import { parseWorkbook, processChartData } from './services/parserExcel';
import { CHART_CONFIGS } from './constants';
import { useExcelSync } from './services/useExcelSync';
import FileUploadPanel from './components/FileUploadPanel';
import ValidatorPanel from './components/ValidatorPanel';
import SharePointPanel from './components/SharePointPanel';
import { ToastProvider, useToast } from './components/Toast';
const DashboardTabs = React.lazy(() => import('./components/DashboardTabs'));

const AppContent: React.FC = () => {
  const MAX_FILE_SIZE_BYTES = Number(import.meta.env.VITE_MAX_FILE_SIZE_MB ?? 30) * 1024 * 1024;
  // --- STATE: Data ---
  const [files, setFiles] = useState<Record<FileType, File | null>>({ facturacion: null, balance: null });
  const [workbooks, setWorkbooks] = useState<WorkbookMap>({ facturacion: null, balance: null });
  const [parsedData, setParsedData] = useState<ParsedChartData[]>([]);
  const [uploadErrors, setUploadErrors] = useState<Record<FileType, string | null>>({ facturacion: null, balance: null });

  // --- RE-PARSE LOGIC ---
  const reparseAll = useCallback((wbs: WorkbookMap) => {
    const allParsed: ParsedChartData[] = [];
    CHART_CONFIGS.forEach(config => {
      const wb = wbs[config.fileType];
      if (wb) {
        const data = processChartData(wb, config);
        allParsed.push(data);
      }
    });
    setParsedData(allParsed);
  }, []);

  // --- STATE: Mode & Config ---
  const [mode, setMode] = useState<'manual' | 'sharepoint'>('manual');
  const toast = useToast();

  // --- SYNC HOOK ---
  const {
    spConfig,
    setSpConfig,
    syncStatus,
    isSyncing,
    handleSync,
    updateLink
  } = useExcelSync(workbooks, setWorkbooks, (wbs) => {
    reparseAll(wbs);
  });

  // --- MANUAL UPLOAD HANDLER ---
  const handleFileUpload = async (type: FileType, file: File) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];

    if (!allowedTypes.includes(file.type)) {
      setUploadErrors(prev => ({ ...prev, [type]: "Tipo de archivo no permitido." }));
      toast.pushToast('Solo se permiten archivos Excel válidos.', 'error');
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadErrors(prev => ({ ...prev, [type]: `El archivo excede el tamaño máximo permitido (${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB).` }));
      toast.pushToast('Archivo demasiado grande.', 'error');
      return;
    }

    setFiles(prev => ({ ...prev, [type]: file }));
    setUploadErrors(prev => ({ ...prev, [type]: null }));
    try {
      const wb = await parseWorkbook(file);
      setWorkbooks(prev => {
        const newWbs = { ...prev, [type]: wb };
        reparseAll(newWbs);
        return newWbs;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al leer el archivo Excel.';
      setUploadErrors(prev => ({ ...prev, [type]: "Error al leer el archivo Excel." }));
      toast.pushToast(message, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-600 rounded-lg shadow-lg">
                <LayoutDashboard className="text-white w-6 h-6" />
            </div>
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Excel Dashboards Vibe</h1>
                <p className="text-sm text-gray-500">
                    {mode === 'manual' ? 'Modo: Carga Manual' : 'Modo: Automático (SharePoint)'}
                </p>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-1 flex shadow-sm">
               <button 
                  onClick={() => { setMode('manual'); setSpConfig(c => ({ ...c, enabled: false })); }}
                  className={`px-4 py-2 text-sm font-medium rounded transition-colors ${mode === 'manual' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
               >
                   Manual
               </button>
               <button 
                  onClick={() => { setMode('sharepoint'); setSpConfig(c => ({...c, enabled: true}))}}
                  className={`px-4 py-2 text-sm font-medium rounded transition-colors ${mode === 'sharepoint' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
               >
                   Fuentes
               </button>
          </div>
        </header>

        {mode === 'manual' ? (
             <FileUploadPanel 
                files={files} 
                onFileUpload={handleFileUpload} 
                errors={uploadErrors} 
             />
        ) : (
            <SharePointPanel 
                config={spConfig} 
                onConfigChange={setSpConfig} 
                onLinkChange={updateLink}
                onSync={handleSync}
                syncStatus={syncStatus}
                isSyncing={isSyncing}
            />
        )}

        <ValidatorPanel data={parsedData} />

        <Suspense fallback={<div className="text-sm text-gray-500\">Cargando paneles...</div>}>
          <DashboardTabs parsedData={parsedData} />
        </Suspense>
        
        <footer className="mt-12 text-center text-xs text-gray-400 py-4 border-t border-gray-200">
            <p className="mb-2">Datos extraídos directamente de Excel (SheetJS). No se calculan fórmulas en tiempo real.</p>
            {mode === 'sharepoint' && <p className="text-indigo-500 font-medium">Conectado a Microsoft Graph API</p>}
        </footer>
      </div>
    </div>
  );
};

const App: React.FC = () => {
    return (
        <ToastProvider>
            <AppContent />
        </ToastProvider>
    );
};

export default App;
