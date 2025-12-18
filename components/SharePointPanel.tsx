import React, { useState } from 'react';
import { useMsal } from "@azure/msal-react";
import { loginRequest, advancedRequest } from "../services/authConfig";
import { SharePointConfig, FileSyncStatus, FileType } from '../types';
import { Cloud, RefreshCw, LogIn, Link as LinkIcon, Clock, Wifi, ShieldAlert, LockKeyhole } from 'lucide-react';
import { SyncStatusBadge } from './SyncStatusBadge';

interface SharePointPanelProps {
  config: SharePointConfig;
  onConfigChange: (newConfig: SharePointConfig) => void;
  onLinkChange: (type: FileType, link: string) => void;
  onSync: (onlyCheckMeta?: boolean) => void;
  syncStatus: Record<FileType, FileSyncStatus>;
  isSyncing: boolean;
}

const SharePointPanel: React.FC<SharePointPanelProps> = ({ 
    config, 
    onConfigChange, 
    onLinkChange,
    onSync, 
    syncStatus,
    isSyncing
}) => {
  const { instance, accounts } = useMsal();
  const isAuthenticated = accounts.length > 0;
  const [authError, setAuthError] = useState<string | null>(null);

  // Standard Login (Min permissions)
  const handleLogin = () => {
    setAuthError(null);
    instance.loginPopup(loginRequest).catch(e => {
        console.error(e);
        const message = e instanceof Error ? e.message : 'No se pudo iniciar sesión.';
        setAuthError(message);
    });
  };

  // Advanced Login (Admin permissions)
  const handleAdvancedLogin = () => {
      setAuthError(null);
      instance.acquireTokenPopup(advancedRequest).then(() => {
          // Retry sync after success
          onSync(true);
      }).catch(e => {
          console.error(e);
          setAuthError("No se pudieron obtener permisos avanzados. Es posible que requieras aprobación de administrador.");
      });
  };

  const handleLogout = () => {
    instance.logoutPopup().catch(e => console.error(e));
  };

  const updateLink = (type: 'facturacion' | 'balance', val: string) => {
      onLinkChange(type, val);
  };

  const toggleAutoRefresh = () => {
      onConfigChange({ ...config, autoRefresh: !config.autoRefresh });
  };

  // Check if any file needs consent
  const needsConsent = syncStatus.facturacion.status === 'needs_consent' || syncStatus.balance.status === 'needs_consent';

  const renderStatus = (type: FileType) => {
      const st = syncStatus[type];
      if (!st) return null;
      return <SyncStatusBadge status={st} />;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-indigo-100 p-6 mb-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
        <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center">
                <Cloud className="mr-2 text-indigo-600" />
                Sincronización SharePoint
            </h2>
            <p className="text-sm text-gray-500 mt-1 max-w-lg">
                Conecta links compartidos. Si la organización lo requiere, usa "Solicitar Permisos Avanzados".
            </p>
        </div>
        <div className="text-right">
             {!isAuthenticated ? (
                 <button onClick={handleLogin} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors shadow-sm">
                    <LogIn size={16} className="mr-2" />
                    Iniciar Sesión Microsoft
                 </button>
             ) : (
                 <div className="flex flex-col items-end">
                     <span className="text-xs text-gray-500 mb-1">Conectado como:</span>
                     <span className="text-sm font-semibold text-gray-800 bg-indigo-50 px-2 py-1 rounded text-indigo-700">{accounts[0].username}</span>
                     <button onClick={handleLogout} className="text-xs text-red-500 hover:text-red-700 mt-1 underline">Cerrar Sesión</button>
                 </div>
             )}
        </div>
      </div>

      {/* Permission Error Banner */}
      {(authError || needsConsent) && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start">
            <ShieldAlert className="text-amber-600 mt-1 mr-3 flex-shrink-0" />
            <div className="flex-grow">
                <h3 className="text-sm font-bold text-amber-800">Se requieren permisos adicionales</h3>
                <p className="text-xs text-amber-700 mt-1">
                    {authError || "Tu organización impide leer estos archivos con los permisos básicos. Intenta solicitar permisos extendidos (Files.Read.All)."}
                </p>
                {/* Admin Consent Hint */}
                {authError && authError.includes("AADSTS") && (
                     <p className="text-xs text-amber-800 font-mono mt-2 bg-amber-100 p-1 rounded">
                        Nota: Si ves "Approval required", contacta a TI para "Grant Admin Consent" a esta App en Azure AD.
                     </p>
                )}
                {isAuthenticated && (
                    <button 
                        onClick={handleAdvancedLogin}
                        className="mt-3 px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded hover:bg-amber-700 transition-colors"
                    >
                        Solicitar Permisos Avanzados
                    </button>
                )}
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Link Inputs Column */}
        <div className="lg:col-span-2 space-y-5">
            {/* Facturacion Input */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="flex justify-between mb-1">
                    <label className="text-xs font-bold text-gray-600 uppercase">Link Facturación 2025</label>
                    <div className="text-xs">{renderStatus('facturacion')}</div>
                </div>
                <div className="flex">
                    <div className="bg-white p-2 rounded-l border border-r-0 border-gray-300">
                        <LinkIcon size={16} className="text-gray-400" />
                    </div>
                    <input 
                        type="text" 
                        value={config.facturacionLink}
                        onChange={(e) => updateLink('facturacion', e.target.value)}
                        placeholder="Pegar link compartido..."
                        className="w-full border border-gray-300 rounded-r px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-gray-600"
                    />
                </div>
                {syncStatus.facturacion.message && (
                    <p className={`text-xs mt-1.5 ml-1 ${syncStatus.facturacion.status === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
                        {syncStatus.facturacion.message}
                    </p>
                )}
                 <div className="flex items-center mt-2 text-xs text-gray-500 space-x-4">
                    <span>Mod: {syncStatus.facturacion.lastModified ? new Date(syncStatus.facturacion.lastModified).toLocaleString() : 'N/A'}</span>
                    <span title={syncStatus.facturacion.eTag} className="truncate max-w-[100px] opacity-60">eTag: {syncStatus.facturacion.eTag || '-'}</span>
                </div>
            </div>

            {/* Balance Input */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="flex justify-between mb-1">
                     <label className="text-xs font-bold text-gray-600 uppercase">Link Balance 2025</label>
                     <div className="text-xs">{renderStatus('balance')}</div>
                </div>
                <div className="flex">
                    <div className="bg-white p-2 rounded-l border border-r-0 border-gray-300">
                        <LinkIcon size={16} className="text-gray-400" />
                    </div>
                    <input 
                        type="text" 
                        value={config.balanceLink}
                        onChange={(e) => updateLink('balance', e.target.value)}
                        placeholder="Pegar link compartido..."
                        className="w-full border border-gray-300 rounded-r px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-gray-600"
                    />
                </div>
                {syncStatus.balance.message && (
                     <p className={`text-xs mt-1.5 ml-1 ${syncStatus.balance.status === 'error' ? 'text-red-600' : 'text-gray-500'}`}>
                        {syncStatus.balance.message}
                    </p>
                )}
                <div className="flex items-center mt-2 text-xs text-gray-500 space-x-4">
                    <span>Mod: {syncStatus.balance.lastModified ? new Date(syncStatus.balance.lastModified).toLocaleString() : 'N/A'}</span>
                    <span title={syncStatus.balance.eTag} className="truncate max-w-[100px] opacity-60">eTag: {syncStatus.balance.eTag || '-'}</span>
                </div>
            </div>
        </div>

        {/* Controls Column */}
        <div className="bg-indigo-50 rounded-lg p-5 flex flex-col h-full border border-indigo-100">
             <div className="flex-grow space-y-6">
                 {/* Auto Refresh Toggle */}
                 <div className="flex items-center justify-between">
                     <div>
                        <span className="text-sm font-bold text-gray-800 block">Auto-Refrescar</span>
                        <span className="text-xs text-gray-500">Cada {config.refreshIntervalMinutes} minutos</span>
                     </div>
                     <button 
                        onClick={toggleAutoRefresh}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${config.autoRefresh ? 'bg-indigo-600' : 'bg-gray-300'}`}
                     >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.autoRefresh ? 'translate-x-6' : 'translate-x-1'}`} />
                     </button>
                 </div>

                 {/* Last Sync Info */}
                 <div className="bg-white/60 p-3 rounded border border-indigo-100">
                     <p className="text-xs text-gray-500 flex items-center uppercase tracking-wide mb-1">
                        <Clock size={10} className="mr-1" /> 
                        Última Sincronización
                     </p>
                     <p className="text-sm font-mono font-semibold text-gray-800">
                         {config.lastSync ? new Date(config.lastSync).toLocaleTimeString() : 'Nunca'}
                     </p>
                     {config.lastSync && <p className="text-xs text-gray-400">{new Date(config.lastSync).toLocaleDateString()}</p>}
                 </div>
             </div>

             {/* Actions */}
             <div className="mt-6 space-y-2">
                 <button 
                    onClick={() => onSync(true)}
                    disabled={!isAuthenticated || isSyncing}
                    className="w-full bg-white text-indigo-700 border border-indigo-200 py-2 rounded-lg hover:bg-indigo-50 disabled:bg-gray-100 disabled:text-gray-400 flex justify-center items-center text-sm font-medium transition-all"
                 >
                    <Wifi size={16} className="mr-2" />
                    Probar Conexión (Meta)
                 </button>

                 <button 
                    onClick={() => onSync(false)}
                    disabled={!isAuthenticated || isSyncing || (!config.facturacionLink && !config.balanceLink)}
                    className="w-full bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 shadow-md disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed flex justify-center items-center font-medium transition-all"
                 >
                    <RefreshCw size={18} className={`mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Sincronizando...' : 'Sincronizar Todo'}
                 </button>
             </div>
        </div>
      </div>
    </div>
  );
};

export default SharePointPanel;
