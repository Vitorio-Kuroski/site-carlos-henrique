"""Gera a versão em inglês do site a partir da página em português.

As fontes são as páginas em português listadas em PAGINAS (public/index.html e
public/<pasta>/index.html). Cada idioma tem um arquivo em traducoes/<codigo>.json com
os dados do idioma e a tabela "texto em português" -> "texto traduzido". O script grava
public/<codigo>/<pasta>/index.html, os links entre idiomas (hreflang) e o sitemap.xml.

Uso:
    python tools/gerar_idiomas.py           # gera tudo
    python tools/gerar_idiomas.py --listar  # só lista os textos sem tradução

Os caminhos são relativos, para o site funcionar em qualquer endereço. Como cada idioma
repete a mesma estrutura de pastas, os links entre páginas ("declaracao/", "../#imposto")
valem iguais nas duas versões; só os arquivos (CSS, imagens) ganham "../" na versão em
inglês, e o seletor PT/EN é refeito para apontar para a mesma página no outro idioma.
"""
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PUBLICO = RAIZ / "public"
# Páginas em português: pasta dentro de public/ ("" = página inicial) -> entra no sitemap?
PAGINAS = {"": True, "declaracao/": True}
# Endereço do site. Ao mudar (Cloudflare, domínio próprio), troque aqui e nos arquivos de public/ que o citam.
SITE = "https://henriqueaccountant.com/"
# Idioma mostrado a quem não tem idioma próprio no site (x-default)
PADRAO_FORA = "en"

# Textos que ficam iguais em todos os idiomas (nomes, marcas, endereços)
NAO_TRADUZIR = {
    "Carlos Henrique", "PT", "EN", "@henrique.accountant", "henrique.csouzaa@gmail.com",
    "Instagram", "LinkedIn", "E-mail", "Self-employed", "Individual", "I", "II", "01", "02", "03",
    "Part-Qualified Accountant · Dublin", "Accountant · Dublin", "Part-Qualified Accountant",
}


def ler_traducoes():
    idiomas = {}
    for arq in sorted((RAIZ / "traducoes").glob("*.json")):
        dados = json.loads(arq.read_text(encoding="utf-8"))
        idiomas[dados["idioma"]["codigo"]] = dados
    return idiomas


def url_de(codigo, pasta=""):
    return f"{SITE}{pasta}" if codigo == "pt" else f"{SITE}{codigo}/{pasta}"


def bloco_hreflang(idiomas, pasta):
    linhas = ["    <!-- idiomas -->",
              f'    <link rel="alternate" hreflang="pt-BR" href="{url_de("pt", pasta)}">']
    for cod, dados in idiomas.items():
        linhas.append(f'    <link rel="alternate" hreflang="{dados["idioma"]["lang"]}" href="{url_de(cod, pasta)}">')
    linhas.append(f'    <link rel="alternate" hreflang="x-default" href="{url_de(PADRAO_FORA, pasta)}">')
    linhas.append("    <!-- /idiomas -->")
    return "\n".join(linhas)


def com_hreflang(html, idiomas, pasta):
    return re.sub(r"    <!-- idiomas -->.*?<!-- /idiomas -->", lambda _: bloco_hreflang(idiomas, pasta), html, flags=re.S)


def traduzivel(texto):
    return re.search(r"[A-Za-zÀ-ÿ]", texto) and texto not in NAO_TRADUZIR


def partes_html(html):
    """Divide em pedaços de script/style (não mexer) e o resto."""
    return re.split(r"(<script\b.*?</script>|<style\b.*?</style>)", html, flags=re.S)


# Atributos com texto visível ou lido por leitores de tela
ATRIBUTOS = r'(aria-label|alt|placeholder)="([^"]*)"'
METAS = r'(<meta (?:name|property)="(?:description|og:title|og:description)" content=")([^"]*)(")'
# Arquivos com caminho relativo (CSS, imagens): ganham "../" na versão em subpasta
ARQUIVOS = r'((?:href|src)=")(?![a-z]+:|/|#)([^"]*\.(?:css|js|png|jpe?g|webp|svg|ico))(")'
# Links do seletor de idioma
SELETOR = r'(<a href=")[^"]*(" hreflang="[^"]*" lang="[^"]*" data-idioma="([a-z]+)")'


def textos_da_pagina(html):
    vistos = []
    for i, parte in enumerate(partes_html(html)):
        if i % 2:
            continue
        for t in re.findall(r">([^<>]+)<", parte):
            t = t.strip()
            if t and traduzivel(t) and t not in vistos:
                vistos.append(t)
        for _, t in re.findall(ATRIBUTOS, parte):
            if traduzivel(t) and t not in vistos:
                vistos.append(t)
        for _, t, _ in re.findall(METAS, parte):
            if traduzivel(t) and t not in vistos:
                vistos.append(t)
    return vistos


def traduzir(html, dados, pasta=""):
    tabela = dados["textos"]
    faltando = []

    def tr(t):
        if not traduzivel(t):
            return t
        if t not in tabela:
            faltando.append(t)
            return t
        return tabela[t]

    def no_texto(m):
        bruto = m.group(1)
        t = bruto.strip()
        if not t:
            return m.group(0)
        ini = bruto[:len(bruto) - len(bruto.lstrip())]
        fim = bruto[len(bruto.rstrip()):]
        return ">" + ini + tr(t) + fim + "<"

    saida = []
    for i, parte in enumerate(partes_html(html)):
        if i % 2:
            # Dados para o Google: só a descrição muda
            if 'application/ld+json' in parte:
                parte = re.sub(r'("description": ")([^"]*)(")', lambda m: m.group(1) + tr(m.group(2)) + m.group(3), parte)
            saida.append(parte)
            continue
        parte = re.sub(r">([^<>]+)<", no_texto, parte)
        parte = re.sub(ATRIBUTOS, lambda m: f'{m.group(1)}="{tr(m.group(2))}"', parte)
        parte = re.sub(METAS, lambda m: m.group(1) + tr(m.group(2)) + m.group(3), parte)
        parte = re.sub(ARQUIVOS, lambda m: m.group(1) + "../" + m.group(2) + m.group(3), parte)
        saida.append(parte)
    html = "".join(saida)

    info = dados["idioma"]
    cod = info["codigo"]
    html = html.replace('<html lang="pt-BR" data-idioma="pt"', f'<html lang="{info["lang"]}" data-idioma="{cod}"', 1)
    html = html.replace(f'<link rel="canonical" href="{url_de("pt", pasta)}">', f'<link rel="canonical" href="{url_de(cod, pasta)}">', 1)
    html = html.replace(f'<meta property="og:url" content="{url_de("pt", pasta)}">', f'<meta property="og:url" content="{url_de(cod, pasta)}">', 1)
    # Seletor: "PT" volta para esta mesma página em português; o idioma atual aponta para si mesmo
    volta = "../" * (1 + pasta.count("/")) + pasta
    html = re.sub(SELETOR, lambda m: m.group(1) + (volta if m.group(3) == "pt" else "./") + m.group(2), html)
    html = html.replace('<meta property="og:locale" content="pt_BR">', f'<meta property="og:locale" content="{info["og_locale"]}">', 1)
    # Textos dentro do script (avisos do botão de copiar)
    for pt, outro in dados.get("scripts", {}).items():
        html = html.replace(pt, outro)
    return html, faltando


def gerar_sitemap(idiomas):
    todos = {"pt": "pt-BR", **{c: d["idioma"]["lang"] for c, d in idiomas.items()}}
    urls = ""
    for pasta, no_sitemap in PAGINAS.items():
        if not no_sitemap:
            continue
        alternativas = "".join(
            f'\n    <xhtml:link rel="alternate" hreflang="{lang}" href="{url_de(c, pasta)}"/>' for c, lang in todos.items())
        alternativas += f'\n    <xhtml:link rel="alternate" hreflang="x-default" href="{url_de(PADRAO_FORA, pasta)}"/>'
        urls += "".join(f"\n  <url>\n    <loc>{url_de(c, pasta)}</loc>{alternativas}\n  </url>" for c in todos)
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
            f"{urls}\n</urlset>\n")


def main():
    idiomas = ler_traducoes()
    fontes = {pasta: (PUBLICO / pasta / "index.html").read_text(encoding="utf-8") for pasta in PAGINAS}

    if "--listar" in sys.argv:
        for cod, dados in idiomas.items():
            falta = list(dict.fromkeys(
                t for fonte in fontes.values() for t in textos_da_pagina(fonte) if t not in dados["textos"]))
            print(f"== {cod}: {len(falta)} sem tradução")
            for t in falta:
                print(json.dumps(t, ensure_ascii=False))
        return

    for pasta in fontes:
        fontes[pasta] = com_hreflang(fontes[pasta], idiomas, pasta)
        (PUBLICO / pasta / "index.html").write_text(fontes[pasta], encoding="utf-8", newline="")
    erro = False
    for cod, dados in idiomas.items():
        for pasta, fonte in fontes.items():
            html, faltando = traduzir(fonte, dados, pasta)
            if faltando:
                erro = True
                print(f"[{cod}] /{pasta}: {len(faltando)} textos sem tradução:")
                for t in dict.fromkeys(faltando):
                    print("   ", json.dumps(t, ensure_ascii=False))
            destino = PUBLICO / cod / pasta / "index.html"
            destino.parent.mkdir(parents=True, exist_ok=True)
            destino.write_text(html, encoding="utf-8", newline="")
            print(f"[{cod}] {destino.relative_to(RAIZ)}")
    (PUBLICO / "sitemap.xml").write_text(gerar_sitemap(idiomas), encoding="utf-8", newline="")
    sys.exit(1 if erro else 0)


if __name__ == "__main__":
    main()
