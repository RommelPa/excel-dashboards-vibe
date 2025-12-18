import React, { useState } from 'react';
import { ChartConfig, ParsedChartData } from '../types';
import ChartCard from './ChartCard';
import { CHART_CONFIGS } from '../constants';

interface DashboardTabsProps {
  parsedData: ParsedChartData[];
}

const DashboardTabs: React.FC<DashboardTabsProps> = ({ parsedData }) => {
  const [activeTab, setActiveTab] = useState<'facturacion' | 'balance'>('facturacion');

  const getChartsForTab = (type: 'facturacion' | 'balance') => {
    return CHART_CONFIGS.filter(c => c.fileType === type).map(config => {
      // Find parsed data or provide fallback empty structure
      const data = parsedData.find(d => d.configId === config.id) || {
        configId: config.id,
        categories: [],
        series: [],
        calculatedRange: "",
        validation: { sheetExists: false, hasData: false, errors: ["Esperando archivo..."], warnings: [] }
      };
      return <ChartCard key={config.id} config={config} data={data} />;
    });
  };

  return (
    <div>
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('facturacion')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'facturacion'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            Facturación (6 Gráficos)
          </button>
          <button
            onClick={() => setActiveTab('balance')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'balance'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
          >
            Balance (1 Gráfico)
          </button>
        </nav>
      </div>

      <div className={`grid gap-6 ${activeTab === 'balance' ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2'}`}>
        {getChartsForTab(activeTab)}
      </div>
    </div>
  );
};

export default DashboardTabs;