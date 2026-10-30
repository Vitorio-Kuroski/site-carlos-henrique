# Carlos Henrique

Site do Carlos Henrique, Part-Qualified Accountant em Dublin: dinheiro, impostos e carreira na Irlanda, em português.
Estático (HTML e CSS, sem banco de dados), em português e inglês. Os arquivos do site ficam em `public/`.

No ar pelo GitHub Pages: https://vitorio-kuroski.github.io/site-carlos-henrique/

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

## O que trocar

| O quê | Onde |
|---|---|
| Textos e links | `public/index.html` (e a tradução em `traducoes/en.json`) |
| Cores e fontes | `public/style.css` (variáveis no topo, `:root`) |
| Foto | `public/img/carlos.jpg` (de preferência vertical e em boa resolução) |
| Ícone da aba e imagem de compartilhamento | `public/favicon-32.png`, `apple-touch-icon.png` e `og-imagem.png` (1200×630) |
| Formulário de declaração | links `tally.so` em `public/index.html` |

## Publicar

**GitHub Pages (agora):** cada envio para o `main` é publicado sozinho pelo `.github/workflows/pages.yml`.
Na primeira vez: Settings > Pages > Source: **GitHub Actions**.

**Cloudflare Workers (depois):** conecte o repositório em Workers & Pages (configuração em `wrangler.jsonc`).
O `src/worker.js` abre a versão em inglês para quem tem o navegador em outro idioma, respeitando a escolha do seletor PT/EN.

Ao mudar de endereço (Cloudflare ou domínio próprio), troque o endereço antigo pelo novo em `SITE` (`tools/gerar_idiomas.py`),
`public/index.html`, `public/404.html` e `public/robots.txt`, e rode o gerador.

## Rodar no Docker

```bash
docker compose up -d --build
```

Abre em http://localhost:8080. A pasta `public/` está montada no container: editou, é só recarregar a página.
Para parar: `docker compose down`.
