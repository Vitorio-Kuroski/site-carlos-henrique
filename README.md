# Carlos Henrique

Site do Carlos Henrique, Part-Qualified Accountant em Dublin: dinheiro, impostos e carreira na Irlanda, em português.
Estático (HTML e CSS, sem banco de dados), em português e inglês. Os arquivos do site ficam em `public/`.

No ar em https://henriqueaccountant.com (Cloudflare Workers, conectado ao GitHub: cada envio para o `main` é publicado sozinho).

## Idiomas

- As páginas em português são a fonte: `public/index.html` (início) e `public/declaracao/index.html`
  (declaração de imposto). Edite os textos nelas. Página nova: crie `public/<pasta>/index.html` e ponha a pasta
  em `PAGINAS` (`tools/gerar_idiomas.py`).
- `traducoes/en.json` tem a tradução ("texto em português" -> "texto em inglês").
- Depois de mudar a página ou a tradução, gere a versão em inglês:

```bash
python tools/gerar_idiomas.py
```

O script grava a versão em inglês de cada página em `public/en/`, os links entre idiomas (hreflang) e o `sitemap.xml`,
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
