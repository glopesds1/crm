import React from 'react';
import { AlertCircle } from 'lucide-react';

export const Empty = ({ msg }: { msg?: string }) => (
  <div className="flex items-center justify-center h-32 gap-3 text-gray-600">
    <AlertCircle size={18} />
    <span className="text-sm">{msg ?? 'Nenhum dado disponível.'}</span>
  </div>
);
