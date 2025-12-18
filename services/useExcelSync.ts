import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { advancedRequest, loginRequest } from './authConfig';
import { downloadDriveItemContent, getDriveItemMeta, getShareIdFromLink } from './sharepoint';
import { parseArrayBuffer } from './parserExcel';
import { FileSyncStatus, FileType, SharePointConfig, WorkbookMap } from '../types';
import { useToast } from '../components/Toast';

const STORAGE_KEY = 'vibe_sp_config_session';

const sanitizeForStorage = (config: SharePointConfig) => ({
  ...config,
  facturacionLink: config.facturacionShareId ? `share:${config.facturacionShareId}` : '',
  balanceLink: config.balanceShareId ? `share:${config.balanceShareId}` : ''
});

const defaultSharePointConfig: SharePointConfig = {
  enabled: false,
  facturacionLink: import.meta.env.VITE_SHAREPOINT_FACTURACION_URL || '',
  balanceLink: import.meta.env.VITE_SHAREPOINT_BALANCE_URL || '',
  facturacionShareId: undefined,
  balanceShareId: undefined,
  autoRefresh: false,
  refreshIntervalMinutes: Number(import.meta.env.VITE_SP_REFRESH_MINUTES ?? 15)
};

const initialStatus: Record<FileType, FileSyncStatus> = {
  facturacion: { status: 'idle' },
  balance: { status: 'idle' }
};

const isAuthError = (error: unknown) => {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('403') || msg.includes('401') || msg.includes('access denied');
  }
  return false;
};

export const useExcelSync = (
  workbooks: WorkbookMap,
  setWorkbooks: (w: WorkbookMap) => void,
  onParsed: (w: WorkbookMap) => void
) => {
  const { instance, accounts } = useMsal();
  const toast = useToast();
  const [spConfig, setSpConfig] = useState<SharePointConfig>(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = { ...defaultSharePointConfig, ...JSON.parse(stored) } as SharePointConfig;
        return {
          ...parsed,
          facturacionLink: parsed.facturacionLink?.startsWith('share:') ? '' : parsed.facturacionLink,
          balanceLink: parsed.balanceLink?.startsWith('share:') ? '' : parsed.balanceLink
        };
      } catch {
        return defaultSharePointConfig;
      }
    }
    return defaultSharePointConfig;
  });
  const [syncStatus, setSyncStatus] = useState<Record<FileType, FileSyncStatus>>(initialStatus);
  const [isSyncing, setIsSyncing] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const safeConfig = sanitizeForStorage(spConfig);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(safeConfig));
  }, [spConfig]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (spConfig.autoRefresh && accounts.length > 0 && spConfig.enabled) {
      const ms = (spConfig.refreshIntervalMinutes || 15) * 60 * 1000;
      intervalRef.current = window.setInterval(() => {
        handleSync(false);
      }, ms);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [spConfig.autoRefresh, spConfig.refreshIntervalMinutes, spConfig.enabled, accounts, handleSync]);

  const updateLink = useCallback((type: FileType, value: string) => {
    const shareId = value ? getShareIdFromLink(value) : undefined;
    setSpConfig(prev => ({
      ...prev,
      [type === 'facturacion' ? 'facturacionLink' : 'balanceLink']: value,
      [type === 'facturacion' ? 'facturacionShareId' : 'balanceShareId']: shareId
    }));
  }, []);

  const syncFileWorker = useCallback(async (
    type: FileType,
    link: string,
    token: string,
    onlyCheckMeta: boolean,
    currentWb: any
  ) => {
    const preComputedShareId = type === 'facturacion' ? spConfig.facturacionShareId : spConfig.balanceShareId;
    const shareId = getShareIdFromLink(link.startsWith('share:') ? '' : link) || preComputedShareId;
    if (!shareId) {
      return { wb: currentWb, changed: false };
    }

    setSyncStatus(prev => ({ ...prev, [type]: { ...prev[type], status: 'checking', message: 'Verificando...' } }));
    const meta = await getDriveItemMeta(shareId, token);

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

    if (onlyCheckMeta || (isSameVersion && currentWb)) {
      return { wb: currentWb, changed: false };
    }

    const buffer = await downloadDriveItemContent(shareId, token);
    const newWb = parseArrayBuffer(buffer);

    setSpConfig(prev => ({
      ...prev,
      [type === 'facturacion' ? 'metaFacturacion' : 'metaBalance']: {
        eTag: meta.eTag,
        lastModifiedDateTime: meta.lastModifiedDateTime
      }
    }));

    setSyncStatus(prev => ({ ...prev, [type]: { ...prev[type], status: 'success', message: '' } }));
    return { wb: newWb, changed: true };
  }, [spConfig.metaBalance, spConfig.metaFacturacion]);

  const acquireToken = useCallback(async (useAdvanced = false) => {
    if (accounts.length === 0) {
      throw new Error('Sin sesión activa');
    }
    const request = useAdvanced ? advancedRequest : loginRequest;
    try {
      const result = await instance.acquireTokenSilent({ ...request, account: accounts[0] });
      return result.accessToken;
    } catch (error) {
      if (useAdvanced) {
        throw error;
      }
      return (await instance.acquireTokenPopup({ ...request, account: accounts[0] })).accessToken;
    }
  }, [accounts, instance]);

  const handleSync = useCallback(async (onlyCheckMeta: boolean = false) => {
    if (accounts.length === 0) {
      toast.pushToast('Por favor inicia sesión con Microsoft.', 'error');
      return;
    }

    setIsSyncing(true);
    const newWorkbooks = { ...workbooks };
    let anyChange = false;

    const executeSync = async (accessToken: string) => {
      if (spConfig.facturacionLink || spConfig.facturacionShareId) {
        try {
          const res = await syncFileWorker('facturacion', spConfig.facturacionLink, accessToken, onlyCheckMeta, workbooks.facturacion);
          if (res.changed) {
            newWorkbooks.facturacion = res.wb;
            anyChange = true;
          }
        } catch (error) {
          if (isAuthError(error)) throw error;
          const message = error instanceof Error ? error.message : 'Error desconocido';
          setSyncStatus(prev => ({ ...prev, facturacion: { status: 'error', message } }));
        }
      }

      if (spConfig.balanceLink || spConfig.balanceShareId) {
        try {
          const res = await syncFileWorker('balance', spConfig.balanceLink, accessToken, onlyCheckMeta, workbooks.balance);
          if (res.changed) {
            newWorkbooks.balance = res.wb;
            anyChange = true;
          }
        } catch (error) {
          if (isAuthError(error)) throw error;
          const message = error instanceof Error ? error.message : 'Error desconocido';
          setSyncStatus(prev => ({ ...prev, balance: { status: 'error', message } }));
        }
      }
    };

    try {
      let token = await acquireToken(false);
      try {
        await executeSync(token);
      } catch (error) {
        if (isAuthError(error)) {
          token = await acquireToken(true);
          await executeSync(token);
        } else {
          throw error;
        }
      }

      if (anyChange) {
        setWorkbooks(newWorkbooks);
        onParsed(newWorkbooks);
      }
      if (!onlyCheckMeta) {
        setSpConfig(prev => ({ ...prev, lastSync: new Date().toISOString() }));
      }
    } catch (error) {
      if (isAuthError(error)) {
        setSyncStatus(prev => ({
          ...prev,
          facturacion: { ...prev.facturacion, status: 'needs_consent', message: 'Permisos insuficientes.' },
          balance: { ...prev.balance, status: 'needs_consent', message: 'Permisos insuficientes.' }
        }));
      }
      const message = error instanceof Error ? error.message : 'Error inesperado en la sincronización';
      toast.pushToast(message, 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [accounts.length, acquireToken, onParsed, setWorkbooks, spConfig.balanceLink, spConfig.facturacionLink, toast, workbooks, syncFileWorker, spConfig]);

  const syncState = useMemo(() => ({
    spConfig,
    setSpConfig,
    syncStatus,
    isSyncing,
    handleSync,
    updateLink
  }), [spConfig, syncStatus, isSyncing, handleSync, updateLink]);

  return syncState;
};
