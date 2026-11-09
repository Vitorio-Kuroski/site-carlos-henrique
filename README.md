# Carlos Henrique

Site do Carlos Henrique, Part-Qualified Accountant em Dublin: dinheiro, impostos e carreira na Irlanda, em português.
Estático (HTML e CSS, sem banco de dados), em português e inglês. Os arquivos do site ficam em `public/`.

No ar em https://henriqueaccountant.com (Cloudflare Workers, conectado ao GitHub: cada envio para o `main` é publicado sozinho).

## Idiomas

- `public/index.html` é a página em português e a fonte de tudo: edite os textos aqui.
- `traducoes/en.json` tem a tradução ("texto em português" -> "texto em inglês").
- Depois de mudar a página ou a tradução, gere a versão em inglês:

```bash
python tools/gerar_idiomas.py
```

O script grava `public/en/index.html`, os links entre idiomas (hreflang) e o `sitemap.xml`,
e avisa quais textos ficaram sem tradução (`--listar` só mostra a lista).

Os caminhos na página são relativos (`style.css`, `img/carlos.jpg`, `en/`), para funcionar tanto no GitHub Pages
(que fica na subpasta `/site-carlos-henrique/`) quanto num domínio próprio.

## Blog

O blog é escrito e publicado pelo painel: `/admin/` > **Blog**. Os posts e as imagens ficam no banco D1 e as páginas
são montadas pelo Worker (`src/blog.js`), então publicar coloca o post no ar na hora, sem GitHub nem outro serviço.

- **Escrever:** título, endereço (gerado do título), resumo (aparece no Google e na lista), imagem de capa e o texto.
  A barra do editor tem negrito, itálico, título, subtítulo, listas, link, citação e imagem; a aba **Prévia** mostra o
  post como vai ficar no site (o painel e o site usam o mesmo conversor, `public/admin/markdown.js`).
- **Imagens:** enviadas do celular ou do computador; o navegador reduz para no máximo 1600 px (WebP) antes de enviar.
  Ficam no D1 e são servidas em `/imagens/<id>` com cache longo. Aceita JPG, PNG e WebP.
- **Situação:** **Rascunho** (só administradores veem, com um aviso no topo), **Publicado** e **Agendado** (publicado
  com data futura: aparece sozinho nesse dia). Publicar exige resumo e texto.
- **Salvamento automático:** rascunho salva sozinho no site 3 segundos depois da última mudança (e na hora, ao sair
  da página ou trocar de aplicativo). Post já publicado não muda sozinho: as mudanças ficam guardadas no aparelho até
  "Salvar alterações". Uma cópia sempre fica no aparelho; se a aba fechar ou a internet cair, o post oferece
  **Recuperar** quando for aberto de novo.
- Páginas: `/blog/` (lista), `/blog/<endereço>/` (post, com dados para o Google) e `/blog/sitemap.xml`.
  O blog é só em português.

## Área do aluno (cadastro e login)

Etapa 1 da plataforma de cursos: alunos criam conta e entram no site.

- Páginas: `/conta/cadastro/`, `/conta/entrar/` e `/conta/` (área do aluno), só em português e fora do Google (`noindex`).
- O Worker responde em `/api/conta/*` (`src/alunos.js`) e guarda os dados no banco **D1** `carlos-henrique-alunos`
  (binding `DB` em `wrangler.jsonc`). O Cloudflare cria o banco na primeira publicação, e o Worker cria as tabelas
  sozinho na primeira requisição.
- Senhas guardadas com PBKDF2 (nunca em texto); sessão de 30 dias em cookie HttpOnly; 5 senhas erradas em 15 minutos
  bloqueiam o e-mail por 15 minutos.
- Ver os alunos: painel do Cloudflare > Storage & Databases > D1 > carlos-henrique-alunos > Console,
  com `SELECT id, nome, email, criado_em FROM alunos;`.
- **Administradores:** quem entra com um e-mail do segredo `ADMIN_EMAILS` vê o botão "Painel do administrador"
  em `/conta/` e acessa o painel em `/admin/` (`public/admin/`, rotas `/api/admin/*` em `src/admin.js`):
  menu lateral, **Painel** (alunos, novos hoje, em 7 e 30 dias, ativos e últimos cadastros), **Alunos** (busca) e a
  **ficha do aluno** (cadastro, último acesso, sessões abertas, enviar link de senha nova e apagar conta).
  O segredo fica no painel do Cloudflare (Workers & Pages > site-carlos-henrique > Settings > Variables and Secrets,
  tipo **Secret**), com os e-mails separados por vírgula; fica fora do código porque o repositório é público.
  Administrador não pode ser apagado pelo painel e não conta como aluno (fica fora dos números, da lista de alunos e das
  vendas). Ao entrar, o administrador vai direto para `/admin/` (a `/conta/` também leva para o painel). No PC, coloque `ADMIN_EMAILS=...` no arquivo `.dev.vars`.
- **Esqueci minha senha:** `/conta/esqueci/` manda um link (vale 1 hora e uma vez só; até 3 pedidos por e-mail por hora)
  para `/conta/nova-senha/`. Trocar a senha encerra todas as sessões abertas. O e-mail sai pelo **Resend**:
  1. Crie a conta em resend.com, adicione o domínio `henriqueaccountant.com` em **Domains** e copie os registros DNS
     que ele mostrar para o DNS do domínio no Cloudflare (ou use a opção automática do Cloudflare, se aparecer).
  2. Em **API Keys**, crie uma chave só com permissão de envio.
  3. No Cloudflare, crie o segredo `RESEND_API_KEY` (tipo **Secret**) com essa chave.
  O remetente é `Carlos Henrique <nao-responda@henriqueaccountant.com>`; para trocar, crie a variável
  `EMAIL_REMETENTE`. Sem a chave, o link aparece só no log do Worker (útil para testar no PC).

## Cursos e vendas (Mercado Pago)

Etapa 2: cursos pagos com liberação automática.

- **Cadastrar:** painel `/admin/` > **Cursos** > Novo curso (título, preço, endereço, resumo, descrição). Só os marcados
  como **Publicado** aparecem em `/cursos/` e podem ser comprados. As páginas `/cursos/` e `/cursos/<endereço>/` são
  montadas pelo Worker (`src/cursos.js`) a partir do banco.
- **Compra:** o botão "Comprar o curso" pede login (e volta para o curso depois), cria um pedido e manda o aluno para o
  **Checkout Pro** do Mercado Pago (Pix, cartão ou boleto). O preço vem sempre do banco, nunca do navegador.
- **Liberação:** o Mercado Pago avisa em `/api/pagamentos/mercadopago`; o Worker não confia no aviso e consulta o
  pagamento direto na API com a chave da conta. Só libera se estiver aprovado, com a referência do pedido e o valor
  certo em reais. Na volta do checkout, `/conta/?pedido=<id>` também confere a situação. Reembolso ou chargeback
  tira o acesso.
- **Painel:** **Vendas** (receita do mês, total, aprovadas, pendentes e a lista) e, na ficha do aluno, os cursos dele,
  os pagamentos, o total pago e **Liberar curso** (acesso sem pagamento, para cortesia ou pagamento por fora; esse
  acesso pode ser removido). Aluno com compra registrada não pode ser apagado, para não perder o histórico.
- **Configurar (uma vez):** em mercadopago.com.br > Seu negócio > Configurações > Credenciais (ou
  mercadopago.com.br/developers > Suas integrações > criar aplicação "Checkout Pro"), copie o **Access Token de
  produção** (começa com `APP_USR-`) e crie no Cloudflare o segredo `MP_ACCESS_TOKEN` (tipo **Secret**). Sem ele o
  botão de compra mostra "pagamentos indisponíveis". Não é preciso cadastrar a URL de aviso: ela vai em cada pedido.
- **Testar no PC:** em `.dev.vars`, use o Access Token **de teste** em `MP_ACCESS_TOKEN`; `MP_API` troca o endereço da
  API (só para testes com um servidor falso).

## Aulas e vídeos

Etapa 3: as aulas de cada curso, com vídeo e progresso do aluno.

- **Cadastrar:** painel > **Cursos** > abra o curso > **Aulas** > Nova aula. Cada aula tem título, módulo (agrupa as
  aulas; opcional), link do vídeo, duração, texto (endereços `https://` viram links, útil para materiais) e as opções
  **Publicada** e **Aula grátis** (amostra que qualquer pessoa assiste, com o selo "Assista grátis" na página de venda).
  As setas ↑ ↓ mudam a ordem; "Criar e cadastrar outra" agiliza o cadastro de várias aulas.
- **Vídeos:** o site guarda só o link e mostra o player dentro da aula. Aceita YouTube, Vimeo, Bunny Stream e
  Cloudflare Stream (link ou só o ID). Para proteger o conteúdo pago, prefira **Vimeo** (vídeo privado com "só nos
  domínios" `henriqueaccountant.com`) ou **Bunny Stream** / **Cloudflare Stream** com domínios permitidos; no YouTube
  use "Não listado" (quem tiver o link consegue ver).
- **Aluno:** `/cursos/<curso>/assistir/` abre a próxima aula não concluída; a página da aula (`/cursos/<curso>/aulas/<id>/`)
  tem o vídeo, o texto, a lista de aulas com o progresso e "Marcar como concluída" (leva para a próxima). A área do
  aluno mostra a barra de progresso e o botão Continuar. Páginas de aula ficam fora do Google (`noindex`).
- **Acesso:** aulas só para quem tem o curso (comprado ou liberado) e para administradores, que também veem os
  rascunhos. Sem login, vai para Entrar e volta; sem o curso, vai para a página de venda.
- **Painel:** a lista de aulas mostra quantos alunos concluíram cada uma, e a ficha do aluno mostra o progresso em
  cada curso. Código: `src/aulas.js`.

## Pedidos de declaração

O formulário fica no próprio site, em `/declaracao/formulario/` (antes era o Tally). Os botões "Fazer minha declaração"
da página inicial e o quadro no fim dos posts do blog levam para ele.

- **Perguntas:** nome, serviço (empregado, autônomo, os dois, não sei), anos de imposto (os 4 anteriores ao ano atual),
  estado civil, acesso à Revenue, situações (aluguel, despesas médicas, mais de um emprego, emergency tax), e-mail,
  telefone/WhatsApp e mensagem. Aluno logado já vem com nome e e-mail preenchidos.
- **Segurança:** o formulário avisa para não mandar PPSN, senhas nem documentos e recusa texto com cara de PPSN;
  campo escondido e tempo mínimo contra robôs; até 5 pedidos por hora por conexão.
- **Painel:** **Pedidos de declaração** (com o número de novos no menu), filtros por situação (Novo, Em andamento,
  Concluído, Arquivado) e a ficha do pedido com as respostas, "Responder por e-mail", WhatsApp, ficha do aluno (se
  tiver conta), anotações internas e "Apagar pedido". Abrir um pedido novo já o marca como "Em andamento".
- **E-mails** (precisa do `RESEND_API_KEY`): os administradores recebem cada pedido, e quem pediu recebe a confirmação.

## Privacidade e termos

`/privacidade/` (GDPR e LGPD) e `/termos/` ficam em `src/legal.js`, com link no rodapé de todas as páginas, no
cadastro, no formulário de declaração e na caixa de compra do curso (desistência em 7 dias). O texto descreve o que o
site guarda de verdade: ao mudar dados coletados, cookies ou prestadores (Cloudflare, Mercado Pago, Resend, Google
Fonts, serviço de vídeo), atualize o texto e a data `ATUALIZADO`.

Apagar aluno que comprou curso (painel > ficha > Apagar conta): os registros de venda ficam (lei fiscal, 6 anos), e
nome, e-mail, senha, sessões, mensagens, progresso e acesso aos cursos são apagados; a conta vira "Aluno removido".

## Mensagens

Conversa entre cada aluno e os administradores (todos os e-mails de `ADMIN_EMAILS` veem e respondem).

- **Aluno:** área do aluno > botão **Ajuda** (`/conta/mensagens/`). Mostra "1 nova" quando chega resposta e confere
  respostas novas a cada 15 segundos com a página aberta.
- **Painel:** menu **Mensagens**, com o número de não lidas (também no título da aba, conferido a cada 30 segundos),
  a lista de conversas e a conversa aberta, que se atualiza sozinha. Na ficha do aluno, o botão **Mensagens** abre
  (ou começa) a conversa com ele. Mostra se a resposta já foi lida.
- **Aviso por e-mail** (precisa do `RESEND_API_KEY`): o aluno recebe um e-mail quando chega uma resposta e ele ainda
  não tinha nenhuma para ler; os administradores, quando um aluno escreve e não havia mensagem dele esperando.
- Texto até 4.000 caracteres; endereços `https://` viram links; até 20 mensagens do aluno a cada 10 minutos.
  Anexos ficam para depois (precisam de um lugar para guardar arquivos, o R2). Código: `src/mensagens.js`.

## O que trocar

| O quê | Onde |
|---|---|
| Textos e links | `public/index.html` (e a tradução em `traducoes/en.json`) |
| Cores e fontes | `public/style.css` (variáveis no topo, `:root`) |
| Foto | `public/img/carlos.jpg` (de preferência vertical e em boa resolução) |
| Ícone da aba e imagem de compartilhamento | `public/favicon-32.png`, `apple-touch-icon.png` e `og-imagem.png` (1200×630) |
| Formulário de declaração | perguntas em `src/declaracoes.js` (página `/declaracao/formulario/`) |

## Publicar

**Cloudflare Workers:** o repositório está conectado em Workers & Pages (configuração em `wrangler.jsonc`).
Cada envio para o `main` é publicado em https://henriqueaccountant.com. O `src/worker.js` abre a versão em inglês
para quem tem o navegador em outro idioma, respeitando a escolha do seletor PT/EN.

**GitHub Pages:** o `.github/workflows/pages.yml` também publica uma cópia em github.io. As páginas apontam
(canonical) para o domínio próprio, então o Google indexa só o henriqueaccountant.com.

Ao mudar de endereço, troque o endereço antigo pelo novo em `SITE` (`tools/gerar_idiomas.py`),
`public/index.html`, `public/404.html` e `public/robots.txt`, e rode o gerador.

## Rodar no Docker

```bash
docker compose up -d --build
```

Abre em http://localhost:8080. A pasta `public/` está montada no container: editou, é só recarregar a página.
Para parar: `docker compose down`.
