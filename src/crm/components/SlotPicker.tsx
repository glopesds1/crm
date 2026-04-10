import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { SLOT_HOURS, MAX_POR_SLOT } from '../../shared/constants';
import { SP_TZ } from '../../shared/lib/dateHelpers';

const WEBHOOK_BASE_SLOT = (import.meta.env.VITE_WEBHOOK_BASE ?? 'https://webhook.m2black.com/webhook/dashboard').replace('/webhook/dashboard', '');

interface SlotPickerProps {
  selectedDate: string;
  onSelectDate: (d: string) => void;
  selectedHour: string;
  onSelectHour: (h: string) => void;
  tpAtual?: string;
}

export function SlotPicker({ selectedDate, onSelectDate, selectedHour, onSelectHour, tpAtual }: SlotPickerProps) {
  const [ocupacao, setOcupacao] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  // Mês exibido no calendário [year, month(0-indexed)]
  const [viewYear, setViewYear] = useState(() => {
    if (selectedDate) {
      const [y, m] = selectedDate.split('-').map(Number);
      return y;
    }
    return new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (selectedDate) {
      const [, m] = selectedDate.split('-').map(Number);
      return m - 1;
    }
    return new Date().getMonth();
  });

  // Today helpers
  const nowRef = useRef(new Date());
  const todayStr = React.useMemo(() => {
    const n = nowRef.current;
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }, []);
  const todayYear = nowRef.current.getFullYear();
  const todayMonth = nowRef.current.getMonth();
  const todayDate = nowRef.current.getDate();
  const currentHour = nowRef.current.getHours();

  // Gerar dias do mês para o grid do calendário
  const calendarDays = React.useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startDow = firstDay.getDay(); // 0=dom
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: { day: number; month: number; year: number; currentMonth: boolean; dateStr: string }[] = [];

    // Dias do mês anterior para preencher o início
    for (let i = startDow - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = viewMonth === 0 ? 11 : viewMonth - 1;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      cells.push({ day: d, month: m, year: y, currentMonth: false, dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }

    // Dias do mês atual
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, month: viewMonth, year: viewYear, currentMonth: true, dateStr: `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }

    // Preencher final para completar a última semana
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
      for (let d = 1; d <= remaining; d++) {
        cells.push({ day: d, month: nextM, year: nextY, currentMonth: false, dateStr: `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
      }
    }

    return cells;
  }, [viewYear, viewMonth]);

  // Navegar meses
  const canGoPrev = viewYear > todayYear || (viewYear === todayYear && viewMonth > todayMonth);
  const goNextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
    onSelectHour('');
  };
  const goPrevMonth = () => {
    if (!canGoPrev) return;
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
    onSelectHour('');
  };

  // Nome do mês
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: SP_TZ });

  // Verificar se um dia é passado ou fim de semana
  const isDayDisabled = (cell: typeof calendarDays[0]) => {
    if (!cell.currentMonth) return true;
    const dow = new Date(cell.year, cell.month, cell.day).getDay();
    if (dow === 0 || dow === 6) return true; // fim de semana
    // Dia passado
    if (cell.year < todayYear) return true;
    if (cell.year === todayYear && cell.month < todayMonth) return true;
    if (cell.year === todayYear && cell.month === todayMonth && cell.day < todayDate) return true;
    // Hoje: desabilitar se já passou das 17h
    if (cell.dateStr === todayStr && currentHour >= 17) return true;
    return false;
  };

  // Fetch disponibilidade quando data muda
  useEffect(() => {
    if (!selectedDate) return;
    const map: Record<string, number> = {};
    SLOT_HOURS.forEach(s => map[s] = 0);
    setOcupacao(map);
    setLoading(true);
    (async () => {
      try {
        const resp = await fetch(`${WEBHOOK_BASE_SLOT}/webhook/dashboard?page=disponibilidade&data_inicio=${selectedDate}`);
        const json = await resp.json();
        const slots: { hora: string; ocupacao: number | string }[] = json.slots || [];
        const m: Record<string, number> = {};
        SLOT_HOURS.forEach(s => m[s] = 0);
        slots.forEach(s => { if (m[s.hora] !== undefined) m[s.hora] = Number(s.ocupacao); });
        setOcupacao(m);
      } catch (e) {
        console.warn('[disponibilidade]', e);
      } finally { setLoading(false); }
    })();
  }, [selectedDate]);

  // Filtrar slots passados se hoje
  const visibleSlots = SLOT_HOURS.filter(h => {
    if (selectedDate !== todayStr) return true;
    return parseInt(h) > currentHour;
  });

  // Data selecionada formatada
  const selectedDateFormatted = React.useMemo(() => {
    if (!selectedDate) return '';
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: SP_TZ });
  }, [selectedDate]);

  const DOW_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  return (
    <div className="rounded-xl bg-[var(--color-background-secondary,#1a1a2e)] p-4">
      {/* Cabeçalho do mês */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={goPrevMonth} disabled={!canGoPrev}
            className={`p-1 rounded-full transition-colors ${canGoPrev ? 'text-gray-300 hover:text-white hover:bg-white/10' : 'text-gray-700 cursor-not-allowed'}`}>
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-[var(--color-text-primary,#fff)] capitalize">{monthLabel}</span>
          <button type="button" onClick={goNextMonth}
            className="p-1 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
        <span className="text-[11px] text-gray-500">Horário de Brasília</span>
      </div>

      <p className="text-xs text-gray-400 mb-3">Selecione uma data e horário</p>

      {/* Layout: calendário + slots */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Calendário mensal */}
        <div className="flex-shrink-0">
          {/* Cabeçalho dias da semana */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {DOW_LABELS.map(d => (
              <div key={d} className="text-center text-[11px] text-gray-500 font-medium py-1">{d}</div>
            ))}
          </div>
          {/* Grid de dias */}
          <div className="grid grid-cols-7 gap-0.5">
            {calendarDays.map((cell, i) => {
              const disabled = isDayDisabled(cell);
              const isSelected = selectedDate === cell.dateStr;
              const isToday = cell.dateStr === todayStr;
              return (
                <button key={i} type="button" disabled={disabled}
                  onClick={() => { onSelectDate(cell.dateStr); onSelectHour(''); }}
                  className={`w-8 h-8 rounded-full text-[13px] font-medium transition-all flex items-center justify-center ${
                    isSelected
                      ? 'bg-cyan-500 text-white font-bold'
                      : disabled
                        ? 'text-gray-700 cursor-not-allowed'
                        : isToday
                          ? 'text-cyan-400 border border-cyan-500/40 hover:bg-white/10'
                          : cell.currentMonth
                            ? 'text-gray-300 hover:bg-white/10 hover:text-white'
                            : 'text-gray-700 cursor-not-allowed'
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Slots de horário */}
        <div className="flex-1 min-w-0">
          {selectedDate ? (
            <>
              <p className="text-xs font-semibold text-[var(--color-text-primary,#fff)] mb-2 capitalize">{selectedDateFormatted}</p>
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 size={18} className="animate-spin text-gray-500" />
                </div>
              ) : visibleSlots.length === 0 ? (
                <p className="text-[12px] text-gray-600 text-center py-4">Nenhum horário disponível</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {visibleSlots.map(h => {
                    const occ = ocupacao[h] ?? 0;
                    const isR1 = !tpAtual || tpAtual === 'R1';
                    const full = isR1 && occ >= MAX_POR_SLOT;
                    const selected = selectedHour === h;

                    let borderColor = 'border-[#22c55e60]';
                    let bgColor = 'bg-transparent';
                    let txt = 'text-white';
                    let badge = '';
                    if (occ === 1) { borderColor = 'border-[#d4af3760]'; badge = '1/2'; }
                    if (occ >= 2) { borderColor = 'border-[#ef444460]'; badge = '2/2'; }
                    if (full) { txt = 'text-gray-600'; }
                    if (selected && !full) { bgColor = 'bg-cyan-500/20'; borderColor = 'border-cyan-400'; }

                    return (
                      <button key={h} type="button" disabled={full}
                        onClick={() => onSelectHour(h)}
                        className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all flex items-center justify-between ${bgColor} ${borderColor} ${txt} ${
                          full ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:brightness-125'
                        } ${selected && !full ? 'ring-1 ring-cyan-400/30' : ''}`}
                      >
                        <span className="font-bold">{h}</span>
                        {badge && <span className="text-[10px] opacity-70">{badge}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-8 text-gray-600 text-xs">
              Selecione uma data no calendário
            </div>
          )}
        </div>
      </div>

      {/* Resumo */}
      {selectedDate && selectedHour && (
        <p className="text-[11px] text-gray-400 mt-3">
          Reunião marcada para <span className="text-white font-semibold">{selectedDate.split('-').reverse().join('/')}</span> às <span className="text-white font-semibold">{selectedHour}</span>
        </p>
      )}
    </div>
  );
}
