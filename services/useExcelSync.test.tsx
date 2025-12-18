import { act, renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useExcelSync } from './useExcelSync';
import { WorkbookMap } from '../types';

const metaMock = vi.fn();
const downloadMock = vi.fn();

vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({
    instance: {
      acquireTokenSilent: vi.fn(async () => ({ accessToken: 'basic-token' })),
      acquireTokenPopup: vi.fn(async () => ({ accessToken: 'advanced-token' })),
      loginPopup: vi.fn(),
      logoutPopup: vi.fn()
    },
    accounts: [{ username: 'user@example.com' }]
  })
}));

vi.mock('../components/Toast', () => ({
  useToast: () => ({
    toasts: [],
    pushToast: vi.fn(),
    dismissToast: vi.fn()
  })
}));

vi.mock('./sharepoint', () => ({
  getShareIdFromLink: (link: string) => `u!${link}`,
  getDriveItemMeta: (...args: unknown[]) => metaMock(...args),
  downloadDriveItemContent: (...args: unknown[]) => downloadMock(...args)
}));

vi.mock('./parserExcel', () => ({
  parseArrayBuffer: () => ({ workbook: true })
}));

describe('useExcelSync', () => {
  beforeEach(() => {
    metaMock.mockReset();
    downloadMock.mockReset();
  });

  it('reintenta con token avanzado cuando el básico no tiene permisos', async () => {
    const workbooks: WorkbookMap = { facturacion: null, balance: null };
    metaMock.mockImplementation((_id: string, token: string) => {
      if (token === 'basic-token') {
        throw new Error('403');
      }
      return {
        name: 'file.xlsx',
        lastModifiedDateTime: new Date().toISOString(),
        eTag: 'etag',
        webUrl: '',
        size: 1
      };
    });
    downloadMock.mockResolvedValue(new ArrayBuffer(8));

    const setWorkbooks = vi.fn();
    const onParsed = vi.fn();
    const { result } = renderHook(() => useExcelSync(workbooks, setWorkbooks, onParsed));

    act(() => {
      result.current.updateLink('facturacion', 'https://example.sharepoint.com/file');
    });

    await act(async () => {
      await result.current.handleSync();
    });

    await waitFor(() => {
      expect(metaMock).toHaveBeenCalled();
      expect(downloadMock).toHaveBeenCalled();
      expect(setWorkbooks).toHaveBeenCalled();
      expect(onParsed).toHaveBeenCalled();
      expect(result.current.syncStatus.facturacion.status).toBe('success');
    });
  });
});
