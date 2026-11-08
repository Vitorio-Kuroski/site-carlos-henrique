"""Gera o blog a partir dos posts em content/blog/*.md (escritos pelo painel do Pages CMS).

Cada post é um arquivo Markdown com um cabeçalho (front matter):
    ---
    title: Título do post
    description: Resumo que aparece no Google e na lista do blog
    date: 2026-11-08
    image: /img/blog/capa.jpg      (opcional)
    draft: false                   (true = não publica)
    ---
    Texto do post em Markdown.

O script grava public/blog/index.html (lista), public/blog/<slug>/index.html (cada post)
e public/blog/sitemap.xml. O nome do arquivo vira o endereço: 2026-11-08-meu-post.md -> /blog/meu-post/.

Uso:
    pip install -r tools/requirements.txt
    python tools/gerar_blog.py

No GitHub, .github/workflows/blog.yml roda este script sozinho a cada post publicado.
"""
import html
import json
import re
import shutil
from datetime import date, datetime
from pathlib import Path

import markdown
import yaml

RAIZ = Path(__file__).resolve().parent.parent
POSTS = RAIZ / "content" / "blog"
SAIDA = RAIZ / "public" / "blog"
SITE = "https://henriqueaccountant.com/"
TALLY = "https://tally.so/r/2EqxZj"
MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
         "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]


def ler_post(arq):
    texto = arq.read_text(encoding="utf-8")
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", texto, re.S)
    meta, corpo = (yaml.safe_load(m.group(1)) or {}, m.group(2)) if m else ({}, texto)
    slug = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", arq.stem)
    data = meta.get("date") or date.today()
    if isinstance(data, str):
        data = datetime.fromisoformat(data[:10]).date()
    elif isinstance(data, datetime):
        data = data.date()
    return {
        "slug": slug,
        "titulo": str(meta.get("title") or slug.replace("-", " ").capitalize()),
        "resumo": str(meta.get("description") or ""),
        "data": data,
        "imagem": endereco_imagem(meta.get("image")),
        "rascunho": bool(meta.get("draft")),
        "corpo": corpo,
    }


def endereco_imagem(caminho):
    """O painel pode salvar "/img/blog/x.jpg" ou "public/img/blog/x.jpg": os dois viram "/img/blog/x.jpg"."""
    if not caminho:
        return ""
    caminho = str(caminho)
    if caminho.startswith(("http://", "https://")):
        return caminho
    return "/" + re.sub(r"^/?(public/)?", "", caminho)


def data_extenso(d):
    return f"{d.day} de {MESES[d.month - 1]} de {d.year}"


def minutos_de_leitura(texto):
    return max(1, round(len(re.findall(r"\w+", texto)) / 200))


def esc(texto):
    return html.escape(texto, quote=True)


def pagina(titulo, descricao, url, imagem, conteudo, raiz, extra_head=""):
    """Moldura comum (topo, rodapé). raiz: caminho relativo até a pasta public/ (ex.: "../../")."""
    og_imagem = imagem if imagem.startswith("http") else SITE + (imagem.lstrip("/") if imagem else "og-imagem.png")
    return f'''<!DOCTYPE html>
<html lang="pt-BR" data-idioma="pt">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="only light">
    <meta name="description" content="{esc(descricao)}">
    <title>{esc(titulo)}</title>
    <meta name="theme-color" content="#0F3D2E">
    <link rel="canonical" href="{url}">
    <meta property="og:type" content="article">
    <meta property="og:locale" content="pt_BR">
    <meta property="og:site_name" content="Carlos Henrique">
    <meta property="og:title" content="{esc(titulo)}">
    <meta property="og:description" content="{esc(descricao)}">
    <meta property="og:url" content="{url}">
    <meta property="og:image" content="{og_imagem}">
    <meta name="twitter:card" content="summary_large_image">
{extra_head}
    <link rel="icon" type="image/png" sizes="32x32" href="{raiz}favicon-32.png">
    <link rel="apple-touch-icon" href="{raiz}apple-touch-icon.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="{raiz}style.css">
</head>
<body>
    <a class="pular" href="#conteudo">Pular para o conteúdo</a>

    <header class="topo">
        <div class="caixa topo__linha">
            <a href="{raiz}" class="marca">Carlos Henrique<span>Accountant · Dublin</span></a>
            <nav class="menu" aria-label="Menu principal">
                <a href="{raiz}#sobre">Sobre</a>
                <a href="{raiz}#imposto">Declaração</a>
                <a href="{raiz}blog/">Blog</a>
                <a href="{raiz}#parcerias">Parcerias</a>
            </nav>
            <div class="topo__acoes">
                <a href="/conta/" class="topo__conta" aria-label="Área do aluno" title="Área do aluno"><svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg></a>
            </div>
        </div>
    </header>

    <main id="conteudo">
{conteudo}
    </main>

    <footer class="rodape">
        <div class="caixa">
            <p class="rodape__frase">Dinheiro, impostos e carreira na Irlanda, <em>em português.</em></p>
            <div class="rodape__linha">
                <p><strong>Carlos Henrique</strong> · Part-Qualified Accountant · Dublin</p>
                <nav aria-label="Redes sociais">
                    <a class="rede" href="https://www.instagram.com/henrique.accountant/" target="_blank" rel="noopener"><svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".9" class="icone__ponto"/></svg>Instagram</a>
                    <a class="rede" href="https://www.linkedin.com/in/carlos-henrique-de-souza-ba167914a" target="_blank" rel="noopener"><svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10.5V16M8 7.6v.1M11.5 16v-5.5M11.5 13c0-1.7 1-2.6 2.3-2.6s2.2.9 2.2 2.6V16"/></svg>LinkedIn</a>
                    <a class="rede" href="{raiz}blog/"><svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 15.5h6M9 9h2"/></svg>Blog</a>
                    <a class="rede" href="{raiz}#parcerias"><svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/></svg>E-mail</a>
                </nav>
            </div>
            <p class="rodape__aviso">O conteúdo é educativo e não substitui uma orientação individual.</p>
        </div>
    </footer>
</body>
</html>
'''


def cartao(post):
    capa = (f'<img class="post-cartao__capa" src="../{post["imagem"].lstrip("/")}" alt="" loading="lazy">'
            if post["imagem"] and not post["imagem"].startswith("http") else
            f'<img class="post-cartao__capa" src="{post["imagem"]}" alt="" loading="lazy">' if post["imagem"] else "")
    return f'''                    <a class="post-cartao" href="{post["slug"]}/">
                        {capa}
                        <div class="post-cartao__texto">
                            <p class="post-cartao__data"><time datetime="{post["data"].isoformat()}">{data_extenso(post["data"])}</time> · {minutos_de_leitura(post["corpo"])} min de leitura</p>
                            <h2>{esc(post["titulo"])}</h2>
                            <p>{esc(post["resumo"])}</p>
                            <span class="opcao__link">Ler o post <span aria-hidden="true">→</span></span>
                        </div>
                    </a>'''


def gerar_lista(posts):
    if posts:
        itens = "\n".join(cartao(p) for p in posts)
        lista = f'                <div class="posts">\n{itens}\n                </div>'
    else:
        lista = '                <p class="posts__vazio">Os primeiros posts chegam em breve.</p>'
    conteudo = f'''        <section class="hero hero--pagina">
            <div class="caixa">
                <p class="rotulo"><span class="rotulo__linha"></span>Blog</p>
                <h1>Dinheiro, impostos e carreira na Irlanda, <em>no detalhe.</em></h1>
                <p class="hero__lead">Os temas do Instagram, explicados com mais calma e em português.</p>
            </div>
        </section>
        <section class="secao secao--blog">
            <div class="caixa">
{lista}
            </div>
        </section>'''
    return pagina("Blog | Carlos Henrique", "Dinheiro, impostos e carreira na Irlanda, explicados em português.",
                  f"{SITE}blog/", "", conteudo, "../")


def gerar_post(post):
    url = f"{SITE}blog/{post['slug']}/"
    corpo = markdown.markdown(post["corpo"], extensions=["extra", "sane_lists"])
    # Imagens do painel ("/img/blog/...") com caminho relativo, como o resto do site
    corpo = re.sub(r'src="/(?!/)', 'src="../../', corpo)
    capa = ""
    if post["imagem"]:
        src = post["imagem"] if post["imagem"].startswith("http") else "../../" + post["imagem"].lstrip("/")
        capa = f'\n                <img class="post__capa" src="{src}" alt="">'
    dados = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": post["titulo"],
        "description": post["resumo"],
        "datePublished": post["data"].isoformat(),
        "url": url,
        "inLanguage": "pt-BR",
        "author": {"@type": "Person", "name": "Carlos Henrique", "url": SITE},
    }
    if post["imagem"]:
        dados["image"] = post["imagem"] if post["imagem"].startswith("http") else SITE + post["imagem"].lstrip("/")
    head = ('    <script type="application/ld+json">\n    '
            + json.dumps(dados, ensure_ascii=False, indent=4).replace("\n", "\n    ") + "\n    </script>")
    conteudo = f'''        <article class="post">
            <header class="caixa post__cabeca">
                <a class="link-seta" href="../">← Todos os posts</a>
                <p class="post-cartao__data"><time datetime="{post["data"].isoformat()}">{data_extenso(post["data"])}</time> · {minutos_de_leitura(post["corpo"])} min de leitura</p>
                <h1>{esc(post["titulo"])}</h1>
                <p class="hero__lead">{esc(post["resumo"])}</p>{capa}
            </header>
            <div class="caixa">
                <div class="post__texto">
{corpo}
                </div>
            </div>
        </article>
        <section class="secao secao--papel">
            <div class="caixa">
                <div class="destaque">
                    <div>
                        <p class="rotulo"><span class="rotulo__linha"></span>Declaração de imposto</p>
                        <h2>Quer ajuda com a <em>sua declaração?</em></h2>
                        <p>Preencha o formulário. A resposta chega direto para mim, e eu retorno pelo e-mail que você informar.</p>
                    </div>
                    <div class="destaque__acao">
                        <a href="{TALLY}" target="_blank" rel="noopener" class="botao">Abrir o formulário <span aria-hidden="true">→</span></a>
                        <p class="nota">Não coloque PPSN, senhas nem documentos no formulário.</p>
                    </div>
                </div>
            </div>
        </section>'''
    return pagina(f"{post['titulo']} | Carlos Henrique", post["resumo"] or post["titulo"], url, post["imagem"], conteudo,
                  "../../", head)


def gerar_sitemap(posts):
    urls = [(f"{SITE}blog/", max((p["data"] for p in posts), default=date.today()))]
    urls += [(f"{SITE}blog/{p['slug']}/", p["data"]) for p in posts]
    itens = "".join(f"\n  <url>\n    <loc>{u}</loc>\n    <lastmod>{d.isoformat()}</lastmod>\n  </url>" for u, d in urls)
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{itens}\n</urlset>\n')


def main():
    posts = [ler_post(a) for a in sorted(POSTS.glob("*.md"))]
    publicados = sorted((p for p in posts if not p["rascunho"]), key=lambda p: p["data"], reverse=True)

    # Recria a pasta do blog (pasta de post apagado ou virado rascunho some do site)
    if SAIDA.exists():
        shutil.rmtree(SAIDA)
    SAIDA.mkdir(parents=True)
    (SAIDA / "index.html").write_text(gerar_lista(publicados), encoding="utf-8", newline="")
    for post in publicados:
        destino = SAIDA / post["slug"] / "index.html"
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text(gerar_post(post), encoding="utf-8", newline="")
    (SAIDA / "sitemap.xml").write_text(gerar_sitemap(publicados), encoding="utf-8", newline="")
    rascunhos = len(posts) - len(publicados)
    print(f"Blog: {len(publicados)} post(s) publicado(s)" + (f", {rascunhos} rascunho(s)" if rascunhos else ""))


if __name__ == "__main__":
    main()
