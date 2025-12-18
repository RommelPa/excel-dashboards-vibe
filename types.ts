export type FileType = 'facturacion' | 'balance';

export interface SeriesConfig {
  nameCell?: string;   // Single cell for name
  nameRange?: string;  // Range for name (merged)
  valuesStartCell: string; // Dynamic: Start cell for data row
  valueHeaderPattern?: string;
  renderType?: 'bar' | 'line' | 'area';
  stack?: boolean | string;
}

export interface ChartConfig {
  id: number;
  title: string;
  fileType: FileType;
  sheet: string;
  
  // Dynamic Range Configuration
  categoryStartCell: string;       // Where categories start (e.g. "C3")
  categoryStartCellRow2?: string;  // For "Margen Comercial" (second row of header)
  categoryHeaderPattern?: string;
  maxConsecutiveBlanks?: number;
  
  series: SeriesConfig[];
  type: 'bar' | 'line' | 'area';
  stack?: boolean;
  
  // Visual overrides
  height?: number;
  disableDataZoom?: boolean;
  initialZoomLastN?: number;
  xAxisLabelInterval?: number | 'auto';
  xAxisLabelRotate?: number;
}

export interface ParsedSeries {
  name: string;
  data: (number | null)[];
}

export interface ParsedChartData {
  configId: number;
  categories: string[];
  series: ParsedSeries[];
  calculatedRange: string; // e.g., "C3:DR3" (calculated dynamically)
  discardedColumns?: number;
  validation: {
    sheetExists: boolean;
    hasData: boolean;
    errors: string[];
    warnings: string[];
  };
}

export interface WorkbookMap {
  facturacion: any | null; // XLSX.WorkBook
  balance: any | null;     // XLSX.WorkBook
}

// --- SharePoint Types ---

export interface StoredFileMeta {
    eTag: string;
    lastModifiedDateTime: string;
}

export interface SharePointConfig {
  enabled: boolean;
  facturacionLink: string;
  balanceLink: string;
  facturacionShareId?: string;
  balanceShareId?: string;
  autoRefresh: boolean; // 15 min
  refreshIntervalMinutes: number;
  lastSync?: string; // ISO Date
  // Cache to prevent re-downloading
  metaFacturacion?: StoredFileMeta;
  metaBalance?: StoredFileMeta;
}

export interface FileSyncStatus {
  lastModified?: string;
  eTag?: string;
  // 'needs_consent' added to trigger advanced permission UI
  status: 'idle' | 'loading' | 'success' | 'error' | 'up-to-date' | 'checking' | 'needs_consent';
  message?: string;
}
