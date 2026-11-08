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

Os posts ficam em `content/blog/` (um arquivo Markdown por post) e são escritos pelo painel do **Pages CMS**
(https://app.pagescms.org), configurado em `.pages.yml`. Ao publicar pelo painel:

1. o post é salvo em `content/blog/` (e as imagens em `public/img/blog/`);
2. o GitHub Actions (`.github/workflows/blog.yml`) roda `tools/gerar_blog.py` e salva as páginas em `public/blog/`;
3. o Cloudflare publica: lista em `/blog/`, cada post em `/blog/<nome-do-post>/`.

Post marcado como **Rascunho** não aparece no site. Para gerar no PC: `pip install -r tools/requirements.txt`
e `python tools/gerar_blog.py`. O blog é só em português.

### Configurar o painel (uma vez)

1. Entre em https://app.pagescms.org com a conta do GitHub dona do repositório e instale o app
   **Pages CMS** só no repositório `site-carlos-henrique`.
2. Abra o repositório no painel e, em **Collaborators**, convide o Carlos pelo e-mail.
   Ele entra pelo link do e-mail, sem conta no GitHub, e só vê o blog.

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
  em `/conta/` e acessa `/admin/` (número de alunos, busca e apagar conta). O segredo fica no painel do Cloudflare
  (Workers & Pages > carlos-henrique > Settings > Variables and Secrets, tipo **Secret**), com os e-mails separados
  por vírgula; fica fora do código porque o repositório é público. Para tirar alguém, apague o e-mail da lista.
  Administrador não pode ser apagado pelo painel. No PC, coloque `ADMIN_EMAILS=...` no arquivo `.dev.vars`.
- Ainda não tem "esqueci minha senha": precisa de um serviço que mande e-mail para os alunos (próxima etapa).

## O que trocar

| O quê | Onde |
|---|---|
| Textos e links | `public/index.html` (e a tradução em `traducoes/en.json`) |
| Cores e fontes | `public/style.css` (variáveis no topo, `:root`) |
| Foto | `public/img/carlos.jpg` (de preferência vertical e em boa resolução) |
| Ícone da aba e imagem de compartilhamento | `public/favicon-32.png`, `apple-touch-icon.png` e `og-imagem.png` (1200×630) |
| Formulário de declaração | links `tally.so` em `public/index.html` |

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
