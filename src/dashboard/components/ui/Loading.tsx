import React from 'react';
import { RefreshCw } from 'lucide-react';

export const Loading = () => (
  <div className="flex items-center justify-center h-48 gap-3 text-gray-500">
    <RefreshCw size={20} className="animate-spin" />
    <span className="text-sm">Carregando dados...</span>
  </div>
);
