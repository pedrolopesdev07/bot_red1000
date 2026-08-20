import { useState, useEffect, useCallback, useRef, type FormEvent } from "react";
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

interface ApiUser { id: number; created_at: string; username: string | null; email: string | null; role: string; plan: string; bonus_credits: number; reminders_enabled: boolean; csrf_token: string; subscription_status: string }
interface ApiUsage { plan: string; limit: number | string; used: number; remaining: number | string; next_credit_at: string | null; bonus_credits: number }
interface ApiAnalysisSummary { id: string; status: string; created_at: string; completed_at: string | null; total_score: number | null; summary: string | null }
interface ApiAnalysisDetail extends ApiAnalysisSummary { text: string | null; competency_scores: Array<number | null>; feedback: Record<string, any> | null; detailed_feedback: boolean; topic: string | null }
interface ApiPlan { name: string; daily_limit: number; price_cents: number; detailed_feedback: boolean; unlimited: boolean; gemini_daily_limit: number | null }
interface ApiCreditTransaction { id: string; amount: number; balance_after: number; reason: string; description: string; created_at: string }

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

async function api<T>(path: string, options: RequestInit = {}, csrfToken?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: "include" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail || `Erro ${response.status} ao acessar a API`);
  }
  return response.json() as Promise<T>;
}

function displayIdentity(user: ApiUser | null) {
  const email = user?.email || user?.username || "Conta local";
  const local = user?.username || (email.includes("@") ? email.split("@")[0] : email);
  const name = local.replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
  return { name, email, initials };
}

function dailyRanking(analyses: ApiAnalysis[], accountCreatedAt: string, now = Date.now()) {
  const cycleDuration = 7 * 86_400_000;
  const createdAt = new Date(accountCreatedAt).getTime();
  const validCreatedAt = Number.isFinite(createdAt) ? createdAt : now;
  const cycleNumber = Math.max(0, Math.floor((now - validCreatedAt) / cycleDuration));
  const cycleStart = validCreatedAt + cycleNumber * cycleDuration;
  const cycleEndsAt = cycleStart + cycleDuration;
  const day = Math.floor(cycleStart / 86_400_000);
  const pool = ["Lara M.", "Rafael S.", "Bia Costa", "Lucas P.", "Ana Clara", "João V.", "Cecília R.", "Davi N.", "Yasmin A.", "Pedro H.", "Luiza F.", "Caio T."];
  const seeded = pool.map((name, index) => ({ name, key: Math.sin((day + 1) * 9301 + index * 49297) }));
  const names = seeded.sort((a, b) => a.key - b.key).slice(0, 7).map((item) => item.name);
  const leaders = names.slice(0, 3).map((name, index) => ({
    name, pos: index + 1, score: 347 - index * 47 + Math.abs((day + index * 5) % 11), essays: 24 - index * 3 + Math.abs((day + index * 5) % 4), current: false,
  }));
  const others = names.slice(3).map((name, index) => ({
    name, pos: index + 4, score: 193 - index * 31 + Math.abs((day + index * 3) % 13), essays: 14 - index * 2 + Math.abs((day + index * 3) % 3), current: false,
  }));
  const completed = analyses.filter((item) => item.status === "COMPLETED" && item.total_score !== null && new Date(item.created_at).getTime() >= cycleStart);
  const activeDays = new Set(completed.map((item) => new Date(item.created_at).toISOString().slice(0, 10))).size;
  const rankingScore = activeDays >= 7
    ? Math.max(0, completed.reduce((total, item) => total + (Number(item.total_score) === 1000 ? 15 : Number(item.total_score) < 600 ? -30 : 0), 0))
    : 0;
  const activityGain = Math.floor(rankingScore / 15) * 45;
  const startingPosition = 1100 + Math.abs((day * 137) % 401);
  const userPosition = Math.max(800, Math.min(1500, startingPosition - activityGain));
  const user = { name: "Você", pos: userPosition, score: rankingScore, essays: completed.length, current: true };
  return { leaders, others, user, activeDays, cycleEndsAt };
}

function detailCompetencies(detail: ApiAnalysisDetail | null): Competencia[] {
  if (!detail) return [];
  return [1, 2, 3, 4, 5].map((number) => {
    const value = detail.feedback?.[`competencia_${number}`] || {};
    const evidencias: Evidencia[] = (value.evidence || []).map((entry: string | { text?: string; texto?: string; tipo?: string }) => {
      const texto = typeof entry === "string" ? entry : entry.text || entry.texto || "";
      const legacyWeakness = /\b(ausência|erro|desvio|insufici|problema|falha|inadequ|repetitiv|sem sentido|não (?:há|apresenta|possui)|falta)\b/i.test(texto);
      const isWeakness = typeof entry === "string" ? legacyWeakness : entry.tipo === "ponto_fraco";
      return { texto, tipo: isWeakness ? "negativo" : "positivo" };
    }).filter((entry: Evidencia) => entry.texto);
    return {
      id: number, sigla: `C${number}`, nome: ["Domínio da língua formal", "Compreensão da proposta", "Seleção de argumentos", "Coesão e coerência", "Proposta de intervenção"][number - 1],
      nota: Number(value.score ?? detail.competency_scores[number - 1] ?? 0), max: 200,
      justificativa: value.justification || "A nota por competência está disponível. Os detalhes e orientações fazem parte das correções Premium.", positivos: evidencias.filter((item) => item.tipo === "positivo").map((item) => item.texto), negativos: evidencias.filter((item) => item.tipo === "negativo").map((item) => item.texto),
      melhoria: (value.improvements || []).join(" "),
      evidencias,
    };
  });
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

const HOME_CAROUSEL = [
  "A nota que você quer começa no rascunho que você ainda não escreveu.",
  "Treine nesta semana e dispute 3 meses de Netflix + 1 mês de CapCut Pro!",
  "Quem treina hoje chega à prova com argumento, repertório e confiança.",
  "Chegue ao 2º lugar e ganhe 3 meses de Disney+.",
  "Texto perfeito não nasce pronto. Nasce escrito, corrigido e reescrito.",
  "O 3º lugar da semana leva 1 mês de Crunchyroll.",
  "O top 10 não espera inspiração: escreva, envie e melhore toda semana.",
];

const RANKING_PRIZES = [
  { place: "1º lugar", title: "Netflix + CapCut Pro", detail: "3 meses de Netflix + 1 mês de CapCut Pro", medal: "🥇", logos: [{ name: "Netflix", kind: "netflix", mark: "N" }, { name: "CapCut Pro", kind: "capcut", mark: "✂" }] },
  { place: "2º lugar", title: "Disney+", detail: "3 meses de Disney+", medal: "🥈", logos: [{ name: "Disney+", kind: "disney", mark: "Disney+" }] },
  { place: "3º lugar", title: "Crunchyroll", detail: "1 mês de Crunchyroll", medal: "🥉", logos: [{ name: "Crunchyroll", kind: "crunchyroll", mark: "◉" }] },
];

const HOME_MILESTONES = [
  { min: 80, label: "Aquecimento", reward: "+20 XP" },
  { min: 180, label: "Ritmo de prova", reward: "+40 XP" },
  { min: 320, label: "Turbo de envio", reward: "+80 XP" },
];

const HOME_TOPICS = [
  TEMA_SEMANA,
  { titulo: "Caminhos para combater a desinformação entre os jovens brasileiros", prazo: "Livre", area: "Tecnologia e sociedade" },
  { titulo: "Desafios para garantir a saúde mental dos estudantes no Brasil", prazo: "Livre", area: "Saúde e educação" },
  { titulo: "O impacto da inteligência artificial na formação profissional", prazo: "Livre", area: "Trabalho e tecnologia" },
  { titulo: "Estratégias para ampliar o acesso à cultura nas periferias brasileiras", prazo: "Livre", area: "Cultura e cidadania" },
];

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
      style={{ background: "rgba(255,122,69,0.12)", border: "1px solid rgba(255,122,69,0.22)" }}
    >
      <Zap size={13} style={{ color: "#FF7A45" }} />
      <span style={{ fontFamily: ff.mono, fontSize: "0.8rem", fontWeight: 600, color: "#2F2341" }}>{credits}</span>
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
        background: "linear-gradient(135deg, #FFB46C, #FF7A45)",
        fontFamily: ff.display, fontSize: size * 0.36, fontWeight: 700, color: "#2F2341",
        boxShadow: "0 12px 24px rgba(255,122,69,0.2)",
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

function TopNav({ view, onNav, onLogout, credits, initials, username }: { view: View; onNav: (v: View) => void; onLogout: () => void; credits: number; initials: string; username: string }) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const links: { id: View; label: string }[] = [
    { id: "dashboard", label: "Início" },
    { id: "historico", label: "Histórico" },
    { id: "planos", label: "Planos" },
  ];

  useEffect(() => {
    if (!profileMenuOpen) return;
    function closeMenu(event: MouseEvent) {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setProfileMenuOpen(false);
    }
    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileMenuOpen]);

  return (
    <header
      className="hidden md:flex fixed top-0 left-0 right-0 z-50 items-center justify-between px-6 lg:px-8 h-16"
      style={{ background: "rgba(255,249,241,0.9)", borderBottom: "1px solid rgba(255,122,69,0.12)", backdropFilter: "blur(14px)" }}
    >
      <button onClick={() => onNav("dashboard")} className="flex items-center gap-2.5 shrink-0">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #FFB46C, #FF7A45)", boxShadow: "0 12px 22px rgba(255,122,69,0.22)" }}
        >
          <span style={{ fontFamily: ff.display, fontSize: "1.1rem", fontWeight: 700, color: "#2F2341" }}>R</span>
        </div>
        <span style={{ fontFamily: ff.display, fontSize: "1.25rem", fontWeight: 700, color: "#2F2341", letterSpacing: "-0.01em" }}>
          Reda<span style={{ color: "#FF7A45" }}>1000</span>IA
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
              color: view === l.id ? "#2F2341" : "#7B6D8E",
              background: view === l.id ? "rgba(255,122,69,0.14)" : "transparent",
              fontWeight: view === l.id ? 500 : 400,
            }}
          >
            {l.label}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <CreditBadge credits={credits} />
        <div ref={profileMenuRef} className="relative">
          <button
            type="button" aria-label="Abrir menu do perfil" aria-haspopup="menu" aria-expanded={profileMenuOpen}
            onClick={() => setProfileMenuOpen((open) => !open)}
            className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2"
          >
            <UserAvatar iniciais={initials} />
          </button>
          {profileMenuOpen && (
            <div role="menu" className="absolute right-0 top-[calc(100%+.7rem)] w-56 overflow-hidden rounded-2xl bg-white p-2" style={{ border: "1px solid rgba(109,40,217,.14)", boxShadow: "0 18px 45px rgba(47,35,65,.18)" }}>
              <div className="px-3 py-2 mb-1 border-b" style={{ borderColor: "rgba(109,40,217,.1)" }}>
                <p className="truncate text-sm font-bold" style={{ color: "#2F2341" }}>{username}</p>
                <p className="text-xs" style={{ color: "#7B6D8E" }}>Minha conta</p>
              </div>
              <button role="menuitem" onClick={() => { setProfileMenuOpen(false); onNav("perfil"); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-purple-50" style={{ color: "#4C1D95" }}>
                <User size={16} /> Ver perfil
              </button>
              <button role="menuitem" onClick={() => { setProfileMenuOpen(false); onLogout(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-red-50" style={{ color: "#DC2626" }}>
                <LogOut size={16} /> Sair
              </button>
            </div>
          )}
        </div>
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
    <nav className="core-bottom-nav md:hidden" aria-label="Navegação principal">
      {tabs.map((tab) =>
        tab.id === "nova-redacao" ? (
          <button
            key={tab.id}
            type="button"
            aria-label="Começar nova redação"
            aria-current={view === tab.id ? "page" : undefined}
            onClick={() => onNav(tab.id)}
            className="core-bottom-nav__item core-bottom-nav__item--create"
          >
            <span className="core-bottom-nav__create-icon">
              <tab.icon size={23} strokeWidth={2.5} />
            </span>
            <span className="core-bottom-nav__label">
              {tab.label}
            </span>
          </button>
        ) : (
          <button
            key={tab.id}
            type="button"
            aria-current={view === tab.id ? "page" : undefined}
            onClick={() => onNav(tab.id)}
            className={`core-bottom-nav__item${view === tab.id ? " is-active" : ""}`}
          >
            <span className="core-bottom-nav__icon"><tab.icon size={21} strokeWidth={2.25} /></span>
            <span className="core-bottom-nav__label">
              {tab.label}
            </span>
          </button>
        )
      )}
    </nav>
  );
}

// ─── Views ────────────────────────────────────────────────────────────────────

function LoginView({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleCredentials(e: FormEvent) {
    e.preventDefault();
    if (mode === "register" && password !== passwordConfirmation) {
      setMessage("As senhas não coincidem");
      return;
    }
    try {
      setLoading(true); setMessage("");
      await api(`/api/v1/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST", body: JSON.stringify({ username, password }),
      });
      await onAuthenticated();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Não foi possível acessar sua conta");
    } finally { setLoading(false); }
  }

  const inputStyle = { fontFamily: ff.body, fontSize: "1rem", background: "#16121F", color: "#F7F5FB", border: "1px solid rgba(139,92,246,0.25)" };
  return <div className="auth-page min-h-screen flex items-center justify-center p-6" style={{ background: "#08070C" }}>
    <div className="auth-shell w-full max-w-sm">
      <div className="auth-heading flex flex-col items-center mb-8">
        <div className="auth-logo w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: "linear-gradient(145deg, #5B21B6, #8B5CF6)", boxShadow: "0 0 32px rgba(139,92,246,.45)" }}>
          <span style={{ fontFamily: ff.display, fontSize: "2.1rem", fontWeight: 700, color: "#fff" }}>R</span>
        </div>
        <h1 className="auth-title" style={{ fontFamily: ff.display, fontSize: "2.2rem", fontWeight: 700, color: "#F7F5FB" }}>Reda<span>1000</span>IA</h1>
        <p className="auth-subtitle" style={{ color: "#9D94AC", marginTop: 8 }}>{mode === "login" ? "Entre na sua conta" : "Crie sua conta gratuita"}</p>
      </div>
      <form onSubmit={handleCredentials} className="auth-card flex flex-col gap-4 p-5 rounded-2xl" style={{ background: "#100D18", border: "1px solid rgba(139,92,246,.2)" }}>
        <label className="auth-label" style={{ color: "#C9C1D5", fontSize: ".82rem" }}>Nome de usuário
          <div className="relative mt-1.5"><User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#9D94AC" }} />
            <input autoComplete="username" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_.\-]+" value={username} onChange={(e) => setUsername(e.target.value)} className="auth-input w-full pl-10 pr-4 py-3 rounded-xl outline-none" style={inputStyle} placeholder="seu_usuario" />
          </div>
        </label>
        <label className="auth-label" style={{ color: "#C9C1D5", fontSize: ".82rem" }}>Senha
          <div className="relative mt-1.5"><Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#9D94AC" }} />
            <input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} className="auth-input w-full pl-10 pr-4 py-3 rounded-xl outline-none" style={inputStyle} placeholder="Mínimo de 8 caracteres" />
          </div>
        </label>
        {mode === "register" && <label className="auth-label" style={{ color: "#C9C1D5", fontSize: ".82rem" }}>Confirmar senha
          <div className="relative mt-1.5"><Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#9D94AC" }} />
            <input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} className="auth-input w-full pl-10 pr-4 py-3 rounded-xl outline-none" style={inputStyle} placeholder="Digite a senha novamente" />
          </div>
        </label>}
        {message && <p role="alert" style={{ color: "#F87171", fontSize: ".82rem" }}>{message}</p>}
        <button disabled={loading} className="auth-submit w-full py-3 rounded-xl flex justify-center gap-2" style={{ color: "#fff", fontWeight: 700, background: "linear-gradient(135deg,#5B21B6,#8B5CF6)", opacity: loading ? .7 : 1 }}>
          {loading ? <RefreshCw size={17} className="animate-spin" /> : mode === "login" ? "Entrar" : "Criar conta"}
        </button>
        <button className="auth-switch" type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setPasswordConfirmation(""); setMessage(""); }} style={{ color: "#A78BFA", fontSize: ".82rem" }}>
          {mode === "login" ? "Ainda não tenho conta" : "Já tenho uma conta"}
        </button>
      </form>
    </div>
  </div>;
}

function LegacyLoginView({ onLogin }: { onLogin: () => void }) {
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
    <div className="app-page p-4 md:p-6 lg:p-8 w-full max-w-none mx-auto">
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

function DashboardV2({ onNav }: { onNav: (v: View) => void }) {
  const [homeText, setHomeText] = useState("");
  const canSubmit = homeText.trim().length >= 100;
  const ranking = [
    { pos: 15, name: "Lara M.", score: 920 },
    { pos: 16, name: "Rafael S.", score: 900 },
    { pos: 17, name: "Bia Costa", score: 880 },
    { pos: 18, name: "Maria Oliveira", score: 840, current: true },
    { pos: 19, name: "Lucas P.", score: 820 },
  ];

  return (
    <div className="home-page app-page">
      <div className="home-welcome">
        <h1>Olá, Maria 👋</h1>
        <p>
          Você tem <strong>{USER.creditos} créditos</strong> disponíveis no plano <strong>{USER.plano}</strong>.
        </p>
      </div>

      <div className="home-layout">
        <section className="home-panel home-writing-panel">
          <div className="home-editor-header">
            <div>
              <div className="home-eyebrow"><PenLine size={19} /> COMECE SUA REDAÇÃO</div>
              <h2>Escreva agora. Evolua a cada texto.</h2>
              <p>Cole ou escreva sua redação e receba uma correção completa em segundos.</p>
            </div>
            <CreditBadge credits={USER.creditos} />
          </div>

          <div className="home-topic">
            <div className="home-eyebrow"><Sparkles size={17} /> TEMA DA SEMANA</div>
            <p>{TEMA_SEMANA.titulo}</p>
            <div className="home-topic-meta">
              <span>Até {TEMA_SEMANA.prazo}</span>
              <span>{TEMA_SEMANA.area}</span>
            </div>
          </div>

          <textarea
            className="home-textarea"
            value={homeText}
            onChange={(event) => setHomeText(event.target.value)}
            placeholder="Comece pela introdução: apresente o tema e defenda sua tese..."
            aria-label="Escreva sua redação"
          />

          <div className="home-editor-footer">
            <span className="home-counter">
              {homeText.length} caracteres
              {homeText.length < 100 && ` · faltam ${100 - homeText.length}`}
            </span>
            <button
              onClick={() => canSubmit && onNav("processando")}
              className={`home-writing-cta ${canSubmit ? "is-ready" : ""}`}
              aria-disabled={!canSubmit}
            >
              <span className="home-cta-shine" />
              <Sparkles size={20} />
              <span>{canSubmit ? "Corrigir minha redação" : "Escreva para liberar a correção"}</span>
              <small>1 crédito</small>
            </button>
          </div>
        </section>

        <aside className="home-sidebar">
          <section className="home-panel home-ranking">
            <div className="home-ranking-header">
              <div>
                <span className="home-eyebrow">RANKING SEMANAL</span>
                <h3>Suba para o top 10</h3>
              </div>
              <Trophy size={27} />
            </div>
            <div className="home-ranking-list">
              {ranking.map((item) => (
                <div key={item.pos} className={`home-ranking-row ${item.current ? "is-current" : ""}`}>
                  <span className="home-position">{item.pos}º</span>
                  <span className="home-rank-avatar">{item.name[0]}</span>
                  <span className="home-rank-name">{item.name}{item.current && " (você)"}</span>
                  <strong>{item.score}</strong>
                </div>
              ))}
            </div>
            <div className="home-rank-nudge">
              <TrendingUp size={18} />
              Uma nota acima de 880 coloca você no top 17.
            </div>
          </section>

          <div className="home-stats">
            {[
              { label: "Redações", value: USER.totalRedacoes, Icon: FileText },
              { label: "Média", value: USER.mediaNota, Icon: TrendingUp },
              { label: "Posição", value: "#18", Icon: Crown },
            ].map((item) => (
              <div className="home-stat" key={item.label}>
                <item.Icon size={19} />
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <section className="home-panel home-recents">
            <div className="home-recents-header">
              <h3>Redações recentes</h3>
              <button onClick={() => onNav("historico")}>Ver tudo <ChevronRight size={16} /></button>
            </div>
            {HISTORICO.slice(0, 2).map((item) => (
              <button className="home-recent-row" key={item.id} onClick={() => onNav("resultado")}>
                <span>{item.tema}</span>
                <strong style={{ color: scoreColor(item.nota) }}>{item.nota}</strong>
              </button>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}

function DashboardV3({ onNav, usage, analyses, theme, accountCreatedAt, onSubmit, onSelectAnalysis }: { onNav: (v: View) => void; usage: ApiUsage | null; analyses: ApiAnalysisSummary[]; theme: string; accountCreatedAt: string; onSubmit: (text: string, topicId: number | null, customTopic: string | null) => Promise<void>; onSelectAnalysis: (id: string) => void }) {
  const [homeText, setHomeText] = useState("");
  const [messageIndex, setMessageIndex] = useState(0);
  const [rankingNow, setRankingNow] = useState(Date.now());
  const [writingMode, setWritingMode] = useState<"write" | "paste">("write");
  const [topicMode, setTopicMode] = useState<"choose" | "random">("choose");
  const [customTopic, setCustomTopic] = useState("");
  const [topicError, setTopicError] = useState(false);
  const topicInputRef = useRef<HTMLInputElement>(null);
  const [randomTopic, setRandomTopic] = useState<{ id: number | null; title: string; category: string } | null>(null);
  const selectedTopic = topicMode === "choose"
    ? { titulo: customTopic.trim(), prazo: "Livre", area: "Tema personalizado" }
    : { titulo: randomTopic?.title || theme, prazo: "Livre", area: randomTopic?.category || "Tema da semana" };
  const charCount = homeText.trim().length;
  const canSubmit = charCount >= 100;
  const gameProgress = Math.min((charCount / 320) * 100, 100);
  const unlockedMilestones = HOME_MILESTONES.filter((item) => charCount >= item.min).length;
  const completed = analyses.filter((item) => item.status === "COMPLETED" && item.total_score !== null);
  const average = completed.length ? Math.round(completed.reduce((sum, item) => sum + Number(item.total_score), 0) / completed.length) : 0;
  const ranking = dailyRanking(analyses, accountCreatedAt, rankingNow);
  const countdownSeconds = Math.max(0, Math.ceil((ranking.cycleEndsAt - rankingNow) / 1000));
  const countdownDays = Math.floor(countdownSeconds / 86400);
  const countdownHours = Math.floor((countdownSeconds % 86400) / 3600);
  const countdownMinutes = Math.floor((countdownSeconds % 3600) / 60);
  const countdownRemainingSeconds = countdownSeconds % 60;
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % HOME_CAROUSEL.length);
    }, 7000);

    return () => window.clearInterval(intervalId);
  }, []);
  useEffect(() => {
    const timerId = window.setInterval(() => setRankingNow(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  function focusWritingArea() {
    const editor = document.querySelector<HTMLTextAreaElement>("#home-writing-input");
    if (!editor) return;

    editor.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => editor.focus({ preventScroll: true }), 450);
  }

  async function drawRandomTopic() {
    setTopicError(false);
    setTopicMode("random");
    try {
      const result = await api<{ id: number | null; theme: string; category: string }>("/api/v1/themes/random");
      setRandomTopic({ id: result.id, title: result.theme, category: result.category });
    } catch {
      setRandomTopic({ id: null, title: theme, category: "Tema da semana" });
    }
  }

  async function submitHomeEssay() {
    if (!canSubmit) return;
    if (!selectedTopic.titulo) {
      setTopicError(true);
      topicInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => topicInputRef.current?.focus({ preventScroll: true }), 450);
      return;
    }
    setTopicError(false);
    await onSubmit(homeText, topicMode === "random" ? randomTopic?.id || null : null, topicMode === "choose" || !randomTopic?.id ? selectedTopic.titulo : null);
  }

  return (
    <div className="home-page app-page">
      <section className="home-motivation" aria-live="polite">
        <img className="home-motivation-art" src="/images/ranking-prizes-banner.png" alt="Top 3 premiado: primeiro lugar Netflix e CapCut Pro, segundo lugar Disney+, terceiro lugar Crunchyroll" />
        <div className="home-motivation-footer">
          <div className="home-banner-copy">
            <span>MOTIVAÇÃO DA VEZ</span>
            <p key={messageIndex}>{HOME_CAROUSEL[messageIndex]}</p>
            <div className="home-carousel-dots" aria-hidden="true">
              {HOME_CAROUSEL.map((_, index) => <i key={index} className={index === messageIndex ? "is-active" : ""} />)}
            </div>
          </div>
          <button onClick={focusWritingArea}>
            Começar agora <ChevronRight size={19} />
          </button>
        </div>
      </section>

      <div className="home-layout">
        <section className="home-panel home-writing-panel">
          <div className="home-editor-header">
            <div>
              <div className="home-eyebrow"><PenLine size={19} /> ESCREVA NO HOME</div>
              <h2>Sua próxima correção pode virar um novo recorde.</h2>
              <p>Abra o texto aqui mesmo, ganhe ritmo e envie assim que sua tese estiver pronta.</p>
            </div>
            <CreditBadge credits={usage?.bonus_credits || 0} />
          </div>

          <div className="home-start-options">
            <div className="home-option-group">
              <span className="home-option-label">Como você quer começar?</span>
              <div className="home-segmented" role="group" aria-label="Modo de escrita">
                <button className={writingMode === "write" ? "is-active" : ""} onClick={() => setWritingMode("write")}>
                  <PenLine size={17} /> Escrever uma nova
                </button>
                <button className={writingMode === "paste" ? "is-active" : ""} onClick={() => setWritingMode("paste")}>
                  <Copy size={17} /> Colar pronta
                </button>
              </div>
            </div>
            <div className="home-option-group">
              <span className="home-option-label">E o tema?</span>
              <div className="home-segmented" role="group" aria-label="Modo de escolha do tema">
                <button className={topicMode === "choose" ? "is-active" : ""} onClick={() => setTopicMode("choose")}>
                  <Target size={17} /> Quero escolher
                </button>
                <button className={topicMode === "random" ? "is-active" : ""} onClick={drawRandomTopic}>
                  <RefreshCw size={17} /> Sortear tema
                </button>
              </div>
            </div>
          </div>

          {topicMode === "choose" && (
            <label className={`home-topic-select ${topicError ? "is-error" : ""}`}>
              <span>Escreva o tema da sua redação</span>
              <input
                ref={topicInputRef}
                value={customTopic}
                onChange={(event) => { setCustomTopic(event.target.value); if (event.target.value.trim()) setTopicError(false); }}
                placeholder="Ex.: Os desafios da inclusão digital no Brasil"
                aria-label="Tema da redação"
                aria-invalid={topicError}
                aria-describedby={topicError ? "home-topic-error" : undefined}
              />
              {topicError && <strong id="home-topic-error" className="home-topic-error" role="alert"><AlertTriangle size={15} /> Escolha ou escreva um tema antes de enviar sua redação.</strong>}
            </label>
          )}

          <div className="home-topic">
            <div className="home-topic-heading">
              <div className="home-eyebrow"><Target size={17} /> {topicMode === "random" ? "TEMA SORTEADO" : "TEMA ESCOLHIDO"}</div>
              {topicMode === "random" && <button onClick={drawRandomTopic}><RefreshCw size={15} /> Sortear outro</button>}
            </div>
            <p className={!selectedTopic.titulo ? "is-placeholder" : ""}>
              {selectedTopic.titulo || "Digite seu tema no campo acima para começar."}
            </p>
            <div className="home-topic-meta">
              <span>{selectedTopic.prazo === "Livre" ? "Sem prazo" : `Até ${selectedTopic.prazo}`}</span>
              <span>{selectedTopic.area}</span>
            </div>
          </div>

          <textarea
            id="home-writing-input"
            className="home-textarea"
            value={homeText}
            onChange={(event) => setHomeText(event.target.value)}
            placeholder={writingMode === "write"
              ? "Comece pela introdução: apresente o tema, assuma sua tese e siga sem esperar o texto perfeito."
              : "Cole aqui a redação que você já escreveu para receber a correção completa."}
            aria-label="Escreva sua redação"
          />

          <div className="home-editor-footer home-editor-footer-direct">
            <div className="home-counter-wrap">
              <span className="home-counter">
                {homeText.length} caracteres
                {homeText.length < 100 && ` · faltam ${100 - homeText.length}`}
              </span>
              <span className="home-live-proof">Agora mesmo há alunos recebendo nota enquanto você escreve.</span>
            </div>
            <button
              onClick={submitHomeEssay}
              className={`home-writing-cta ${canSubmit ? "is-ready" : ""}`}
              aria-disabled={!canSubmit}
            >
              <span className="home-cta-shine" />
              <span>{canSubmit ? (usage?.remaining === "∞" || Number(usage?.remaining || 0) > 0 ? "Usar correção do plano" : "Usar 150 créditos e corrigir") : "Escreva 100 caracteres para liberar"}</span>
              <small>{canSubmit ? "feedback completo" : "destrave o envio"}</small>
            </button>
          </div>

          <div className={`home-game-strip ${canSubmit ? "is-ready" : ""}`}>
            <div className="home-game-copy">
              <strong>
                {canSubmit
                  ? "Modo envio ativado"
                  : unlockedMilestones === 0
                    ? "Primeiro impulso"
                    : unlockedMilestones === 1
                    ? "Você entrou no ritmo"
                      : "Quase pronta para enviar"}
              </strong>
              <p>
                {canSubmit
                  ? "Seu texto já liberou a correção completa. Envie agora e aproveite o embalo."
                  : "Cada frase aproxima você do feedback. Continue escrevendo para destravar a correção."}
              </p>
            </div>
            <div className="home-xp-track">
              <div className="home-xp-fill" style={{ width: `${gameProgress}%` }} />
            </div>
            <div className="home-achievements">
              {HOME_MILESTONES.map((item) => (
                <div
                  key={item.label}
                  className={`home-achievement ${charCount >= item.min ? "is-unlocked" : ""}`}
                >
                  <span>{item.label}</span>
                  <strong>{item.reward}</strong>
                </div>
              ))}
            </div>
          </div>

        </section>

        <aside className="home-sidebar">
          <section className="home-panel home-ranking">
            <div className="home-ranking-header">
              <div>
                <span className="home-eyebrow">RANKING SEMANAL</span>
                <h3>Suba no ranking</h3>
              </div>
              <Trophy size={27} />
            </div>
            <div aria-live="polite" className="mb-3 px-3 py-2 rounded-xl flex items-center justify-between gap-3" style={{ background: "#F3E8FF", color: "#5B21B6", border: "1px solid #DDD0FF" }}>
              <span style={{ fontSize: ".72rem", fontWeight: 700 }}>REINICIA EM</span>
              <strong style={{ fontFamily: ff.mono, fontSize: ".82rem" }}>{countdownDays}d {String(countdownHours).padStart(2, "0")}h {String(countdownMinutes).padStart(2, "0")}m {String(countdownRemainingSeconds).padStart(2, "0")}s</strong>
            </div>
            <div className="home-prizes-pitch">
              <span><Sparkles size={13} /> TOP 3 PREMIADO</span>
              <strong>Seu treino pode virar entretenimento.</strong>
              <small>Escreva, some pontos e dispute os prêmios da semana.</small>
            </div>
            <div className="home-ranking-prizes" aria-label={`Prêmios da semana: ${RANKING_PRIZES.map((prize) => `${prize.place}, ${prize.detail}`).join("; ")}`}>
              <div className="home-ranking-prizes-track">
                {RANKING_PRIZES.map((prize, index) => (
                  <article className={`home-prize-card is-place-${index + 1}`} key={prize.place}>
                    <b className="home-prize-medal">{prize.medal}</b>
                    <div className="home-prize-logos">
                      {prize.logos.map((logo) => <span key={logo.name} className={`home-brand-mark is-${logo.kind}`} aria-label={logo.name}>{logo.mark}</span>)}
                    </div>
                    <div className="home-prize-copy">
                      <small>{prize.place}</small>
                      <strong>{prize.title}</strong>
                      <span>{prize.detail}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <div className="home-ranking-list">
              <div className="home-ranking-podium-label"><Crown size={14} /> TOP 3 DA SEMANA</div>
              {ranking.leaders.map((item) => (
                <div key={item.pos} className={`home-ranking-row is-podium is-podium-${item.pos}`}>
                  <span className="home-position">{item.pos}º</span>
                  <span className="home-rank-avatar">{item.name[0]}</span>
                  <span className="home-rank-name">{item.name}</span>
                  <strong>{item.score} pts</strong>
                </div>
              ))}
              <div className="home-ranking-you-label"><span>OUTRAS POSIÇÕES</span><i /></div>
              {ranking.others.map((item) => (
                <div key={item.pos} className="home-ranking-row">
                  <span className="home-position">{item.pos}º</span>
                  <span className="home-rank-avatar">{item.name[0]}</span>
                  <span className="home-rank-name">{item.name}</span>
                  <strong>{item.score} pts</strong>
                </div>
              ))}
              <div className="home-ranking-you-label"><span>SUA POSIÇÃO</span><i /></div>
              <div className="home-ranking-row is-current">
                <span className="home-position">{ranking.user.pos.toLocaleString("pt-BR")}º</span>
                <span className="home-rank-avatar">V</span>
                <span className="home-rank-name">Você<small>{ranking.user.essays} redação(ões)</small></span>
                <strong>{ranking.user.score} pts</strong>
              </div>
            </div>
            <div className="home-rank-nudge">
              <TrendingUp size={18} />
              <span>
                <strong>Como pontuar:</strong> após usar o sistema em 7 dias diferentes, cada redação nota 1000 vale 15 pontos e cada nota abaixo de 600 tira 30 pontos.
                {ranking.activeDays < 7 && <small> Você já usou em {ranking.activeDays} de 7 dias.</small>}
              </span>
            </div>
          </section>

          <div className="home-stats">
            {[
              { label: "Redações", value: analyses.length, Icon: FileText },
              { label: "Média", value: average, Icon: TrendingUp },
              { label: "Posição", value: `${ranking.user.pos.toLocaleString("pt-BR")}º`, Icon: Crown },
            ].map((item) => (
              <div className="home-stat" key={item.label}>
                <item.Icon size={19} />
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <section className="home-panel home-recents">
            <div className="home-recents-header">
              <h3>Redações recentes</h3>
              <button onClick={() => onNav("historico")}>Ver tudo <ChevronRight size={16} /></button>
            </div>
            {analyses.slice(0, 2).map((item) => (
              <button className="home-recent-row" key={item.id} onClick={() => onSelectAnalysis(item.id)}>
                <span>{item.summary || `Redação de ${new Date(item.created_at).toLocaleDateString("pt-BR")}`}</span>
                <strong style={{ color: scoreColor(item.total_score || 0) }}>{item.total_score ?? item.status}</strong>
              </button>
            ))}
            {!analyses.length && <p style={{ color: "#776A89", fontSize: ".8rem" }}>Nenhuma redação enviada ainda.</p>}
          </section>
        </aside>
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
    <div className="app-page p-4 md:p-6 lg:p-8 w-full max-w-none mx-auto">
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

function ProcessandoView({ analysisId, onComplete, onError }: { analysisId: string | null; onComplete: (detail: ApiAnalysisDetail) => void; onError: (message: string) => void }) {
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
    if (!analysisId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const detail = await api<ApiAnalysisDetail>(`/api/v1/analyses/${analysisId}`);
        if (cancelled) return;
        if (detail.status === "COMPLETED") { setDone(true); onComplete(detail); return; }
        if (detail.status === "FAILED" || detail.status === "CANCELLED") { onError("Não foi possível concluir a correção."); return; }
        window.setTimeout(poll, 1500);
      } catch (error) { if (!cancelled) onError(error instanceof Error ? error.message : "Falha ao consultar a correção"); }
    };
    poll();
    return () => { cancelled = true; };
  }, [analysisId, onComplete, onError]);

  const progress = ((step + 1) / PROCESSING_STEPS.length) * 100;

  return (
    <div className="processing-page">
      <span className="processing-decoration processing-decoration-one">✦</span>
      <span className="processing-decoration processing-decoration-two">●</span>
      <div className="processing-card">
        <div className="processing-orb-wrap">
          <div className="processing-orb">
            <Sparkles size={36} />
          </div>
          <div className="processing-orbit" />
        </div>

        <span className="processing-kicker">CORREÇÃO EM JOGO</span>
        <h2>Corrigindo sua redação</h2>
        <p className="processing-subtitle">Nossa IA analisa cada competência do ENEM individualmente.</p>

        <div className="processing-steps">
          {PROCESSING_STEPS.map((s, i) => (
            <div key={i} className={`processing-step ${i < step ? "is-done" : i === step ? "is-current" : ""}`}>
              <div className="processing-step-icon">
                {i < step ? (
                  <CheckCircle2 size={15} />
                ) : i === step ? (
                  <Zap size={14} />
                ) : <Lock size={12} />}
              </div>
              <span>{s}</span>
              {i === step && (
                <div className="processing-dots">
                  {[0, 1, 2].map((d) => (
                    <i key={d} style={{ animationDelay: `${d * 0.16}s` }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="processing-progress-label">
          <span>Progresso da análise</span>
          <strong>{Math.round(progress)}%</strong>
        </div>
        <div className="processing-progress">
          <div style={{ width: `${progress}%` }} />
        </div>
        <p className="processing-time"><Clock size={14} /> Geralmente leva menos de 30 segundos</p>
      </div>
    </div>
  );
}

function ResultadoView({ onNav, detail }: { onNav: (v: View) => void; detail: ApiAnalysisDetail | null }) {
  const [selectedComp, setSelectedComp] = useState<number | null>(null);
  const [tab, setTab] = useState<"competencias" | "evidencias" | "proximos">("competencias");
  const competencies = detailCompetencies(detail);
  const totalScore = detail?.total_score ?? competencies.reduce((a, c) => a + c.nota, 0);
  const nextSteps: string[] = totalScore === 1000
    ? ["Excelente trabalho! Sua redação demonstrou domínio completo das cinco competências do ENEM. Continue praticando com regularidade para manter esse alto nível, ampliar seu repertório e chegar à prova com a mesma consistência."]
    : (detail?.feedback?.improvements || competencies.filter((item) => item.melhoria).map((item) => item.melhoria));

  function toggleComp(i: number) {
    setSelectedComp(selectedComp === i ? null : i);
  }

  const paidFeedbackLocked = !detail?.detailed_feedback;
  const upgradeGate = (feature: string) => (
    <div className="result-upgrade-gate">
      <div className="result-upgrade-icon"><Lock size={25} /></div>
      <span>RECURSO PREMIUM</span>
      <h2>Desbloqueie {feature}</h2>
      <p>Veja exatamente onde melhorar, entenda os trechos da sua redação e receba um plano de evolução mais completo.</p>
      <ul>
        <li><CheckCircle2 size={15} /> Evidências detalhadas por competência</li>
        <li><CheckCircle2 size={15} /> Prioridades e próximos passos personalizados</li>
        <li><CheckCircle2 size={15} /> Mais correções para acelerar sua evolução</li>
      </ul>
      <button onClick={() => onNav("planos")}>
        Ver planos e liberar <ChevronRight size={18} />
      </button>
      <small>Escolha o plano que combina com o seu ritmo de estudos.</small>
    </div>
  );

  return (
    <div className="result-page app-page w-full max-w-none mx-auto">
      {/* Sticky sub-header */}
      <div
        className="result-subheader sticky top-0 md:top-16 z-30 flex items-center justify-between px-4 md:px-6 h-12"
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

      <div className="result-content p-4 md:p-6 lg:p-8">
        {/* Score hero */}
        <div className="result-score-hero flex flex-col items-center mb-8 mt-2">
          <span className="result-celebration"><Trophy size={15} /> NOVO RESULTADO</span>
          <ScoreRing score={totalScore} max={1000} size={200} />
          <h1 style={{ fontFamily: ff.display, fontSize: "1.15rem", fontWeight: 600, color: "#F7F5FB", marginTop: 18, textAlign: "center", maxWidth: 320 }}>
            {detail?.topic || "Resultado da correção"}
          </h1>
          <p style={{ fontFamily: ff.body, fontSize: "0.78rem", color: "#9D94AC", marginTop: 4 }}>{detail ? new Date(detail.created_at).toLocaleDateString("pt-BR") : "Carregando..."} · {detail?.text?.trim().split(/\s+/).length || 0} palavras</p>
        </div>

        {/* Tabs */}
        <div className="result-tabs flex gap-1 mb-5 p-1 rounded-xl" style={{ background: "#16121F" }}>
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
              <span className="result-tab-label">
                {paidFeedbackLocked && t !== "competencias" && <Lock size={13} />}
                {t === "competencias" ? "Competências" : t === "evidencias" ? "Evidências" : "Próximos passos"}
              </span>
            </button>
          ))}
        </div>

        {tab === "competencias" && (
          <div className="result-competencies flex flex-col gap-2">
            {competencies.map((c, i) => (
              <CompBar key={c.id} comp={c} selected={selectedComp === i} onSelect={() => toggleComp(i)} />
            ))}
          </div>
        )}

        {tab === "evidencias" && (
          <div className="result-evidences flex flex-col gap-4">
            {paidFeedbackLocked ? upgradeGate("as evidências da sua redação") : competencies.flatMap((c) =>
              c.evidencias.map((ev, i) => (
                <div
                  key={`${c.id}-${i}`} className="result-evidence-card p-4 rounded-xl"
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
          <div className="result-next flex flex-col gap-4">
            {paidFeedbackLocked ? upgradeGate("seu plano de evolução") : <div className="result-priorities p-4 rounded-2xl" style={{ background: "#16121F", border: "1px solid rgba(139,92,246,0.15)" }}>
              <h3 style={{ fontFamily: ff.display, fontSize: "1rem", fontWeight: 600, color: "#F7F5FB", marginBottom: 12 }}>
                Prioridades de melhoria
              </h3>
              <div className="flex flex-col gap-3">
                {nextSteps.map((acao: string, i: number) => ({
                  prioridade: totalScore === 1000 ? "Excelente" : i === 0 ? "Alta" : i === 1 ? "Média" : "Próxima", cor: totalScore === 1000 ? "#4ADE80" : i === 0 ? "#F87171" : i === 1 ? "#F6A35B" : "#4ADE80", meta: totalScore === 1000 ? "Continue praticando" : `Passo ${i + 1}`, acao,
                })).map((item: { prioridade: string; cor: string; meta: string; acao: string }, i: number) => (
                  <div key={i} className="result-priority flex gap-3 p-3 rounded-xl" style={{ background: "#1C1729" }}>
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
            </div>}

            <button
              onClick={() => onNav("nova-redacao")}
              className="result-new-essay w-full py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
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

function HistoricoView({ analyses, onSelect, onDelete, onLoadMore, hasMore }: { analyses: ApiAnalysisSummary[]; onSelect: (id: string) => void; onDelete: (id: string) => void; onLoadMore: () => void; hasMore: boolean }) {
  const completed = analyses.filter((item) => item.total_score !== null);
  const best = completed.length ? Math.max(...completed.map((item) => Number(item.total_score))) : 0;
  const avg = completed.length ? Math.round(completed.reduce((a, item) => a + Number(item.total_score), 0) / completed.length) : 0;
  const evolution = [...completed].reverse().map((item) => ({ label: new Date(item.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), nota: item.total_score }));

  return (
    <div className="history-page app-page p-4 md:p-6 lg:p-8 w-full max-w-none mx-auto">
      <div className="history-heading">
        <div>
          <span><Clock size={15} /> SUA JORNADA</span>
          <h1>Histórico de redações</h1>
          <p>Acompanhe sua evolução e transforme cada correção em uma nova conquista.</p>
        </div>
      </div>

      <div className="history-stats grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Total", value: analyses.length, Icon: FileText },
          { label: "Melhor", value: best, Icon: Trophy },
          { label: "Média", value: avg, Icon: TrendingUp },
        ].map((s) => (
          <div key={s.label} className="history-stat p-3 rounded-xl text-center" style={{ background: "#16121F", border: "1px solid rgba(139,92,246,0.1)" }}>
            <s.Icon size={14} style={{ color: "#8B5CF6", margin: "0 auto 6px" }} />
            <div style={{ fontFamily: ff.mono, fontSize: "1.3rem", fontWeight: 700, color: "#8B5CF6", lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontFamily: ff.body, fontSize: "0.68rem", color: "#9D94AC", marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Evolution chart */}
      <div className="history-chart mb-6 p-4 rounded-2xl" style={{ background: "#16121F", border: "1px solid rgba(139,92,246,0.1)" }}>
        <h3 style={{ fontFamily: ff.display, fontSize: "0.95rem", fontWeight: 600, color: "#F7F5FB", marginBottom: 14 }}>Evolução da nota</h3>
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={evolution} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(109,40,217,0.12)" />
            <XAxis dataKey="label" tick={{ fontFamily: ff.mono, fontSize: 10, fill: "#776A89" }} axisLine={false} tickLine={false} />
            <YAxis domain={[500, 1000]} tick={{ fontFamily: ff.mono, fontSize: 10, fill: "#776A89" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#FFFFFF", border: "2px solid rgba(109,40,217,0.22)", borderRadius: 10, fontFamily: ff.mono, fontSize: 12, color: "#2F2341" }}
              cursor={{ stroke: "rgba(139,92,246,0.3)" }}
            />
            <Line type="monotone" dataKey="nota" stroke="#8B5CF6" strokeWidth={2.5} dot={{ fill: "#8B5CF6", r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: "#A78BFA", strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="history-list flex flex-col gap-2.5">
        {analyses.map((r) => (
          <div
            key={r.id}
            onClick={() => onSelect(r.id)}
            role="button" tabIndex={0}
            className="history-entry w-full p-4 rounded-2xl text-left transition-all duration-200"
            style={{ background: "#16121F", border: "1px solid rgba(139,92,246,0.1)" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.28)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.1)")}
          >
            <div className="flex items-start gap-3 mb-2.5">
              <p style={{ fontFamily: ff.body, fontSize: "0.84rem", color: "#F7F5FB", lineHeight: 1.4, flex: 1 }}>{r.summary || "Redação sem resumo"}</p>
              <div className="text-right shrink-0">
                <div style={{ fontFamily: ff.mono, fontSize: "1.3rem", fontWeight: 700, color: scoreColor(r.total_score || 0), lineHeight: 1 }}>{r.total_score ?? "—"}</div>
                <div style={{ fontFamily: ff.body, fontSize: "0.62rem", color: "#9D94AC" }}>pts</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: ff.body, fontSize: "0.73rem", color: "#9D94AC" }}>{new Date(r.created_at).toLocaleDateString("pt-BR")} · {r.status}</span>
              <div className="flex items-center gap-3">
                <button onClick={(event) => { event.stopPropagation(); onDelete(r.id); }} aria-label="Excluir redação" style={{ color: "#dc2626", fontSize: ".7rem" }}>Excluir</button>
                <div className="w-20 h-1 rounded-full" style={{ background: "#1C1729" }}>
                  <div className="h-1 rounded-full" style={{ width: `${((r.total_score || 0) / 1000) * 100}%`, background: scoreColor(r.total_score || 0) }} />
                </div>
              </div>
            </div>
          </div>
        ))}
        {!analyses.length && <p style={{ textAlign: "center", color: "#776A89", padding: "2rem" }}>Seu histórico aparecerá aqui após o primeiro envio.</p>}
        {hasMore && <button onClick={onLoadMore} className="w-full py-3 rounded-xl" style={{ background: "#ede2ff", color: "#6d28d9", fontWeight: 800 }}>Carregar mais</button>}
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

function PlanosView({ plans, usage, csrfToken }: { plans: ApiPlan[]; usage: ApiUsage | null; csrfToken: string }) {
  const [tab, setTab] = useState<"planos" | "avulso">("planos");
  const [checkoutError, setCheckoutError] = useState("");
  const [ledger, setLedger] = useState<ApiCreditTransaction[]>([]);
  useEffect(() => { api<{ items: ApiCreditTransaction[] }>("/api/v1/credits/transactions?page_size=10").then((result) => setLedger(result.items)).catch(() => setLedger([])); }, []);
  const displayedPlans = plans.map((plan) => ({
    id: plan.name.toLowerCase(), nome: plan.name.replace("_", " "),
    preco: plan.price_cents ? (plan.price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0", periodo: "/mês",
    creditos: plan.unlimited ? -1 : plan.daily_limit, cor: plan.name === "ULTRA_PREMIUM" ? "#FFD600" : plan.name === "PREMIUM" ? "#4ADE80" : "#9D94AC", current: usage?.plan === plan.name,
    features: plan.name === "FREE"
      ? ["1 correção por dia", "Nota completa por competência", "Sem evidências e pontos de melhoria"]
      : plan.name === "PREMIUM"
        ? ["5 correções por dia", "Feedback e evidências completos", "Pontos de melhoria liberados"]
        : ["Correções ilimitadas", "Feedback e evidências completos", "Pontos de melhoria liberados", "Histórico completo de evolução"],
    destaque: plan.name === "PREMIUM" ? "RECOMENDADO" : plan.name === "ULTRA_PREMIUM" ? "MÁXIMA PERFORMANCE" : null,
    chamada: plan.name === "FREE" ? "Comece sem compromisso" : plan.name === "PREMIUM" ? "Evolua com constância" : "Treine sem limites",
    precoRegular: plan.name === "PREMIUM" ? "R$ 69,99" : plan.name === "ULTRA_PREMIUM" ? "R$ 259,99" : null,
    desconto: plan.name === "PREMIUM" ? "43% OFF" : plan.name === "ULTRA_PREMIUM" ? "62% OFF" : null,
  }));
  async function startCheckout(product: "premium" | "ultra_premium" | "credits", creditAmount?: 150 | 270 | 750 | 1050) {
    try {
      setCheckoutError("");
      const result = await api<{ url: string }>("/api/v1/billing/checkout", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ product, credit_amount: creditAmount }) }, csrfToken);
      window.location.assign(result.url);
    } catch (error) { setCheckoutError(error instanceof Error ? error.message : "Checkout indisponível"); }
  }

  return (
    <div className="plans-page app-page p-4 md:p-6 lg:p-8 w-full max-w-none mx-auto">
      <div className="plans-heading mb-5">
        <div>
          <span><Crown size={15} /> EVOLUA SEM LIMITES</span>
          <h1 style={{ fontFamily: ff.display, fontSize: "1.55rem", fontWeight: 700, color: "#F7F5FB" }}>Escolha seu plano</h1>
          <p className="plans-intro">Mais treinos, feedbacks completos e evolução constante até a nota 1000.</p>
        </div>
        <p style={{ fontFamily: ff.body, fontSize: "0.84rem", color: "#9D94AC", marginTop: 2 }}>
          Plano atual: <strong style={{ color: "#8B5CF6" }}>{usage?.plan?.replace("_", " ") || "—"}</strong> · {String(usage?.remaining ?? "—")} correções do plano · {usage?.bonus_credits || 0} créditos
        </p>
      </div>

      <div className="plans-tabs flex gap-1 mb-6 p-1 rounded-xl" style={{ background: "#16121F" }}>
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
        <div className="plans-grid flex flex-col gap-4">
          {displayedPlans.map((p) => (
            <div
              key={p.id} className={`plan-card plan-card-${p.id} p-5 rounded-2xl relative overflow-hidden`}
              style={{ background: "#16121F", border: `1px solid ${p.current ? p.cor + "45" : "rgba(139,92,246,0.1)"}`, boxShadow: p.current ? `0 0 24px ${p.cor}12` : "none" }}
            >
              {p.current && (
                <div className="plan-current absolute top-4 right-4 px-2.5 py-0.5 rounded-full" style={{ fontFamily: ff.body, fontSize: "0.68rem", fontWeight: 600, color: "#8B5CF6", background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.35)" }}>
                  Plano atual
                </div>
              )}
              {p.destaque && !p.current && <span className="plan-highlight">{p.destaque}</span>}
              <h3 style={{ fontFamily: ff.display, fontSize: "1.3rem", fontWeight: 700, color: "#F7F5FB", marginBottom: 4 }}>{p.nome}</h3>
              <p className="plan-pitch">{p.chamada}</p>
              {p.precoRegular && <div className="plan-offer">
                <div className="plan-offer-badges"><span><Clock size={12} /> PREÇO PROMOCIONAL</span><strong>{p.desconto}</strong></div>
                <p>De <del>{p.precoRegular}</del> por apenas</p>
              </div>}
              <div className="flex items-baseline gap-1 mb-1">
                <span style={{ fontFamily: ff.mono, fontSize: "1.9rem", fontWeight: 700, color: p.cor }}>{p.preco}</span>
                <span style={{ fontFamily: ff.body, fontSize: "0.84rem", color: "#9D94AC" }}>{p.periodo}</span>
              </div>
              <p style={{ fontFamily: ff.mono, fontSize: "0.82rem", color: p.cor, marginBottom: 14 }}>
                {p.creditos === -1 ? "Correções ilimitadas" : `${p.creditos} ${p.creditos === 1 ? "correção" : "correções"} por dia`}
              </p>
              <ul className="flex flex-col gap-2 mb-5">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 size={13} style={{ color: p.cor, flexShrink: 0 }} />
                    <span style={{ fontFamily: ff.body, fontSize: "0.82rem", color: "#9D94AC" }}>{f}</span>
                  </li>
                ))}
              </ul>
              {(!p.current || p.id === "premium") && (
                <button
                  onClick={() => p.id !== "free" && startCheckout(p.id === "ultra_premium" ? "ultra_premium" : "premium")}
                  disabled={p.id === "free"}
                  className="plan-cta w-full py-2.5 rounded-xl transition-all duration-200 active:scale-[0.98]"
                  style={{
                    fontFamily: ff.display, fontSize: "0.95rem", fontWeight: 600, color: "#F7F5FB",
                    background: p.id === "premium" ? "linear-gradient(135deg, #166534, #4ADE80)" : p.id === "free" ? "#1C1729" : "linear-gradient(135deg, #5B21B6, #8B5CF6)",
                  }}
                >
                  {p.id === "free" ? "Plano gratuito" : p.id === "premium" ? "Assinar Premium" : "Assinar agora"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "avulso" && (
        <div className="credit-packs flex flex-col gap-3">
          <p style={{ fontFamily: ff.body, fontSize: "0.84rem", color: "#9D94AC", marginBottom: 4 }}>
            Cada correção Premium custa 150 créditos. Os créditos não expiram.
          </p>
          {[
            { qtd: 150 as const, preco: "R$ 9,99", popular: false, economia: null },
            { qtd: 270 as const, preco: "R$ 17,98", popular: false, economia: null },
            { qtd: 750 as const, preco: "R$ 49,95", popular: true, economia: null },
            { qtd: 1050 as const, preco: "R$ 69,93", popular: false, economia: null },
          ].map((pack) => (
            <div
              key={pack.qtd}
              className={`credit-pack ${pack.popular ? "is-popular" : ""} flex items-center justify-between p-4 rounded-xl`}
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
                  onClick={() => startCheckout("credits", pack.qtd)}
                  className="px-3.5 py-1.5 rounded-lg active:scale-95 transition-transform"
                  style={{ fontFamily: ff.display, fontSize: "0.84rem", fontWeight: 600, color: "#F7F5FB", background: "linear-gradient(135deg, #5B21B6, #8B5CF6)" }}
                >
                  Comprar
                </button>
              </div>
            </div>
          ))}
          {checkoutError && <p style={{ color: "#F87171", fontSize: ".8rem" }}>{checkoutError}</p>}
          <div className="mt-5 p-4 rounded-xl" style={{ background: "#fff", border: "1px solid rgba(109,40,217,.14)" }}>
            <h3 style={{ marginBottom: ".7rem" }}>Extrato de créditos</h3>
            {ledger.map((item) => <div key={item.id} className="flex justify-between gap-3 py-2 border-t" style={{ fontSize: ".78rem" }}><span>{item.description}<small style={{ display: "block", color: "#9589a5" }}>{new Date(item.created_at).toLocaleDateString("pt-BR")}</small></span><strong style={{ color: item.amount >= 0 ? "#16a34a" : "#dc2626" }}>{item.amount > 0 ? "+" : ""}{item.amount}</strong></div>)}
            {!ledger.length && <p style={{ color: "#9589a5", fontSize: ".78rem" }}>Nenhuma movimentação registrada.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function PerfilView({ onNav, user, usage, analyses, onToggleReminders, onLogout, onDeleteAccount }: { onNav: (v: View) => void; user: ApiUser | null; usage: ApiUsage | null; analyses: ApiAnalysisSummary[]; onToggleReminders: () => void; onLogout: () => void; onDeleteAccount: () => void }) {
  const identity = displayIdentity(user);
  const completed = analyses.filter((item) => item.total_score !== null);
  const average = completed.length ? Math.round(completed.reduce((sum, item) => sum + Number(item.total_score), 0) / completed.length) : 0;
  const best = completed.length ? Math.max(...completed.map((item) => Number(item.total_score))) : 0;
  return (
    <div className="profile-page app-page p-4 md:p-6 lg:p-8 w-full max-w-none mx-auto">
      <div className="profile-hero flex items-center gap-4 mb-6 p-4 rounded-2xl" style={{ background: "#16121F", border: "1px solid rgba(139,92,246,0.15)" }}>
        <div
          className="profile-avatar w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(145deg, #5B21B6, #8B5CF6)", fontFamily: ff.display, fontSize: "1.7rem", fontWeight: 700, color: "#F7F5FB" }}
        >
          {identity.initials}
        </div>
        <div className="profile-identity">
          <span className="profile-kicker"><Sparkles size={13} /> PERFIL DE CAMPEÃ</span>
          <h2 style={{ fontFamily: ff.display, fontSize: "1.2rem", fontWeight: 600, color: "#F7F5FB" }}>{identity.name}</h2>
          <p style={{ fontFamily: ff.body, fontSize: "0.8rem", color: "#9D94AC" }}>{identity.email}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <Crown size={12} style={{ color: "#8B5CF6" }} />
            <span style={{ fontFamily: ff.body, fontSize: "0.74rem", color: "#8B5CF6" }}>Plano {usage?.plan || user?.plan || "—"}</span>
          </div>
        </div>
      </div>

      <div className="profile-stats grid grid-cols-2 gap-3 mb-6">
        {[
          { label: "Redações enviadas", value: analyses.length, Icon: FileText },
          { label: "Nota média", value: `${average} pts`, Icon: TrendingUp },
          { label: "Melhor nota", value: `${best} pts`, Icon: Trophy },
          { label: "Saldo de créditos", value: String(usage?.bonus_credits ?? 0), Icon: Zap },
        ].map((s) => (
          <div key={s.label} className="profile-stat p-3 rounded-xl" style={{ background: "#16121F", border: "1px solid rgba(139,92,246,0.1)" }}>
            <s.Icon size={14} style={{ color: "#8B5CF6", marginBottom: 6 }} />
            <div style={{ fontFamily: ff.mono, fontSize: "1.2rem", fontWeight: 700, color: "#F7F5FB", lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontFamily: ff.body, fontSize: "0.7rem", color: "#9D94AC", marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="profile-menu flex flex-col gap-2 mb-6">
        {[
          { Icon: CreditCard, label: "Planos e créditos", action: () => onNav("planos") },
          { Icon: Bell, label: `Notificações: ${user?.reminders_enabled ? "ativadas" : "desativadas"}`, action: onToggleReminders },
          ...(user?.role === "ADMIN" ? [{ Icon: Shield, label: "Painel administrativo", action: () => onNav("admin") }] : []),
          { Icon: LogOut, label: "Sair da conta", action: onLogout },
          { Icon: LogOut, label: "Excluir minha conta e dados", action: onDeleteAccount },
        ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="profile-menu-item flex items-center justify-between p-4 rounded-xl transition-all duration-200"
              style={{ background: "#16121F", border: "1px solid rgba(139,92,246,0.1)" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.28)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.1)")}
            >
              <div className="flex items-center gap-3">
                <item.Icon size={16} style={{ color: "#9D94AC" }} />
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
    <div className="app-page p-4 md:p-6 lg:p-8 w-full max-w-none mx-auto">
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

function RealAdminView({ onNav, csrfToken, onProfileChanged }: { onNav: (v: View) => void; csrfToken: string; onProfileChanged: () => Promise<void> }) {
  type AdminUser = { id: number; email: string; plan: string; is_active: boolean; created_at: string };
  type AdminAnalysis = { id: string; user_id: number; status: string; total_score: number | null; summary: string | null; created_at: string };
  type DemoControls = { plan: "FREE" | "PREMIUM" | "ULTRA_PREMIUM"; bonus_credits: number; used: number; remaining: number | string; next_credit_at: string | null };
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [rows, setRows] = useState<AdminAnalysis[]>([]);
  const [controls, setControls] = useState<DemoControls | null>(null);
  const [creditInput, setCreditInput] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([api<AdminUser[]>("/api/v1/admin/users?page_size=50"), api<AdminAnalysis[]>("/api/v1/admin/analyses?page_size=50"), api<DemoControls>("/api/v1/admin/demo-controls")])
      .then(([nextUsers, nextRows, nextControls]) => { setUsers(nextUsers); setRows(nextRows); setControls(nextControls); setCreditInput(String(nextControls.bonus_credits)); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Painel indisponível"));
  }, []);
  async function updateControls(payload: { plan?: DemoControls["plan"]; bonus_credits?: number }) {
    try {
      setSaving(true); setError("");
      const next = await api<DemoControls>("/api/v1/admin/demo-controls", { method: "PATCH", body: JSON.stringify(payload) }, csrfToken);
      setControls(next); setCreditInput(String(next.bonus_credits)); await onProfileChanged();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível alterar o perfil"); }
    finally { setSaving(false); }
  }
  const scored = rows.filter((row) => row.total_score != null);
  const average = Math.round(scored.reduce((sum, row) => sum + (row.total_score || 0), 0) / Math.max(scored.length, 1));
  return <div className="app-page p-4 md:p-8 w-full max-w-6xl mx-auto">
    <div className="flex items-center gap-3 mb-6"><button aria-label="Voltar" onClick={() => onNav("perfil")} className="p-2 rounded-xl bg-white"><ArrowLeft size={18} /></button><div><h1 style={{ fontFamily: ff.display, fontSize: "1.5rem", fontWeight: 700 }}>Painel administrativo</h1><p style={{ color: "#6f6680", fontSize: ".8rem" }}>Dados reais do backend</p></div></div>
    {error && <div role="alert" className="mb-4 p-3 rounded-xl bg-red-100 text-red-800">{error}</div>}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">{[["Usuários", users.length], ["Redações", rows.length], ["Nota média", `${average} pts`], ["Planos pagos", users.filter((user) => user.plan !== "FREE" && user.is_active).length]].map(([label, value]) => <div key={label} className="p-4 rounded-2xl bg-white border"><strong className="block text-2xl text-purple-700">{value}</strong><span className="text-sm text-slate-500">{label}</span></div>)}</div>
    {controls && <section className="bg-white border rounded-2xl p-4 mb-6">
      <h2 className="font-bold mb-3">Meu perfil de testes</h2>
      <div className="flex flex-wrap gap-2 mb-4">{(["FREE", "PREMIUM", "ULTRA_PREMIUM"] as const).map((plan) => <button key={plan} disabled={saving} onClick={() => updateControls({ plan })} className="px-4 py-2 rounded-xl border font-semibold" style={{ background: controls.plan === plan ? "#6D28D9" : "#fff", color: controls.plan === plan ? "#fff" : "#4C1D95" }}>{plan.replace("_", " ")}</button>)}</div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm font-semibold">Créditos extras<input type="number" min="0" max="100000" value={creditInput} onChange={(event) => setCreditInput(event.target.value)} className="block mt-1 px-3 py-2 rounded-xl border w-40" /></label>
        <button disabled={saving} onClick={() => updateControls({ bonus_credits: Math.max(0, Math.min(100000, Number(creditInput) || 0)) })} className="px-4 py-2 rounded-xl bg-purple-700 text-white font-semibold">Salvar créditos</button>
        <button disabled={saving} onClick={() => updateControls({ plan: "ULTRA_PREMIUM" })} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold">Créditos infinitos</button>
      </div>
      <p className="mt-3 text-sm text-slate-500">Plano atual: {controls.plan.replace("_", " ")} · Restantes: {String(controls.remaining)} · Usados hoje: {controls.used}</p>
    </section>}
    <section className="bg-white border rounded-2xl overflow-hidden mb-6"><h2 className="p-4 font-bold">Usuários recentes</h2>{users.map((user) => <div key={user.id} className="grid grid-cols-3 gap-3 p-3 border-t text-sm"><span className="truncate">{user.email}</span><span>{user.plan}</span><span>{new Date(user.created_at).toLocaleDateString("pt-BR")}</span></div>)}</section>
    <section className="bg-white border rounded-2xl overflow-hidden"><h2 className="p-4 font-bold">Redações recentes</h2>{rows.map((row) => <div key={row.id} className="grid grid-cols-3 gap-3 p-3 border-t text-sm"><span className="truncate">{row.summary || row.status}</span><strong>{row.total_score ?? "—"}</strong><span>{new Date(row.created_at).toLocaleDateString("pt-BR")}</span></div>)}</section>
  </div>;
}

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [user, setUser] = useState<ApiUser | null>(null);
  const [usage, setUsage] = useState<ApiUsage | null>(null);
  const [analyses, setAnalyses] = useState<ApiAnalysisSummary[]>([]);
  const [analysesTotal, setAnalysesTotal] = useState(0);
  const [plans, setPlans] = useState<ApiPlan[]>([]);
  const [theme, setTheme] = useState("");
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApiAnalysisDetail | null>(null);
  const [error, setError] = useState("");
  const [authChecked, setAuthChecked] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [nextUser, nextUsage, history, nextPlans, weekly] = await Promise.all([
        api<ApiUser>("/api/v1/me"), api<ApiUsage>("/api/v1/usage"), api<{ items: ApiAnalysisSummary[]; total: number }>("/api/v1/analyses?page_size=50"), api<ApiPlan[]>("/api/v1/plans"), api<{ theme: string }>("/api/v1/theme"),
      ]);
      setUser(nextUser); setUsage(nextUsage); setAnalyses(history.items); setAnalysesTotal(history.total); setPlans(nextPlans); setTheme(weekly.theme); setError("");
    } catch (reason) { setUser(null); setError(reason instanceof Error ? reason.message : "Backend indisponível"); }
    finally { setAuthChecked(true); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function submitEssay(text: string, topicId: number | null, customTopic: string | null) {
    if (!user) { setError("Aguarde os dados da conta carregarem."); return; }
    try {
      setError("");
      const queued = await api<{ id: string; status: string }>("/api/v1/analyses", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ text, topic_id: topicId, custom_topic: customTopic }) }, user.csrf_token);
      setAnalysisId(queued.id); setView("processando");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível enviar a redação"); }
  }

  async function selectAnalysis(id: string) {
    try { const selected = await api<ApiAnalysisDetail>(`/api/v1/analyses/${id}`); setDetail(selected); setView("resultado"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível abrir a redação"); }
  }

  async function deleteAnalysis(id: string) {
    if (!user || !window.confirm("Excluir esta redação e o resultado da correção?")) return;
    try { await api(`/api/v1/analyses/${id}`, { method: "DELETE" }, user.csrf_token); await loadData(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível excluir a redação"); }
  }

  async function loadMoreAnalyses() {
    try {
      const page = Math.floor(analyses.length / 50) + 1;
      const next = await api<{ items: ApiAnalysisSummary[]; total: number }>(`/api/v1/analyses?page=${page}&page_size=50`);
      setAnalyses((current) => [...current, ...next.items.filter((item) => !current.some((saved) => saved.id === item.id))]);
      setAnalysesTotal(next.total);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível carregar mais redações"); }
  }

  async function toggleReminders() {
    if (!user) return;
    try { await api("/api/v1/me", { method: "PATCH", body: JSON.stringify({ reminders_enabled: !user.reminders_enabled }) }, user.csrf_token); await loadData(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível atualizar os lembretes"); }
  }

  async function deleteAccount() {
    if (!user || !window.confirm("Excluir permanentemente sua conta, redações e dados pessoais?")) return;
    try { await api("/api/v1/me", { method: "DELETE" }, user.csrf_token); window.location.reload(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível excluir a conta"); }
  }

  async function logout() {
    if (!user) return;
    try { await api("/api/v1/auth/logout", { method: "POST" }, user.csrf_token); }
    finally { setUser(null); setView("dashboard"); setError(""); }
  }

  const finishAnalysis = useCallback((selected: ApiAnalysisDetail) => { setDetail(selected); setView("resultado"); loadData(); }, [loadData]);
  const failAnalysis = useCallback((message: string) => { setError(message); setView("dashboard"); loadData(); }, [loadData]);

  function navigate(v: View) {
    if (v === "nova-redacao") {
      setView("dashboard");
      window.setTimeout(() => {
        const editor = document.querySelector<HTMLTextAreaElement>("#home-writing-input");
        editor?.scrollIntoView({ behavior: "smooth", block: "start" });
        window.setTimeout(() => editor?.focus({ preventScroll: true }), 450);
      }, 50);
      return;
    }

    setView(v);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const hideBottomNav = view === "processando" || view === "admin";
  const identity = displayIdentity(user);
  const credits = usage?.bonus_credits || 0;

  if (!authChecked) return <div className="min-h-screen grid place-items-center" style={{ background: "#08070C", color: "#A78BFA" }}><RefreshCw className="animate-spin" /></div>;
  if (!user) return <LoginView onAuthenticated={loadData} />;

  return (
    <div style={{ background: "transparent", minHeight: "100dvh" }}>
      <TopNav view={view} onNav={navigate} onLogout={logout} credits={credits} initials={identity.initials} username={identity.name} />
      <main className="md:pt-16" style={{ paddingBottom: hideBottomNav ? 0 : undefined }}>
        <div className={hideBottomNav ? "" : "pb-24 md:pb-6"}>
          {error && <div role="alert" style={{ margin: "1rem", padding: ".8rem 1rem", borderRadius: "1rem", background: "#fee2e2", color: "#991b1b", fontSize: ".85rem" }}>{error}</div>}
          {view === "dashboard" && <DashboardV3 onNav={navigate} usage={usage} analyses={analyses} theme={theme} accountCreatedAt={user.created_at} onSubmit={submitEssay} onSelectAnalysis={selectAnalysis} />}
          {view === "processando" && <ProcessandoView analysisId={analysisId} onComplete={finishAnalysis} onError={failAnalysis} />}
          {view === "resultado" && <ResultadoView onNav={navigate} detail={detail} />}
          {view === "historico" && <HistoricoView analyses={analyses} onSelect={selectAnalysis} onDelete={deleteAnalysis} onLoadMore={loadMoreAnalyses} hasMore={analyses.length < analysesTotal} />}
          {view === "planos" && <PlanosView plans={plans} usage={usage} csrfToken={user?.csrf_token || ""} />}
          {view === "perfil" && <PerfilView onNav={navigate} user={user} usage={usage} analyses={analyses} onToggleReminders={toggleReminders} onLogout={logout} onDeleteAccount={deleteAccount} />}
          {view === "admin" && <RealAdminView onNav={navigate} csrfToken={user.csrf_token} onProfileChanged={loadData} />}
        </div>
      </main>
      {!hideBottomNav && <BottomNav view={view} onNav={navigate} />}
      {user.role === "ADMIN" && view !== "admin" && <button onClick={() => navigate("admin")} aria-label="Abrir painel administrativo" title="Painel administrativo" className="fixed right-5 bottom-24 md:bottom-6 z-50 w-14 h-14 rounded-full grid place-items-center text-white" style={{ background: "linear-gradient(135deg,#5B21B6,#8B5CF6)", boxShadow: "0 12px 30px rgba(91,33,182,.4)" }}><Shield size={24} /></button>}
    </div>
  );
}
