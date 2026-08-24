# Reda1000IA

Plataforma web mobile-first para correção de redações do ENEM com Gemini. O canal Telegram permanece no código apenas para uma transição gradual e vem desativado por padrão (`ENABLE_TELEGRAM_BOT=false`).

## Visão rápida

O sistema recebe a redação pela interface web, reserva créditos, coloca a avaliação em uma fila Redis e devolve o resultado processado pelo Gemini. A API é responsável por autenticação, histórico, planos, cobrança e administração; o frontend não recebe credenciais de provedores.

### Estrutura do projeto

| Diretório | Responsabilidade |
| --- | --- |
| `app/api/v1` | Endpoints REST versionados |
| `app/services` | Regras de negócio, Gemini, ENEM, planos e uso |
| `app/database` | Modelos, conexão e repositories assíncronos |
| `app/workers` | Processamento assíncrono das avaliações |
| `app/scheduler` | Retenção de dados e lembretes |
| `app/bot` | Canal Telegram legado e opcional |
| `frontend` | Aplicação React/Vite responsiva |
| `migrations` | Migrações Alembic do PostgreSQL |
| `tests` | Testes unitários e de contrato |

> O ambiente local usa autenticação por nome de usuário e senha. O modo de demonstração só deve ser habilitado explicitamente com `AUTH_DISABLED=true`.

> A avaliação é gerada por IA, pode divergir de uma correção humana e não é uma nota oficial do ENEM.

## Arquitetura

- `frontend`: Vite, React, TypeScript e Tailwind.
- `app/api/v1`: API REST versionada; autenticação, redações, planos, cobrança e administração.
- `app/workers`: correções assíncronas via ARQ/Redis.
- `app/scheduler`: retenção e lembretes; execute exatamente uma instância.
- `app/services/gemini`: cliente, retry/timeout, prompt e validação do JSON.
- `app/services/enem`: contrato independente do provedor, rubrica resumida e cálculo de nota.
- `app/services/usage`: reserva atômica de créditos no PostgreSQL.
- `app/database`: modelos e repositories SQLAlchemy assíncronos.
- `app/bot`: canal Telegram legado e opcional.

A API responde `QUEUED` imediatamente e o worker processa o Gemini fora da requisição HTTP. ARQ foi escolhido por integrar naturalmente funções assíncronas Python e Redis com uma superfície operacional menor que Celery neste estágio. A nota total é recalculada no Python e a reserva de crédito ocorre antes do processamento, inclusive se o provedor falhar depois.

## Stack e requisitos

Python 3.12+, FastAPI, PostgreSQL, Redis, ARQ, SQLAlchemy 2, Alembic, Pydantic 2, Stripe, Vite, React 18, Tailwind e Docker Compose.

O produto possui catálogo de temas persistido no banco, escolha entre tema sorteado e tema personalizado, extrato auditável de créditos e três planos: Free (1 correção essencial/dia), Premium (5 correções completas/dia) e Ultra Premium (correções ilimitadas). Cada correção avulsa completa consome 150 créditos.

## Operação

- Disponibilidade básica: `GET /health`; dependências: `GET /health/ready`; métricas Prometheus: `GET /metrics`.
- Documentação interativa da API: `http://localhost:8000/docs` em desenvolvimento; ela é desativada automaticamente em produção.
- Backup local: `powershell -File scripts/backup.ps1`. Restauração: `powershell -File scripts/restore.ps1 -BackupFile backups/arquivo.sql`.
- A rotina de CI executa testes Python, build do frontend e validação do Compose.
- As minutas de [privacidade](docs/PRIVACY.md) e [termos](docs/TERMS.md) precisam de revisão jurídica antes da publicação.

## Configuração local

1. Instale Docker Desktop com Compose v2.
2. Crie uma chave do Gemini no Google AI Studio.
3. Configure uma conta Resend somente se desejar enviar lembretes por e-mail.
4. Configure produtos/preços no Stripe e o webhook, caso vá testar cobrança.
5. Copie `.env.example` para `.env` e preencha ao menos:

```env
GEMINI_API_KEY=chave_gemini
SECRET_KEY=valor-aleatorio-com-no-minimo-32-caracteres
RESEND_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PREMIUM_PRICE_ID=
STRIPE_CREDITS_PRICE_ID=
AUTH_DISABLED=false
```

O Compose injeta `DATABASE_URL`, `REDIS_URL` e `FRONTEND_URL` nos serviços. A `SECRET_KEY` deve ser definida no `.env`; não há segredo padrão no arquivo versionado. Para um ambiente real, defina também `AUTH_DISABLED=false`, `COOKIE_SECURE=true`, `ENVIRONMENT=production` e origens públicas específicas.

Execute toda a plataforma:

```bash
docker compose up --build
```

- Web: `http://localhost:3000`
- API: `http://localhost:8000`
- Documentação local: `http://localhost:8000/docs`

O serviço `migrate` executa Alembic uma vez antes da API e dos workers. Em produção, mantenha migrations como etapa única do release.

## Segurança e privacidade

- Sessões ficam no Redis e usam identificador opaco em cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção.
- Operações mutáveis exigem CSRF; criação de análise e checkout exigem `Idempotency-Key`.
- CORS aceita somente os domínios listados em `ALLOWED_ORIGINS`.
- O frontend não recebe segredos nem usa `localStorage` para autenticação.
- Resultados do Gemini são renderizados como dados/texto, nunca como HTML cru.
- O endpoint de listagem não retorna o texto completo da redação.
- Administradores precisam do papel `ADMIN` e `mfa_enabled=true`; acessos administrativos são auditados.
- OpenAPI é desativado automaticamente quando `ENVIRONMENT=production`.

As redações são armazenadas para correção, histórico e evolução do usuário. O texto é enviado ao Gemini para produzir a avaliação. O usuário pode excluir uma redação ou toda a conta; o scheduler remove redações que excedem `DATA_RETENTION_DAYS`. Logs não devem conter textos, cookies, tokens nem respostas integrais da IA. Backups devem ser criptografados e testados periodicamente.

Antes de produção: use TLS no proxy/CDN, `COOKIE_SECURE=true`, secret manager, banco/Redis em rede privada, backups com restauração testada, monitoramento, alertas e revisão jurídica de LGPD.

Com PostgreSQL em execução:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

Para execução sem Docker, inicie também Redis, `arq app.workers.analysis.WorkerSettings`, `arq app.scheduler.main.WorkerSettings` e o frontend em `frontend/`. O bot só inicia quando `ENABLE_TELEGRAM_BOT=true`.

## Docker

```powershell
Copy-Item .env.example .env
# preencha .env
docker compose up --build
```

O Compose inicia PostgreSQL, Redis, migration, API, worker, scheduler e frontend. As credenciais padrão são apenas para desenvolvimento.

## Canal Telegram legado

`/start` cria o usuário no FREE (1 análise a cada 24 horas) e mantém o fluxo antigo disponível durante a migração. O checkout web usa Stripe; os links externos do Telegram permanecem apenas por compatibilidade.

Comandos: `/start`, `/help`, `/plan`, `/status`, `/historico`, `/tema`, `/lembretes`, `/premium` e `/cancelar`.

`/historico` mostra as 10 correções mais recentes, a variação da nota e a competência que merece mais atenção. `/tema` publica uma proposta semanal e `/lembretes` permite optar pelo aviso automático de renovação do crédito FREE.

## Testes

```powershell
pytest
python -m compileall app migrations tests
cd frontend
npm run typecheck
npm test
npm run build
npm run test:e2e
npm audit
```

O pipeline do GitHub Actions reproduz os comandos principais: `pip install -e ".[dev]"`, `pytest -q`, `npm ci`, `npm run build` e `docker compose config`. O frontend também pode ser executado isoladamente com `npm run dev` dentro de `frontend/`.

Os testes unitários não acessam provedores externos; usam clientes simulados para JSON inválido e timeout. A suíte marcada como `infrastructure` usa PostgreSQL, Redis e ARQ reais para validar migrations, concorrência de reserva, processamento completo da fila e idempotência de webhook. Ela é executada automaticamente no CI.

Para executá-la localmente, inicie os serviços, aplique as migrations e habilite-a explicitamente:

```powershell
docker compose up -d postgres redis
$env:DATABASE_URL="postgresql+asyncpg://redacao:redacao_dev@127.0.0.1:5432/redacao_db"
$env:REDIS_URL="redis://127.0.0.1:6379/15"
alembic upgrade head
$env:RUN_INFRASTRUCTURE_TESTS="1"
pytest -m infrastructure
```

O Playwright cobre Chromium desktop e mobile, ausência de overflow horizontal e violações graves ou críticas detectadas pelo axe. Na primeira execução local, instale o navegador com `npx playwright install chromium` dentro de `frontend/`.

## Limitações e próximos passos

- observabilidade possui logs e correlação, mas ainda precisa de backend de métricas e rastreamento de exceções;
- a ativação de MFA administrativo deve ser feita por procedimento operacional seguro;
- tema/proposta da redação não são coletados separadamente, o que pode reduzir a confiança da competência 2;
- calibrar os critérios pedagógicos com uma amostra anonimizada corrigida por avaliadores humanos;
- elaborar termos, política de privacidade e análise de adequação à LGPD com profissionais qualificados.
