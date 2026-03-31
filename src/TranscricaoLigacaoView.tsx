import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Square, Loader2, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Lightbulb, ArrowRight, Clock } from 'lucide-react';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const ANALISE_PROMPT = `Você é o Taleco, o cérebro comercial do Thalisson na M2 Black, especializada em marketing para construção civil (reformas, construção financiada, projetos arquitetônicos).

Analise esta ligação/reunião de pré-venda ou venda e retorne um JSON com exatamente esta estrutura (sem markdown, apenas JSON puro):

{
  "transcricao": "transcrição completa e fiel do áudio aqui",
  "tipo_ligacao": "Pré-venda | Reunião R1 | Reunião R2 | Ligação de Follow-up | Outro",
  "servico_identificado": "Reforma | Construção Financiada | Projeto | Não identificado",
  "dor_encontrada": true ou false,
  "momento_uau": true ou false,
  "resumo": "resumo executivo em 2-3 frases do que aconteceu",
  "acertos": ["ponto positivo 1", "ponto positivo 2", "..."],
  "melhorias": ["ponto de melhoria 1", "ponto de melhoria 2", "..."],
  "proximos_passos": ["próximo passo 1", "próximo passo 2", "..."],
  "nota_geral": número de 1 a 10,
  "comentario_taleco": "mensagem direta do Taleco para o vendedor, curta, honesta, no estilo mentor — máximo 3 parágrafos curtos"
}

Critérios de análise:
- A dor do lead foi identificada e explorada? O vendedor fez perguntas abertas para descobrir o problema real?
- Houve momento "UAU" — quando o lead sentiu que alguém entendeu o problema dele e tem a solução certa?
- O vendedor demonstrou autoridade sem ser vendedor? Falou brevemente como resolve o problema depois de entender a dor?
- A ligação avançou no funil? Marcou reunião, agendou próximo contato?
- Foram identificados decisores? (mas sem ser invasivo — perguntas naturais como "quem mais vai morar?" ou "você toma a decisão sozinho ou tem alguém envolvido?")
- O vendedor ficou no controle da conversa ou o lead conduziu?
- Foram coletadas informações de qualificação: faturamento/budget, timing, necessidade?`;

interface Analise {
  transcricao: string;
  tipo_ligacao: string;
  servico_identificado: string;
  dor_encontrada: boolean;
  momento_uau: boolean;
  resumo: string;
  acertos: string[];
  melhorias: string[];
  proximos_passos: string[];
  nota_geral: number;
  comentario_taleco: string;
}

type Estado = 'idle' | 'gravando' | 'pausado' | 'processando' | 'resultado';

export default function TranscricaoLigacaoView() {
  const [estado, setEstado] = useState<Estado>('idle');
  const [segundos, setSegundos] = useState(0);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [erro, setErro] = useState('');
  const [showTranscricao, setShowTranscricao] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const formatarTempo = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const iniciarGravacao = async () => {
    setErro('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(1000);
      mediaRecorderRef.current = mr;

      setEstado('gravando');
      setSegundos(0);
      timerRef.current = setInterval(() => setSegundos(s => s + 1), 1000);
    } catch {
      setErro('Não foi possível acessar o microfone. Verifique as permissões do navegador.');
    }
  };

  const pausarGravacao = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      setEstado('pausado');
    }
  };

  const continuarGravacao = () => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => setSegundos(s => s + 1), 1000);
      setEstado('gravando');
    }
  };

  const finalizarGravacao = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setEstado('processando');

    const mr = mediaRecorderRef.current;
    if (!mr) return;

    mr.onstop = async () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      await enviarParaGemini(blob);
    };

    if (mr.state !== 'inactive') mr.stop();
  };

  const enviarParaGemini = async (blob: Blob) => {
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inline_data: { mime_type: 'audio/webm', data: base64 } },
                { text: ANALISE_PROMPT }
              ]
            }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 4096 }
          })
        }
      );

      if (!res.ok) throw new Error(`Erro na API: ${res.status}`);
      const data = await res.json();
      const texto = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      // Remove possíveis blocos de markdown
      const jsonLimpo = texto.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const resultado: Analise = JSON.parse(jsonLimpo);
      setAnalise(resultado);
      setEstado('resultado');
    } catch (e) {
      setErro('Erro ao processar o áudio. Tente novamente.');
      setEstado('idle');
      console.error(e);
    }
  };

  const reiniciar = () => {
    setEstado('idle');
    setAnalise(null);
    setErro('');
    setSegundos(0);
    setShowTranscricao(false);
    chunksRef.current = [];
  };

  const notaCor = (nota: number) => {
    if (nota >= 8) return 'text-green-400';
    if (nota >= 6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const notaBg = (nota: number) => {
    if (nota >= 8) return 'bg-green-400/10 border-green-400/20';
    if (nota >= 6) return 'bg-yellow-400/10 border-yellow-400/20';
    return 'bg-red-400/10 border-red-400/20';
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Análise de Ligação</h2>
        <p className="text-gray-400 text-sm mt-1">Grave a ligação e o Taleco analisa o que foi bem e o que melhorar</p>
      </div>

      {/* Erro */}
      {erro && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {erro}
        </div>
      )}

      {/* Estado: idle */}
      {estado === 'idle' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-10 flex flex-col items-center gap-6 text-center"
        >
          <div className="w-20 h-20 rounded-full bg-brand-primary/10 border-2 border-brand-primary/30 flex items-center justify-center">
            <Mic size={36} className="text-brand-primary" />
          </div>
          <div>
            <p className="text-white font-semibold text-lg">Pronto para gravar</p>
            <p className="text-gray-400 text-sm mt-1">Clique para iniciar. O microfone vai capturar a ligação.</p>
          </div>
          <button
            onClick={iniciarGravacao}
            className="bg-brand-primary text-black font-bold px-8 py-3 rounded-xl hover:opacity-90 transition-all flex items-center gap-2"
          >
            <Mic size={18} />
            Iniciar Gravação
          </button>
        </motion.div>
      )}

      {/* Estado: gravando / pausado */}
      {(estado === 'gravando' || estado === 'pausado') && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-8 flex flex-col items-center gap-6"
        >
          {/* Indicador pulsante */}
          <div className="relative">
            {estado === 'gravando' && (
              <>
                <span className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
                <span className="absolute inset-0 rounded-full bg-red-500/20 animate-ping [animation-delay:0.3s]" />
              </>
            )}
            <div className={`relative w-20 h-20 rounded-full flex items-center justify-center border-2 ${estado === 'gravando' ? 'bg-red-500/20 border-red-500/50' : 'bg-yellow-500/20 border-yellow-500/50'}`}>
              <Mic size={32} className={estado === 'gravando' ? 'text-red-400' : 'text-yellow-400'} />
            </div>
          </div>

          {/* Timer */}
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-gray-500" />
            <span className="text-3xl font-mono font-bold text-white">{formatarTempo(segundos)}</span>
          </div>

          <p className="text-gray-400 text-sm">
            {estado === 'gravando' ? 'Gravando...' : 'Pausado'}
          </p>

          {/* Botões */}
          <div className="flex gap-3">
            {estado === 'gravando' ? (
              <button
                onClick={pausarGravacao}
                className="px-5 py-2.5 rounded-xl border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition-all text-sm font-medium"
              >
                Pausar
              </button>
            ) : (
              <button
                onClick={continuarGravacao}
                className="px-5 py-2.5 rounded-xl border border-brand-primary/30 text-brand-primary hover:bg-brand-primary/10 transition-all text-sm font-medium"
              >
                Continuar
              </button>
            )}
            <button
              onClick={finalizarGravacao}
              className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all text-sm font-medium flex items-center gap-2"
            >
              <Square size={14} />
              Finalizar e Analisar
            </button>
          </div>
        </motion.div>
      )}

      {/* Estado: processando */}
      {estado === 'processando' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-12 flex flex-col items-center gap-6 text-center"
        >
          <div className="relative">
            <img src="/consultor-avatar.jpg" alt="Taleco" className="w-16 h-16 rounded-full object-cover" />
            <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-brand-primary rounded-full border-2 border-[#0a0f1e] flex items-center justify-center">
              <Loader2 size={11} className="text-black animate-spin" />
            </span>
          </div>
          <div>
            <p className="text-white font-semibold">Taleco está analisando...</p>
            <p className="text-gray-400 text-sm mt-1">Transcrevendo o áudio e avaliando a ligação</p>
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <span key={i} className="w-2 h-2 bg-brand-primary rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </motion.div>
      )}

      {/* Estado: resultado */}
      {estado === 'resultado' && analise && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Nota + Resumo */}
          <div className={`glass-card p-6 border ${notaBg(analise.nota_geral)}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-500">{analise.tipo_ligacao}</span>
                  <span className="text-gray-700">•</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-500">{analise.servico_identificado}</span>
                </div>
                <p className="text-white text-sm leading-relaxed">{analise.resumo}</p>
                {/* Badges */}
                <div className="flex gap-2 mt-3 flex-wrap">
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${analise.dor_encontrada ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                    {analise.dor_encontrada ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                    Dor {analise.dor_encontrada ? 'identificada' : 'não identificada'}
                  </span>
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${analise.momento_uau ? 'bg-brand-primary/10 text-brand-primary' : 'bg-gray-500/10 text-gray-500'}`}>
                    {analise.momento_uau ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                    Momento UAU {analise.momento_uau ? '✓' : 'não gerado'}
                  </span>
                </div>
              </div>
              {/* Nota */}
              <div className="text-center flex-shrink-0">
                <span className={`text-4xl font-black ${notaCor(analise.nota_geral)}`}>{analise.nota_geral}</span>
                <span className="text-gray-500 text-sm">/10</span>
                <p className="text-gray-500 text-[10px] uppercase tracking-widest mt-0.5">Nota</p>
              </div>
            </div>
          </div>

          {/* Comentário do Taleco */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <img src="/consultor-avatar.jpg" alt="Taleco" className="w-8 h-8 rounded-full object-cover" />
              <span className="text-white font-semibold text-sm">Taleco fala:</span>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{analise.comentario_taleco}</p>
          </div>

          {/* Acertos */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-bold text-green-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <CheckCircle2 size={14} /> O que acertou
            </h3>
            <ul className="space-y-2">
              {analise.acertos.map((a, i) => (
                <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                  <span className="text-green-400 mt-0.5 flex-shrink-0">•</span>
                  {a}
                </li>
              ))}
            </ul>
          </div>

          {/* Melhorias */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-bold text-yellow-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Lightbulb size={14} /> O que melhorar
            </h3>
            <ul className="space-y-2">
              {analise.melhorias.map((m, i) => (
                <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                  <span className="text-yellow-400 mt-0.5 flex-shrink-0">•</span>
                  {m}
                </li>
              ))}
            </ul>
          </div>

          {/* Próximos passos */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-bold text-brand-primary uppercase tracking-widest mb-3 flex items-center gap-2">
              <ArrowRight size={14} /> Próximos passos
            </h3>
            <ul className="space-y-2">
              {analise.proximos_passos.map((p, i) => (
                <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                  <span className="text-brand-primary mt-0.5 flex-shrink-0">{i + 1}.</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          {/* Transcrição (colapsável) */}
          <div className="glass-card overflow-hidden">
            <button
              onClick={() => setShowTranscricao(!showTranscricao)}
              className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-all"
            >
              <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Ver transcrição completa</span>
              {showTranscricao ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
            </button>
            <AnimatePresence>
              {showTranscricao && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 pt-0 border-t border-white/5">
                    <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-wrap">{analise.transcricao}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Nova gravação */}
          <button
            onClick={reiniciar}
            className="w-full py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all text-sm font-medium flex items-center justify-center gap-2"
          >
            <Mic size={15} />
            Nova gravação
          </button>
        </motion.div>
      )}
    </div>
  );
}
