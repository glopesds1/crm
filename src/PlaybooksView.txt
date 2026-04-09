import { useState } from 'react';
import { BookOpen, FileText, Target, ChevronRight, ExternalLink, Download, Map } from 'lucide-react';

const CATEGORIAS = [
  {
    id: 'pre-vendas',
    label: 'Pré-Vendas',
    icon: FileText,
    color: 'border-blue-500',
    badge: 'bg-blue-900/40 text-blue-300',
    playbooks: [
      {
        id: 'playbook-ligacoes',
        titulo: 'Playbook de Ligações',
        descricao: 'Roteiro completo para ligações de pré-venda, abordagem, qualificação e agendamento.',
        arquivo: '/playbooks/playbook-ligacoes.pdf',
      },
    ],
  },
  {
    id: 'vendas',
    label: 'Vendas',
    icon: Target,
    color: 'border-brand-primary',
    badge: 'bg-green-900/40 text-brand-primary',
    playbooks: [
      {
        id: 'playbook-reuniao',
        titulo: 'Playbook Reunião de Vendas',
        descricao: 'Roteiro da reunião de vendas: diagnóstico, ancoragem, prova social e fechamento.',
        arquivo: '/playbooks/playbook-reuniao-vendas.pdf',
      },
      {
        id: 'guia-objecoes',
        titulo: 'Guia de Objeções',
        descricao: 'Como contornar as principais objeções: preço, tempo, comparação e outras.',
        arquivo: '/playbooks/guia-objecoes.pdf',
      },
      {
        id: 'fluxo-decisao',
        titulo: 'Fluxo de Decisão',
        descricao: 'Fluxo de decisão PRO, LITE e BASIC para guiar o fechamento correto.',
        arquivo: '/playbooks/fluxo-decisao.pdf',
      },
    ],
  },
  {
    id: 'estrategia',
    label: 'Estratégia',
    icon: Map,
    color: 'border-purple-500',
    badge: 'bg-purple-900/40 text-purple-300',
    playbooks: [
      {
        id: 'icps-2026',
        titulo: 'ICPs 2026',
        descricao: 'Perfis de clientes ideais para 2026 — segmentação, características e abordagem.',
        arquivo: '/playbooks/icps-2026.pdf',
      },
    ],
  },
];

export default function PlaybooksView() {
  const [selectedDoc, setSelectedDoc] = useState<{ titulo: string; arquivo: string } | null>(null);

  return (
    <div className="space-y-6">
      {selectedDoc ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedDoc(null)}
                className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all"
              >
                <ChevronRight size={14} className="rotate-180" />
              </button>
              <h2 className="text-sm font-bold text-white">{selectedDoc.titulo}</h2>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={selectedDoc.arquivo}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400 hover:text-white hover:border-white/20 transition-all"
              >
                <ExternalLink size={12} />
                Abrir em nova aba
              </a>
              <a
                href={selectedDoc.arquivo}
                download
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-primary/20 border border-brand-primary/30 text-xs text-brand-primary hover:bg-brand-primary/30 transition-all"
              >
                <Download size={12} />
                Download
              </a>
            </div>
          </div>
          <div className="glass-card overflow-hidden rounded-2xl" style={{ height: 'calc(100vh - 220px)' }}>
            <iframe
              src={`${selectedDoc.arquivo}#toolbar=1&navpanes=0&scrollbar=1`}
              className="w-full h-full"
              title={selectedDoc.titulo}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Playbooks</h1>
            <p className="text-sm text-gray-400 mt-1">Materiais de referência para o time comercial</p>
          </div>
          {CATEGORIAS.map(cat => {
            const Icon = cat.icon;
            return (
              <div key={cat.id} className="space-y-3">
                <div className={`flex items-center gap-3 border-l-2 ${cat.color} pl-3`}>
                  <Icon size={14} className="text-gray-400" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">{cat.label}</h2>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${cat.badge}`}>
                    {cat.playbooks.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cat.playbooks.map(pb => (
                    <button
                      key={pb.id}
                      onClick={() => setSelectedDoc({ titulo: pb.titulo, arquivo: pb.arquivo })}
                      className={`glass-card p-5 text-left border-l-2 ${cat.color} hover:bg-white/5 transition-all group space-y-3`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold text-white group-hover:text-brand-primary transition-colors leading-tight">
                          {pb.titulo}
                        </h3>
                        <ChevronRight size={14} className="text-gray-600 group-hover:text-brand-primary flex-shrink-0 mt-0.5 transition-colors" />
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed">{pb.descricao}</p>
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
                        <FileText size={10} />
                        PDF
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
