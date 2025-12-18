import { ChartConfig } from './types';

export const CHART_CONFIGS: ChartConfig[] = [
  // --- A) FACTURACION ---
  {
    id: 1,
    title: "EVOLUCIÓN DEL PRECIO MEDIO DE ENERGÍA ACTIVA",
    fileType: 'facturacion',
    sheet: "Precio Medio",
    categoryStartCell: "E23",
    type: 'bar',
    series: [
      { nameCell: "C25", valuesStartCell: "E25" },
      { nameCell: "C32", valuesStartCell: "E32" },
      { nameCell: "C37", valuesStartCell: "E37" },
      { nameCell: "B50", valuesStartCell: "E50" }
    ]
  },
  {
    id: 2,
    title: "VENTA DE ENERGÍA (GWh)",
    fileType: 'facturacion',
    sheet: "VENTAS (MWh)",
    categoryStartCell: "F63",
    type: 'bar',
    stack: true,
    series: [
      { nameCell: "D64", valuesStartCell: "F64" },
      { nameCell: "D65", valuesStartCell: "F65" },
      { nameCell: "D66", valuesStartCell: "F66" },
      { nameCell: "D67", valuesStartCell: "F67" },
      { nameCell: "D68", valuesStartCell: "F68" }
    ]
  },
  {
    id: 3,
    title: "INGRESOS POR VENTAS DE ENERGÍA",
    fileType: 'facturacion',
    sheet: "VENTAS (S)",
    categoryStartCell: "F2",
    type: 'bar',
    series: [
      { nameCell: "C4", valuesStartCell: "F4" }, 
      { nameCell: "C11", valuesStartCell: "F11" },
      { nameCell: "C16", valuesStartCell: "F16" },
      { nameCell: "C26", valuesStartCell: "F26" }
    ]
  },
  {
    id: 4,
    title: "PARTICIPACIÓN EN EL MERCADO",
    fileType: 'facturacion',
    sheet: "Participación",
    categoryStartCell: "C4",
    type: 'bar',
    series: [
      { nameCell: "B5", valuesStartCell: "C5" },
      { nameCell: "B6", valuesStartCell: "C6" }
    ]
  },
  {
    id: 5,
    title: "ENERGÍA DESPACHADA",
    fileType: 'facturacion',
    sheet: "Despacho",
    categoryStartCell: "C5",
    type: 'bar',
    series: [
      { nameCell: "B6", valuesStartCell: "C6" },
      { nameCell: "B7", valuesStartCell: "C7" }
    ]
  },
  {
    id: 6,
    title: "Margen Comercial",
    fileType: 'facturacion',
    sheet: "Margen Comercial",
    categoryStartCell: "D3", 
    categoryStartCellRow2: "D4", // Special 2-row category
    type: 'bar',
    series: [
      { nameRange: "B5:C5", valuesStartCell: "D5" },
      { nameRange: "B12:C12", valuesStartCell: "D12" },
      { nameRange: "B20:C20", valuesStartCell: "D20" }
    ]
  },
  // --- B) BALANCE ---
  {
    id: 7,
    title: "Producción de energía activa 2016-2025",
    fileType: 'balance',
    sheet: "Perfil",
    categoryStartCell: "C3", // Dynamic: starts at C3, grows right
    type: 'line', 
    disableDataZoom: false,
    initialZoomLastN: 24, 
    height: 550, 
    xAxisLabelInterval: 'auto', 
    xAxisLabelRotate: 45,
    series: [
      // Stacked Areas
      { nameCell: "B20", valuesStartCell: "C20", renderType: 'area', stack: 'total' }, // Contratos
      { nameCell: "B19", valuesStartCell: "C19", renderType: 'area', stack: 'total' }, // Venta en COES
      // Lines on top
      { nameCell: "B16", valuesStartCell: "C16", renderType: 'line', stack: false },   // Prod Hidráulica
      { nameCell: "B17", valuesStartCell: "C17", renderType: 'line', stack: false }    // Prod Térmica
    ]
  }
];