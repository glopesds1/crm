import React from 'react';
import { DashTable } from './ui/DashTable';
import { Empty } from './ui/Empty';

interface ReunioesTabProps {
  data: any;
}

export function ReunioesTab({ data }: ReunioesTabProps) {
  console.log('[reunioes dia] raw data:', data);
  console.log('[reunioes dia] data.dia:', data?.dia);
  const dia: any[] = Array.isArray(data?.dia) ? data.dia : data?.dia ? [data.dia] : [];
  console.log('[reunioes dia] parsed array:', dia.length, dia);

  const statusStyle: Record<string, React.CSSProperties> = {
    'Pendente': { color: '#d4af37' },
    'Reunião Marcada': { color: '#d4af37' },
    'Compareceu': { color: '#4ade80' },
    'Reunião Realizada': { color: '#4ade80' },
    'Venda': { color: '#22c55e', fontWeight: 600 },
    'No-show': { color: '#ef4444' },
    'Não compareceu': { color: '#ef4444' },
    'Perdido': { color: '#dc2626', fontWeight: 600 },
    'Reagendou': { color: '#60a5fa' },
    'Reagendado': { color: '#60a5fa' },
  };

  const STATUS_LABEL: Record<string, string> = {
    'Reunião Marcada': 'Reunião Marcada',
    'No-show': 'No-show',
    'Reunião Realizada': 'Reunião Realizada',
    'Pendente': 'Reunião Marcada',
    'Venda': 'Venda',
    'Perdido': 'Perdido',
    'Reagendado': 'Reagendado',
    'Compareceu': 'Compareceu',
    'Não compareceu': 'Não compareceu',
    'Reagendou': 'Reagendou',
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-4">
          Reuniões do Dia ({dia.length})
        </h3>
        {dia.length === 0 ? <Empty msg="Nenhuma reunião hoje." /> : (
          <DashTable
            cols={['Lead', 'Telefone', 'Horário', 'Status', 'TP', 'Vendedor', 'SDR']}
            rows={dia.map(r => {
              const label = STATUS_LABEL[r.status] ?? r.status;
              return [
                r.lead,
                r.telefone ?? '—',
                r.horario ?? '—',
                <span style={statusStyle[label] ?? statusStyle[r.status] ?? { color: '#aaa' }}>{label}</span>,
                r.tp ?? '—',
                r.vendedor ?? '—',
                r.sdr ?? '—',
              ] as any;
            })}
          />
        )}
      </div>
    </div>
  );
}
