# Segurança do Reda1000IA

## Controles implementados

- SQLAlchemy e consultas parametrizadas; nenhuma entrada do usuário é concatenada em SQL.
- Schemas Pydantic com limites de tamanho, tipo e formato.
- React renderiza conteúdo dinâmico como texto; não usar HTML fornecido pelo usuário.
- CSP, proteção contra frames, MIME sniffing, vazamento de referrer e permissões do navegador.
- Senhas derivadas com `scrypt`, salt aleatório e comparação em tempo constante.
- Sessões opacas armazenadas no Redis com TTL; cookies `HttpOnly`, `SameSite=Lax` e `Secure` em produção.
- CSRF em operações mutáveis, rate limiting distribuído e bloqueio temporário de login.
- RBAC, MFA administrativo e allowlist de IP para login e endpoints administrativos.
- Limite de corpo de requisição e respostas 500 sem detalhes internos.
- Idempotência para envio de redações, checkout e webhooks financeiros.
- Containers executados sem root/capabilities, com filesystem somente leitura onde aplicável.
- Auditorias `pip-audit`, `bandit` e `npm audit` no CI.

## Requisitos obrigatórios de produção

- TLS deve terminar em CDN, load balancer ou proxy reverso confiável.
- Definir `ENVIRONMENT=production`, `AUTH_DISABLED=false`, `COOKIE_SECURE=true` e uma `SECRET_KEY` aleatória com pelo menos 32 caracteres.
- Usar apenas origens HTTPS em `ALLOWED_ORIGINS`.
- Banco e Redis devem permanecer em rede privada, sem portas públicas.
- Habilitar criptografia AES-256 do volume/disco no serviço gerenciado do PostgreSQL e dos backups. Chaves devem ficar em KMS/secret manager, nunca no repositório.
- Colocar CDN/WAF com proteção DDoS e limites por IP antes da aplicação.
- Configurar IP real somente por proxies confiáveis; não confiar livremente em `X-Forwarded-For`.
- Rotacionar segredos, testar restauração de backups e revisar acessos administrativos regularmente.

## Verificação recorrente

Execute em cada release:

```powershell
pytest -q
python -m pip_audit
python -m bandit -q -r app -x app/knowledge
cd frontend
npm.cmd audit --audit-level=high
npm.cmd run build
```

Testes dinâmicos devem ser executados somente contra ambiente de homologação autorizado. Use OWASP ZAP ou ferramenta equivalente para verificar autenticação, headers, XSS, CSRF, autorização, limites de requisição e exposição de dados.

## Resposta a incidentes

Não registrar redações, senhas, cookies, tokens, segredos de webhook ou payloads financeiros completos. Use o `X-Request-ID` para correlação. Em incidente, revogue sessões, rotacione chaves, preserve logs de auditoria e reconcilie pagamentos com o provedor.
