import { useState, useEffect, type FormEvent } from "react";
import {
  Home, PenLine, Clock, CreditCard, User, LogOut, ChevronRight,
  Sparkles, TrendingUp, ArrowLeft, FileText, BarChart3, Users,
  Lock, Shield, CheckCircle2, AlertTriangle, Zap, Crown, Mail,
  Camera, Mic, Upload, Info, RefreshCw, Settings, Bell, Copy,
  Share2, Trophy, Target,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type View =
  | "login"
  | "dashboard"
  | "nova-redacao"
  | "processando"
  | "resultado"
  | "historico"
  | "planos"
  | "perfil"
  | "admin";

interface Evidencia {
  texto: string;
  tipo: "positivo" | "negativo";
  obs?: string;
}

interface Competencia {
  id: number;
  sigla: string;
  nome: string;
  nota: number;
  max: number;
  justificativa: string;
  positivos: string[];
  negativos: string[];
  melhoria: string;
  evidencias: Evidencia[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const USER = {
  nome: "Maria Oliveira",
  email: "maria.oliveira@email.com",
  iniciais: "MO",
  creditos: 7,
  plano: "Pro",
  isAdmin: true,
  totalRedacoes: 5,
  mediaNota: 760,
};

const TEMA_SEMANA = {
  titulo:
    "Desafios para a valorização de comunidades e povos tradicionais no Brasil",
  prazo: "22 de agosto de 2025",
  area: "Ciências Humanas",
};

const COMPETENCIAS: Competencia[] = [
  {
    id: 1,
    sigla: "C1",
    nome: "Domínio da língua formal",
    nota: 160,
    max: 200,
    justificativa:
      "Sua redação demonstra bom domínio das regras gramaticais, com poucos desvios pontuais. A linguagem é formal e adequada ao gênero dissertativo-argumentativo.",
    positivos: [
      "Uso correto de vírgula na maioria das orações subordinadas",
      "Vocabulário preciso e variado",
      "Ausência de gírias ou linguagem coloquial",
    ],
    negativos: [
      "Concordância verbal incorreta em 2 ocorrências",
      "Uso inadequado de crase no 3º parágrafo",
    ],
    melhoria:
      "Revise concordância verbal com sujeitos compostos e o uso da crase antes de pronomes demonstrativos.",
    evidencias: [
      {
        texto: '"...populações marginalizadas enfrentam obstáculos sistêmicos que historicamente as excluem..."',
        tipo: "positivo",
      },
      {
        texto: '"...os povos indígenas e quilombolas tem direito à..."',
        tipo: "negativo",
        obs: '"tem" → "têm" (concordância verbal)',
      },
    ],
  },
  {
    id: 2,
    sigla: "C2",
    nome: "Compreensão da proposta",
    nota: 180,
    max: 200,
    justificativa:
      "O tema foi plenamente compreendido e desenvolvido com coerência. Você mobilizou conceitos de história, sociologia e direitos humanos de forma pertinente.",
    positivos: [
      "Referências a Paulo Freire e à Constituição Federal bem aplicadas",
      "Abordagem multidisciplinar consistente",
      "Nenhuma fuga do tema identificada",
    ],
    negativos: [
      "A dimensão econômica da valorização cultural poderia ser mais explorada",
    ],
    melhoria:
      "Para a nota máxima, inclua pelo menos uma perspectiva econômica ou ambiental na argumentação.",
    evidencias: [
      {
        texto: '"...retomando os ensinamentos de Paulo Freire sobre a educação libertadora como ferramenta de emancipação cultural..."',
        tipo: "positivo",
      },
    ],
  },
  {
    id: 3,
    sigla: "C3",
    nome: "Seleção de argumentos",
    nota: 160,
    max: 200,
    justificativa:
      "Os argumentos são relevantes e organizados. Alguns pontos carecem de maior embasamento teórico e dados concretos.",
    positivos: [
      "Dado do IBGE 2023 usado corretamente",
      "Progressão argumentativa clara entre os parágrafos",
    ],
    negativos: [
      "3º parágrafo contém generalização sem evidência",
      "Ausência de contra-argumento refutado",
    ],
    melhoria:
      "Evite afirmações genéricas. Substitua por dados, estudos ou autores reconhecidos.",
    evidencias: [
      {
        texto: '"...segundo dados do IBGE 2023, apenas 13% das terras indígenas são homologadas no país..."',
        tipo: "positivo",
      },
      {
        texto: '"...isso é ruim para o Brasil como um todo..."',
        tipo: "negativo",
        obs: "Argumento vago, sem evidência ou embasamento teórico",
      },
    ],
  },
  {
    id: 4,
    sigla: "C4",
    nome: "Coesão e coerência",
    nota: 140,
    max: 200,
    justificativa:
      "Os conectivos são usados de forma razoável, mas há problemas na transição entre o 2º e 3º parágrafos e repetição excessiva de conectivos similares.",
    positivos: [
      "Uso correto de 'por outro lado' e 'dessa forma'",
      "Retomada pronominal adequada na maioria dos casos",
    ],
    negativos: [
      "Acúmulo de 'além disso, outrossim' no 4º parágrafo",
      "Ruptura de coerência na conclusão em relação ao 2º parágrafo",
    ],
    melhoria:
      "Varie os recursos coesivos. Nunca use dois conectivos de adição consecutivos.",
    evidencias: [
      {
        texto: '"Além disso, outrossim, cabe ressaltar que as comunidades tradicionais..."',
        tipo: "negativo",
        obs: "Repetição desnecessária: 'além disso' e 'outrossim' têm a mesma função",
      },
      {
        texto: '"Por outro lado, as comunidades quilombolas resistem por meio da memória coletiva..."',
        tipo: "positivo",
      },
    ],
  },
  {
    id: 5,
    sigla: "C5",
    nome: "Proposta de intervenção",
    nota: 200,
    max: 200,
    justificativa:
      "Proposta de intervenção exemplar, com todos os cinco elementos exigidos pelo ENEM presentes e bem articulados. Ponto de destaque da redação.",
    positivos: [
      "Agente: Ministério da Cultura ✓",
      "Ação específica e factível ✓",
      "Modo/meio claramente detalhado ✓",
      "Efeito esperado descrito ✓",
      "Detalhamento adicional presente ✓",
    ],
    negativos: [],
    melhoria:
      "Parabéns! Sua proposta de intervenção está completa e bem articulada. Continue com esse modelo.",
    evidencias: [
      {
        texto: '"O Ministério da Cultura, por meio da criação de centros de memória viva em territórios tradicionais, deve implementar políticas públicas de valorização cultural, garantindo, assim, a preservação das identidades étnicas das futuras gerações."',
        tipo: "positivo",
      },
    ],
  },
];

const HISTORICO = [
  { id: "1", tema: "Desafios para a valorização de comunidades e povos tradicionais no Brasil", data: "15/08/2025", nota: 840, palavras: 412 },
  { id: "2", tema: "O estigma associado às doenças mentais na sociedade brasileira", data: "10/08/2025", nota: 720, palavras: 398 },
  { id: "3", tema: "Invisibilidade e registro civil: garantia de acesso à cidadania no Brasil", data: "02/08/2025", nota: 760, palavras: 425 },
  { id: "4", tema: "O impacto da Inteligência Artificial no mercado de trabalho brasileiro", data: "28/07/2025", nota: 680, palavras: 384 },
  { id: "5", tema: "A democratização do acesso à internet no Brasil", data: "20/07/2025", nota: 800, palavras: 436 },
];

const EVOLUCAO = [
  { label: "20/07", nota: 800 },
  { label: "28/07", nota: 680 },
  { label: "02/08", nota: 760 },
  { label: "10/08", nota: 720 },
  { label: "15/08", nota: 840 },
];

const PROCESSING_STEPS = [
  "Recebendo redação",
  "Verificando estrutura do texto",
  "Analisando competência por competência",
  "Identificando pontos fortes e fracos",
  "Calculando pontuação final",
  "Gerando feedback detalhado",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(nota: number, max = 1000) {
  const p = nota / max;
  if (p >= 0.8) return "#4ADE80";
  if (p >= 0.6) return "#8B5CF6";
  if (p >= 0.4) return "#F6A35B";
  return "#F87171";
}

function scoreLabel(nota: number, max = 1000) {
  const p = nota / max;
  if (p >= 0.8) return "Excelente";
  if (p >= 0.6) return "Bom";
  if (p >= 0.4) return "Regular";
  return "Iniciante";
}

const ff = {
  display: "'Fredoka', sans-serif",
  body: "'Inter', -apple-system, sans-serif",
  mono: "'JetBrains Mono', monospace",
};

// ─── Micro Components ─────────────────────────────────────────────────────────

function ScoreRing({ score, max = 1000, size = 180 }: { score: number; max?: number; size?: number }) {
  const sw = 10;
  const r = (size - sw * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct = score / max;
  const offset = circ * (1 - pct);
  const color = scoreColor(score, max);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", position: "absolute", top: 0, left: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#1C1729" strokeWidth={sw} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={sw} fill="none"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 10px ${color}90)`, transition: "stroke-dashoffset 1.4s cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      <div className="flex flex-col items-center" style={{ position: "relative", zIndex: 1 }}>
        <span style={{ fontFamily: ff.mono, fontSize: size > 150 ? "2.6rem" : "1.8rem", fontWeight: 700, color: "#F7F5FB", lineHeight: 1 }}>{score}</span>
        <span style={{ fontFamily: ff.mono, fontSize: "0.8rem", color: "#9D94AC", marginTop: 2 }}>/{max}</span>
        <span style={{ fontFamily: ff.display, fontSize: "0.9rem", color, marginTop: 6, fontWeight: 500 }}>{scoreLabel(score, max)}</span>
      </div>
    </div>
  );
}

function CompBar({ comp, selected, onSelect }: { comp: Competencia; selected: boolean; onSelect: () => void }) {
  const pct = (comp.nota / comp.max) * 100;
  const color = scoreColor(comp.nota, comp.max);

  return (
    <div>
      <button
        onClick={onSelect}
        className="w-full text-left p-3 rounded-xl transition-all duration-200"
        style={{
          background: selected ? "#1C1729" : "#16121F",
          border: `1px solid ${selected ? "rgba(139,92,246,0.35)" : "rgba(139,92,246,0.1)"}`,
          boxShadow: selected ? "0 0 0 1px rgba(139,92,246,0.12)" : "none",
        }}
      >
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span
              style={{
                fontFamily: ff.mono, fontSize: "0.65rem", color: "#9D94AC",
                background: "#08070C", padding: "2px 7px", borderRadius: 5,
                border: "1px solid rgba(139,92,246,0.2)", letterSpacing: "0.04em",
              }}
            >
              {comp.sigla}
            </span>
            <span style={{ fontFamily: ff.body, fontSize: "0.85rem", color: "#F7F5FB" }}>{comp.nome}</span>
          </div>
          <span style={{ fontFamily: ff.mono, fontSize: "0.85rem", fontWeight: 600, color }}>
            {comp.nota}<span style={{ color: "#9D94AC", fontWeight: 400 }}>/{comp.max}</span>
          </span>
        </div>
        <div className="h-1.5 rounded-full" style={{ background: "#08070C" }}>
          <div
            className="h-1.5 rounded-full"
            style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}55`, transition: "width 1.2s ease" }}
          />
        </div>
      </button>

      {selected && (
        <div className="mt-1 mx-1 p-4 rounded-xl" style={{ background: "#0E0B16", border: "1px solid rgba(139,92,246,0.12)" }}>
          <p style={{ fontFamily: ff.body, fontSize: "0.84rem", color: "#9D94AC", lineHeight: 1.65, marginBottom: 12 }}>
            {comp.justificativa}
          </p>
          {comp.positivos.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-3">
              {comp.positivos.map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 size={13} style={{ color: "#4ADE80", marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontFamily: ff.body, fontSize: "0.8rem", color: "#4ADE80" }}>{p}</span>
                </div>
              ))}
            </div>
          )}
          {comp.negativos.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-3">
              {comp.negativos.map((n, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle size={12} style={{ color: "#F6A35B", marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontFamily: ff.body, fontSize: "0.8rem", color: "#F6A35B" }}>{n}</span>
                </div>
              ))}
            </div>
          )}
          <div
            className="flex items-start gap-2 p-2.5 rounded-lg"
            style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.15)" }}
          >
            <Target size={12} style={{ color: "#8B5CF6", marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontFamily: ff.body, fontSize: "0.78rem", color: "#9D94AC" }}>{comp.melhoria}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function CreditBadge({ credits }: { credits: number }) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
      style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)" }}
    >
      <Zap size={13} style={{ color: "#8B5CF6" }} />
      <span style={{ fontFamily: ff.mono, fontSize: "0.8rem", fontWeight: 600, color: "#F7F5FB" }}>{credits}</span>
      <span style={{ fontFamily: ff.body, fontSize: "0.72rem", color: "#9D94AC" }}>créditos</span>
    </div>
  );
}

function UserAvatar({ iniciais, size = 36 }: { iniciais: string; size?: number }) {
  return (
    <div
      className="rounded-xl flex items-center justify-center cursor-pointer select-none"
      style={{
        width: size, height: size,
        background: "linear-gradient(135deg, #5B21B6, #8B5CF6)",
        fontFamily: ff.display, fontSize: size * 0.36, fontWeight: 700, color: "#F7F5FB",
        boxShadow: "0 0 12px rgba(139,92,246,0.3)",
      }}
    >
      {iniciais}
    </div>
  );
}

function FuturoBadge() {
  return (
    <span
      style={{
        fontFamily: ff.body, fontSize: "0.62rem", fontWeight: 500,
        color: "#F6A35B", background: "rgba(246,163,91,0.1)",
        border: "1px solid rgba(246,163,91,0.25)",
        padding: "1px 5px", borderRadius: 4, whiteSpace: "nowrap",
      }}
    >
      Em breve
    </span>
  );
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function TopNav({ view, onNav, credits }: { view: View; onNav: (v: View) => void; credits: number }) {
  const links: { id: View; label: string }[] = [
    { id: "dashboard", label: "Início" },
    { id: "nova-redacao", label: "Nova Redação" },
    { id: "historico", label: "Histórico" },
    { id: "planos", label: "Planos" },
  ];

  return (
    <header
      className="hidden md:flex fixed top-0 left-0 right-0 z-50 items-center justify-between px-6 h-16"
      style={{ background: "rgba(8,7,12,0.9)", borderBottom: "1px solid rgba(139,92,246,0.12)", backdropFilter: "blur(12px)" }}
    >
      <button onClick={() => onNav("dashboard")} className="flex items-center gap-2.5 shrink-0">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #5B21B6, #8B5CF6)", boxShadow: "0 0 14px rgba(139,92,246,0.45)" }}
        >
          <span style={{ fontFamily: ff.display, fontSize: "1.1rem", fontWeight: 700, color: "#F7F5FB" }}>R</span>
        </div>
        <span style={{ fontFamily: ff.display, fontSize: "1.25rem", fontWeight: 700, color: "#F7F5FB", letterSpacing: "-0.01em" }}>
          Reda<span style={{ color: "#8B5CF6" }}>1000</span>IA
        </span>
      </button>

      <nav className="flex items-center gap-0.5">
        {links.map((l) => (
          <button
            key={l.id}
            onClick={() => onNav(l.id)}
            className="px-4 py-2 rounded-xl text-sm transition-all duration-200"
            style={{
              fontFamily: ff.body,
              color: view === l.id ? "#F7F5FB" : "#9D94AC",
              background: view === l.id ? "rgba(139,92,246,0.14)" : "transparent",
              fontWeight: view === l.id ? 500 : 400,
            }}
          >
            {l.label}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <CreditBadge credits={credits} />
        <button onClick={() => onNav("perfil")}>
          <UserAvatar iniciais={USER.iniciais} />
        </button>
      </div>
    </header>
  );
}

function BottomNav({ view, onNav }: { view: View; onNav: (v: View) => void }) {
  const tabs = [
    { id: "dashboard" as View, label: "Início", icon: Home },
    { id: "historico" as View, label: "Histórico", icon: Clock },
    { id: "nova-redacao" as View, label: "Nova", icon: PenLine },
    { id: "planos" as View, label: "Planos", icon: CreditCard },
    { id: "perfil" as View, label: "Perfil", icon: User },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-end justify-around px-2 pt-2 pb-safe"
      style={{ background: "rgba(8,7,12,0.96)", borderTop: "1px solid rgba(139,92,246,0.12)", paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
    >
      {tabs.map((tab) =>
        tab.id === "nova-redacao" ? (
          <button key={tab.id} onClick={() => onNav(tab.id)} className="flex flex-col items-center -mt-7">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-0.5 transition-transform duration-200 active:scale-95"
              style={{
                background: "linear-gradient(145deg, #6D28D9, #8B5CF6)",
                boxShadow: "0 0 24px rgba(139,92,246,0.55), 0 4px 16px rgba(0,0,0,0.5)",
              }}
            >
              <tab.icon size={22} style={{ color: "#F7F5FB" }} />
            </div>
            <span style={{ fontFamily: ff.body, fontSize: "0.62rem", color: view === tab.id ? "#8B5CF6" : "#9D94AC" }}>
              {tab.label}
            </span>
          </button>
        ) : (
          <button key={tab.id} onClick={() => onNav(tab.id)} className="flex flex-col items-center gap-1 py-1 px-2 transition-colors duration-150">
            <tab.icon size={20} style={{ color: view === tab.id ? "#8B5CF6" : "#9D94AC" }} />
            <span style={{ fontFamily: ff.body, fontSize: "0.62rem", color: view === tab.id ? "#8B5CF6" : "#9D94AC" }}>
              {tab.label}
            </span>
          </button>
        )
      )}
    </nav>
  );
}

// ─── Views ────────────────────────────────────────────────────────────────────

function LoginView({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); setSent(true); }, 1400);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: "#08070C" }}>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(91,33,182,0.18) 0%, transparent 70%)" }}
      />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(145deg, #5B21B6, #8B5CF6)", boxShadow: "0 0 32px rgba(139,92,246,0.45)" }}
          >
            <span style={{ fontFamily: ff.display, fontSize: "2.1rem", fontWeight: 700, color: "#F7F5FB" }}>R</span>
          </div>
          <h1 style={{ fontFamily: ff.display, fontSize: "2.2rem", fontWeight: 700, color: "#F7F5FB", letterSpacing: "-0.02em" }}>
            Reda<span style={{ color: "#8B5CF6" }}>1000</span>IA
          </h1>
          <p style={{ fontFamily: ff.body, fontSize: "0.9rem", color: "#9D94AC", textAlign: "center", marginTop: 8, maxWidth: 260 }}>
            Correção inteligente de redações ENEM com nota de 0 a 1000
          </p>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label style={{ fontFamily: ff.body, fontSize: "0.82rem", color: "#9D94AC", display: "block", marginBottom: 6 }}>
                E-mail de acesso
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#9D94AC" }} />
                <input
                  type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl outline-none transition-all duration-200"
                  style={{
                    fontFamily: ff.body, fontSize: "1rem",
                    background: "#16121F", color: "#F7F5FB",
                    border: "1px solid rgba(139,92,246,0.2)",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "rgba(139,92,246,0.6)")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(139,92,246,0.2)")}
                />
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
              style={{
                fontFamily: ff.display, fontSize: "1.05rem", fontWeight: 600, color: "#F7F5FB",
                background: "linear-gradient(135deg, #5B21B6, #8B5CF6)",
                boxShadow: loading ? "none" : "0 0 20px rgba(139,92,246,0.35)",
                letterSpacing: "0.01em", opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? <RefreshCw size={17} className="animate-spin" /> : <><Mail size={17} /> Enviar link de acesso</>}
            </button>
          </form>
        ) : (
          <div className="p-6 rounded-2xl text-center" style={{ background: "#16121F", border: "1px solid rgba(74,222,128,0.2)" }}>
            <CheckCircle2 size={38} style={{ color: "#4ADE80", margin: "0 auto 12px" }} />
            <h3 style={{ fontFamily: ff.display, fontSize: "1.2rem", fontWeight: 600, color: "#F7F5FB", marginBottom: 6 }}>Link enviado!</h3>
            <p style={{ fontFamily: ff.body, fontSize: "0.84rem", color: "#9D94AC", lineHeight: 1.5, marginBottom: 16 }}>
              Verifique sua caixa de entrada em{" "}
              <strong style={{ color: "#F7F5FB" }}>{email}</strong>
            </p>
            <button
              onClick={onLogin}
              className="w-full py-2.5 rounded-xl text-sm transition-all duration-200 active:scale-95"
              style={{ fontFamily: ff.body, background: "rgba(139,92,246,0.15)", color: "#8B5CF6", border: "1px solid rgba(139,92,246,0.3)" }}
            >
              Entrar direto (demonstração)
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 text-center mt-10">
          {[
            { value: "48.200+", label: "redações corrigidas" },
            { value: "4,9 / 5", label: "avaliação média" },
            { value: "94%", label: "aprovação no ENEM" },
          ].map((s) => (
            <div key={s.label}>
              <div style={{ fontFamily: ff.display, fontSize: "1.1rem", fontWeight: 700, color: "#8B5CF6" }}>{s.value}</div>
              <div style={{ fontFamily: ff.body, fontSize: "0.68rem", color: "#9D94AC", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardView({ onNav }: { onNav: (v: View) => void }) {
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 style={{ fontFamily: ff.display, fontSize: "1.7rem", fontWeight: 600, color: "#F7F5FB" }}>
          Olá, Maria 👋
        </h1>
        <p style={{ fontFamily: ff.body, fontSize: "0.9rem", color: "#9D94AC", marginTop: 2 }}>
          Você tem{" "}
          <strong style={{ color: "#8B5CF6", fontFamily: ff.mono }}>{USER.creditos}</strong>{" "}
          créditos disponíveis no plano{" "}
          <strong style={{ color: "#8B5CF6" }}>{USER.plano}</strong>
        </p>
      </div>

      {/* Tema da semana */}
      <div
        className="mb-6 p-5 rounded-2xl relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1C1729 0%, #16121F 100%)",
          border: "1px solid rgba(139,92,246,0.28)",
          boxShadow: "0 0 30px rgba(139,92,246,0.08)",
        }}
      >
        <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #8B5CF6, transparent)" }} />
        <div className="flex items-center gap-1.5 mb-3">
          <Sparkles size={13} style={{ color: "#8B5CF6" }} />
          <span style={{ fontFamily: ff.body, fontSize: "0.72rem", fontWeight: 600, color: "#8B5CF6", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Tema da semana
          </span>
        </div>
        <h2 style={{ fontFamily: ff.display, fontSize: "1.1rem", fontWeight: 600, color: "#F7F5FB", lineHeight: 1.4, marginBottom: 10 }}>
          {TEMA_SEMANA.titulo}
        </h2>
        <div className="flex items-center gap-3 mb-4">
          <span style={{ fontFamily: ff.body, fontSize: "0.74rem", color: "#9D94AC" }}>Até {TEMA_SEMANA.prazo}</span>
          <span
            className="px-2 py-0.5 rounded-full"
            style={{ fontFamily: ff.body, fontSize: "0.7rem", color: "#8B5CF6", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}
          >
            {TEMA_SEMANA.area}
          </span>
        </div>
        <button
          onClick={() => onNav("nova-redacao")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 active:scale-95"
          style={{
            fontFamily: ff.display, fontSize: "0.95rem", fontWeight: 600, color: "#F7F5FB",
            background: "linear-gradient(135deg, #5B21B6, #8B5CF6)",
            boxShadow: "0 0 16px rgba(139,92,246,0.4)",
          }}
        >
          <PenLine size={16} /> Escrever agora
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Redações", value: USER.totalRedacoes, Icon: FileText },
          { label: "Média", value: `${USER.mediaNota}`, Icon: TrendingUp },
          { label: "Plano", value: USER.plano, Icon: Crown },
        ].map((s) => (
          <div
            key={s.label} className="p-3 rounded-xl flex flex-col gap-1.5"
            style={{ background: "#16121F", border: "1px solid rgba(139,92,246,0.1)" }}
          >
            <s.Icon size={14} style={{ color: "#8B5CF6" }} />
            <span style={{ fontFamily: ff.mono, fontSize: "1.2rem", fontWeight: 700, color: "#F7F5FB", lineHeight: 1 }}>{s.value}</span>
            <span style={{ fontFamily: ff.body, fontSize: "0.7rem", color: "#9D94AC" }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Recent */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontFamily: ff.display, fontSize: "1.1rem", fontWeight: 600, color: "#F7F5FB" }}>Redações recentes</h3>
          <button
            onClick={() => onNav("historico")}
            className="flex items-center gap-1"
            style={{ fontFamily: ff.body, fontSize: "0.8rem", color: "#8B5CF6" }}
          >
            Ver tudo <ChevronRight size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {HISTORICO.slice(0, 3).map((r) => (
            <button
              key={r.id}
              onClick={() => onNav("resultado")}
              className="w-full p-4 rounded-xl text-left transition-all duration-200"
              style={{ background: "#16121F", border: "1px solid rgba(139,92,246,0.1)" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.28)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.1)")}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p style={{ fontFamily: ff.body, fontSize: "0.84rem", color: "#F7F5FB", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.tema}
                  </p>
                  <p style={{ fontFamily: ff.body, fontSize: "0.73rem", color: "#9D94AC", marginTop: 2 }}>{r.data}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div style={{ fontFamily: ff.mono, fontSize: "1.15rem", fontWeight: 700, color: scoreColor(r.nota), lineHeight: 1 }}>
                    {r.nota}
                  </div>
                  <div style={{ fontFamily: ff.body, fontSize: "0.65rem", color: "#9D94AC" }}>pts</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function NovaRedacaoView({ onNav }: { onNav: (v: View) => void }) {
  const [texto, setTexto] = useState("");
  const MAX = 30000;
  const pct = (texto.length / MAX) * 100;
  const canSubmit = texto.length >= 100;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => onNav("dashboard")}
          className="p-2 rounded-xl transition-colors"
          style={{ background: "#16121F", color: "#9D94AC", border: "1px solid rgba(139,92,246,0.1)" }}
        >
          <ArrowLeft size={17} />
        </button>
        <h1 style={{ fontFamily: ff.display, fontSize: "1.4rem", fontWeight: 600, color: "#F7F5FB" }}>Nova redação</h1>
      </div>

      {/* Tema */}
      <div className="mb-4 p-4 rounded-xl" style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.22)" }}>
        <p style={{ fontFamily: ff.body, fontSize: "0.68rem", fontWeight: 600, color: "#8B5CF6", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>
          Tema
        </p>
        <p style={{ fontFamily: ff.body, fontSize: "0.9rem", color: "#F7F5FB", lineHeight: 1.5 }}>{TEMA_SEMANA.titulo}</p>
      </div>

      {/* Futuras funcionalidades */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[{ label: "Foto / OCR", Icon: Camera }, { label: "Upload PDF", Icon: Upload }, { label: "Áudio", Icon: Mic }].map((f) => (
          <div
            key={f.label}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg opacity-50 cursor-not-allowed"
            style={{ background: "#16121F", border: "1px solid rgba(139,92,246,0.1)" }}
          >
            <f.Icon size={12} style={{ color: "#9D94AC" }} />
            <span style={{ fontFamily: ff.body, fontSize: "0.72rem", color: "#9D94AC" }}>{f.label}</span>
            <FuturoBadge />
          </div>
        ))}
      </div>

      {/* Editor */}
      <div className="relative mb-4">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={`Escreva sua redação aqui.\n\nLembre-se da estrutura ENEM:\n• Introdução com apresentação do tema e tese\n• 1º desenvolvimento com argumento e evidência\n• 2º desenvolvimento com argumento e evidência\n• Conclusão com proposta de intervenção (agente, ação, modo, efeito, detalhamento)`}
          rows={16}
          className="w-full p-4 rounded-2xl outline-none resize-none transition-all duration-200"
          style={{
            fontFamily: ff.body, fontSize: "0.95rem", lineHeight: 1.75,
            background: "#16121F", color: "#F7F5FB",
            border: "1px solid rgba(139,92,246,0.15)",
            caretColor: "#8B5CF6",
          }}
          onFocus={(e) => (e.target.style.borderColor = "rgba(139,92,246,0.45)")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(139,92,246,0.15)")}
        />
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <div className="w-20 h-1 rounded-full" style={{ background: "#1C1729" }}>
            <div
              className="h-1 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(pct, 100)}%`, background: pct > 90 ? "#F87171" : pct > 70 ? "#F6A35B" : "#8B5CF6" }}
            />
          </div>
          <span style={{ fontFamily: ff.mono, fontSize: "0.66rem", color: pct > 90 ? "#F87171" : "#9D94AC" }}>
            {texto.length.toLocaleString("pt-BR")}/{MAX.toLocaleString("pt-BR")}
          </span>
        </div>
      </div>

      {/* Dicas */}
      <div className="mb-6 p-3.5 rounded-xl" style={{ background: "#16121F", border: "1px solid rgba(139,92,246,0.1)" }}>
        <div className="flex items-center gap-2 mb-2">
          <Info size={13} style={{ color: "#8B5CF6" }} />
          <span style={{ fontFamily: ff.display, fontSize: "0.9rem", fontWeight: 500, color: "#F7F5FB" }}>Dicas para a nota máxima</span>
        </div>
        <ul className="flex flex-col gap-1.5">
          {[
            "Proposta de intervenção com agente, ação, modo, efeito e detalhamento (C5 = 200)",
            "Cite dados, pesquisas ou autores para embasar argumentos (C3)",
            "Varie os conectivos e não os acumule no mesmo parágrafo (C4)",
          ].map((t, i) => (
            <li key={i} className="flex items-start gap-2">
              <span style={{ color: "#8B5CF6", fontSize: "0.7rem", marginTop: 3, flexShrink: 0 }}>▸</span>
              <span style={{ fontFamily: ff.body, fontSize: "0.78rem", color: "#9D94AC" }}>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={() => canSubmit && onNav("processando")}
        className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
        style={{
          fontFamily: ff.display, fontSize: "1.1rem", fontWeight: 600, color: "#F7F5FB",
          background: canSubmit ? "linear-gradient(135deg, #5B21B6, #8B5CF6)" : "#16121F",
          boxShadow: canSubmit ? "0 0 24px rgba(139,92,246,0.35)" : "none",
          border: canSubmit ? "none" : "1px solid rgba(139,92,246,0.1)",
          opacity: canSubmit ? 1 : 0.55,
          cursor: canSubmit ? "pointer" : "not-allowed",
        }}
      >
        <Sparkles size={18} /> Enviar para correção — 1 crédito
      </button>

      {!canSubmit && (
        <p className="text-center mt-2" style={{ fontFamily: ff.body, fontSize: "0.74rem", color: "#9D94AC" }}>
          Mínimo de 100 caracteres para enviar
        </p>
      )}
    </div>
  );
}

function ProcessandoView({ onNav }: { onNav: (v: View) => void }) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => {
      setStep((prev) => {
        if (prev >= PROCESSING_STEPS.length - 1) {
          clearInterval(iv);
          setDone(true);
          return prev;
        }
        return prev + 1;
      });
    }, 700);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => onNav("resultado"), 600);
    return () => clearTimeout(t);
  }, [done, onNav]);

  const progress = ((step + 1) / PROCESSING_STEPS.length) * 100;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: "#08070C" }}>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 40% at 50% 40%, rgba(91,33,182,0.14) 0%, transparent 70%)" }}
      />
      <div className="w-full max-w-sm relative z-10">
        {/* Orb */}
        <div className="flex justify-center mb-10">
          <div className="relative">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(145deg, #5B21B6, #8B5CF6)", boxShadow: "0 0 50px rgba(139,92,246,0.5)" }}
            >
              <Sparkles size={36} style={{ color: "#F7F5FB" }} />
            </div>
            <div
              className="absolute rounded-full border-2 border-dashed animate-spin"
              style={{ inset: -10, borderColor: "rgba(139,92,246,0.25)", animationDuration: "4s" }}
            />
          </div>
        </div>

        <h2 style={{ fontFamily: ff.display, fontSize: "1.55rem", fontWeight: 600, color: "#F7F5FB", textAlign: "center", marginBottom: 4 }}>
          Corrigindo sua redação
        </h2>
        <p style={{ fontFamily: ff.body, fontSize: "0.84rem", color: "#9D94AC", textAlign: "center", marginBottom: 32 }}>
          Nossa IA analisa cada competência do ENEM individualmente
        </p>

        <div className="flex flex-col gap-3 mb-8">
          {PROCESSING_STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-500"
                style={{
                  background: i < step ? "#4ADE80" : i === step ? "#8B5CF6" : "#1C1729",
                  boxShadow: i === step ? "0 0 12px rgba(139,92,246,0.6)" : "none",
                }}
              >
                {i < step ? (
                  <CheckCircle2 size={13} style={{ color: "#08070C" }} />
                ) : i === step ? (
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                ) : null}
              </div>
              <span style={{ fontFamily: ff.body, fontSize: "0.85rem", color: i <= step ? "#F7F5FB" : "#9D94AC", fontWeight: i === step ? 500 : 400 }}>
                {s}
              </span>
              {i === step && (
                <div className="ml-auto flex gap-1">
                  {[0, 1, 2].map((d) => (
                    <div
                      key={d} className="w-1 h-1 rounded-full animate-bounce"
                      style={{ background: "#8B5CF6", animationDelay: `${d * 0.16}s` }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="h-1.5 rounded-full mb-2" style={{ background: "#1C1729" }}>
          <div
            className="h-1.5 rounded-full transition-all duration-700"
            style={{ width: `${progress}%`, background: "linear-gradient(90deg, #5B21B6, #8B5CF6)", boxShadow: "0 0 8px rgba(139,92,246,0.5)" }}
          />
        </div>
        <p style={{ fontFamily: ff.body, fontSize: "0.72rem", color: "#9D94AC", textAlign: "right" }}>
          Geralmente menos de 30 segundos
        </p>
      </div>
    </div>
  );
}

function ResultadoView({ onNav }: { onNav: (v: View) => void }) {
  const [selectedComp, setSelectedComp] = useState<number | null>(null);
  const [tab, setTab] = useState<"competencias" | "evidencias" | "proximos">("competencias");
  const totalScore = COMPETENCIAS.reduce((a, c) => a + c.nota, 0);

  function toggleComp(i: number) {
    setSelectedComp(selectedComp === i ? null : i);
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Sticky sub-header */}
      <div
        className="sticky top-0 md:top-16 z-30 flex items-center justify-between px-4 md:px-6 h-12"
        style={{ background: "rgba(8,7,12,0.92)", borderBottom: "1px solid rgba(139,92,246,0.1)", backdropFilter: "blur(8px)" }}
      >
        <button onClick={() => onNav("historico")} className="flex items-center gap-1.5" style={{ fontFamily: ff.body, fontSize: "0.82rem", color: "#9D94AC" }}>
          <ArrowLeft size={15} /> Histórico
        </button>
        <div className="flex items-center gap-2">
          <button className="p-1.5 rounded-lg" style={{ background: "#16121F", color: "#9D94AC" }}><Share2 size={15} /></button>
          <button className="p-1.5 rounded-lg" style={{ background: "#16121F", color: "#9D94AC" }}><Copy size={15} /></button>
        </div>
      </div>

      <div className="p-4 md:p-6">
        {/* Score hero */}
        <div className="flex flex-col items-center mb-8 mt-2">
          <ScoreRing score={totalScore} max={1000} size={200} />
          <h1 style={{ fontFamily: ff.display, fontSize: "1.15rem", fontWeight: 600, color: "#F7F5FB", marginTop: 18, textAlign: "center", maxWidth: 320 }}>
            {TEMA_SEMANA.titulo.substring(0, 55)}…
          </h1>
          <p style={{ fontFamily: ff.body, fontSize: "0.78rem", color: "#9D94AC", marginTop: 4 }}>15 de agosto de 2025 · 412 palavras</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: "#16121F" }}>
          {(["competencias", "evidencias", "proximos"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-lg text-sm transition-all duration-200"
              style={{
                fontFamily: ff.body,
                color: tab === t ? "#F7F5FB" : "#9D94AC",
                background: tab === t ? "#1C1729" : "transparent",
                fontWeight: tab === t ? 500 : 400,
              }}
            >
              {t === "competencias" ? "Competências" : t === "evidencias" ? "Evidências" : "Próximos passos"}
            </button>
          ))}
        </div>

        {tab === "competencias" && (
          <div className="flex flex-col gap-2">
            {COMPETENCIAS.map((c, i) => (
              <CompBar key={c.id} comp={c} selected={selectedComp === i} onSelect={() => toggleComp(i)} />
            ))}
          </div>
        )}

        {tab === "evidencias" && (
          <div className="flex flex-col gap-4">
            {COMPETENCIAS.flatMap((c) =>
              c.evidencias.map((ev, i) => (
                <div
                  key={`${c.id}-${i}`} className="p-4 rounded-xl"
                  style={{ background: "#16121F", border: `1px solid ${ev.tipo === "positivo" ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.18)"}` }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span style={{ fontFamily: ff.mono, fontSize: "0.62rem", color: "#9D94AC", background: "#1C1729", padding: "2px 6px", borderRadius: 4 }}>
                      {c.sigla}
                    </span>
                    <span style={{ fontFamily: ff.body, fontSize: "0.74rem", fontWeight: 500, color: ev.tipo === "positivo" ? "#4ADE80" : "#F87171" }}>
                      {ev.tipo === "positivo" ? "✓ Ponto forte" : "⚠ Ponto a melhorar"}
                    </span>
                  </div>
                  <blockquote
                    style={{
                      fontFamily: ff.body, fontSize: "0.84rem", color: "#F7F5FB", fontStyle: "italic", lineHeight: 1.6,
                      borderLeft: `2px solid ${ev.tipo === "positivo" ? "#4ADE80" : "#F87171"}`, paddingLeft: 12,
                    }}
                  >
                    {ev.texto}
                  </blockquote>
                  {ev.obs && (
                    <p style={{ fontFamily: ff.body, fontSize: "0.74rem", color: "#F6A35B", marginTop: 8 }}>
                      → {ev.obs}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === "proximos" && (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-2xl" style={{ background: "#16121F", border: "1px solid rgba(139,92,246,0.15)" }}>
              <h3 style={{ fontFamily: ff.display, fontSize: "1rem", fontWeight: 600, color: "#F7F5FB", marginBottom: 12 }}>
                Prioridades de melhoria
              </h3>
              <div className="flex flex-col gap-3">
                {[
                  { prioridade: "Alta", cor: "#F87171", meta: "C4 — Coesão e coerência (140 pts)", acao: "Pratique transições entre parágrafos usando conectivos variados. Nunca acumule dois conectivos de adição consecutivos." },
                  { prioridade: "Média", cor: "#F6A35B", meta: "C3 — Seleção de argumentos (160 pts)", acao: "Leia 2 artigos por semana sobre temas ENEM. Anote dados e autores para usar como embasamento." },
                  { prioridade: "Baixa", cor: "#4ADE80", meta: "C1 — Domínio da língua formal (160 pts)", acao: "Revise concordância verbal com sujeitos compostos antes de cada redação." },
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-xl" style={{ background: "#1C1729" }}>
                    <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ background: item.cor, boxShadow: `0 0 8px ${item.cor}60` }} />
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span style={{ fontFamily: ff.body, fontSize: "0.68rem", fontWeight: 700, color: item.cor, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                          {item.prioridade}
                        </span>
                        <span style={{ fontFamily: ff.body, fontSize: "0.8rem", color: "#F7F5FB" }}>{item.meta}</span>
                      </div>
                      <p style={{ fontFamily: ff.body, fontSize: "0.78rem", color: "#9D94AC", lineHeight: 1.55 }}>{item.acao}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => onNav("nova-redacao")}
              className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              style={{ fontFamily: ff.display, fontSize: "1rem", fontWeight: 600, color: "#F7F5FB", background: "linear-gradient(135deg, #5B21B6, #8B5CF6)", boxShadow: "0 0 20px rgba(139,92,246,0.35)" }}
            >
              <PenLine size={18} /> Escrever nova redação
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function HistoricoView({ onNav }: { onNav: (v: View) => void }) {
  const best = Math.max(...HISTORICO.map((r) => r.nota));
  const avg = Math.round(HISTORICO.reduce((a, r) => a + r.nota, 0) / HISTORICO.length);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 style={{ fontFamily: ff.display, fontSize: "1.55rem", fontWeight: 700, color: "#F7F5FB", marginBottom: 16 }}>Histórico</h1>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Total", value: HISTORICO.length, Icon: FileText },
          { label: "Melhor", value: best, Icon: Trophy },
          { label: "Média", value: avg, Icon: TrendingUp },
        ].map((s) => (
          <div key={s.label} className="p-3 rounded-xl text-center" style={{ background: "#16121F", border: "1px solid rgba(139,92,246,0.1)" }}>
            <s.Icon size={14} style={{ color: "#8B5CF6", margin: "0 auto 6px" }} />
            <div style={{ fontFamily: ff.mono, fontSize: "1.3rem", fontWeight: 700, color: "#8B5CF6", lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontFamily: ff.body, fontSize: "0.68rem", color: "#9D94AC", marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Evolution chart */}
      <div className="mb-6 p-4 rounded-2xl" style={{ background: "#16121F", border: "1px solid rgba(139,92,246,0.1)" }}>
        <h3 style={{ fontFamily: ff.display, fontSize: "0.95rem", fontWeight: 600, color: "#F7F5FB", marginBottom: 14 }}>Evolução da nota</h3>
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={EVOLUCAO} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.07)" />
            <XAxis dataKey="label" tick={{ fontFamily: ff.mono, fontSize: 10, fill: "#9D94AC" }} axisLine={false} tickLine={false} />
            <YAxis domain={[500, 1000]} tick={{ fontFamily: ff.mono, fontSize: 10, fill: "#9D94AC" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#1C1729", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 8, fontFamily: ff.mono, fontSize: 12, color: "#F7F5FB" }}
              cursor={{ stroke: "rgba(139,92,246,0.3)" }}
            />
            <Line type="monotone" dataKey="nota" stroke="#8B5CF6" strokeWidth={2.5} dot={{ fill: "#8B5CF6", r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: "#A78BFA", strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col gap-2.5">
        {HISTORICO.map((r) => (
          <button
            key={r.id}
            onClick={() => onNav("resultado")}
            className="w-full p-4 rounded-2xl text-left transition-all duration-200"
            style={{ background: "#16121F", border: "1px solid rgba(139,92,246,0.1)" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.28)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.1)")}
          >
            <div className="flex items-start gap-3 mb-2.5">
              <p style={{ fontFamily: ff.body, fontSize: "0.84rem", color: "#F7F5FB", lineHeight: 1.4, flex: 1 }}>{r.tema}</p>
              <div className="text-right shrink-0">
                <div style={{ fontFamily: ff.mono, fontSize: "1.3rem", fontWeight: 700, color: scoreColor(r.nota), lineHeight: 1 }}>{r.nota}</div>
                <div style={{ fontFamily: ff.body, fontSize: "0.62rem", color: "#9D94AC" }}>pts</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: ff.body, fontSize: "0.73rem", color: "#9D94AC" }}>{r.data} · {r.palavras} palavras</span>
              <div className="w-20 h-1 rounded-full" style={{ background: "#1C1729" }}>
                <div className="h-1 rounded-full" style={{ width: `${(r.nota / 1000) * 100}%`, background: scoreColor(r.nota) }} />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const PLANOS = [
  {
    id: "free", nome: "Gratuito", preco: "R$ 0", periodo: "/mês", creditos: 3,
    cor: "#9D94AC", current: false,
    features: ["3 correções por mês", "Nota por competência", "Feedback básico", "Histórico dos últimos 10"],
  },
  {
    id: "pro", nome: "Pro", preco: "R$ 29,90", periodo: "/mês", creditos: 20,
    cor: "#8B5CF6", current: true,
    features: ["20 correções por mês", "Feedback completo com evidências", "Próximos passos personalizados", "Histórico ilimitado", "Suporte por e-mail"],
  },
  {
    id: "premium", nome: "Premium", preco: "R$ 79,90", periodo: "/mês", creditos: -1,
    cor: "#4ADE80", current: false,
    features: ["Correções ilimitadas", "Tudo do Pro incluso", "Análise de evolução semanal", "Temas exclusivos antecipados", "Suporte prioritário"],
  },
];

function PlanosView() {
  const [tab, setTab] = useState<"planos" | "avulso">("planos");

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 style={{ fontFamily: ff.display, fontSize: "1.55rem", fontWeight: 700, color: "#F7F5FB" }}>Planos</h1>
        <p style={{ fontFamily: ff.body, fontSize: "0.84rem", color: "#9D94AC", marginTop: 2 }}>
          Plano atual: <strong style={{ color: "#8B5CF6" }}>{USER.plano}</strong> · {USER.creditos} créditos restantes
        </p>
      </div>

      <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: "#16121F" }}>
        {[{ id: "planos" as const, label: "Assinaturas" }, { id: "avulso" as const, label: "Créditos avulsos" }].map((t) => (
          <button
            key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-2 rounded-lg text-sm transition-all duration-200"
            style={{ fontFamily: ff.body, color: tab === t.id ? "#F7F5FB" : "#9D94AC", background: tab === t.id ? "#1C1729" : "transparent", fontWeight: tab === t.id ? 500 : 400 }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "planos" && (
        <div className="flex flex-col gap-4">
          {PLANOS.map((p) => (
            <div
              key={p.id} className="p-5 rounded-2xl relative overflow-hidden"
              style={{ background: "#16121F", border: `1px solid ${p.current ? p.cor + "45" : "rgba(139,92,246,0.1)"}`, boxShadow: p.current ? `0 0 24px ${p.cor}12` : "none" }}
            >
              {p.current && (
                <div className="absolute top-4 right-4 px-2.5 py-0.5 rounded-full" style={{ fontFamily: ff.body, fontSize: "0.68rem", fontWeight: 600, color: "#8B5CF6", background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.35)" }}>
                  Plano atual
                </div>
              )}
              <h3 style={{ fontFamily: ff.display, fontSize: "1.3rem", fontWeight: 700, color: "#F7F5FB", marginBottom: 4 }}>{p.nome}</h3>
              <div className="flex items-baseline gap-1 mb-1">
                <span style={{ fontFamily: ff.mono, fontSize: "1.9rem", fontWeight: 700, color: p.cor }}>{p.preco}</span>
                <span style={{ fontFamily: ff.body, fontSize: "0.84rem", color: "#9D94AC" }}>{p.periodo}</span>
              </div>
              <p style={{ fontFamily: ff.mono, fontSize: "0.82rem", color: p.cor, marginBottom: 14 }}>
                {p.creditos === -1 ? "∞ correções" : `${p.creditos} correções/mês`}
              </p>
              <ul className="flex flex-col gap-2 mb-5">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 size={13} style={{ color: p.cor, flexShrink: 0 }} />
                    <span style={{ fontFamily: ff.body, fontSize: "0.82rem", color: "#9D94AC" }}>{f}</span>
                  </li>
                ))}
              </ul>
              {!p.current && (
                <button
                  className="w-full py-2.5 rounded-xl transition-all duration-200 active:scale-[0.98]"
                  style={{
                    fontFamily: ff.display, fontSize: "0.95rem", fontWeight: 600, color: "#F7F5FB",
                    background: p.id === "premium" ? "linear-gradient(135deg, #166534, #4ADE80)" : p.id === "free" ? "#1C1729" : "linear-gradient(135deg, #5B21B6, #8B5CF6)",
                  }}
                >
                  {p.id === "free" ? "Fazer downgrade" : "Assinar agora"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "avulso" && (
        <div className="flex flex-col gap-3">
          <p style={{ fontFamily: ff.body, fontSize: "0.84rem", color: "#9D94AC", marginBottom: 4 }}>
            Compre créditos extras sem assinar um plano. Não expiram.
          </p>
          {[
            { qtd: 1, preco: "R$ 4,90", popular: false, economia: null },
            { qtd: 5, preco: "R$ 19,90", popular: false, economia: "Economize R$ 4,60" },
            { qtd: 10, preco: "R$ 34,90", popular: true, economia: "Economize R$ 14,10" },
            { qtd: 20, preco: "R$ 59,90", popular: false, economia: "Economize R$ 38,10" },
          ].map((pack) => (
            <div
              key={pack.qtd}
              className="flex items-center justify-between p-4 rounded-xl"
              style={{ background: "#16121F", border: `1px solid ${pack.popular ? "rgba(139,92,246,0.4)" : "rgba(139,92,246,0.1)"}` }}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: ff.display, fontSize: "1.05rem", fontWeight: 600, color: "#F7F5FB" }}>
                    {pack.qtd} crédito{pack.qtd > 1 ? "s" : ""}
                  </span>
                  {pack.popular && (
                    <span className="px-2 py-0.5 rounded-full" style={{ fontFamily: ff.body, fontSize: "0.62rem", fontWeight: 700, color: "#8B5CF6", background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
                      Mais popular
                    </span>
                  )}
                </div>
                {pack.economia && (
                  <p style={{ fontFamily: ff.body, fontSize: "0.72rem", color: "#4ADE80", marginTop: 2 }}>{pack.economia}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span style={{ fontFamily: ff.mono, fontSize: "1rem", fontWeight: 700, color: "#F7F5FB" }}>{pack.preco}</span>
                <button
                  className="px-3.5 py-1.5 rounded-lg active:scale-95 transition-transform"
                  style={{ fontFamily: ff.display, fontSize: "0.84rem", fontWeight: 600, color: "#F7F5FB", background: "linear-gradient(135deg, #5B21B6, #8B5CF6)" }}
                >
                  Comprar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PerfilView({ onNav }: { onNav: (v: View) => void }) {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6 p-4 rounded-2xl" style={{ background: "#16121F", border: "1px solid rgba(139,92,246,0.15)" }}>
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(145deg, #5B21B6, #8B5CF6)", fontFamily: ff.display, fontSize: "1.7rem", fontWeight: 700, color: "#F7F5FB" }}
        >
          {USER.iniciais}
        </div>
        <div>
          <h2 style={{ fontFamily: ff.display, fontSize: "1.2rem", fontWeight: 600, color: "#F7F5FB" }}>{USER.nome}</h2>
          <p style={{ fontFamily: ff.body, fontSize: "0.8rem", color: "#9D94AC" }}>{USER.email}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <Crown size={12} style={{ color: "#8B5CF6" }} />
            <span style={{ fontFamily: ff.body, fontSize: "0.74rem", color: "#8B5CF6" }}>Plano {USER.plano}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { label: "Redações enviadas", value: USER.totalRedacoes, Icon: FileText },
          { label: "Nota média", value: `${USER.mediaNota} pts`, Icon: TrendingUp },
          { label: "Melhor nota", value: "840 pts", Icon: Trophy },
          { label: "Créditos restantes", value: USER.creditos, Icon: Zap },
        ].map((s) => (
          <div key={s.label} className="p-3 rounded-xl" style={{ background: "#16121F", border: "1px solid rgba(139,92,246,0.1)" }}>
            <s.Icon size={14} style={{ color: "#8B5CF6", marginBottom: 6 }} />
            <div style={{ fontFamily: ff.mono, fontSize: "1.2rem", fontWeight: 700, color: "#F7F5FB", lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontFamily: ff.body, fontSize: "0.7rem", color: "#9D94AC", marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 mb-6">
        {[
          { Icon: CreditCard, label: "Planos e créditos", action: () => onNav("planos") },
          { Icon: Bell, label: "Notificações", action: () => {} },
          { Icon: Settings, label: "Configurações da conta", action: () => {} },
          { Icon: Shield, label: "Painel Admin", action: () => onNav("admin"), admin: true },
        ]
          .filter((item) => !item.admin || USER.isAdmin)
          .map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="flex items-center justify-between p-4 rounded-xl transition-all duration-200"
              style={{ background: "#16121F", border: "1px solid rgba(139,92,246,0.1)" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.28)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.1)")}
            >
              <div className="flex items-center gap-3">
                <item.Icon size={16} style={{ color: item.label === "Painel Admin" ? "#8B5CF6" : "#9D94AC" }} />
                <span style={{ fontFamily: ff.body, fontSize: "0.9rem", color: "#F7F5FB" }}>{item.label}</span>
              </div>
              <ChevronRight size={15} style={{ color: "#9D94AC" }} />
            </button>
          ))}
      </div>

    </div>
  );
}

function AdminView({ onNav }: { onNav: (v: View) => void }) {
  const [unlocked, setUnlocked] = useState(true);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<"stats" | "usuarios" | "redacoes">("stats");

  function handleMfa(e: FormEvent) {
    e.preventDefault();
    if (code === "123456") {
      setUnlocked(true);
    } else {
      setError(true);
      setTimeout(() => setError(false), 3000);
    }
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: "#08070C" }}>
        <div className="w-full max-w-xs">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.28)" }}>
              <Lock size={28} style={{ color: "#8B5CF6" }} />
            </div>
          </div>
          <h2 style={{ fontFamily: ff.display, fontSize: "1.45rem", fontWeight: 700, color: "#F7F5FB", textAlign: "center", marginBottom: 4 }}>
            Área Restrita
          </h2>
          <p style={{ fontFamily: ff.body, fontSize: "0.84rem", color: "#9D94AC", textAlign: "center", marginBottom: 6 }}>
            Requer privilégio ADMIN
          </p>
          <p style={{ fontFamily: ff.body, fontSize: "0.78rem", color: "#9D94AC", textAlign: "center", marginBottom: 24 }}>
            Confirme sua identidade com o código de autenticação em dois fatores.
          </p>

          <form onSubmit={handleMfa} className="flex flex-col gap-4">
            <div>
              <label style={{ fontFamily: ff.body, fontSize: "0.78rem", color: "#9D94AC", display: "block", marginBottom: 6 }}>
                Código MFA (6 dígitos)
              </label>
              <input
                type="text" maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000 000"
                className="w-full text-center py-3.5 rounded-xl outline-none tracking-widest"
                style={{
                  fontFamily: ff.mono, fontSize: "1.6rem", fontWeight: 600,
                  background: "#16121F", color: "#F7F5FB", letterSpacing: "0.3em",
                  border: `1px solid ${error ? "rgba(248,113,113,0.5)" : "rgba(139,92,246,0.25)"}`,
                  transition: "border-color 0.2s",
                }}
              />
              {error && (
                <p style={{ fontFamily: ff.body, fontSize: "0.74rem", color: "#F87171", textAlign: "center", marginTop: 6 }}>
                  Código incorreto — use <strong style={{ fontFamily: ff.mono }}>123456</strong> para demo
                </p>
              )}
            </div>
            <button
              type="submit"
              className="w-full py-3 rounded-xl transition-all duration-200 active:scale-[0.98]"
              style={{ fontFamily: ff.display, fontSize: "1rem", fontWeight: 600, color: "#F7F5FB", background: "linear-gradient(135deg, #5B21B6, #8B5CF6)" }}
            >
              Verificar código
            </button>
          </form>

          <button onClick={() => onNav("perfil")} className="w-full mt-5 text-center" style={{ fontFamily: ff.body, fontSize: "0.8rem", color: "#9D94AC" }}>
            ← Voltar ao perfil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => onNav("perfil")} className="p-2 rounded-xl" style={{ background: "#16121F", color: "#9D94AC", border: "1px solid rgba(139,92,246,0.1)" }}>
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 style={{ fontFamily: ff.display, fontSize: "1.4rem", fontWeight: 700, color: "#F7F5FB" }}>Painel Admin</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4ADE80" }} />
            <span style={{ fontFamily: ff.mono, fontSize: "0.68rem", color: "#4ADE80" }}>Modo de demonstração · {USER.email}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: "#16121F" }}>
        {(
          [
            { id: "stats" as "stats", label: "Métricas", Icon: BarChart3 },
            { id: "usuarios" as "usuarios", label: "Usuários", Icon: Users },
            { id: "redacoes" as "redacoes", label: "Redações", Icon: FileText },
          ]
        ).map((t) => (
          <button
            key={t.id} onClick={() => setActiveTab(t.id)}
            className="flex-1 py-2 rounded-lg text-sm transition-all duration-200 flex items-center justify-center gap-1.5"
            style={{ fontFamily: ff.body, color: activeTab === t.id ? "#F7F5FB" : "#9D94AC", background: activeTab === t.id ? "#1C1729" : "transparent", fontWeight: activeTab === t.id ? 500 : 400 }}
          >
            <t.Icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {activeTab === "stats" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Usuários cadastrados", value: "1.847", delta: "+12% na semana", cor: "#8B5CF6" },
            { label: "Redações hoje", value: "243", delta: "+8% vs. ontem", cor: "#4ADE80" },
            { label: "Nota média global", value: "712 pts", delta: "+3% no mês", cor: "#F6A35B" },
            { label: "Receita MRR", value: "R$ 38.420", delta: "+21% no mês", cor: "#A78BFA" },
          ].map((m) => (
            <div key={m.label} className="p-4 rounded-xl" style={{ background: "#16121F", border: "1px solid rgba(139,92,246,0.1)" }}>
              <div style={{ fontFamily: ff.mono, fontSize: "1.45rem", fontWeight: 700, color: m.cor, marginBottom: 4, lineHeight: 1 }}>{m.value}</div>
              <div style={{ fontFamily: ff.body, fontSize: "0.73rem", color: "#9D94AC", marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontFamily: ff.body, fontSize: "0.7rem", color: "#4ADE80" }}>{m.delta}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "usuarios" && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(139,92,246,0.12)" }}>
          <div className="grid grid-cols-4 px-4 py-3" style={{ background: "#1C1729", fontFamily: ff.body, fontSize: "0.72rem", color: "#9D94AC", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <span>Nome</span><span>Plano</span><span>Redações</span><span>Último acesso</span>
          </div>
          {[
            { nome: "Maria Oliveira", plano: "Pro", red: 5, acesso: "Agora" },
            { nome: "João Silva", plano: "Premium", red: 23, acesso: "Ontem" },
            { nome: "Ana Costa", plano: "Gratuito", red: 2, acesso: "3 dias atrás" },
            { nome: "Carlos Lima", plano: "Pro", red: 11, acesso: "Hoje" },
            { nome: "Beatriz Santos", plano: "Premium", red: 34, acesso: "Hoje" },
            { nome: "Lucas Ferreira", plano: "Gratuito", red: 1, acesso: "5 dias atrás" },
          ].map((u, i) => (
            <div
              key={i} className="grid grid-cols-4 px-4 py-3 border-t items-center"
              style={{ fontFamily: ff.body, fontSize: "0.83rem", color: "#F7F5FB", borderColor: "rgba(139,92,246,0.08)" }}
            >
              <span>{u.nome}</span>
              <span style={{ color: u.plano === "Premium" ? "#4ADE80" : u.plano === "Pro" ? "#8B5CF6" : "#9D94AC" }}>{u.plano}</span>
              <span style={{ fontFamily: ff.mono }}>{u.red}</span>
              <span style={{ color: "#9D94AC" }}>{u.acesso}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === "redacoes" && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(139,92,246,0.12)" }}>
          <div className="grid grid-cols-4 px-4 py-3" style={{ background: "#1C1729", fontFamily: ff.body, fontSize: "0.72rem", color: "#9D94AC", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <span className="col-span-2">Tema</span><span>Nota</span><span>Data</span>
          </div>
          {[
            { tema: "Desafios para a valorização de comunidades e povos tradicionais", nota: 840, data: "15/08/2025" },
            { tema: "O estigma associado às doenças mentais na sociedade brasileira", nota: 720, data: "15/08/2025" },
            { tema: "Invisibilidade e registro civil: acesso à cidadania no Brasil", nota: 960, data: "14/08/2025" },
            { tema: "O impacto da Inteligência Artificial no mercado de trabalho", nota: 680, data: "14/08/2025" },
            { tema: "A democratização do acesso à internet no Brasil", nota: 800, data: "13/08/2025" },
          ].map((r, i) => (
            <div
              key={i} className="grid grid-cols-4 px-4 py-3 border-t items-center"
              style={{ fontFamily: ff.body, fontSize: "0.83rem", color: "#F7F5FB", borderColor: "rgba(139,92,246,0.08)" }}
            >
              <span className="col-span-2 pr-4 truncate">{r.tema}</span>
              <span style={{ fontFamily: ff.mono, fontWeight: 700, color: scoreColor(r.nota) }}>{r.nota}</span>
              <span style={{ color: "#9D94AC" }}>{r.data}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<View>("dashboard");

  function navigate(v: View) {
    setView(v);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const hideBottomNav = view === "processando" || view === "admin";

  return (
    <div style={{ background: "#08070C", minHeight: "100dvh" }}>
      <TopNav view={view} onNav={navigate} credits={USER.creditos} />
      <main className="md:pt-16" style={{ paddingBottom: hideBottomNav ? 0 : undefined }}>
        <div className={hideBottomNav ? "" : "pb-24 md:pb-6"}>
          {view === "dashboard" && <DashboardView onNav={navigate} />}
          {view === "nova-redacao" && <NovaRedacaoView onNav={navigate} />}
          {view === "processando" && <ProcessandoView onNav={navigate} />}
          {view === "resultado" && <ResultadoView onNav={navigate} />}
          {view === "historico" && <HistoricoView onNav={navigate} />}
          {view === "planos" && <PlanosView />}
          {view === "perfil" && <PerfilView onNav={navigate} />}
          {view === "admin" && <AdminView onNav={navigate} />}
        </div>
      </main>
      {!hideBottomNav && <BottomNav view={view} onNav={navigate} />}
    </div>
  );
}
