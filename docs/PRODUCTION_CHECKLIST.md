# Checklist de produção

## Ações manuais obrigatórias

- Revogar a chave Gemini e a senha do Supabase expostas durante a configuração.
- Gerar uma `SECRET_KEY` nova e exclusiva.
- Definir `ADMIN_ALLOWED_IPS` com o IP público autorizado.
- Executar `python -m app.scripts.generate_admin_totp`, salvar o segredo no Render e cadastrar a URI em um aplicativo autenticador.
- Trocar a senha administrativa por uma senha exclusiva de no mínimo 14 caracteres.
- Configurar `CAKTO_WEBHOOK_SECRET` no Render.
- Preencher `CAKTO_*_PRODUCT_IDS` com os IDs reais obtidos no payload de teste da Cakto.
- Cadastrar `https://bot-red1000.onrender.com/api/v1/webhooks/cakto` para compra, reembolso, chargeback e assinatura.
- Restringir o acesso público do Supabase e do Render Key Value.
- Ativar backups/PITR no Supabase e testar uma restauração.
- Criar alertas para picos de 401, 403, 429 e 500 e para falhas de webhook.

## Domínios e cookies

Enquanto frontend e API usam `vercel.app` e `onrender.com`, defina `COOKIE_SAMESITE=none`. A configuração recomendada é:

```text
app.reda1000ia.com  -> Vercel
api.reda1000ia.com  -> Render
```

Depois, atualize `VITE_API_URL`, `FRONTEND_URL`, `ALLOWED_ORIGINS`, a CSP em `frontend/vercel.json` e defina os cookies conforme a topologia. Com frontend e API em domínios diferentes, use `COOKIE_SECURE=true` e `COOKIE_SAMESITE=none`.

No Vercel, prefira remover `VITE_API_URL` (ou deixá-la vazia). O `vercel.json` encaminha `/api/v1/*` e `/health` ao Render, mantendo cookies de sessão no mesmo site do frontend. Defina `VITE_API_URL` apenas quando quiser chamar a API diretamente e assumir CORS/cookies entre sites.

Para aceitar previews somente deste projeto Vercel, configure no Render uma expressão ancorada, por exemplo:

```env
ALLOWED_ORIGINS=https://bot-red1000.vercel.app
ALLOWED_ORIGIN_REGEX=^https://bot-red1000(?:-[a-z0-9-]+)?-lopes-projects-09b60071\.vercel\.app$
```

Não use uma expressão genérica para todos os subdomínios `vercel.app`, pois as requisições CORS carregam cookies de sessão.

## Validação antes de vendas reais

1. Criar conta com e-mail real.
2. Testar login, logout e expiração em Chrome, Brave, Firefox e Safari.
3. Enviar webhook Cakto com segredo errado e confirmar 401.
4. Reenviar o mesmo evento válido e confirmar que não duplica benefícios.
5. Testar compra, reembolso, chargeback, cancelamento e renovação recusada.
6. Conferir plano, pagamento e extrato de créditos no banco.
7. Executar `pytest -q`, `pip-audit`, `bandit` e `npm audit`.
