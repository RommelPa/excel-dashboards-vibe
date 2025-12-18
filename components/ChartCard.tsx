import React, { Suspense, useMemo, useRef, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Download, Image as ImageIcon, Table as TableIcon } from 'lucide-react';
import { ChartConfig, ParsedChartData } from '../types';
import { useToast } from './Toast';

const LazyReactECharts = React.lazy(() => import('echarts-for-react'));

type EChartsInstanceRef = {
  getEchartsInstance?: () => { getDataURL: (opts: { type: string; backgroundColor?: string }) => string };
};

interface ChartCardProps {
  config: ChartConfig;
  data: ParsedChartData;
}

const ChartCard: React.FC<ChartCardProps> = ({ config, data }) => {
  const chartRef = useRef<EChartsInstanceRef | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  // If critical errors, show error state
  if (data.validation.errors.length > 0) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-red-100 p-6 flex flex-col items-center justify-center min-h-[300px]">
        <div className="text-red-500 font-bold mb-2">Error al cargar datos</div>
        <div className="text-sm text-center text-gray-600">{data.validation.errors.join(', ')}</div>
      </div>
    );
  }

  const exportPng = async () => {
    if (!chartRef.current?.getEchartsInstance) return;
    setExporting(true);
    try {
      const dataUrl = chartRef.current.getEchartsInstance()?.getDataURL({ type: 'png', backgroundColor: '#ffffff' });
      if (!dataUrl) throw new Error('No se pudo generar la imagen.');
      const link = document.createElement('a');
      link.download = `${config.title.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed', err);
      const message = err instanceof Error ? err.message : 'Error al exportar imagen';
      toast.pushToast(message, 'error');
    } finally {
      setExporting(false);
    }
  };

  const downloadCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Category,' + data.series.map(s => `"${s.name}"`).join(',') + '\n';
    data.categories.forEach((cat, i) => {
      const row = [
        `"${cat}"`,
        ...data.series.map(s => s.data[i] ?? '')
      ];
      csvContent += row.join(',') + '\n';
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${config.title.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const echartsSeries = useMemo(() => data.series.map((s, i) => {
    const sConfig = config.series[i];
    const typeStr = sConfig?.renderType || config.type;
    let stackVal: string | undefined = undefined;
    if (sConfig?.stack === false) {
      stackVal = undefined;
    } else if (sConfig?.stack !== undefined && sConfig?.stack !== true) {
      stackVal = sConfig.stack as string;
    } else if (config.stack === true || sConfig?.stack === true) {
      stackVal = 'total';
    }

    const isArea = typeStr === 'area';
    const actualType = isArea ? 'line' : typeStr;
    const areaStyle = isArea ? { opacity: 0.7 } : undefined;

    return {
      name: s.name,
      type: actualType,
      stack: stackVal,
      data: s.data,
      areaStyle,
      smooth: true,
      label: {
        show: actualType === 'bar' && !stackVal && data.categories.length < 20,
        position: 'top',
        fontSize: 9,
        formatter: (params: any) => (params.value ? Math.round(params.value).toLocaleString() : '')
      }
    };
  }), [config.series, config.stack, data.categories.length, data.series]);

  let dataZoomOption = undefined;
  if (!config.disableDataZoom && config.id === 7) {
    let startValue = undefined;
    if (config.initialZoomLastN && data.categories.length > config.initialZoomLastN) {
      startValue = data.categories[data.categories.length - config.initialZoomLastN];
    }
    dataZoomOption = [
      { type: 'inside', xAxisIndex: 0 },
      {
        type: 'slider',
        xAxisIndex: 0,
        height: 24,
        bottom: 10,
        startValue,
        endValue: data.categories[data.categories.length - 1]
      }
    ];
  }

  const chartHeight = config.height ? `${config.height}px` : '350px';
  const numericHeight = Number.parseInt(chartHeight.replace('px', ''), 10) || 350;

  const option = useMemo(() => ({
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
  }), [config.xAxisLabelRotate, config.xAxisLabelInterval, data.categories, dataZoomOption, echartsSeries]);

  const columnTemplate = useMemo(
    () => `repeat(${data.series.length + 1}, minmax(120px,1fr))`,
    [data.series.length]
  );

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div
      style={{ ...style, display: 'grid', gridTemplateColumns: columnTemplate }}
      className="px-3 py-1 border-b border-gray-200 items-center"
    >
      <div className="font-medium text-gray-900 truncate">{data.categories[index]}</div>
      {data.series.map((s, colIdx) => (
        <div key={colIdx} className="text-gray-500">
          {s.data[index] !== null && s.data[index] !== undefined ? Number(s.data[index]).toLocaleString('es-PE', { maximumFractionDigits: 2 }) : '-'}
        </div>
      ))}
    </div>
  );

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
                {typeof data.discardedColumns === 'number' && data.discardedColumns > 0 && (
                  <span className="ml-2 text-amber-700">Columnas omitidas: {data.discardedColumns}</span>
                )}
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

      <div className="p-4 relative flex-grow">
        {!showTable ? (
          <Suspense fallback={<div className="text-sm text-gray-500">Cargando gráfico...</div>}>
            <LazyReactECharts
              ref={chartRef as any}
              option={option}
              style={{ height: chartHeight, width: '100%' }}
              notMerge
            />
          </Suspense>
        ) : (
          <div className="overflow-auto text-xs" style={{ height: chartHeight }}>
            <div
              className="grid bg-gray-50 sticky top-0 z-10 px-3 py-2 font-medium text-gray-600 uppercase tracking-wide"
              style={{ gridTemplateColumns: columnTemplate }}
            >
              <div>Categoría</div>
              {data.series.map((s, i) => (
                <div key={i}>{s.name}</div>
              ))}
            </div>
            <List
              height={numericHeight - 40}
              itemCount={data.categories.length}
              itemSize={36}
              width={'100%'}
            >
              {({ index, style }) => <Row index={index} style={style} />}
            </List>
          </div>
        )}
      </div>
      
      {data.validation.warnings.length > 0 && (
          <div className="bg-amber-50 px-4 py-2 text-xs text-amber-700 border-t border-amber-100">
             Warning: {data.validation.warnings.join(' ')}
          </div>
      )}
    </div>
  );
};

export default ChartCard;
