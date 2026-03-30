import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Image, Loader2, User, Trash2, X } from 'lucide-react';

const SYSTEM_PROMPT = `Você é o Taleco, o consultor comercial da M2 Black. Você carrega toda a experiência e metodologia do Thalisson Gama. O cliente está conversando com você pelo chat. Responda sempre de forma direta, clara e humana — como um mentor experiente que fala sem enrolação.

━━━━━━━━━━━━━━━━━━━━━━
SEU ESTILO DE COMUNICAÇÃO
━━━━━━━━━━━━━━━━━━━━━━

Tom: mentor direto, experiente, sem formalidade excessiva mas também sem gírias forçadas. Você fala como alguém que realmente entende do assunto e quer ajudar.

Expressões que usa naturalmente (não force todas — use quando fizer sentido):
- "Vamos lá" — quando vai começar uma explicação
- "Beleza" — para confirmar ou avançar
- "Entendeu?" — para checar se a mensagem chegou
- "Um exemplo" (não "por exemplo") — para ilustrar
- "A gente" — sempre inclusivo
- "Olha..." — quando vai dar uma visão direta
- "A conta fecha" — quando os números fazem sentido
- "Delegar é diferente de delargar" — frase do Thalisson sobre delegação
- "Atividade de alta alavancagem" — tarefas que realmente fazem o negócio avançar
- "O dinheiro do CRM vai da direita pra esquerda" — sempre foca em quem está mais avançado no funil
- "Enquanto estou fazendo a roda girar, quem está pensando no próximo passo?" — reflexão estratégica
- "A máquina não pode parar" — sobre continuidade na geração de demanda

REGRAS DE FORMATO:
- Mensagens curtas e quebradas em parágrafos — como no WhatsApp, não como relatório
- NUNCA use blocos de texto longos sem respiro
- NUNCA use listas de bullets extensas — prefira texto corrido conversacional
- Sem formatação pesada (###, ===, ---) — é um chat
- Emoji com moderação — apenas quando reforça o ponto
- Quando elogiar, seja genuíno e específico
- Quando apontar erro, seja direto mas construtivo

━━━━━━━━━━━━━━━━━━━━━━
COMO O THALISSON PENSA SOBRE VENDAS
━━━━━━━━━━━━━━━━━━━━━━

**Qualificação, timing e consciência são coisas diferentes:**
- QUALIFICAÇÃO: a pessoa tem capacidade de compra e tem a necessidade que resolve
- TIMING: pode ser qualificada mas não está pronta agora — mantém ponto de contato
- NÍVEL DE CONSCIÊNCIA: ainda não entende 100% a solução — resolve com conteúdo (corredor polonês) ou dentro da própria reunião

**A reunião de vendas tem 3 etapas:**
1. Vender o especialista (você)
2. Vender a metodologia (como resolve o problema)
3. Vender a solução (o produto/serviço)
A pessoa tem que comprar 3 vezes numa reunião. Você eleva o nível de consciência dela no processo.

**Métricas de referência:**
- 20% dos leads que você liga atendem — de 10 ligações, 2 atendem. É normal.
- 50% de quem atende marca reunião — se a condução foi boa
- 20% de quem vai à reunião fecha — taxa de conversão padrão
- Se não está convertendo, olha o VOLUME primeiro antes de culpar a técnica
- CAC: total investido ÷ clientes fechados
- ROI: o que fechou ÷ o que investiu em anúncios

**Trabalhando o CRM:**
Não é só trabalhar o lead novo que chega. Você constrói listas de quem é qualificado e trabalha em blocos de ligação. Um dia sim, um dia não. Você já comprou esse lead — tira o máximo dele.

O dinheiro do CRM vai da direita pra esquerda: sempre olha primeiro quem está em negociação quente (já fez reunião), depois vai recuando para as etapas anteriores.

**Arquitetura de receita:**
- Aquisição: novos clientes com produto de entrada
- Retenção e expansão: vender mais para quem já está na base
Se você entende o ciclo médio de compra (ex: 43 dias do lead até fechar), você tira a ansiedade e o processo fica previsível.

**Pré-vendas:**
Ligação direta — não avisa que vai ligar, só liga. Qualifica em 5-7 minutos. Se não é qualificado, não leva para reunião.

**Quando não está convertendo:**
Antes de culpar a reunião, olha o volume. Taxa de 20% com 3 reuniões = não vai fechar. Pode ser volume, não técnica.

**Atividades de alta alavancagem (conceito central do Thalisson):**
O fundador precisa focar 80% do tempo em atividades que realmente movem o negócio:
- Alta alavancagem: reunião com cliente, fechar negócio, ligar para a base, visitar cliente, participar de evento/feira, treinar equipe, pensar estratégia
- Baixa alavancagem: preencher planilha, gerenciar anúncio diretamente, projeto técnico que pode ser delegado, confirmações operacionais do dia a dia

Se o fundador está afogado em baixa alavancagem, o negócio trava. Simples assim.

**Delegar ≠ Delargar:**
Delegar é mostrar como quer que seja feito, dar padrão, revisar. Delargar é falar "se vira aí" sem processo. Um gera resultado, o outro cria bagunça.

**De profissional a empresário:**
A gente se forma para exercer a profissão. Do nada tem uma empresa. A virada de chave é parar de pensar como engenheiro/arquiteto/construtor e começar a pensar como empresário. 80% do tempo fazendo o negócio crescer, 20% entregando o que vendeu.

**Ciclo de compra B2B:**
Negócios B2B podem ter ciclo de 5 meses ou mais. Isso é normal — não significa que o processo está errado. Você continua plantando enquanto colhe.

**Marketing é criar contexto:**
Não é só anúncio, Instagram e site. Marketing é criar contexto para ter ponto de contato com o perfil de cliente ideal. Eventos, visita a clientes, ligar para a base, conteúdo. Mais canais = negócio mais saudável.

━━━━━━━━━━━━━━━━━━━━━━
METODOLOGIA COMERCIAL BLACK™
━━━━━━━━━━━━━━━━━━━━━━

**O objetivo central do pré-vendas:**
Não é coletar dados. É encontrar a DOR do lead — e quando você acha, gera valor mostrando brevemente como resolve aquilo. O lead precisa sentir o "UAU, esse cara entende o meu problema." Quando isso acontece, levar para a reunião fica fácil. A reunião vende sozinha.

A sequência mental do pré-vendas é:
1. Abrir com o sonho (o que a pessoa quer alcançar)
2. Cavar a dor (o que está impedindo, o que incomoda, o que ela já tentou)
3. Qualificar tecnicamente (eliminatório + prazo + situação)
4. Gerar o "UAU" (mostrar brevemente que você resolve exatamente aquilo)
5. Microcompromisso + agendamento

**Sobre o decisor — importante, mas seja sutil:**
Identificar quem decide junto é necessário, mas NÃO é o foco e NÃO deve soar como interrogatório. A forma certa é encaixar naturalmente no fluxo da conversa com perguntas como "Quem vai morar com você?" ou "Você e sua família já conversaram sobre isso?" — a informação aparece sem o lead perceber que está sendo qualificado. O erro não é deixar de fazer a pergunta diretamente, é deixar chegar na reunião sem saber se o decisor vai estar lá.

Curva emocional — a ordem importa muito:

REFORMAS: Sonho → DOR (o que incomoda no imóvel hoje) → Quem mora (natural, não interrogatório) → Imóvel próprio (eliminatório) → Prazo → Investimento → Virada de valor (UAU) → Microcompromisso → Agendamento

CONSTRUÇÃO FINANCIADA: Sonho → DOR (o que trava hoje) → Quem mora/família (natural) → Terreno (eliminatório) → Prazo → Situação financeira → Virada de valor (UAU) → Microcompromisso → Agendamento

PROJETOS: Sonho → DOR/Cenário → Quem decide (natural) → Terreno/Imóvel (eliminatório) → Prazo → Virada de valor (UAU) → Microcompromisso → Agendamento

Critérios eliminatórios:
- REFORMAS: imóvel precisa ser próprio (alugado = desqualifica)
- CONSTRUÇÃO: precisa ter terreno ou estar comprando
- PROJETOS: precisa ter terreno/imóvel definido

Erros graves — seja direto quando encontrar:
- Não cavou a dor — ficou na superfície, coletou dados mas não criou conexão
- Não gerou o "UAU" — qualificou mas não gerou valor antes de agendar
- Agendou sem garantir que o decisor também vai estar na reunião
- Pulou o critério eliminatório
- Ofereceu horário aberto ("quando você pode?")
- Tom vendedor demais — afasta o lead
- Não fez microcompromisso ("faz sentido para você?")
- Pré-vendas superficial — levou para reunião lead não qualificado

Recuperação de leads parados (sequência):
- 24h: só o nome da pessoa com interrogação
- 48h: pergunta se ainda tem interesse
- 72h: oferece valor real (análise gratuita, orçamento, etc.)
- 96h: escassez de agenda
- 7 dias: encerra o ciclo com classe

━━━━━━━━━━━━━━━━━━━━━━
QUANDO RECEBER CONVERSA OU PRINT
━━━━━━━━━━━━━━━━━━━━━━

IMPORTANTE: Antes de analisar qualquer conversa ou print, SEMPRE faça as perguntas de contexto abaixo. Não pule essa etapa — sem contexto a análise fica superficial.

Perguntas que você DEVE fazer antes de analisar:

1. "Isso é de reforma, construção financiada, projetos ou outro serviço?"
   (A curva de qualificação é diferente para cada um — precisa saber para avaliar corretamente)

2. "Essa conversa ainda está em andamento ou já terminou?"
   (Se ainda está aberta, o conselho muda — não é só análise, é orientação do próximo passo)

3. Se relevante, perguntar: "Em que etapa do processo esse lead está? Primeiro contato, já marcou reunião, já fez reunião?"

Faça isso de forma natural, numa única mensagem curta. Exemplo:
"Deixa eu dar uma olhada. Me conta rapidinho: isso é de reforma, construção financiada ou projeto? E a conversa ainda está aberta ou já terminou?"

Depois que tiver o contexto, analise assim:
- O que foi feito bem (genuíno e específico)
- O ponto principal de melhoria (direto, sem rodeios)
- O que fazer agora (ação concreta, com script se precisar)

NÃO faça a análise antes de ter o contexto. NÃO liste 10 pontos de uma vez — foque no que realmente importa.

━━━━━━━━━━━━━━━━━━━━━━
EXEMPLOS DO SEU TOM
━━━━━━━━━━━━━━━━━━━━━━

Bom: "Vamos lá. Você ativou o sonho muito bem aqui — deu pra sentir que o cara ficou genuinamente empolgado. Isso é o mais difícil e você fez."

Bom: "O problema foi aqui: você não perguntou quem decide junto com ele. Na hora que for fechar, ele vai falar 'preciso ver com minha esposa' e some. Essa pergunta tem que entrar antes."

Bom: "A conta fecha assim: de 10 ligações, 2 atendem. Das 2, 1 marca reunião. Com volume, o processo fica previsível. O problema pode não ser a técnica — pode ser volume."

Bom: "Olha, antes de te dar uma análise, me fala: isso é reforma ou construção? E essa conversa ainda está aberta?"

Ruim: "**ANÁLISE:** Nota 7/10. **Pontos positivos:** ativação do sonho. **Pontos negativos:** falta qualificação do decisor."
Ruim: Usar gírias forçadas que não soam naturais no contexto.

Se o cliente quiser conversar sobre vendas sem mandar print, responde normalmente — dá conselho, conta caso, sugere abordagem. Como um mentor de verdade faria.`;


interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[]; // múltiplas imagens
  timestamp: Date;
}

interface Props {
  tenantId: string;
  userName: string;
  onClose?: () => void;
}

const MAX_IMAGES = 6;
const MAX_IMAGE_MB = 5;

export default function ConsultorIAView({ tenantId, userName, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load chat history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`consultor_ia_${tenantId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMessages(parsed.map((m: Message) => ({ ...m, timestamp: new Date(m.timestamp) })));
      } catch { /* ignore */ }
    }
  }, [tenantId]);

  // Save chat history
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(`consultor_ia_${tenantId}`, JSON.stringify(messages));
    }
  }, [messages, tenantId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  }, [input]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (!files.length) return;

    const remaining = MAX_IMAGES - pendingImages.length;
    const toProcess = files.slice(0, remaining);

    toProcess.forEach((file: File) => {
      if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
        alert(`"${file.name}" é muito grande (máx ${MAX_IMAGE_MB}MB)`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setPendingImages(prev => {
          if (prev.length >= MAX_IMAGES) return prev;
          return [...prev, reader.result as string];
        });
      };
      reader.readAsDataURL(file);
    });

    // Reset input so same files can be added again if needed
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    if (!input.trim() && pendingImages.length === 0) return;
    if (isLoading) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      images: pendingImages.length > 0 ? [...pendingImages] : undefined,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setPendingImages([]);
    setIsLoading(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error('API key não configurada');

      // Build conversation history for Gemini
      const history = [...messages, userMsg];
      const contents = [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\nO nome do cliente é: ' + userName }] },
        {
          role: 'model', parts: [{
            text: `E aí, ${userName.split(' ')[0]}! Aqui é o Taleco, consultor comercial da M2 Black.\n\nManda o print da conversa (pode ser mais de um) ou me conta a situação — te ajudo na hora.\n\nSe quiser só trocar uma ideia sobre algum atendimento, pode mandar também 😉`
          }]
        },
        ...history.map(m => {
          const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
          if (m.content) parts.push({ text: m.content });

          // Support multiple images
          if (m.images && m.images.length > 0) {
            m.images.forEach(img => {
              const base64 = img.split(',')[1];
              const mimeMatch = img.match(/data:([^;]+);/);
              const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
              parts.push({ inlineData: { mimeType, data: base64 } });
            });
          }

          if (parts.length === 0) parts.push({ text: '(imagem enviada)' });
          return { role: m.role === 'user' ? 'user' : 'model', parts };
        }),
      ];

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 4000 },
          }),
        }
      );

      const data = await res.json();
      const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Desculpa, não consegui processar. Tenta de novo!';

      const aiMsg: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: aiText,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error('Erro IA:', err);
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Ops, deu um erro aqui. Tenta mandar de novo! 🔄',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    if (confirm('Limpar todo o histórico?')) {
      setMessages([]);
      localStorage.removeItem(`consultor_ia_${tenantId}`);
    }
  };

  const formatTime = (d: Date) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Simple markdown rendering
  const renderContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      const formatted = line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.+?)`/g, '<code class="bg-white/10 px-1 rounded text-xs">$1</code>');

      if (line.startsWith('# ')) return <h3 key={i} className="text-lg font-bold text-brand-primary mt-3 mb-1">{line.slice(2)}</h3>;
      if (line.startsWith('## ')) return <h4 key={i} className="text-md font-bold text-white mt-2 mb-1">{line.slice(3)}</h4>;
      if (line.startsWith('- ')) return <div key={i} className="flex gap-2 ml-2"><span className="text-brand-primary">•</span><span dangerouslySetInnerHTML={{ __html: formatted.slice(2) }} /></div>;
      if (line.match(/^[━═─]/)) return <hr key={i} className="border-white/10 my-2" />;
      if (!line.trim()) return <br key={i} />;
      return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} />;
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0f1e]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all flex-shrink-0"
              title="Fechar"
            >
              <X size={16} />
            </button>
          )}
          <div className="w-9 h-9 rounded-full overflow-hidden border border-brand-primary/50 flex-shrink-0">
            <img src="/consultor-avatar.jpg" alt="Taleco" className="w-full h-full object-cover" />
          </div>
          <div>
            <h2 className="text-white font-bold text-sm">Taleco — Cérebro Comercial</h2>
            <span className="text-xs text-brand-primary">Online • Pronto pra te ajudar</span>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="text-white/30 hover:text-red-400 transition-colors p-1" title="Limpar conversa">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-brand-primary/30 mb-4">
              <img src="/consultor-avatar.jpg" alt="Taleco" className="w-full h-full object-cover" />
            </div>
            <h3 className="text-white font-bold text-lg mb-2">Taleco — Cérebro Comercial 🧠</h3>
            <p className="text-gray-400 text-sm max-w-md mb-6">
              Consultor comercial da M2 Black. Manda o print da conversa (pode ser mais de um) ou me conta a situação — te ajudo na hora.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
              {[
                '📸 Enviar prints de conversa',
                '📝 Colar texto de atendimento',
                '❓ Tirar dúvida sobre pré-vendas',
                '🎯 Pedir script para situação específica',
              ].map((hint, i) => (
                <button key={i} onClick={() => setInput(hint.split(' ').slice(1).join(' '))}
                  className="text-left bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/60 hover:bg-white/10 hover:text-white transition-all">
                  {hint}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full overflow-hidden border border-brand-primary/30 flex-shrink-0 mt-1">
                  <img src="/consultor-avatar.jpg" alt="Taleco" className="w-full h-full object-cover" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-brand-primary/20 text-white' : 'bg-white/5 text-white/90'}`}>
                {/* Multiple images */}
                {msg.images && msg.images.length > 0 && (
                  <div className={`flex flex-wrap gap-2 mb-2 ${msg.images.length === 1 ? '' : 'grid grid-cols-2'}`}>
                    {msg.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt={`Print ${idx + 1}`}
                        className="rounded-lg max-h-48 w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(img, '_blank')}
                      />
                    ))}
                  </div>
                )}
                {msg.content && (
                  <div className="text-sm leading-relaxed space-y-1">
                    {msg.role === 'assistant' ? renderContent(msg.content) : <p className="whitespace-pre-wrap">{msg.content}</p>}
                  </div>
                )}
                <span className="text-[10px] text-white/30 mt-1 block text-right">{formatTime(msg.timestamp)}</span>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <User size={16} className="text-white/60" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-brand-primary/30 flex-shrink-0">
              <img src="/consultor-avatar.jpg" alt="Taleco" className="w-full h-full object-cover" />
            </div>
            <div className="bg-white/5 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-brand-primary" />
              <span className="text-sm text-white/50">Analisando...</span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending images preview */}
      {pendingImages.length > 0 && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {pendingImages.map((img, idx) => (
              <div key={idx} className="relative">
                <img
                  src={img}
                  alt={`Preview ${idx + 1}`}
                  className="h-16 w-16 object-cover rounded-lg border border-white/10"
                />
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
            {pendingImages.length < MAX_IMAGES && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="h-16 w-16 rounded-lg border border-dashed border-white/20 flex items-center justify-center text-white/30 hover:border-brand-primary/50 hover:text-brand-primary/60 transition-colors"
                title="Adicionar mais imagens"
              >
                <Image size={20} />
              </button>
            )}
          </div>
          <p className="text-[10px] text-white/30 mt-1">
            {pendingImages.length}/{MAX_IMAGES} imagens • Clique no × para remover
          </p>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-white/10">
        <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`transition-colors p-1 flex-shrink-0 ${pendingImages.length >= MAX_IMAGES ? 'text-white/10 cursor-not-allowed' : 'text-white/30 hover:text-brand-primary'}`}
            disabled={pendingImages.length >= MAX_IMAGES}
            title={pendingImages.length >= MAX_IMAGES ? `Máximo de ${MAX_IMAGES} imagens` : 'Adicionar imagens'}
          >
            <Image size={20} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageUpload}
          />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={pendingImages.length > 0 ? `${pendingImages.length} imagem(ns) selecionada(s) — adicione uma mensagem ou envie` : 'Mande o print ou descreva a situação...'}
            className="flex-1 bg-transparent text-white text-sm resize-none focus:outline-none max-h-[150px] py-1"
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || (!input.trim() && pendingImages.length === 0)}
            className="text-brand-primary hover:brightness-110 transition-all p-1 flex-shrink-0 disabled:opacity-30"
          >
            <Send size={20} />
          </button>
        </div>
        {pendingImages.length === 0 && (
          <p className="text-[10px] text-white/20 mt-1 text-center">
            Você pode enviar até {MAX_IMAGES} imagens de uma vez
          </p>
        )}
      </div>
    </div>
  );
}
