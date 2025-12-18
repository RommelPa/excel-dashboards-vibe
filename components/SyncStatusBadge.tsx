import React from 'react';
import { AlertCircle, CheckCircle, Clock, LockKeyhole, Wifi } from 'lucide-react';
import { FileSyncStatus } from '../types';

interface SyncStatusBadgeProps {
  status: FileSyncStatus;
}

const statusMap = {
  idle: { label: 'Inactivo', className: 'text-gray-400 border-gray-200 bg-gray-50' },
  checking: { label: 'Verificando', className: 'text-blue-600 border-blue-200 bg-blue-50' },
  loading: { label: 'Descargando', className: 'text-indigo-600 border-indigo-200 bg-indigo-50' },
  success: { label: 'Actualizado', className: 'text-green-600 border-green-200 bg-green-50' },
  'up-to-date': { label: 'Sin cambios', className: 'text-slate-600 border-slate-200 bg-slate-50' },
  error: { label: 'Error', className: 'text-red-600 border-red-200 bg-red-50' },
  'needs_consent': { label: 'Permisos', className: 'text-amber-700 border-amber-200 bg-amber-50' }
};

const iconMap: Record<FileSyncStatus['status'], JSX.Element> = {
  idle: <Clock size={14} />,
  checking: <Wifi size={14} />,
  loading: <Wifi size={14} className="animate-pulse" />,
  success: <CheckCircle size={14} />,
  'up-to-date': <CheckCircle size={14} />,
  error: <AlertCircle size={14} />,
  'needs_consent': <LockKeyhole size={14} />
};

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ status }) => {
  const ui = statusMap[status.status];

  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border ${ui.className}`}>
      <span className="mr-1">{iconMap[status.status]}</span>
      {ui.label}
    </span>
  );
};
