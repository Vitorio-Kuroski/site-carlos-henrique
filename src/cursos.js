// Cursos pagos: páginas públicas, compra pelo Mercado Pago (Checkout Pro) e liberação do curso.
//
// Páginas (HTML gerado pelo Worker, com o visual do site):
//   GET  /cursos/                       lista dos cursos publicados
//   GET  /cursos/<slug>/                página de venda do curso
// Rotas (JSON):
//   POST /api/compras        { curso_id }        cria o pedido e devolve o link do checkout do Mercado Pago
//   GET  /api/conta/cursos                       cursos do aluno logado (área do aluno)
//   GET  /api/conta/pedidos/<id>                 situação de um pedido (confere no Mercado Pago se ainda pendente)
//   POST /api/pagamentos/mercadopago             aviso do Mercado Pago (webhook)
//
// Segurança do pagamento: o preço sai sempre do banco, nunca do navegador. Um aviso do Mercado Pago só serve
// para dizer "olhe o pagamento X": o Worker busca esse pagamento na API do Mercado Pago com o token da conta
// e só libera o curso se ele estiver aprovado, for do pedido certo e tiver o valor certo em reais.
//
// Segredos (painel do Cloudflare): MP_ACCESS_TOKEN (token de produção, APP_USR-...).
// MP_API muda o endereço da API (só para testes no PC).
import { alunoLogado, garantirTabelas, json } from "./alunos.js";

const MP_API = "https://api.mercadopago.com";

// Tabelas dos cursos (criadas junto com as dos alunos, em garantirTabelas)
export const TABELAS_CURSOS = [
    `CREATE TABLE IF NOT EXISTS cursos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        titulo TEXT NOT NULL,
        resumo TEXT NOT NULL DEFAULT '',
        descricao TEXT NOT NULL DEFAULT '',
        preco_centavos INTEGER NOT NULL,
        publicado INTEGER NOT NULL DEFAULT 0,
        criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS pedidos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
        curso_id INTEGER NOT NULL REFERENCES cursos(id),
        valor_centavos INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pendente',
        mp_preferencia TEXT,
        mp_pagamento TEXT,
        criado_em TEXT NOT NULL DEFAULT (datetime('now')),
        pago_em TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS pedidos_aluno ON pedidos(aluno_id)`,
    `CREATE TABLE IF NOT EXISTS matriculas (
        aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
        curso_id INTEGER NOT NULL REFERENCES cursos(id),
        origem TEXT NOT NULL,
        pedido_id INTEGER,
        criado_em TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (aluno_id, curso_id)
    )`,
];

let tabelasCursosProntas = false;
export async function garantirTabelasCursos(db) {
    if (tabelasCursosProntas) return;
    await garantirTabelas(db); // cursos dependem da tabela de alunos
    await db.batch(TABELAS_CURSOS.map((sql) => db.prepare(sql)));
    tabelasCursosProntas = true;
}

export const reais = (centavos) =>
    (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function esc(texto) {
    return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Texto da descrição: parágrafos separados por linha em branco; linhas com "- " viram lista
function paragrafos(texto) {
    return String(texto || "").trim().split(/\n\s*\n/).filter(Boolean).map((bloco) => {
        const linhas = bloco.split("\n").map((l) => l.trim());
        if (linhas.every((l) => l.startsWith("- "))) return `<ul>${linhas.map((l) => `<li>${esc(l.slice(2))}</li>`).join("")}</ul>`;
        return `<p>${linhas.map(esc).join("<br>")}</p>`;
    }).join("\n");
}

// ---------- Páginas públicas ----------

const ICONE_CONTA = '<svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';

function pagina(request, { titulo, descricao, conteudo, status = 200 }) {
    const url = new URL(request.url);
    const html = `<!DOCTYPE html>
<html lang="pt-BR" data-idioma="pt">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="only light">
    <meta name="description" content="${esc(descricao)}">
    <title>${esc(titulo)} | Carlos Henrique</title>
    <meta name="theme-color" content="#0F3D2E">
    <link rel="canonical" href="${url.origin}${url.pathname}">
    <meta property="og:type" content="website">
    <meta property="og:locale" content="pt_BR">
    <meta property="og:site_name" content="Carlos Henrique">
    <meta property="og:title" content="${esc(titulo)}">
    <meta property="og:description" content="${esc(descricao)}">
    <meta property="og:image" content="${url.origin}/og-imagem.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/style.css">
</head>
<body>
    <a class="pular" href="#conteudo">Pular para o conteúdo</a>
    <header class="topo">
        <div class="caixa topo__linha">
            <a href="/" class="marca">Carlos Henrique<span>Accountant · Dublin</span></a>
            <nav class="menu" aria-label="Menu principal">
                <a href="/#sobre">Sobre</a>
                <a href="/#imposto">Declaração</a>
                <a href="/cursos/">Cursos</a>
                <a href="/blog/">Blog</a>
            </nav>
            <div class="topo__acoes">
                <a href="/conta/" class="topo__conta" aria-label="Área do aluno" title="Área do aluno">${ICONE_CONTA}</a>
            </div>
        </div>
    </header>
    <main id="conteudo">
${conteudo}
    </main>
    <footer class="rodape">
        <div class="caixa">
            <p class="rodape__frase">Dinheiro, impostos e carreira na Irlanda, <em>em português.</em></p>
            <div class="rodape__linha">
                <p><strong>Carlos Henrique</strong> · Part-Qualified Accountant · Dublin</p>
                <nav aria-label="Links">
                    <a href="/blog/">Blog</a>
                    <a href="/conta/">Área do aluno</a>
                    <a href="/#parcerias">E-mail</a>
                </nav>
            </div>
            <p class="rodape__aviso">O conteúdo é educativo e não substitui uma orientação individual.</p>
        </div>
    </footer>
    <script src="/cursos/curso.js"></script>
</body>
</html>`;
    return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

async function paginaLista(request, env) {
    const { results } = await env.DB.prepare(
        "SELECT slug, titulo, resumo, preco_centavos FROM cursos WHERE publicado = 1 ORDER BY id DESC").all();
    const cartoes = results.map((c) => `
                    <a class="post-cartao" href="/cursos/${esc(c.slug)}/">
                        <div class="post-cartao__texto">
                            <p class="post-cartao__data">Curso · ${reais(c.preco_centavos)}</p>
                            <h2>${esc(c.titulo)}</h2>
                            <p>${esc(c.resumo)}</p>
                            <span class="opcao__link">Ver o curso <span aria-hidden="true">→</span></span>
                        </div>
                    </a>`).join("");
    const lista = results.length ? `<div class="posts">${cartoes}</div>` : '<p class="posts__vazio">Os primeiros cursos chegam em breve.</p>';
    return pagina(request, {
        titulo: "Cursos",
        descricao: "Cursos sobre dinheiro, impostos e carreira em contabilidade na Irlanda, em português.",
        conteudo: `
        <section class="hero hero--pagina">
            <div class="caixa">
                <p class="rotulo"><span class="rotulo__linha"></span>Cursos</p>
                <h1>Aprenda no seu ritmo, <em>em português.</em></h1>
                <p class="hero__lead">Cursos sobre dinheiro, impostos e carreira em contabilidade na Irlanda.</p>
            </div>
        </section>
        <section class="secao secao--blog"><div class="caixa">${lista}</div></section>`,
    });
}

async function paginaCurso(request, env, slug) {
    const curso = await env.DB.prepare("SELECT * FROM cursos WHERE slug = ? AND publicado = 1").bind(slug).first();
    if (!curso) {
        return pagina(request, {
            titulo: "Curso não encontrado", descricao: "Este curso não existe ou saiu do ar.", status: 404,
            conteudo: `<section class="hero hero--pagina"><div class="caixa"><h1>Curso <em>não encontrado.</em></h1>
                <p class="hero__lead">Ele pode ter saído do ar.</p><p style="margin-top:2rem"><a class="botao" href="/cursos/">Ver os cursos</a></p></div></section>`,
        });
    }
    return pagina(request, {
        titulo: curso.titulo,
        descricao: curso.resumo || curso.titulo,
        conteudo: `
        <section class="hero hero--pagina">
            <div class="caixa">
                <p class="rotulo"><span class="rotulo__linha"></span>Curso</p>
                <h1>${esc(curso.titulo)}</h1>
                <p class="hero__lead">${esc(curso.resumo)}</p>
            </div>
        </section>
        <section class="secao secao--papel curso">
            <div class="caixa duas">
                <div class="post__texto curso__texto">${paragrafos(curso.descricao)}</div>
                <aside class="curso__compra" id="compra" data-curso="${curso.id}">
                    <p class="curso__preco">${reais(curso.preco_centavos)}</p>
                    <p class="nota">Pagamento único pelo Mercado Pago: Pix, cartão de crédito ou boleto.</p>
                    <button type="button" class="botao" id="comprar">Comprar o curso</button>
                    <p class="conta__erro" id="erro" role="alert" hidden></p>
                    <p class="nota">Depois do pagamento, o curso aparece na sua <a href="/conta/">área do aluno</a>.</p>
                </aside>
            </div>
        </section>`,
    });
}

// ---------- Mercado Pago ----------

async function mp(env, caminho, opcoes = {}) {
    const resposta = await fetch((env.MP_API || MP_API) + caminho, {
        ...opcoes,
        headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`, "Content-Type": "application/json", ...opcoes.headers },
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
        const erro = new Error(`Mercado Pago ${resposta.status}: ${JSON.stringify(dados).slice(0, 300)}`);
        erro.status = resposta.status;
        throw erro;
    }
    return dados;
}

async function comprar(request, env) {
    const aluno = await alunoLogado(request, env);
    if (!aluno) return json({ erro: "Entre na sua conta para comprar." }, 401);
    if (!env.MP_ACCESS_TOKEN) return json({ erro: "As compras ainda não estão abertas. Tente de novo mais tarde." }, 503);
    let dados;
    try { dados = await request.json(); } catch { return json({ erro: "Dados inválidos." }, 400); }
    const db = env.DB;
    const curso = await db.prepare("SELECT * FROM cursos WHERE id = ? AND publicado = 1").bind(Number(dados?.curso_id)).first();
    if (!curso) return json({ erro: "Curso não encontrado." }, 404);
    const ja = await db.prepare("SELECT 1 FROM matriculas WHERE aluno_id = ? AND curso_id = ?").bind(aluno.id, curso.id).first();
    if (ja) return json({ erro: "Você já tem este curso.", ja_tem: true }, 409);

    const pedido = await db.prepare(
        "INSERT INTO pedidos (aluno_id, curso_id, valor_centavos) VALUES (?, ?, ?) RETURNING id")
        .bind(aluno.id, curso.id, curso.preco_centavos).first();
    const origem = new URL(request.url).origin;
    const voltar = `${origem}/conta/?pedido=${pedido.id}`;
    try {
        const preferencia = await mp(env, "/checkout/preferences", {
            method: "POST",
            headers: { "X-Idempotency-Key": `pedido-${pedido.id}` },
            body: JSON.stringify({
                items: [{ id: `curso-${curso.id}`, title: curso.titulo, quantity: 1, currency_id: "BRL", unit_price: curso.preco_centavos / 100 }],
                payer: { email: aluno.email, name: aluno.nome },
                external_reference: `pedido-${pedido.id}`,
                back_urls: { success: voltar, pending: voltar, failure: voltar },
                auto_return: "approved",
                notification_url: `${origem}/api/pagamentos/mercadopago`,
                statement_descriptor: "CARLOS HENRIQUE",
            }),
        });
        await db.prepare("UPDATE pedidos SET mp_preferencia = ? WHERE id = ?").bind(preferencia.id, pedido.id).run();
        return json({ pedido: pedido.id, checkout: preferencia.init_point });
    } catch (erro) {
        console.error("Falha ao criar o checkout:", erro);
        await db.prepare("UPDATE pedidos SET status = 'erro' WHERE id = ?").bind(pedido.id).run();
        return json({ erro: "Não foi possível abrir o pagamento agora. Tente de novo em alguns minutos." }, 502);
    }
}

const STATUS_PEDIDO = {
    approved: "aprovado", pending: "pendente", in_process: "pendente", authorized: "pendente", in_mediation: "pendente",
    rejected: "recusado", cancelled: "cancelado", refunded: "reembolsado", charged_back: "reembolsado",
};

// Aplica um pagamento lido da API do Mercado Pago ao pedido dele. Idempotente.
async function aplicarPagamento(env, pagamento) {
    const id = /^pedido-(\d+)$/.exec(String(pagamento.external_reference || ""))?.[1];
    if (!id) return null;
    const db = env.DB;
    const pedido = await db.prepare("SELECT * FROM pedidos WHERE id = ?").bind(Number(id)).first();
    if (!pedido) return null;
    const status = STATUS_PEDIDO[pagamento.status] || "pendente";
    // Um pedido aprovado só muda para reembolsado (não volta para pendente por um aviso atrasado)
    if (pedido.status === "aprovado" && status !== "reembolsado") return pedido;
    // Reembolsado é o fim: um aviso atrasado não devolve o acesso
    if (pedido.status === "reembolsado") return pedido;

    if (status === "aprovado") {
        const valorCerto = Math.round(Number(pagamento.transaction_amount) * 100) === pedido.valor_centavos && pagamento.currency_id === "BRL";
        if (!valorCerto) {
            console.error("Pagamento com valor diferente do pedido:", pedido.id, pagamento.id, pagamento.transaction_amount, pagamento.currency_id);
            return pedido;
        }
        await db.batch([
            db.prepare("UPDATE pedidos SET status = 'aprovado', mp_pagamento = ?, pago_em = datetime('now') WHERE id = ?").bind(String(pagamento.id), pedido.id),
            db.prepare("INSERT OR IGNORE INTO matriculas (aluno_id, curso_id, origem, pedido_id) VALUES (?, ?, 'compra', ?)")
                .bind(pedido.aluno_id, pedido.curso_id, pedido.id),
        ]);
    } else if (status === "reembolsado") {
        await db.batch([
            db.prepare("UPDATE pedidos SET status = 'reembolsado', mp_pagamento = ? WHERE id = ?").bind(String(pagamento.id), pedido.id),
            db.prepare("DELETE FROM matriculas WHERE aluno_id = ? AND curso_id = ? AND pedido_id = ?").bind(pedido.aluno_id, pedido.curso_id, pedido.id),
        ]);
    } else {
        await db.prepare("UPDATE pedidos SET status = ?, mp_pagamento = ? WHERE id = ?").bind(status, String(pagamento.id), pedido.id).run();
    }
    return db.prepare("SELECT * FROM pedidos WHERE id = ?").bind(pedido.id).first();
}

async function avisoMercadoPago(request, env) {
    if (!env.MP_ACCESS_TOKEN) return new Response(null, { status: 503 });
    const url = new URL(request.url);
    const corpo = await request.json().catch(() => ({}));
    const tipo = corpo.type || corpo.topic || url.searchParams.get("type") || url.searchParams.get("topic");
    const id = corpo?.data?.id || url.searchParams.get("data.id") || url.searchParams.get("id");
    // Só interessam avisos de pagamento; o resto recebe "ok" para o Mercado Pago não reenviar
    if (tipo !== "payment" || !/^\d+$/.test(String(id || ""))) return new Response(null, { status: 200 });
    try {
        const pagamento = await mp(env, `/v1/payments/${id}`);
        await aplicarPagamento(env, pagamento);
        return new Response(null, { status: 200 });
    } catch (erro) {
        // Pagamento que não existe nesta conta (ex.: aviso falso): "ok" para não ficar reenviando
        if (erro.status === 404) return new Response(null, { status: 200 });
        console.error("Falha ao conferir o pagamento", id, erro);
        return new Response(null, { status: 500 }); // o Mercado Pago tenta de novo depois
    }
}

// Na volta do checkout o aviso pode ainda não ter chegado: confere direto no Mercado Pago
async function situacaoPedido(request, env, id) {
    const aluno = await alunoLogado(request, env);
    if (!aluno) return json({ erro: "Não está logado." }, 401);
    let pedido = await env.DB.prepare("SELECT p.*, c.titulo FROM pedidos p JOIN cursos c ON c.id = p.curso_id WHERE p.id = ? AND p.aluno_id = ?")
        .bind(id, aluno.id).first();
    if (!pedido) return json({ erro: "Pedido não encontrado." }, 404);
    if (pedido.status === "pendente" && env.MP_ACCESS_TOKEN) {
        try {
            const busca = await mp(env, `/v1/payments/search?external_reference=pedido-${id}&sort=date_created&criteria=desc`);
            const pagamentos = busca.results || [];
            const melhor = pagamentos.find((p) => p.status === "approved") || pagamentos[0];
            if (melhor) pedido = { ...pedido, ...(await aplicarPagamento(env, melhor)) };
        } catch (erro) {
            console.error("Falha ao buscar o pedido no Mercado Pago", id, erro);
        }
    }
    return json({ id: pedido.id, status: pedido.status, curso: pedido.titulo, valor: reais(pedido.valor_centavos) });
}

async function cursosDoAluno(request, env) {
    const aluno = await alunoLogado(request, env);
    if (!aluno) return json({ erro: "Não está logado." }, 401);
    const { results } = await env.DB.prepare(
        `SELECT c.id, c.slug, c.titulo, c.resumo, m.criado_em AS liberado_em FROM matriculas m
         JOIN cursos c ON c.id = m.curso_id WHERE m.aluno_id = ? ORDER BY m.criado_em DESC`).bind(aluno.id).all();
    return json({ cursos: results });
}

// ---------- Roteamento ----------

export async function rotasCursos(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const metodo = request.method;

    if (metodo === "POST" && pathname !== "/api/pagamentos/mercadopago") {
        const origem = request.headers.get("Origin");
        if (!origem || new URL(origem).host !== url.host) return json({ erro: "Origem não permitida." }, 403);
    }

    await garantirTabelasCursos(env.DB);
    if (pathname === "/cursos") return Response.redirect(new URL("/cursos/", url).toString(), 301);
    if (pathname === "/cursos/" && metodo === "GET") return paginaLista(request, env);
    const slug = /^\/cursos\/([a-z0-9-]+)\/?$/.exec(pathname)?.[1];
    if (slug && metodo === "GET") {
        if (!pathname.endsWith("/")) return Response.redirect(new URL(`/cursos/${slug}/`, url).toString(), 301);
        return paginaCurso(request, env, slug);
    }
    if (pathname === "/api/compras" && metodo === "POST") return comprar(request, env);
    if (pathname === "/api/conta/cursos" && metodo === "GET") return cursosDoAluno(request, env);
    const pedido = /^\/api\/conta\/pedidos\/(\d+)$/.exec(pathname)?.[1];
    if (pedido && metodo === "GET") return situacaoPedido(request, env, Number(pedido));
    if (pathname === "/api/pagamentos/mercadopago" && metodo === "POST") return avisoMercadoPago(request, env);
    return null; // não é rota de cursos
}
