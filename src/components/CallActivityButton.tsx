import React, { useState } from 'react';
import { Phone, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { saveCallLog } from '../lib/mvpStorage';

interface CallActivityButtonProps {
  leadId: string;
  leadName: string;
  phone: string;
  onActivityLogged: (log: any) => void;
}

export const CallActivityButton: React.FC<CallActivityButtonProps> = ({
  leadId,
  leadName,
  phone,
  onActivityLogged,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [notificationText, setNotificationText] = useState('');

  const handleCall = () => {
    // Registra a atividade no localStorage
    const log = saveCallLog(leadId, leadName, 'call', phone, 'Ligação realizada');
    onActivityLogged(log);

    // Abre discador padrão
    window.location.href = `tel:${phone}`;

    // Mostra notificação
    setNotificationText('📞 Ligação registrada!');
    setShowMenu(false);
    setTimeout(() => setNotificationText(''), 3000);
  };

  const handleWhatsApp = () => {
    // Registra a atividade no localStorage
    const log = saveCallLog(leadId, leadName, 'whatsapp', phone, 'Mensagem WhatsApp enviada');
    onActivityLogged(log);

    // Limpa formatação do telefone
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Abre WhatsApp Web Beta
    window.open(`https://wa.me/${cleanPhone}?text=Olá%20${encodeURIComponent(leadName)}`, '_blank');

    // Mostra notificação
    setNotificationText('💬 WhatsApp registrado!');
    setShowMenu(false);
    setTimeout(() => setNotificationText(''), 3000);
  };

  return (
    <div className="relative">
      <AnimatePresence>
        {notificationText && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute -top-10 left-0 bg-green-500/20 text-green-300 px-3 py-1.5 rounded-lg text-xs border border-green-500/30 whitespace-nowrap"
          >
            {notificationText}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative inline-block">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="px-3 py-1.5 rounded-lg bg-brand-primary/20 hover:bg-brand-primary/30 text-brand-primary border border-brand-primary/50 text-xs font-bold transition-all flex items-center gap-1.5"
        >
          <Phone size={14} />
          Contato
        </button>

        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              className="absolute top-full mt-2 right-0 bg-white/10 border border-white/20 rounded-lg overflow-hidden z-40 backdrop-blur-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleCall}
                className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2 border-b border-white/10"
              >
                <Phone size={16} className="text-blue-400" />
                📞 Ligar
              </button>
              <button
                onClick={handleWhatsApp}
                className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2"
              >
                <MessageCircle size={16} className="text-green-400" />
                💬 WhatsApp
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};