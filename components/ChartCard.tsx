import React, { useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import * as htmlToImage from 'html-to-image';
import { Download, Image as ImageIcon, Table as TableIcon } from 'lucide-react';
import { ChartConfig, ParsedChartData } from '../types';

interface ChartCardProps {
  config: ChartConfig;
  data: ParsedChartData;
}

const ChartCard: React.FC<ChartCardProps> = ({ config, data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [showTable, setShowTable] = useState(false);
  const [exporting, setExporting] = useState(false);

  // If critical errors, show error state
  if (data.validation.errors.length > 0) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-red-100 p-6 flex flex-col items-center justify-center min-h-[300px]">
        <div className="text-red-500 font-bold mb-2">Error al cargar datos</div>
        <div className="text-sm text-center text-gray-600">{data.validation.errors.join(", ")}</div>
      </div>
    );
  }

  const exportPng = async () => {
    if (!chartRef.current) return;
    setExporting(true);
    try {
        const dataUrl = await htmlToImage.toPng(chartRef.current, { backgroundColor: '#ffffff' });
        const link = document.createElement('a');
        link.download = `${config.title.replace(/\s+/g, '_')}.png`;
        link.href = dataUrl;
        link.click();
    } catch (err) {
        console.error("Export failed", err);
        alert("Error al exportar imagen");
    } finally {
        setExporting(false);
    }
  };

  const downloadCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    // Header
    csvContent += "Category," + data.series.map(s => `"${s.name}"`).join(",") + "\n";
    // Rows
    data.categories.forEach((cat, i) => {
        const row = [
            `"${cat}"`,
            ...data.series.map(s => s.data[i] ?? "")
        ];
        csvContent += row.join(",") + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${config.title.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Build Series with mixed type support
  const echartsSeries = data.series.map((s, i) => {
      const sConfig = config.series[i];
      // Determine type: specific override > global config > default 'line'
      const typeStr = sConfig?.renderType || config.type;
      
      // Determine stack logic
      let stackVal: string | undefined = undefined;
      if (sConfig?.stack === false) {
          stackVal = undefined; // Force no stack
      } else if (sConfig?.stack !== undefined && sConfig?.stack !== true) {
          stackVal = sConfig.stack as string;
      } else if (config.stack === true || sConfig?.stack === true) {
          stackVal = 'total';
      }

      // Convert 'area' type to line + areaStyle
      const isArea = typeStr === 'area';
      const actualType = isArea ? 'line' : typeStr;
      const areaStyle = isArea ? { opacity: 0.7 } : undefined;

      return {
          name: s.name,
          type: actualType,
          stack: stackVal,
          data: s.data,
          areaStyle: areaStyle,
          smooth: true,
          label: {
            show: actualType === 'bar' && !stackVal && data.categories.length < 20, 
            position: 'top',
            fontSize: 9,
            formatter: (params: any) => params.value ? Math.round(params.value).toLocaleString() : ''
          }
      };
  });

  // Calculate DataZoom
  let dataZoomOption = undefined;
  if (!config.disableDataZoom && config.id === 7) {
      let startValue = undefined;
      // If we want the last N months, calculate start index
      if (config.initialZoomLastN && data.categories.length > config.initialZoomLastN) {
          // Use category value for start/end to be precise
          startValue = data.categories[data.categories.length - config.initialZoomLastN];
      }
      
      dataZoomOption = [
          { type: 'inside', xAxisIndex: 0 }, 
          { 
            type: 'slider', 
            xAxisIndex: 0, 
            height: 24, 
            bottom: 10,
            startValue: startValue, 
            endValue: data.categories[data.categories.length - 1] 
          }
      ];
  }

  const chartHeight = config.height ? `${config.height}px` : '350px';

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    legend: {
      bottom: 0,
      type: 'scroll'
    },
    grid: {
      top: 40,
      left: '3%',
      right: '4%',
      bottom: dataZoomOption ? 50 : 30,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.categories,
      axisLabel: {
        rotate: config.xAxisLabelRotate || 0,
        interval: config.xAxisLabelInterval
      }
    },
    yAxis: {
      type: 'value'
    },
    dataZoom: dataZoomOption,
    series: echartsSeries
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 flex flex-col overflow-hidden h-full">
      <div className="p-4 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
        <div>
            <h3 className="font-bold text-gray-800 text-lg leading-tight">{config.title}</h3>
            <p className="text-xs text-gray-500 mt-1">
                Fuente: {config.fileType}.xlsx / Hoja: {config.sheet} / 
                <span className="font-semibold text-indigo-600 ml-1">
                    Rango: {data.calculatedRange || config.categoryStartCell + "..."}
                </span>
            </p>
        </div>
        <div className="flex space-x-1">
             <button onClick={() => setShowTable(!showTable)} className="p-2 hover:bg-gray-200 rounded text-gray-600" title="Ver Datos">
                <TableIcon size={18} />
             </button>
             <button onClick={downloadCSV} className="p-2 hover:bg-gray-200 rounded text-gray-600" title="Descargar CSV">
                <Download size={18} />
             </button>
             <button onClick={exportPng} disabled={exporting} className="p-2 hover:bg-gray-200 rounded text-gray-600 disabled:opacity-50" title="Exportar PNG">
                <ImageIcon size={18} />
             </button>
        </div>
      </div>

      <div className="p-4 relative flex-grow" ref={chartRef}>
        {!showTable ? (
             <ReactECharts option={option} style={{ height: chartHeight, width: '100%' }} notMerge={true} />
        ) : (
            <div className={`overflow-auto text-xs`} style={{ height: chartHeight }}>
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                            {data.series.map((s, i) => <th key={i} className="px-3 py-2 text-left font-medium text-gray-500">{s.name}</th>)}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {data.categories.map((cat, rowIdx) => (
                            <tr key={rowIdx}>
                                <td className="px-3 py-1 font-medium text-gray-900 whitespace-nowrap">{cat}</td>
                                {data.series.map((s, colIdx) => (
                                    <td key={colIdx} className="px-3 py-1 text-gray-500">
                                        {s.data[rowIdx]?.toLocaleString('es-PE', { maximumFractionDigits: 2 }) ?? '-'}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </div>
      
      {data.validation.warnings.length > 0 && (
          <div className="bg-amber-50 px-4 py-2 text-xs text-amber-700 border-t border-amber-100">
             Warning: {data.validation.warnings[0]}
          </div>
      )}
    </div>
  );
};

export default ChartCard;