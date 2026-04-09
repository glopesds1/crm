import React, { useState, useRef } from 'react';
import { Bell, X, Clock, User, Building2, Users, Phone, ChevronRight, Calendar, Loader2 } from 'lucide-react';
import { supabase } from '../../shared/lib/supabase';
import type { CRMTarefa, CRMLead } from '../../shared/types';
import { fmtDateSP, fmtDateSmartSP } from '../../shared/lib/dateHelpers';
import { motion } from 'motion/react';

// ── Alarm Sound ───────────────────────────────────────────────
export function playAlarmSound() {
  try {
    const ctx = new AudioContext();
    const playTone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    // 3 beeps
    playTone(880, 0, 0.15);
    playTone(880, 0.25, 0.15);
    playTone(1100, 0.5, 0.3);
  } catch { /* audio not supported */ }
}

// ── Task Alarm Popup ──────────────────────────────────────────
export function TaskAlarmPopup({ tarefa, lead, onDismiss, onOpenLead, onComplete, onReschedule }: {
  tarefa: CRMTarefa; lead?: CRMLead; onDismiss: () => void; onOpenLead?: () => void; onComplete: (imageUrl: string) => void; onReschedule: (novaData: string) => void;
}) {
  const fmtDate = (d: string) => fmtDateSP(d, { year: true });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSaving, setRescheduleSaving] = useState(false);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else { setImagePreview(null); }
  };

  const handleComplete = async () => {
    if (!imageFile) return;
    setUploading(true);
    let url = '';
    try {
      const ext = imageFile.name.split('.').pop() ?? 'png';
      const path = `${tarefa.lead_id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('comercial-prints').upload(path, imageFile);
      if (!error) {
        const { data: urlData } = supabase.storage.from('comercial-prints').getPublicUrl(path);
        url = urlData.publicUrl;
      }
    } catch { /* continue */ }
    setUploading(false);
    onComplete(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className="w-[380px] bg-bg-card border-2 border-yellow-500/50 rounded-2xl shadow-[0_0_40px_rgba(234,179,8,0.2)] overflow-hidden"
    >
      {/* Header pulsante */}
      <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell size={18} className="text-yellow-400 animate-bounce" />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-yellow-400 rounded-full animate-ping" />
          </div>
          <span className="text-sm font-bold text-yellow-400 uppercase tracking-widest">Tarefa Agendada</span>
        </div>
        <button onClick={onDismiss} className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="p-5 space-y-3">
        <p className="text-base font-bold text-white">{tarefa.titulo}</p>

        <div className="space-y-2">
          {tarefa.data_agendada && (
            <div className="flex items-center gap-2 text-xs">
              <Clock size={13} className="text-yellow-400 flex-shrink-0" />
              <span className="text-gray-400">Horário:</span>
              <span className="text-white font-bold">{fmtDate(tarefa.data_agendada)}</span>
            </div>
          )}
          {tarefa.responsavel && (
            <div className="flex items-center gap-2 text-xs">
              <User size={13} className="text-blue-400 flex-shrink-0" />
              <span className="text-gray-400">Responsável tarefa:</span>
              <span className="text-white font-medium">{tarefa.responsavel}</span>
            </div>
          )}
          {lead && (
            <>
              <div className="flex items-center gap-2 text-xs">
                <Building2 size={13} className="text-brand-primary flex-shrink-0" />
                <span className="text-gray-400">Lead:</span>
                <span className="text-white font-medium">{lead.nome}</span>
              </div>
              {lead.closer_responsavel && lead.closer_responsavel !== tarefa.responsavel && (
                <div className="flex items-center gap-2 text-xs">
                  <Users size={13} className="text-purple-400 flex-shrink-0" />
                  <span className="text-gray-400">Closer:</span>
                  <span className="text-white font-medium">{lead.closer_responsavel}</span>
                </div>
              )}
              {lead.telefone && (
                <div className="flex items-center gap-2 text-xs">
                  <Phone size={13} className="text-gray-500 flex-shrink-0" />
                  <a href={`https://api.whatsapp.com/send?phone=${lead.telefone.replace(/\D/g, '').replace(/^0/, '').replace(/^(?!55)/, '55')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-gray-400 hover:text-brand-primary transition-colors"
                  >{lead.telefone}</a>
                </div>
              )}
            </>
          )}
        </div>

        {/* Painel de reagendamento */}
        {showReschedule ? (
          <div className="pt-1 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">Reagendar tarefa</p>
            <input type="datetime-local" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-yellow-400"
            />
            <div className="flex gap-2">
              <button onClick={async () => {
                if (!rescheduleDate) return;
                setRescheduleSaving(true);
                await onReschedule(rescheduleDate);
                setRescheduleSaving(false);
              }} disabled={!rescheduleDate || rescheduleSaving}
                className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-colors flex items-center justify-center gap-2 ${rescheduleDate ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 cursor-pointer' : 'bg-white/3 border-white/10 text-gray-600 cursor-not-allowed'}`}
              >
                {rescheduleSaving ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />} Confirmar
              </button>
              <button onClick={() => { setShowReschedule(false); setRescheduleDate(''); }}
                className="py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 pt-2">
            {onOpenLead && lead && (
              <button onClick={() => { onOpenLead(); onDismiss(); }}
                className="flex-1 py-2.5 rounded-xl bg-brand-primary/10 border border-brand-primary/30 text-xs font-bold text-brand-primary hover:bg-brand-primary/20 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ChevronRight size={14} /> Abrir Lead
              </button>
            )}
            <button onClick={() => setShowReschedule(true)}
              className="py-2.5 px-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-xs font-bold text-yellow-400 hover:text-white hover:bg-yellow-500/20 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Calendar size={13} /> Reagendar
            </button>
            <button onClick={onDismiss}
              className="py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              Depois
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
