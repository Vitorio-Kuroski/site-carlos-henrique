// Blog nativo: os posts e as imagens ficam no banco D1 e as páginas são montadas pelo Worker.
// O Carlos escreve pelo painel (/admin/#/blog); publicar coloca o post no ar na hora.
//
// Páginas:
//   GET /blog/                 lista dos posts publicados
//   GET /blog/<slug>/          post (rascunho só para administradores, com um aviso)
//   GET /blog/sitemap.xml      mapa do blog para o Google
//   GET /imagens/<id>          imagem enviada pelo painel (capa ou dentro do post)
// Painel (só administradores):
//   GET    /api/admin/posts            lista (sem o texto)
//   GET    /api/admin/posts/<id>       post completo
//   POST   /api/admin/posts            cria { titulo, slug, resumo, conteudo, capa, status, data }
//   PUT    /api/admin/posts/<id>       altera
//   DELETE /api/admin/posts/<id>       apaga
//   POST   /api/admin/imagens          envia uma imagem (corpo = o arquivo; JPEG, PNG ou WebP até 1,8 MB)
//
// As imagens já chegam reduzidas pelo navegador (no máximo 1600 px). Ficam no D1 para não precisar de outro
// serviço; com centenas de imagens, dá para mudar para o R2 sem mudar os endereços.
import { alunoLogado, ehAdmin, garantirTabelas, json } from "./alunos.js";
import { esc, pagina } from "./cursos.js";
import { markdownParaHtml, minutosDeLeitura } from "../public/admin/markdown.js";

const TABELAS = [
    `CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        titulo TEXT NOT NULL,
        resumo TEXT NOT NULL DEFAULT '',
        conteudo TEXT NOT NULL DEFAULT '',
        capa TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'rascunho',
        data TEXT NOT NULL DEFAULT (date('now')),
        criado_em TEXT NOT NULL DEFAULT (datetime('now')),
        atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS posts_publicados ON posts(status, data)`,
    `CREATE TABLE IF NOT EXISTS imagens (
        id TEXT PRIMARY KEY,
        tipo TEXT NOT NULL,
        dados BLOB NOT NULL,
        tamanho INTEGER NOT NULL,
        criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS ajustes (chave TEXT PRIMARY KEY, valor TEXT NOT NULL DEFAULT '')`,
];

// O primeiro post, que antes ficava em content/blog/ (Pages CMS); entra no banco uma vez só
const POST_INICIAL = {
    slug: "bem-vindo-ao-blog",
    titulo: "Bem-vindo ao blog",
    resumo: "Dinheiro, impostos e carreira na Irlanda, explicados com calma e em português.",
    data: "2026-11-08",
    conteudo: `Este é o espaço para ir além dos posts do Instagram. Aqui eu explico com mais calma os temas que mais aparecem nas mensagens: **dinheiro, impostos e carreira em contabilidade na Irlanda**, sempre em português.

## O que vem por aí

- Como funciona a declaração de imposto para quem é empregado (PAYE) e para quem é self-employed
- Os prazos importantes do ano
- Dicas para quem quer começar uma carreira em contabilidade na Irlanda

Tem um tema que você quer ver aqui? Me manda uma mensagem no [Instagram](https://www.instagram.com/henrique.accountant/).`,
};

let prontas = false;
export async function garantirTabelasBlog(db) {
    if (prontas) return;
    await garantirTabelas(db);
    await db.batch(TABELAS.map((sql) => db.prepare(sql)));
    const importado = await db.prepare("SELECT 1 FROM ajustes WHERE chave = 'blog_importado'").first();
    if (!importado) {
        const p = POST_INICIAL;
        await db.batch([
            db.prepare("INSERT OR IGNORE INTO posts (slug, titulo, resumo, conteudo, status, data) VALUES (?, ?, ?, ?, 'publicado', ?)")
                .bind(p.slug, p.titulo, p.resumo, p.conteudo, p.data),
            db.prepare("INSERT OR IGNORE INTO ajustes (chave, valor) VALUES ('blog_importado', datetime('now'))"),
        ]);
    }
    prontas = true;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
function dataExtenso(iso) {
    const [a, m, d] = iso.split("-").map(Number);
    return `${d} de ${MESES[m - 1]} de ${a}`;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FORMULARIO = "/declaracao/formulario/";
const hoje = () => new Date().toISOString().slice(0, 10);
// Publicado e com data de hoje ou antes
const VISIVEL = "status = 'publicado' AND data <= ?";

// ---------- Páginas públicas ----------

function cartao(p) {
    return `
                    <a class="post-cartao" href="/blog/${esc(p.slug)}/">
                        ${p.capa ? `<img class="post-cartao__capa" src="${esc(p.capa)}" alt="" loading="lazy">` : ""}
                        <div class="post-cartao__texto">
                            <p class="post-cartao__data"><time datetime="${p.data}">${dataExtenso(p.data)}</time> · ${minutosDeLeitura(p.conteudo)} min de leitura</p>
                            <h2>${esc(p.titulo)}</h2>
                            <p>${esc(p.resumo)}</p>
                            <span class="opcao__link">Ler o post <span aria-hidden="true">→</span></span>
                        </div>
                    </a>`;
}

// Página inicial: coloca os 3 posts mais recentes na seção "Últimos posts" (public/index.html, [data-posts]).
// Sem posts publicados, a seção inteira some. Vale para a versão em inglês (os posts são em português).
export async function comUltimosPosts(resposta, env) {
    if (!(resposta.headers.get("Content-Type") || "").includes("text/html")) return resposta;
    let posts = [];
    try {
        await garantirTabelasBlog(env.DB);
        posts = (await env.DB.prepare(
            `SELECT slug, titulo, resumo, conteudo, capa, data FROM posts WHERE ${VISIVEL} ORDER BY data DESC, id DESC LIMIT 3`).bind(hoje()).all()).results;
    } catch (erro) {
        console.error("Últimos posts: falha ao ler o banco", erro);
    }
    const nova = new HTMLRewriter()
        .on("[data-ultimos-posts]", { element(el) { if (!posts.length) el.remove(); else el.removeAttribute("data-ultimos-posts"); } })
        .on("[data-posts]", { element(el) { el.setInnerContent(posts.map(cartao).join(""), { html: true }); el.removeAttribute("data-posts"); } })
        .transform(resposta);
    const cabecalhos = new Headers(nova.headers);
    cabecalhos.set("Cache-Control", "public, max-age=0, must-revalidate");
    return new Response(nova.body, { status: nova.status, headers: cabecalhos });
}

async function paginaLista(request, env) {
    const { results } = await env.DB.prepare(
        `SELECT slug, titulo, resumo, conteudo, capa, data FROM posts WHERE ${VISIVEL} ORDER BY data DESC, id DESC`).bind(hoje()).all();
    const lista = results.length ? `<div class="posts">${results.map(cartao).join("")}\n                </div>`
        : '<p class="posts__vazio">Os primeiros posts chegam em breve.</p>';
    return pagina(request, {
        titulo: "Blog",
        descricao: "Dinheiro, impostos e carreira na Irlanda, explicados em português.",
        script: false,
        conteudo: `
        <section class="hero hero--pagina">
            <div class="caixa">
                <p class="rotulo"><span class="rotulo__linha"></span>Blog</p>
                <h1>Dinheiro, impostos e carreira na Irlanda, <em>no detalhe.</em></h1>
                <p class="hero__lead">Os temas do Instagram, explicados com mais calma e em português.</p>
            </div>
        </section>
        <section class="secao secao--blog">
            <div class="caixa">
                ${lista}
            </div>
        </section>`,
    });
}

async function paginaPost(request, env, slug) {
    const post = await env.DB.prepare("SELECT * FROM posts WHERE slug = ?").bind(slug).first();
    const visivel = post && post.status === "publicado" && post.data <= hoje();
    let admin = false;
    if (post && !visivel) {
        const eu = await alunoLogado(request, env);
        admin = Boolean(eu && ehAdmin(env, eu.email));
    }
    if (!post || (!visivel && !admin)) {
        return pagina(request, {
            titulo: "Post não encontrado", descricao: "Este post não existe ou saiu do ar.", status: 404, indexar: false, script: false,
            conteudo: `<section class="hero hero--pagina"><div class="caixa"><h1>Post <em>não encontrado.</em></h1>
                <p class="hero__lead">Ele pode ter mudado de endereço ou saído do ar.</p>
                <p style="margin-top:2rem"><a class="botao" href="/blog/">Ver todos os posts</a></p></div></section>`,
        });
    }
    const url = new URL(request.url);
    const endereco = `${url.origin}/blog/${post.slug}/`;
    const dados = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.titulo,
        description: post.resumo,
        datePublished: post.data,
        dateModified: post.atualizado_em.slice(0, 10),
        url: endereco,
        inLanguage: "pt-BR",
        author: { "@type": "Person", name: "Carlos Henrique", url: `${url.origin}/` },
        ...(post.capa ? { image: new URL(post.capa, url.origin).toString() } : {}),
    };
    const aviso = visivel ? "" : `<p class="post__rascunho" role="status">${post.status === "publicado"
        ? `Agendado para ${dataExtenso(post.data)}. Só administradores veem este post por enquanto.`
        : "Rascunho: só administradores veem esta página."} <a href="/admin/#/blog/${post.id}">Editar</a></p>`;
    return pagina(request, {
        titulo: post.titulo,
        descricao: post.resumo || post.titulo,
        tipo: "article",
        imagem: post.capa,
        indexar: visivel,
        script: false,
        extraHead: `\n    <script type="application/ld+json">${JSON.stringify(dados).replace(/</g, "\\u003c")}</script>`,
        conteudo: `
        <article class="post">
            <header class="caixa post__cabeca">
                ${aviso}
                <a class="link-seta" href="/blog/">← Todos os posts</a>
                <p class="post-cartao__data"><time datetime="${post.data}">${dataExtenso(post.data)}</time> · ${minutosDeLeitura(post.conteudo)} min de leitura</p>
                <h1>${esc(post.titulo)}</h1>
                ${post.resumo ? `<p class="hero__lead">${esc(post.resumo)}</p>` : ""}
                ${post.capa ? `<img class="post__capa" src="${esc(post.capa)}" alt="">` : ""}
            </header>
            <div class="caixa">
                <div class="post__texto">
${markdownParaHtml(post.conteudo)}
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
                        <a href="${FORMULARIO}" class="botao">Abrir o formulário <span aria-hidden="true">→</span></a>
                        <p class="nota">Não coloque PPSN, senhas nem documentos no formulário.</p>
                    </div>
                </div>
            </div>
        </section>`,
    });
}

async function sitemap(request, env) {
    const origem = new URL(request.url).origin;
    const { results } = await env.DB.prepare(`SELECT slug, data, atualizado_em FROM posts WHERE ${VISIVEL} ORDER BY data DESC`).bind(hoje()).all();
    const ultima = results[0]?.atualizado_em.slice(0, 10) || hoje();
    const urls = [[`${origem}/blog/`, ultima], ...results.map((p) => [`${origem}/blog/${p.slug}/`, p.atualizado_em.slice(0, 10)])];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${
        urls.map(([u, d]) => `\n  <url>\n    <loc>${esc(u)}</loc>\n    <lastmod>${d}</lastmod>\n  </url>`).join("")}\n</urlset>\n`;
    return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=600" } });
}

async function imagem(env, id) {
    const img = await env.DB.prepare("SELECT tipo, dados FROM imagens WHERE id = ?").bind(id).first();
    if (!img) return new Response("Imagem não encontrada", { status: 404 });
    return new Response(new Uint8Array(img.dados), {
        headers: {
            "Content-Type": img.tipo,
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'",
        },
    });
}

export async function rotasBlog(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    if (request.method !== "GET" && request.method !== "HEAD") return null;
    await garantirTabelasBlog(env.DB);
    const img = /^\/imagens\/([a-f0-9]{32})$/.exec(pathname)?.[1];
    if (img) return imagem(env, img);
    if (pathname === "/blog") return Response.redirect(new URL("/blog/", url).toString(), 301);
    if (pathname === "/blog/" || pathname === "/blog/index.html") return paginaLista(request, env);
    if (pathname === "/blog/sitemap.xml") return sitemap(request, env);
    const slug = /^\/blog\/([a-z0-9-]+)\/?$/.exec(pathname)?.[1];
    if (slug) {
        if (!pathname.endsWith("/")) return Response.redirect(new URL(`/blog/${slug}/`, url).toString(), 301);
        return paginaPost(request, env, slug);
    }
    return null;
}

// ---------- Painel ----------

const TIPOS = { "image/jpeg": [0xff, 0xd8, 0xff], "image/png": [0x89, 0x50, 0x4e, 0x47], "image/webp": [0x52, 0x49, 0x46, 0x46] };
const LIMITE_IMAGEM = 1_800_000;

async function enviarImagem(request, db) {
    const tipo = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
    if (!TIPOS[tipo]) return json({ erro: "Envie uma imagem JPG, PNG ou WebP." }, 415);
    const dados = new Uint8Array(await request.arrayBuffer());
    if (!dados.length) return json({ erro: "A imagem chegou vazia." }, 400);
    if (dados.length > LIMITE_IMAGEM) return json({ erro: "A imagem passou de 1,8 MB mesmo depois de reduzida. Tente outra." }, 413);
    // Confere o começo do arquivo: o tipo informado tem que bater com o conteúdo
    const assinatura = TIPOS[tipo];
    const confere = assinatura.every((b, i) => dados[i] === b)
        && (tipo !== "image/webp" || String.fromCharCode(...dados.slice(8, 12)) === "WEBP");
    if (!confere) return json({ erro: "O arquivo não parece ser uma imagem válida." }, 415);
    const id = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
    await db.prepare("INSERT INTO imagens (id, tipo, dados, tamanho) VALUES (?, ?, ?, ?)").bind(id, tipo, dados, dados.length).run();
    return json({ url: `/imagens/${id}` }, 201);
}

async function lerPost(request) {
    let d;
    try { d = await request.json(); } catch { return { erro: "Dados inválidos." }; }
    const titulo = String(d?.titulo || "").trim();
    const slug = String(d?.slug || "").trim().toLowerCase();
    const resumo = String(d?.resumo || "").trim();
    const conteudo = String(d?.conteudo || "").replace(/\r\n?/g, "\n").trim();
    const capa = String(d?.capa || "").trim();
    const status = d?.status === "publicado" ? "publicado" : "rascunho";
    const data = String(d?.data || "").trim() || hoje();
    if (!titulo || titulo.length > 160) return { erro: "Informe o título (até 160 caracteres)." };
    if (!SLUG.test(slug) || slug.length > 80) return { erro: "O endereço só pode ter letras minúsculas, números e hífens (ex.: imposto-na-irlanda)." };
    if (resumo.length > 300) return { erro: "O resumo passou de 300 caracteres." };
    if (conteudo.length > 100000) return { erro: "O texto passou do limite de 100 mil caracteres." };
    if (capa && !/^\/imagens\/[a-f0-9]{32}$/.test(capa) && !/^https:\/\/[^\s"'<>]+$/.test(capa)) return { erro: "Capa inválida. Envie a imagem pelo botão." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(data))) return { erro: "Data inválida." };
    if (status === "publicado" && !resumo) return { erro: "Para publicar, escreva o resumo (ele aparece no Google e na lista do blog)." };
    if (status === "publicado" && !conteudo) return { erro: "Para publicar, escreva o texto do post." };
    return { titulo, slug, resumo, conteudo, capa, status, data };
}

export async function rotasBlogAdmin(request, url, metodo, db) {
    await garantirTabelasBlog(db);
    if (url.pathname === "/api/admin/imagens" && metodo === "POST") return enviarImagem(request, db);
    if (url.pathname === "/api/admin/posts" && metodo === "GET") {
        const { results } = await db.prepare(
            `SELECT id, slug, titulo, resumo, capa, status, data, atualizado_em, length(conteudo) AS tamanho
             FROM posts ORDER BY (status = 'rascunho') DESC, data DESC, id DESC`).all();
        return json({ posts: results, hoje: hoje() });
    }
    const id = Number(/^\/api\/admin\/posts\/(\d+)$/.exec(url.pathname)?.[1]);
    if (id && metodo === "GET") {
        const post = await db.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
        return post ? json({ post, hoje: hoje() }) : json({ erro: "Post não encontrado." }, 404);
    }
    if (id && metodo === "DELETE") {
        const r = await db.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();
        return r.meta.changes ? json({ ok: true }) : json({ erro: "Post não encontrado." }, 404);
    }
    if ((url.pathname === "/api/admin/posts" && metodo === "POST") || (id && metodo === "PUT")) {
        const p = await lerPost(request);
        if (p.erro) return json({ erro: p.erro }, 422);
        try {
            if (id) {
                const r = await db.prepare(
                    `UPDATE posts SET titulo = ?, slug = ?, resumo = ?, conteudo = ?, capa = ?, status = ?, data = ?,
                     atualizado_em = datetime('now') WHERE id = ?`)
                    .bind(p.titulo, p.slug, p.resumo, p.conteudo, p.capa, p.status, p.data, id).run();
                if (!r.meta.changes) return json({ erro: "Post não encontrado." }, 404);
                return json({ id });
            }
            const novo = await db.prepare(
                "INSERT INTO posts (titulo, slug, resumo, conteudo, capa, status, data) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id")
                .bind(p.titulo, p.slug, p.resumo, p.conteudo, p.capa, p.status, p.data).first();
            return json({ id: novo.id }, 201);
        } catch (erro) {
            if (/UNIQUE/i.test(String(erro))) return json({ erro: "Já existe um post com esse endereço. Mude o endereço." }, 409);
            throw erro;
        }
    }
    return json({ erro: "Não encontrado." }, 404);
}
