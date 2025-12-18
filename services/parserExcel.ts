import * as XLSX from 'xlsx';
import { ChartConfig, ParsedChartData, SeriesConfig } from '../types';

const DEFAULT_BLANK_THRESHOLD = Number(import.meta.env.VITE_BLANK_THRESHOLD ?? 6);
const MAX_COLS = 500;
const MAX_ALLOWED_FILE_SIZE_MB = Number(import.meta.env.VITE_MAX_FILE_SIZE_MB ?? 30);

// --- HELPERS ---

const SPANISH_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const validateWorkbookSize = (file: File) => {
  const maxBytes = MAX_ALLOWED_FILE_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`El archivo supera el límite de ${MAX_ALLOWED_FILE_SIZE_MB}MB.`);
  }
};

const normalizeNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  const sanitized = String(value).replace(/\s+/g, '').replace(/,/g, '.').replace(/[^0-9.-]/g, '');
  const parsed = Number.parseFloat(sanitized);
  return Number.isFinite(parsed) ? parsed : null;
};

// Helper: Format category cells to "mmm-yy" in Spanish
const formatExcelCategory = (cell: any): string => {
  if (!cell) return "";

  // Helper to format JS Date to "mmm-yy" (Spanish)
  const toSpanishMonthYear = (d: Date) => {
     if (isNaN(d.getTime())) return "";
     const year = d.getFullYear().toString().slice(-2);
     return `${SPANISH_MONTHS[d.getMonth()]}-${year}`;
  };

  // a) Cell is Date object (cellDates: true produces type 'd')
  if (cell.t === 'd' && cell.v instanceof Date) {
      return toSpanishMonthYear(cell.v);
  }

  // b) Cell is Number but has date format string (backup)
  if (cell.t === 'n' && cell.z && /[dmy]/i.test(cell.z)) {
      const dateInfo = XLSX.SSF.parse_date_code(cell.v);
      if (dateInfo) {
          const jsDate = new Date(dateInfo.y, dateInfo.m - 1, dateInfo.d);
          return toSpanishMonthYear(jsDate);
      }
  }

  // c) Fallback
  return String(cell.v ?? "");
};

const getCellValue = (sheet: any, cellAddr: string): string => {
  if (!sheet || !sheet[cellAddr]) return "";
  return String(sheet[cellAddr].v || "");
};

// Merged header helper (fixed range)
const getRangeTextJoined = (sheet: any, rangeStr: string): string => {
  const range = XLSX.utils.decode_range(rangeStr);
  const parts = [];
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const addr = XLSX.utils.encode_cell({r:R, c:C});
        const val = sheet[addr]?.v;
        if(val) parts.push(val);
    }
  }
  return parts.join(" ");
};

// --- DYNAMIC READERS ---

interface DynamicRowResult {
    values: any[];
    endColIndex: number;
    endCellAddr: string;
}

// Read row starting at startCell until N consecutive blanks or maxCols
const readRowUntilBlank = (
    sheet: any,
    startCell: string,
    mode: 'number' | 'category',
    threshold: number = DEFAULT_BLANK_THRESHOLD
): DynamicRowResult => {
    const start = XLSX.utils.decode_cell(startCell);
    const values: any[] = [];
    const effectiveThreshold = Math.max(2, threshold);
    
    let consecutiveBlanks = 0;
    let currentCol = start.c;
    let lastValidCol = start.c;

    for (let i = 0; i < MAX_COLS; i++) {
        const addr = XLSX.utils.encode_cell({ r: start.r, c: currentCol });
        const cell = sheet[addr];
        
        let val = null;
        let isEmpty = true;

        if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
            isEmpty = false;
            if (mode === 'category') {
                val = formatExcelCategory(cell);
            } else {
                val = normalizeNumber(cell.v);
            }
        }

        if (isEmpty) {
            consecutiveBlanks++;
            values.push(null);
        } else {
            consecutiveBlanks = 0;
            values.push(val);
            lastValidCol = currentCol;
        }

        if (consecutiveBlanks >= effectiveThreshold) {
            break;
        }
        currentCol++;
    }

    const endCellAddr = XLSX.utils.encode_cell({ r: start.r, c: lastValidCol });

    return {
        values,
        endColIndex: lastValidCol,
        endCellAddr
    };
};

// Read row with fixed length (based on category length)
const readRowFixedLen = (sheet: any, startCell: string, length: number): any[] => {
    const start = XLSX.utils.decode_cell(startCell);
    const values: any[] = [];
    
    for (let i = 0; i < length; i++) {
        const addr = XLSX.utils.encode_cell({ r: start.r, c: start.c + i });
        const cell = sheet[addr];
        values.push(normalizeNumber(cell?.v));
    }
    return values;
};

// Check if a category string looks like a valid monthly date or contains "Total"
const filterCategories = (categories: string[], isFacturacion: boolean) => {
    let cutoffIndex = -1;

    for (let i = 0; i < categories.length; i++) {
        const val = String(categories[i] || "").toLowerCase().trim();
        
        // 1. Hard Stop: Explicit "Total" detected
        if (val.includes('total')) {
            cutoffIndex = i;
            break;
        }

        // 2. Facturacion specific: Soft Stop if not date-like
        // Valid formatted dates usually look like "ene-25", "feb-24"
        if (isFacturacion) {
            const hasMonth = SPANISH_MONTHS.some(m => val.includes(m));
            const hasYearDigit = /\d/.test(val);
            
            // If it doesn't look like a month-year combo and is not empty
            if (val.length > 0 && (!hasMonth || !hasYearDigit)) {
                cutoffIndex = i;
                break;
            }
        }
    }

    if (cutoffIndex !== -1) {
        return categories.slice(0, cutoffIndex);
    }
    return categories;
};

const findCellByPattern = (sheet: any, pattern?: string, preferredRow?: number) => {
    if (!pattern) return null;
    const normalizedPattern = pattern.toLowerCase();
    const matches: { addr: string; row: number }[] = [];
    Object.keys(sheet).forEach(key => {
        if (key.startsWith('!')) return;
        const cell = sheet[key];
        const value = cell?.v;
        if (typeof value === 'string' && value.toLowerCase().includes(normalizedPattern)) {
            const decoded = XLSX.utils.decode_cell(key);
            matches.push({ addr: key, row: decoded.r });
        }
    });
    if (matches.length === 0) return null;
    if (preferredRow !== undefined) {
        const rowMatch = matches.find(m => m.row === preferredRow);
        if (rowMatch) return rowMatch.addr;
    }
    return matches[0].addr;
};

const resolveStartCell = (sheet: any, fallback: string, pattern?: string) => {
    if (!sheet) return fallback;
    const decoded = XLSX.utils.decode_cell(fallback);
    const match = findCellByPattern(sheet, pattern, decoded.r);
    return match ?? fallback;
};

const resolveSeriesStartCell = (sheet: any, fallback: string, pattern?: string) => {
    if (!sheet || !pattern) return fallback;
    const decoded = XLSX.utils.decode_cell(fallback);
    const match = findCellByPattern(sheet, pattern, decoded.r);
    if (!match) return fallback;
    const matchedDecoded = XLSX.utils.decode_cell(match);
    return XLSX.utils.encode_cell({ r: decoded.r, c: matchedDecoded.c });
};

// --- EXPORTS ---

// New: Accepts ArrayBuffer directly (for SharePoint)
export const parseArrayBuffer = (buffer: ArrayBuffer): any => {
    return XLSX.read(buffer, { type: 'array', cellDates: true, cellNF: true, cellText: false });
};

// Wraps ArrayBuffer parser for File inputs
export const parseWorkbook = async (file: File): Promise<any> => {
  validateWorkbookSize(file);
  const arrayBuffer = await file.arrayBuffer();
  return parseArrayBuffer(arrayBuffer);
};

export const processChartData = (wb: any, config: ChartConfig): ParsedChartData => {
  const result: ParsedChartData = {
    configId: config.id,
    categories: [],
    series: [],
    calculatedRange: "",
    discardedColumns: 0,
    validation: {
      sheetExists: false,
      hasData: false,
      errors: [],
      warnings: []
    }
  };

  const sheet = wb.Sheets[config.sheet];
  if (!sheet) {
    result.validation.errors.push(`La hoja "${config.sheet}" no existe.`);
    return result;
  }
  result.validation.sheetExists = true;

  // 1. Process Categories (Dynamic)
  try {
      const startCell = resolveStartCell(sheet, config.categoryStartCell, config.categoryHeaderPattern);
      const catResult = readRowUntilBlank(sheet, startCell, 'category', config.maxConsecutiveBlanks);
      let rawCategories = catResult.values;
      let finalEndCellAddr = catResult.endCellAddr;
      
      // Special case: 2-row categories (Margen Comercial)
      if (config.categoryStartCellRow2) {
          // Read row 2
          const start2 = XLSX.utils.decode_cell(config.categoryStartCellRow2);
          const mergedCats = [];
          for(let i=0; i < rawCategories.length; i++) {
              const addr = XLSX.utils.encode_cell({ r: start2.r, c: start2.c + i });
              const cell = sheet[addr];
              const val2 = formatExcelCategory(cell);
              const val1 = rawCategories[i] || "";
              mergedCats.push(`${val1} ${val2}`.trim());
          }
          rawCategories = mergedCats;
      }

      // --- FILTER LOGIC (Remove 'Total' columns) ---
      const isFacturacion = config.fileType === 'facturacion';
      const filteredCategories = filterCategories(rawCategories, isFacturacion);
      result.discardedColumns = rawCategories.length - filteredCategories.length;

      // Recalculate range string if trimmed
      if (filteredCategories.length !== rawCategories.length) {
          const start = XLSX.utils.decode_cell(startCell);
          const newEndCol = start.c + filteredCategories.length - 1;
          finalEndCellAddr = XLSX.utils.encode_cell({ r: start.r, c: newEndCol });
      }

      result.categories = filteredCategories;
      result.calculatedRange = `${startCell}:${finalEndCellAddr}`;

      if (result.categories.length < 2) {
          // Warning if too short, but allow it if file is just starting
          if (rawCategories.length > result.categories.length) {
               // We trimmed it
          } else if (result.categories.length === 0) {
               result.validation.errors.push(`Rango vacío o sin fechas válidas en ${config.categoryStartCell}.`);
          }
      }

  } catch (e) {
      result.validation.errors.push(`Error leyendo categorías dinámicas: ${e}`);
  }

  // 2. Process Series (Fixed Length based on FILTERED Categories)
  const expectedLen = result.categories.length;
  let totalDataPoints = 0;
  let hasCalcWarning = false;
  let invalidNumbers = 0;

  if (expectedLen > 0) {
      config.series.forEach((sConfig: SeriesConfig, idx) => {
        // Name
        let seriesName = `Serie ${idx + 1}`;
        if (sConfig.nameCell) {
            seriesName = getCellValue(sheet, sConfig.nameCell);
        } else if (sConfig.nameRange) {
            seriesName = getRangeTextJoined(sheet, sConfig.nameRange);
        }

        const valuesStartCell = resolveSeriesStartCell(sheet, sConfig.valuesStartCell, sConfig.valueHeaderPattern);

        // Values (Read ONLY the expected length)
        const cleanValues = readRowFixedLen(sheet, valuesStartCell, expectedLen);
        invalidNumbers += cleanValues.filter(v => v === null).length;

        // Validation Check
        const missingPoints = cleanValues.filter(v => v === null).length;
        if (expectedLen > 0 && (missingPoints / expectedLen) > 0.5) { 
            // Increased threshold slightly as some series might have gaps naturally
            hasCalcWarning = true;
        }
        
        totalDataPoints += (expectedLen - missingPoints);

        result.series.push({
            name: seriesName,
            data: cleanValues
        });
      });
  }

  if (totalDataPoints > 0) {
      result.validation.hasData = true;
  } else if (expectedLen > 0) {
      result.validation.errors.push("No se encontraron datos numéricos en los rangos detectados.");
  }

  if (hasCalcWarning) {
      result.validation.warnings.push("Posible falta de valores calculados (muchos vacíos). Abra el Excel, recalcular y guardar.");
  }

  if (invalidNumbers > 0) {
      result.validation.warnings.push(`Se normalizaron valores no numéricos o vacíos (${invalidNumbers}).`);
  }

  return result;
};
