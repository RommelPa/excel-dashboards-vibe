import React from 'react';
import { ParsedChartData } from '../types';
import { CHART_CONFIGS } from '../constants';
import { Check, X, AlertTriangle } from 'lucide-react';

interface ValidatorPanelProps {
  data: ParsedChartData[];
}

const ValidatorPanel: React.FC<ValidatorPanelProps> = ({ data }) => {
  if (data.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Estado de Extracción</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {CHART_CONFIGS.map(config => {
          const parsed = data.find(d => d.configId === config.id);
          if (!parsed) return (
            <div key={config.id} className="flex items-center text-xs text-gray-400">
                <span className="w-4 h-4 mr-2 border rounded-full"></span>
                {config.title.substring(0, 25)}... (Pendiente)
            </div>
          );

          const isError = parsed.validation.errors.length > 0;
          const isWarning = parsed.validation.warnings.length > 0;

          return (
            <div key={config.id} className="flex items-start text-xs p-2 rounded hover:bg-gray-50">
                <div className="mt-0.5 mr-2">
                    {isError ? (
                        <X className="w-4 h-4 text-red-500" />
                    ) : isWarning ? (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                    ) : (
                        <Check className="w-4 h-4 text-green-500" />
                    )}
                </div>
                <div>
                    <span className={`font-medium ${isError ? 'text-red-700' : 'text-gray-700'}`}>
                        {config.title}
                    </span>
                    <div className="text-gray-500 mt-0.5">
                        Hoja: {config.sheet}
                    </div>
                    {isError && parsed.validation.errors.map((e, i) => (
                        <div key={i} className="text-red-500 mt-0.5">{e}</div>
                    ))}
                    {isWarning && parsed.validation.warnings.map((w, i) => (
                        <div key={i} className="text-amber-600 mt-0.5">{w}</div>
                    ))}
                </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ValidatorPanel;