# Segurança do Reda1000IA

## Controles implementados

- SQLAlchemy e consultas parametrizadas, sem concatenar entradas em SQL.
- Schemas Pydantic com limites de tamanho, tipo e formato.
- React renderiza conteúdo dinâmico como texto; HTML vindo do usuário não é aceito.
- CSP, bloqueio de frames, MIME sniffing, referrer e permissões desnecessárias.
- Senhas derivadas com `scrypt`, salt aleatório e comparação em tempo constante.
- Sessões opacas no Redis com TTL e cookies `HttpOnly` e `Secure` em produção.
- `SameSite=None` enquanto Vercel e Render usam sites diferentes; usar `Lax` após adotar subdomínios do mesmo domínio.
- CSRF nas operações mutáveis, rate limiting distribuído e bloqueio temporário de login.
- RBAC, TOTP e allowlist de IP para login e endpoints administrativos.
- Limite de corpo, respostas 500 sem detalhes internos e identificador de correlação.
- Webhook Cakto validado por segredo, produtos permitidos e idempotência por evento.
- Containers sem root/capabilities e verificações `pip-audit`, `bandit` e `npm audit` no CI.

## Requisitos externos de produção

- TLS deve terminar em CDN, load balancer ou proxy reverso confiável.
- Definir `ENVIRONMENT=production`, `AUTH_DISABLED=false`, `COOKIE_SECURE=true` e uma `SECRET_KEY` aleatória com ao menos 32 caracteres.
- Usar somente origens HTTPS em `ALLOWED_ORIGINS`.
- Banco e Redis devem ficar com o menor acesso público possível.
- Ativar criptografia gerenciada em repouso no PostgreSQL, Redis e backups; segredos ficam no painel do provedor, nunca no Git.
- Colocar CDN/WAF com proteção DDoS antes da aplicação quando houver domínio próprio.
- Rotacionar segredos, testar restauração de backups e revisar acessos administrativos periodicamente.

## Verificação recorrente

```powershell
pytest -q
python -m pip_audit
python -m bandit -q -r app -x app/knowledge
cd frontend
npm.cmd audit --audit-level=high
npm.cmd run build
```

Testes dinâmicos devem acontecer somente em homologação autorizada. Use OWASP ZAP ou equivalente para testar autenticação, headers, XSS, CSRF, autorização, rate limits e exposição de dados.

## Resposta a incidentes

Não registrar redações, senhas, cookies, tokens, segredos de webhook nem payloads financeiros completos. Use `X-Request-ID` para correlação. Em incidente, revogue sessões, rotacione chaves, preserve logs de auditoria e reconcilie pagamentos com a Cakto.
