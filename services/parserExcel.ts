import * as XLSX from 'xlsx';
import { ChartConfig, ParsedChartData, SeriesConfig } from '../types';

// --- HELPERS ---

const SPANISH_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

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
const readRowUntilBlank = (sheet: any, startCell: string, mode: 'number' | 'category'): DynamicRowResult => {
    const start = XLSX.utils.decode_cell(startCell);
    const values: any[] = [];
    const MAX_COLS = 500; // Hard limit safety
    const BLANK_THRESHOLD = 3; // Stop after 3 empty cells
    
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
                val = cell.v; // keep raw for numbers
            }
        }

        if (isEmpty) {
            consecutiveBlanks++;
            values.push(null); // placeholder
        } else {
            consecutiveBlanks = 0;
            values.push(val);
            lastValidCol = currentCol;
        }

        if (consecutiveBlanks >= BLANK_THRESHOLD) {
            break;
        }
        currentCol++;
    }

    // Trim trailing nulls caused by the blank detection
    const trimCount = consecutiveBlanks;
    const finalValues = values.slice(0, values.length - trimCount);
    
    const endCellAddr = XLSX.utils.encode_cell({ r: start.r, c: lastValidCol });

    return {
        values: finalValues,
        endColIndex: lastValidCol,
        endCellAddr: endCellAddr
    };
};

// Read row with fixed length (based on category length)
const readRowFixedLen = (sheet: any, startCell: string, length: number): any[] => {
    const start = XLSX.utils.decode_cell(startCell);
    const values: any[] = [];
    
    for (let i = 0; i < length; i++) {
        const addr = XLSX.utils.encode_cell({ r: start.r, c: start.c + i });
        const cell = sheet[addr];
        if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
             const num = Number(cell.v);
             values.push(isNaN(num) ? null : num);
        } else {
             values.push(null);
        }
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

// --- EXPORTS ---

// New: Accepts ArrayBuffer directly (for SharePoint)
export const parseArrayBuffer = (buffer: ArrayBuffer): any => {
    return XLSX.read(buffer, { type: 'array', cellDates: true, cellNF: true, cellText: false });
};

// Wraps ArrayBuffer parser for File inputs
export const parseWorkbook = async (file: File): Promise<any> => {
  const arrayBuffer = await file.arrayBuffer();
  return parseArrayBuffer(arrayBuffer);
};

export const processChartData = (wb: any, config: ChartConfig): ParsedChartData => {
  const result: ParsedChartData = {
    configId: config.id,
    categories: [],
    series: [],
    calculatedRange: "",
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
      const catResult = readRowUntilBlank(sheet, config.categoryStartCell, 'category');
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

      // Recalculate range string if trimmed
      if (filteredCategories.length !== rawCategories.length) {
          const start = XLSX.utils.decode_cell(config.categoryStartCell);
          const newEndCol = start.c + filteredCategories.length - 1;
          finalEndCellAddr = XLSX.utils.encode_cell({ r: start.r, c: newEndCol });
      }

      result.categories = filteredCategories;
      result.calculatedRange = `${config.categoryStartCell}:${finalEndCellAddr}`;

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

  if (expectedLen > 0) {
      config.series.forEach((sConfig: SeriesConfig, idx) => {
        // Name
        let seriesName = `Serie ${idx + 1}`;
        if (sConfig.nameCell) {
            seriesName = getCellValue(sheet, sConfig.nameCell);
        } else if (sConfig.nameRange) {
            seriesName = getRangeTextJoined(sheet, sConfig.nameRange);
        }

        // Values (Read ONLY the expected length)
        const cleanValues = readRowFixedLen(sheet, sConfig.valuesStartCell, expectedLen);

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

  return result;
};