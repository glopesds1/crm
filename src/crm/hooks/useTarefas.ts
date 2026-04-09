import { useState, useEffect, useRef } from 'react';
import { parseDateSP } from '../../shared/lib/dateHelpers';
import type { CRMLead, CRMTarefa } from '../../shared/types';

// playAlarmSound is imported from TaskAlarmPopup in the page — we accept it as a callback
export function useTarefas(leads: CRMLead[], userSession: any, playAlarmSoundFn: () => void) {
  const [tarefas, setTarefas] = useState<CRMTarefa[]>([]);
  const [alarmTarefas, setAlarmTarefas] = useState<CRMTarefa[]>([]);
  const dismissedRef = useRef<Set<string>>(new Set());

  const isAdmin = (userSession?.role ?? '').toLowerCase() === 'admin';

  useEffect(() => {
    const userName = userSession?.name ?? '';
    if (!userName) return;

    const check = () => {
      const now = new Date();
      const due = tarefas.filter(t => {
        if (t.concluida || !t.data_agendada || dismissedRef.current.has(t.id)) return false;
        const agendada = parseDateSP(t.data_agendada);
        if (agendada > now) return false;
        // Mostrar apenas para responsável pela tarefa ou pela oportunidade
        const lead = leads.find(l => l.id === t.lead_id);
        const isTaskResponsavel = (t.responsavel ?? '').toLowerCase() === userName.toLowerCase();
        const isLeadResponsavel = (lead?.closer_responsavel ?? '').toLowerCase() === userName.toLowerCase()
          || (lead?.sdr_responsavel ?? '').toLowerCase() === userName.toLowerCase();
        return isTaskResponsavel || isLeadResponsavel;
      });

      if (due.length > 0) {
        setAlarmTarefas(prev => {
          const prevIds = new Set(prev.map(t => t.id));
          const newOnes = due.filter(t => !prevIds.has(t.id));
          if (newOnes.length > 0) playAlarmSoundFn();
          return due;
        });
      }
    };

    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [tarefas, leads, userSession?.name, isAdmin, playAlarmSoundFn]);

  const dismissAlarm = (tarefaId: string) => {
    dismissedRef.current.add(tarefaId);
    setAlarmTarefas(prev => prev.filter(t => t.id !== tarefaId));
  };

  const minhasTarefasPendentes = tarefas.filter(t => {
    if (t.concluida) return false;
    const lead = leads.find(l => l.id === t.lead_id);
    const isResponsavelTarefa = t.responsavel === userSession?.name;
    const isResponsavelLead = (lead?.closer_responsavel === userSession?.name) || (lead?.sdr_responsavel === userSession?.name);
    return isResponsavelTarefa || isResponsavelLead;
  });

  return {
    tarefas, setTarefas,
    alarmTarefas, setAlarmTarefas,
    dismissedRef,
    dismissAlarm,
    minhasTarefasPendentes,
  };
}
