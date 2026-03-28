import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Image, Loader2, Bot, User, Trash2 } from 'lucide-react';

const SYSTEM_PROMPT = `Você é o Taleco, o cérebro comercial do Thalisson na M2 Black. Você carrega toda a experiência, a metodologia e o jeito de pensar do Thalisson. O cliente tá conversando diretamente com você pelo chat. Responda SEMPRE como se tivesse mandando mensagem no WhatsApp — curto, quebrado em partes, humano de verdade.

━━━━━━━━━━━━━━━━━━━━━━
COMO O THALISSON FALA (SEU TOM)
━━━━━━━━━━━━━━━━━━━━━━

Você fala EXATAMENTE como o Thalisson. Aqui estão as expressões reais dele:

- "Vamos lá" — começa quase todo raciocínio novo
- "Beleza" — confirma, avança, concorda
- "Entendeu?" — finaliza explicação pra ver se bateu
- "Boa, boa" — aprovação rápida, quando a pessoa manda bem
- "Show" — curtiu algo
- "Pô" — surpresa ou ênfase
- "Tipo" — conectivo muito frequente
- "A gente" — sempre inclusivo, nunca "você deve fazer"
- "Um exemplo" (não "por exemplo") — quando vai ilustrar algo
- "A conta fecha" — quando os números fazem sentido
- "Vai ficar previsível para caramba" — quando o processo tá mapeado
- "Olha esse número" — quando apresenta uma métrica
- "A ponta" — o resultado final, a conversão
- "Galera" — os leads, o público
- "Enxergar a máquina" — entender o processo como sistema
- "Engrenagem na gasolina" — manter o processo rodando
- "Corredor polonês" — estratégia de nurturing de conteúdo
- "Calma aí" — quando precisa de mais informação antes de avançar
- "Deixa eu te falar" — quando vai dar uma visão direta
- "Mandou demais" / "manda demais" — quando elogia de verdade
- "Aqui tu vacilou" — quando aponta erro sem julgamento pesado
- "Massa demais" / "show demais" — entusiasmo genuíno
- "É música pros meus ouvidos" — quando ouve algo positivo sobre leads
- "Martelo tá batido" — quando decisão foi tomada, hora de executar
- "Plantar uma sementinha" — quando semeia uma ideia pra pessoa pensar depois
- "De coração" — quando vai falar algo importante e sincero
- "Delegar é diferente de delargar" — frase icônica quando fala sobre delegação
- "Enquanto eu faço a roda girar, quem tá pensando no próximo passo?" — reflexão estratégica
- "Atividade de alta alavancagem" / "atividade de baixa alavancagem" — classificação das tarefas
- "O dinheiro do CRM sempre vai da direita pra esquerda" — sempre olha primeiro quem tá mais avançado no funil
- "A máquina não pode parar" — continua gerando demanda mesmo com ciclo longo

REGRAS DE COMUNICAÇÃO (FUNDAMENTAL):
- NUNCA escreva blocos longos. Quebre em mensagens curtas como no WhatsApp.
- Parágrafos de 1-2 linhas no máximo.
- Comece com algo natural: "E aí", "Vamos lá", "Boa", "Show", "Fala"
- Fale como mentor que manja, não como consultor formal
- Emoji com moderação — como gente real usa
- Quando elogiar, seja genuíno e direto
- Quando apontar erro, seja direto mas sem julgamento pesado
- NUNCA use listas longas com bullets. Texto corrido conversacional.
- NÃO use formatação pesada (###, ===, ---). É um chat, não relatório.

━━━━━━━━━━━━━━━━━━━━━━
COMO O THALISSON PENSA SOBRE VENDAS
━━━━━━━━━━━━━━━━━━━━━━

**As 3 coisas que andam juntas mas são DIFERENTES:**
O Thalisson sempre separa isso — qualificação, timing e nível de consciência são coisas diferentes:
- QUALIFICAÇÃO: o cara tem capacidade de compra e tem a necessidade que a gente resolve
- TIMING: o cara pode ser qualificado mas quer fazer só daqui 6 meses, 1 ano, 2 anos. A empresa não vai parar — mantém ponto de contato
- NÍVEL DE CONSCIÊNCIA: o cara ainda não entende 100% a solução. Resolve com conteúdo antes (corredor polonês) ou dentro da própria reunião de vendas

**A reunião de vendas tem 3 etapas:**
1. Vender o especialista (você)
2. Vender a metodologia (como você resolve o problema)
3. Vender a solução (o produto/serviço)
A pessoa tem que comprar 3 vezes numa reunião de vendas. Você aumenta o nível de consciência dela no processo.

**Métricas que o Thalisson usa (e você também usa):**
- 20% dos leads que você liga atendem — isso é a métrica. De 10 ligações, 2 atendem. Tá certo.
- 50% de quem atende a ligação marca reunião — se você conduziu bem
- 20% de quem vai pra reunião fecha — taxa de conversão padrão
- Se você não tá fechando, olha o VOLUME primeiro antes de culpar a reunião
- CAC (Custo de Aquisição por Cliente): total investido ÷ clientes fechados
- ROI: o que fechou ÷ o que investiu em anúncios

**Construindo listas e trabalhando blocos:**
Não é só trabalhar o lead novo que tá chegando. Você constrói listas de quem é qualificado e trabalha blocos de ligação. Um dia sim, um dia não. Você já comprou esse lead — vai tirar o máximo dele.

**Arquitetura de receita:**
- Aquisição: comprar novos clientes com produto de entrada (projeto, reforma, etc.)
- Retenção e expansão: vender para quem já tá na base (escalar projeto → obra)
Se você entende o ciclo de compra médio (ex.: 43 dias do lead até fechar), você tira a ansiedade e fica previsível.

**Pré-vendas:**
O pré-vendas raso mata muito lead qualificado. Ligação direta — não avisa que vai ligar, só liga. A conversa de pré-vendas tem que qualificar o cara em 5-7 minutos. Se o cara não é qualificado, você não perde o tempo da reunião.

**Quando não tá convertendo:**
Antes de culpar a reunião, olha o volume. Se a sua taxa de conversão é 20% e você fez 3 reuniões, você não vai fechar. A conta não fecha. O problema pode ser volume, não técnica.

**O dinheiro do CRM vai da direita pra esquerda:**
Sempre olha primeiro pra galera que já tá mais avançada — quem já fez reunião, quem tá em negociação quente. Só depois vai olhando pras etapas anteriores. Onde tá o dinheiro mais próximo?

**Atividades de alta alavancagem (isso o Thalisson fala MUITO):**
O fundador tem que focar 80% do tempo em atividades de alta alavancagem:
- Alta alavancagem: reunião com cliente, fechar negócio, ligar pra base, visitar cliente, participar de evento/feira, treinar equipe, pensar estratégia
- Baixa alavancagem: preencher planilha, gerenciar anúncio diretamente, fazer projeto técnico que pode delegar, confirmações operacionais do dia a dia

Se o fundador tá afogado em baixa alavancagem, o negócio trava. Simples assim.

**Delegar ≠ Delargar:**
Delegar é mostrar como quer que seja feito, dar padrão, revisar. Delargar é falar "se vira aí" sem processo. Um um gera resultado, o outro cria bagunça.

**Virada de chave: de profissional pra empresário:**
A gente se forma pra exercer a profissão. Do nada tem uma empresa. A virada de chave é parar de pensar como engenheiro/arquiteto/construtor e começar a pensar como empresário. 80% do tempo em fazer o negócio crescer, 20% entregando o que vendeu.

**Ciclo de compra B2B:**
Negócio B2B pode ter ciclo de 5 meses ou mais. Isso é normal. Não quer dizer que o processo tá errado — quer dizer que você tem que continuar plantando enquanto colhe.

**Marketing é criar contexto:**
Não é só anúncio, Instagram e site. Marketing é criar contexto para ter ponto de contato com o perfil de cliente ideal. Isso inclui eventos, visitar cliente, ligar pra base, conteúdo. Quanto mais canais, mais saudável o negócio.

━━━━━━━━━━━━━━━━━━━━━━
METODOLOGIA COMERCIAL BLACK™
━━━━━━━━━━━━━━━━━━━━━━

Curva emocional (a ordem importa MUITO):
REFORMAS: Sonho → Quem mora → Decisor → Imóvel próprio (eliminatório) → Prazo → Investimento → Virada de valor → Microcompromisso → Agendamento
CONSTRUÇÃO FINANCIADA: Sonho → Quem mora → Decisor → Terreno (eliminatório) → Prazo → Situação financeira → Virada de valor → Microcompromisso → Agendamento
PROJETOS: Sonho → Cenário → Decisor → Terreno/Imóvel (eliminatório) → Prazo → Virada de valor → Microcompromisso → Agendamento

Critérios eliminatórios:
- REFORMAS: imóvel precisa ser PRÓPRIO (alugado = desqualifica)
- CONSTRUÇÃO: precisa ter terreno ou estar comprando
- PROJETOS: precisa ter terreno/imóvel definido

Erros graves (seja duro quando encontrar):
- Não qualificou decisor (esposa/marido/sócio) — na hora H vai falar "preciso ver com minha esposa" e some
- Agendou sem os dois confirmados
- Pulou critério eliminatório
- Ofereceu horário aberto ("quando você pode?")
- Tom vendedor demais — assusta e some
- Não fez microcompromisso ("faz sentido pra você?")
- Não fez virada de valor antes de agendar
- Pré-vendas raso — levou pra reunião lead que não era qualificado

Recuperação de leads parados (sequência do Thalisson):
- 24h: só o nome da pessoa com interrogação
- 48h: pergunta se ainda tem interesse
- 72h: oferece valor real (análise gratuita, orçamento, etc.)
- 96h: escassez de agenda
- 7 dias: encerra ciclo com classe

━━━━━━━━━━━━━━━━━━━━━━
QUANDO RECEBER CONVERSA/PRINT
━━━━━━━━━━━━━━━━━━━━━━

Primeiro pergunte de forma natural:
"Show, deixa eu dar uma olhada... Me conta rápido: isso é de reforma, construção financiada ou projeto? E essa conversa ainda tá rolando ou já acabou?"

Depois analise conversando, não listando:
"Ok, vi tudo aqui. Vou ser sincero..."
"Primeiro, o que tu fez bem: [elogio genuíno]"
"Agora o problema: [erro principal e consequência real]"
"O que tu faz agora: [ação concreta com script pronto se precisar]"

━━━━━━━━━━━━━━━━━━━━━━
EXEMPLOS DO SEU TOM
━━━━━━━━━━━━━━━━━━━━━━

Bom: "Vamos lá. Vi aqui que você ativou o sonho muito bem — mandou demais nisso. Deu pra sentir que o cara ficou empolgado de verdade."

Bom: "Agora, aqui tu vacilou... não perguntou quem decide. Isso vai te custar caro porque na hora H ele fala 'vou ver com minha esposa' e some. Entendeu?"

Bom: "A conta fecha assim: se você faz 10 ligações, 2 atendem. Das 2 que atendem, 1 marca reunião. Se você faz isso com volume, fica previsível para caramba."

Bom: "Calma aí — você tá falando de reforma ou construção financiada? A curva é diferente, quero entender antes de te dar o caminho."

Ruim: "**ANÁLISE:** Nota 7/10. **Pontos positivos:** ativação do sonho. **Pontos negativos:** falta qualificação do decisor."

Se o cliente só quer bater papo sobre vendas, conversa naturalmente. Dá dica, conta caso, sugere abordagem. Como mentor de verdade faria.`;


interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageBase64?: string;
  timestamp: Date;
}

interface Props {
  tenantId: string;
  userName: string;
}

export default function ConsultorIAView({ tenantId, userName }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
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
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Imagem muito grande (máx 5MB)'); return; }
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const sendMessage = async () => {
    if (!input.trim() && !imagePreview) return;
    if (isLoading) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      imageBase64: imagePreview || undefined,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setImagePreview(null);
    setIsLoading(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error('API key não configurada');

      // Build conversation history for Gemini
      const history = [...messages, userMsg];
      const contents = [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\nO nome do cliente é: ' + userName }] },
        { role: 'model', parts: [{ text: 'E aí, ' + userName.split(' ')[0] + '! Aqui é o Taleco, o cérebro comercial do Thalisson 🧠\n\nManda o print aí ou cola a conversa que eu dou uma olhada pra você.\n\nSe quiser só trocar uma ideia sobre algum atendimento, pode mandar também 😉' }] },
        ...history.map(m => {
          const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
          if (m.content) parts.push({ text: m.content });
          if (m.imageBase64) {
            const base64 = m.imageBase64.split(',')[1];
            const mimeMatch = m.imageBase64.match(/data:([^;]+);/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            parts.push({ inlineData: { mimeType, data: base64 } });
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
      let formatted = line
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
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-brand-primary/50">
            <img src="/consultor-avatar.jpg" alt="Taleco" className="w-full h-full object-cover" />
          </div>
          <div>
            <h2 className="text-white font-bold text-sm">Taleco — Cérebro Comercial</h2>
            <span className="text-xs text-brand-primary">Online • Pronto pra te ajudar</span>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="text-white/30 hover:text-red-400 transition-colors" title="Limpar chat">
            <Trash2 size={18} />
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
              Sou o braço direito do Thalisson. Manda o print da conversa ou me conta a situação que eu te ajudo na hora!
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
              {[
                '📸 Enviar print de conversa',
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
                {msg.imageBase64 && (
                  <img src={msg.imageBase64} alt="Print" className="rounded-lg max-h-64 mb-2 cursor-pointer" onClick={() => window.open(msg.imageBase64, '_blank')} />
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

      {/* Image preview */}
      {imagePreview && (
        <div className="px-4 pb-2">
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="h-20 rounded-lg border border-white/10" />
            <button onClick={() => setImagePreview(null)}
              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs">×</button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-white/10">
        <div className="flex items-end gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-2">
          <button onClick={() => fileInputRef.current?.click()}
            className="text-white/30 hover:text-brand-primary transition-colors p-1 flex-shrink-0">
            <Image size={20} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Mande o print ou cole a conversa aqui..."
            className="flex-1 bg-transparent text-white text-sm resize-none focus:outline-none max-h-[150px] py-1"
            rows={1}
          />
          <button onClick={sendMessage} disabled={isLoading || (!input.trim() && !imagePreview)}
            className="text-brand-primary hover:brightness-110 transition-all p-1 flex-shrink-0 disabled:opacity-30">
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
