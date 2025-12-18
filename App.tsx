import React, { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider, useMsal } from "@azure/msal-react";

import FileUploadPanel from './components/FileUploadPanel';
import ValidatorPanel from './components/ValidatorPanel';
import DashboardTabs from './components/DashboardTabs';
import SharePointPanel from './components/SharePointPanel';

import { FileType, WorkbookMap, ParsedChartData, SharePointConfig, FileSyncStatus } from './types';
import { parseWorkbook, parseArrayBuffer, processChartData } from './services/parserExcel';
import { CHART_CONFIGS } from './constants';
import { msalConfig, loginRequest } from './services/authConfig';
import { getShareIdFromLink, getDriveItemMeta, downloadDriveItemContent } from './services/sharepoint';

// Initialize MSAL outside component
const msalInstance = new PublicClientApplication(msalConfig);
msalInstance.initialize();

const DEFAULT_SP_CONFIG: SharePointConfig = {
    enabled: false,
    facturacionLink: "https://egasacompe.sharepoint.com/:x:/s/GerenciaComercial/IQBq5bj4puw8Rrnn4uVL350DAeVF39_OSTHl0Che6dWwS0k?e=icRE36",
    balanceLink: "https://egasacompe.sharepoint.com/:x:/s/GerenciaComercial/IQDx3w9KXKKLTq5WDdfR-XFMAfHQSCR45iEpIG63EmPBeyw?e=i0fiwU",
    autoRefresh: false,
    refreshIntervalMinutes: 15
};

const AppContent: React.FC = () => {
  // --- STATE: Data ---
  const [files, setFiles] = useState<Record<FileType, File | null>>({ facturacion: null, balance: null });
  const [workbooks, setWorkbooks] = useState<WorkbookMap>({ facturacion: null, balance: null });
  const [parsedData, setParsedData] = useState<ParsedChartData[]>([]);
  const [uploadErrors, setUploadErrors] = useState<Record<FileType, string | null>>({ facturacion: null, balance: null });

  // --- STATE: Mode & Config ---
  const [mode, setMode] = useState<'manual' | 'sharepoint'>('manual');
  const [spConfig, setSpConfig] = useState<SharePointConfig>(() => {
      const saved = localStorage.getItem('vibe_sp_config');
      return saved ? { ...DEFAULT_SP_CONFIG, ...JSON.parse(saved) } : DEFAULT_SP_CONFIG;
  });

  // --- STATE: Sync Status ---
  const [syncStatus, setSyncStatus] = useState<Record<FileType, FileSyncStatus>>({
      facturacion: { status: 'idle' },
      balance: { status: 'idle' }
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // MSAL Hook
  const { instance, accounts } = useMsal();

  // --- PERSISTENCE ---
  useEffect(() => {
      localStorage.setItem('vibe_sp_config', JSON.stringify(spConfig));
      // Auto-switch removed to allow user to stay in manual mode if preferred
      // if (spConfig.enabled && mode !== 'sharepoint') setMode('sharepoint');
  }, [spConfig]);

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

  // --- MANUAL UPLOAD HANDLER ---
  const handleFileUpload = async (type: FileType, file: File) => {
    console.log("Processing manual file:", file.name);
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
      console.error(error);
      setUploadErrors(prev => ({ ...prev, [type]: "Error al leer el archivo Excel." }));
    }
  };

  // --- SHAREPOINT SYNC WORKER ---
  const syncFileWorker = async (
      type: FileType, 
      link: string, 
      token: string, 
      onlyCheckMeta: boolean,
      currentWb: any
  ): Promise<{ wb: any, changed: boolean }> => {
      
      if (!link) return { wb: currentWb, changed: false };

      setSyncStatus(prev => ({ ...prev, [type]: { ...prev[type], status: 'checking', message: 'Verificando...' } }));
      
      let meta;
      try {
          const shareId = getShareIdFromLink(link);
          meta = await getDriveItemMeta(shareId, token);
      } catch (e: any) {
          // Detect permission errors (403/401)
          if (e.message.includes("403") || e.message.includes("401") || e.message.toLowerCase().includes("access denied")) {
              setSyncStatus(prev => ({ ...prev, [type]: { status: 'needs_consent', message: 'Faltan permisos.' } }));
              throw new Error("ACCESS_DENIED"); // Stop flow
          }
          throw new Error(e.message || "Error accediendo al archivo.");
      }

      // Check cache
      const storedMeta = type === 'facturacion' ? spConfig.metaFacturacion : spConfig.metaBalance;
      const isSameVersion = storedMeta && storedMeta.eTag === meta.eTag;

      setSyncStatus(prev => ({ 
          ...prev, 
          [type]: { 
              status: isSameVersion ? 'up-to-date' : 'loading',
              lastModified: meta.lastModifiedDateTime, 
              eTag: meta.eTag, 
              message: isSameVersion ? '' : 'Descargando nueva versión...' 
          } 
      }));

      if (onlyCheckMeta) {
          return { wb: currentWb, changed: false };
      }

      if (isSameVersion && currentWb) {
          return { wb: currentWb, changed: false };
      }

      // Download
      try {
        const shareId = getShareIdFromLink(link);
        const buffer = await downloadDriveItemContent(shareId, token);
        const newWb = parseArrayBuffer(buffer);

        // Update Meta Config
        setSpConfig(prev => ({
            ...prev,
            [type === 'facturacion' ? 'metaFacturacion' : 'metaBalance']: {
                eTag: meta.eTag,
                lastModifiedDateTime: meta.lastModifiedDateTime
            }
        }));

        setSyncStatus(prev => ({ 
            ...prev, 
            [type]: { ...prev[type], status: 'success', message: '' } 
        }));

        return { wb: newWb, changed: true };

      } catch (e: any) {
         throw new Error("Error en descarga: " + e.message);
      }
  };

  // --- MAIN SYNC HANDLER ---
  const handleSync = useCallback(async (onlyCheckMeta: boolean = false) => {
      if (accounts.length === 0) {
          alert("Por favor inicia sesión con Microsoft primero.");
          return;
      }
      
      setIsSyncing(true);
      const newWorkbooks = { ...workbooks };
      let anyChange = false;

      try {
          // Try to get token with basic scopes first
          const tokenRes = await instance.acquireTokenSilent({
              ...loginRequest,
              account: accounts[0]
          });
          const token = tokenRes.accessToken;

          // Sync Facturacion
          if (spConfig.facturacionLink) {
              try {
                const res = await syncFileWorker('facturacion', spConfig.facturacionLink, token, onlyCheckMeta, workbooks.facturacion);
                if (res.changed) {
                    newWorkbooks.facturacion = res.wb;
                    anyChange = true;
                }
              } catch (e: any) {
                  if (e.message !== "ACCESS_DENIED") {
                      setSyncStatus(prev => ({ ...prev, facturacion: { status: 'error', message: e.message } }));
                  }
              }
          }

          // Sync Balance
          if (spConfig.balanceLink) {
              try {
                const res = await syncFileWorker('balance', spConfig.balanceLink, token, onlyCheckMeta, workbooks.balance);
                if (res.changed) {
                    newWorkbooks.balance = res.wb;
                    anyChange = true;
                }
              } catch (e: any) {
                  if (e.message !== "ACCESS_DENIED") {
                      setSyncStatus(prev => ({ ...prev, balance: { status: 'error', message: e.message } }));
                  }
              }
          }

          if (anyChange) {
              setWorkbooks(newWorkbooks);
              reparseAll(newWorkbooks);
          }

          if (!onlyCheckMeta) {
             setSpConfig(prev => ({ ...prev, lastSync: new Date().toISOString() }));
          }

      } catch (error) {
          console.error("Sync flow error", error);
      } finally {
          setIsSyncing(false);
      }
  }, [accounts, spConfig, instance, workbooks, reparseAll]);

  // --- AUTO REFRESH TIMER ---
  useEffect(() => {
      let interval: number;
      if (mode === 'sharepoint' && spConfig.autoRefresh && accounts.length > 0) {
          const ms = (spConfig.refreshIntervalMinutes || 15) * 60 * 1000;
          interval = window.setInterval(() => {
              handleSync(false); 
          }, ms);
      }
      return () => clearInterval(interval);
  }, [mode, spConfig.autoRefresh, spConfig.refreshIntervalMinutes, accounts, handleSync]);

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
                  onClick={() => setMode('manual')}
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
                onSync={handleSync}
                syncStatus={syncStatus}
                isSyncing={isSyncing}
            />
        )}

        <ValidatorPanel data={parsedData} />

        <DashboardTabs parsedData={parsedData} />
        
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
        <MsalProvider instance={msalInstance}>
            <AppContent />
        </MsalProvider>
    );
};

export default App;