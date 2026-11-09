// Painel do administrador: só para quem está logado com um e-mail do segredo ADMIN_EMAILS.
//
// Rotas (JSON):
//   GET    /api/admin/eu                     nome e e-mail do administrador logado (topo e menu do painel)
//   GET    /api/admin/resumo                 números do painel e os últimos cadastros
//   GET    /api/admin/alunos?busca=          lista de alunos, até 500
//   GET    /api/admin/alunos/<id>            ficha do aluno
//   POST   /api/admin/alunos/<id>/senha      manda ao aluno o link de senha nova
//   DELETE /api/admin/alunos/<id>            apaga a conta do aluno (e as sessões dele)
//   POST   /api/admin/alunos/<id>/cursos     { curso_id } libera um curso para o aluno (cortesia ou pagamento por fora)
//   DELETE /api/admin/alunos/<id>/cursos/<curso_id>   tira o acesso a um curso liberado à mão
//   GET    /api/admin/cursos                 cursos (publicados ou não), com o número de alunos
//   POST   /api/admin/cursos                 cria um curso { titulo, slug, resumo, descricao, preco, publicado }
//   PUT    /api/admin/cursos/<id>            altera um curso
//   GET    /api/admin/cursos/<id>/aulas      aulas do curso (inclusive rascunhos), na ordem
//   POST   /api/admin/cursos/<id>/aulas      cria uma aula { modulo, titulo, descricao, video, duracao_min, gratis, publicado }
//   POST   /api/admin/cursos/<id>/aulas/ordem   { ids: [...] } nova ordem das aulas
//   PUT    /api/admin/aulas/<id>             altera uma aula
//   DELETE /api/admin/aulas/<id>             apaga uma aula (e o progresso dos alunos nela)
//   GET    /api/admin/vendas                 pedidos (mais recentes primeiro) e os totais
import { alunoLogado, ehAdmin, garantirTabelas, json, listaAdmins, mandarLinkSenha } from "./alunos.js";
import { playerDoVideo } from "./aulas.js";
import { garantirTabelasCursos, reais } from "./cursos.js";

const COLUNAS = "id, nome, email, criado_em, ultimo_acesso";

export async function rotasAdmin(request, env) {
    const url = new URL(request.url);
    const metodo = request.method;
    if (metodo !== "GET") {
        // Só aceita mudanças vindas do próprio site
        const origem = request.headers.get("Origin");
        if (!origem || new URL(origem).host !== url.host) return json({ erro: "Origem não permitida." }, 403);
    }
    await garantirTabelas(env.DB);
    await garantirTabelasCursos(env.DB);
    const eu = await alunoLogado(request, env);
    if (!eu) return json({ erro: "Não está logado." }, 401);
    if (!ehAdmin(env, eu.email)) return json({ erro: "Acesso só para administradores." }, 403);

    const db = env.DB;
    const comAdmin = (a) => ({ ...a, admin: ehAdmin(env, a.email) });
    // Administradores não contam como alunos: ficam fora dos números e da lista de alunos
    const admins = JSON.stringify(listaAdmins(env));
    const SO_ALUNOS = "lower(email) NOT IN (SELECT value FROM json_each(?))";

    if (url.pathname === "/api/admin/eu" && metodo === "GET") {
        return json({ nome: eu.nome, email: eu.email });
    }

    if (url.pathname === "/api/admin/resumo" && metodo === "GET") {
        const [numeros, recentes, vendas] = await db.batch([
            db.prepare(
                `SELECT COUNT(*) AS total,
                        SUM(criado_em >= datetime('now', 'start of day')) AS hoje,
                        SUM(criado_em >= datetime('now', '-7 days')) AS ultimos7,
                        SUM(criado_em >= datetime('now', '-30 days')) AS ultimos30,
                        SUM(ultimo_acesso >= datetime('now', '-7 days')) AS ativos7
                 FROM alunos WHERE ${SO_ALUNOS}`).bind(admins),
            db.prepare(`SELECT ${COLUNAS} FROM alunos WHERE ${SO_ALUNOS} ORDER BY id DESC LIMIT 8`).bind(admins),
            db.prepare(
                `SELECT COUNT(*) AS vendas_mes, COALESCE(SUM(valor_centavos), 0) AS receita_mes FROM pedidos
                 WHERE status = 'aprovado' AND pago_em >= datetime('now', 'start of month')`),
        ]);
        const n = numeros.results[0];
        const v = vendas.results[0];
        return json({
            total: n.total, hoje: n.hoje || 0, ultimos7: n.ultimos7 || 0, ultimos30: n.ultimos30 || 0, ativos7: n.ativos7 || 0,
            vendas_mes: v.vendas_mes, receita_mes: reais(v.receita_mes),
            recentes: recentes.results.map(comAdmin),
        });
    }

    if (url.pathname === "/api/admin/alunos" && metodo === "GET") {
        const busca = (url.searchParams.get("busca") || "").trim().slice(0, 100);
        const filtro = `%${busca.replace(/[%_\\]/g, "\\$&")}%`;
        const { results } = await db.prepare(
            `SELECT ${COLUNAS} FROM alunos
             WHERE ${SO_ALUNOS} AND (? = '' OR nome LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')
             ORDER BY id DESC LIMIT 500`).bind(admins, busca, filtro, filtro).all();
        return json({ alunos: results.map(comAdmin) });
    }

    if (/^\/api\/admin\/(cursos\/\d+\/aulas|aulas\/\d+)/.test(url.pathname)) return rotasAulasAdmin(request, url, metodo, db);
    if (url.pathname.startsWith("/api/admin/cursos")) return rotasCursosAdmin(request, url, metodo, db);
    if (url.pathname === "/api/admin/vendas" && metodo === "GET") return vendas(db);

    const matricula = /^\/api\/admin\/alunos\/(\d+)\/cursos(?:\/(\d+))?$/.exec(url.pathname);
    if (matricula) return rotasMatricula(request, db, Number(matricula[1]), matricula[2] && Number(matricula[2]), metodo);

    const rota = /^\/api\/admin\/alunos\/(\d+)(\/senha)?$/.exec(url.pathname);
    if (!rota) return json({ erro: "Não encontrado." }, 404);
    const id = Number(rota[1]);
    const aluno = await db.prepare(`SELECT ${COLUNAS} FROM alunos WHERE id = ?`).bind(id).first();
    if (!aluno) return json({ erro: "Aluno não encontrado." }, 404);

    if (!rota[2] && metodo === "GET") {
        const [sessoes, cursos, pedidos] = await db.batch([
            db.prepare("SELECT COUNT(*) AS n FROM sessoes WHERE aluno_id = ? AND expira_em > ?").bind(id, Math.floor(Date.now() / 1000)),
            db.prepare(
                `SELECT c.id, c.titulo, m.origem, m.criado_em,
                        (SELECT COUNT(*) FROM aulas a WHERE a.curso_id = c.id AND a.publicado = 1) AS aulas,
                        (SELECT COUNT(*) FROM progresso p JOIN aulas a ON a.id = p.aula_id
                         WHERE p.aluno_id = m.aluno_id AND a.curso_id = c.id AND a.publicado = 1) AS concluidas
                 FROM matriculas m JOIN cursos c ON c.id = m.curso_id
                 WHERE m.aluno_id = ? ORDER BY m.criado_em DESC`).bind(id),
            db.prepare(
                `SELECT p.id, c.titulo, p.valor_centavos, p.status, p.criado_em, p.pago_em FROM pedidos p JOIN cursos c ON c.id = p.curso_id
                 WHERE p.aluno_id = ? AND p.status != 'erro' ORDER BY p.id DESC LIMIT 50`).bind(id),
        ]);
        const pagos = pedidos.results.filter((p) => p.status === "aprovado").reduce((t, p) => t + p.valor_centavos, 0);
        return json({
            ...comAdmin(aluno), sessoes_ativas: sessoes.results[0].n, total_pago: reais(pagos),
            cursos: cursos.results, pedidos: pedidos.results.map((p) => ({ ...p, valor: reais(p.valor_centavos) })),
        });
    }

    if (rota[2] && metodo === "POST") {
        const resultado = await mandarLinkSenha(request, env, aluno);
        const mensagens = {
            enviado: [200, "Link de senha nova enviado para " + aluno.email + "."],
            limite: [429, "Este aluno já recebeu 3 links na última hora. Tente mais tarde."],
            sem_chave: [503, "O envio de e-mail ainda não está configurado (falta o segredo RESEND_API_KEY)."],
            falhou: [502, "O serviço de e-mail recusou o envio. Veja os logs do Worker."],
        };
        const [status, texto] = mensagens[resultado];
        return json(status === 200 ? { ok: true, mensagem: texto } : { erro: texto }, status);
    }

    if (!rota[2] && metodo === "DELETE") {
        if (id === eu.id) return json({ erro: "Você não pode apagar a sua própria conta por aqui." }, 422);
        if (ehAdmin(env, aluno.email)) return json({ erro: "Não dá para apagar um administrador." }, 422);
        const compra = await db.prepare("SELECT 1 FROM pedidos WHERE aluno_id = ? AND status IN ('aprovado', 'reembolsado')").bind(id).first();
        if (compra) return json({ erro: "Este aluno tem compras registradas. Para não perder o histórico de vendas, a conta não pode ser apagada." }, 422);
        await db.batch([
            db.prepare("DELETE FROM sessoes WHERE aluno_id = ?").bind(id),
            db.prepare("DELETE FROM redefinicoes WHERE aluno_id = ?").bind(id),
            db.prepare("DELETE FROM matriculas WHERE aluno_id = ?").bind(id),
            db.prepare("DELETE FROM pedidos WHERE aluno_id = ? AND status != 'aprovado'").bind(id),
            db.prepare("DELETE FROM alunos WHERE id = ?").bind(id),
        ]);
        return json({ ok: true });
    }

    return json({ erro: "Não encontrado." }, 404);
}

// ---------- Cursos ----------

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function lerCurso(request) {
    let d;
    try { d = await request.json(); } catch { return { erro: "Dados inválidos." }; }
    const titulo = String(d?.titulo || "").trim();
    const slug = String(d?.slug || "").trim().toLowerCase();
    const preco = Math.round(Number(String(d?.preco ?? "").replace(/\./g, "").replace(",", ".")) * 100);
    if (!titulo || titulo.length > 120) return { erro: "Informe o título (até 120 caracteres)." };
    if (!SLUG.test(slug) || slug.length > 80) return { erro: "O endereço só pode ter letras minúsculas, números e hífens (ex.: imposto-na-irlanda)." };
    if (!Number.isFinite(preco) || preco < 100 || preco > 10000000) return { erro: "Informe um preço entre R$ 1,00 e R$ 100.000,00." };
    return {
        titulo, slug, preco,
        resumo: String(d?.resumo || "").trim().slice(0, 300),
        descricao: String(d?.descricao || "").trim().slice(0, 20000),
        publicado: d?.publicado ? 1 : 0,
    };
}

async function rotasCursosAdmin(request, url, metodo, db) {
    if (url.pathname === "/api/admin/cursos" && metodo === "GET") {
        const { results } = await db.prepare(
            `SELECT c.*, (SELECT COUNT(*) FROM matriculas m WHERE m.curso_id = c.id) AS alunos,
                    (SELECT COUNT(*) FROM aulas a WHERE a.curso_id = c.id) AS aulas
             FROM cursos c ORDER BY c.id DESC`).all();
        return json({ cursos: results.map((c) => ({ ...c, preco: reais(c.preco_centavos) })) });
    }
    const id = /^\/api\/admin\/cursos\/(\d+)$/.exec(url.pathname)?.[1];
    if ((url.pathname === "/api/admin/cursos" && metodo === "POST") || (id && metodo === "PUT")) {
        const c = await lerCurso(request);
        if (c.erro) return json({ erro: c.erro }, 422);
        try {
            if (id) {
                const r = await db.prepare(
                    "UPDATE cursos SET titulo = ?, slug = ?, resumo = ?, descricao = ?, preco_centavos = ?, publicado = ? WHERE id = ?")
                    .bind(c.titulo, c.slug, c.resumo, c.descricao, c.preco, c.publicado, Number(id)).run();
                if (!r.meta.changes) return json({ erro: "Curso não encontrado." }, 404);
                return json({ id: Number(id) });
            }
            const novo = await db.prepare(
                "INSERT INTO cursos (titulo, slug, resumo, descricao, preco_centavos, publicado) VALUES (?, ?, ?, ?, ?, ?) RETURNING id")
                .bind(c.titulo, c.slug, c.resumo, c.descricao, c.preco, c.publicado).first();
            return json({ id: novo.id }, 201);
        } catch (erro) {
            if (/UNIQUE/i.test(String(erro))) return json({ erro: "Já existe um curso com esse endereço." }, 409);
            throw erro;
        }
    }
    return json({ erro: "Não encontrado." }, 404);
}

// ---------- Aulas ----------

async function lerAula(request) {
    let d;
    try { d = await request.json(); } catch { return { erro: "Dados inválidos." }; }
    const titulo = String(d?.titulo || "").trim();
    const video = String(d?.video || "").trim();
    const minutos = Number(d?.duracao_min || 0);
    if (!titulo || titulo.length > 160) return { erro: "Informe o título da aula (até 160 caracteres)." };
    if (video && (video.length > 500 || !playerDoVideo(video))) {
        return { erro: "Link de vídeo não reconhecido. Use um link do YouTube, Vimeo, Bunny Stream ou Cloudflare Stream." };
    }
    if (!Number.isInteger(minutos) || minutos < 0 || minutos > 1440) return { erro: "Duração em minutos inválida." };
    return {
        titulo, video, minutos,
        modulo: String(d?.modulo || "").trim().slice(0, 120),
        descricao: String(d?.descricao || "").trim().slice(0, 20000),
        gratis: d?.gratis ? 1 : 0,
        publicado: d?.publicado === false ? 0 : 1,
    };
}

async function rotasAulasAdmin(request, url, metodo, db) {
    const doCurso = /^\/api\/admin\/cursos\/(\d+)\/aulas(\/ordem)?$/.exec(url.pathname);
    if (doCurso) {
        const cursoId = Number(doCurso[1]);
        const curso = await db.prepare("SELECT id FROM cursos WHERE id = ?").bind(cursoId).first();
        if (!curso) return json({ erro: "Curso não encontrado." }, 404);
        if (!doCurso[2] && metodo === "GET") {
            const { results } = await db.prepare(
                `SELECT a.*, (SELECT COUNT(*) FROM progresso p WHERE p.aula_id = a.id) AS concluiram
                 FROM aulas a WHERE a.curso_id = ? ORDER BY a.ordem, a.id`).bind(cursoId).all();
            return json({ aulas: results });
        }
        if (!doCurso[2] && metodo === "POST") {
            const a = await lerAula(request);
            if (a.erro) return json({ erro: a.erro }, 422);
            const nova = await db.prepare(
                `INSERT INTO aulas (curso_id, modulo, titulo, descricao, video, duracao_min, gratis, publicado, ordem)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(ordem), 0) + 1 FROM aulas WHERE curso_id = ?)) RETURNING id`)
                .bind(cursoId, a.modulo, a.titulo, a.descricao, a.video, a.minutos, a.gratis, a.publicado, cursoId).first();
            return json({ id: nova.id }, 201);
        }
        if (doCurso[2] && metodo === "POST") {
            let d;
            try { d = await request.json(); } catch { return json({ erro: "Dados inválidos." }, 400); }
            const ids = Array.isArray(d?.ids) ? d.ids.map(Number) : [];
            const { results } = await db.prepare("SELECT id FROM aulas WHERE curso_id = ?").bind(cursoId).all();
            const atuais = new Set(results.map((r) => r.id));
            if (ids.length !== atuais.size || new Set(ids).size !== ids.length || !ids.every((id) => atuais.has(id))) {
                return json({ erro: "A lista de aulas mudou. Recarregue a página." }, 409);
            }
            if (ids.length) await db.batch(ids.map((id, i) => db.prepare("UPDATE aulas SET ordem = ? WHERE id = ?").bind(i + 1, id)));
            return json({ ok: true });
        }
    }
    const id = Number(/^\/api\/admin\/aulas\/(\d+)$/.exec(url.pathname)?.[1]);
    if (id && metodo === "PUT") {
        const a = await lerAula(request);
        if (a.erro) return json({ erro: a.erro }, 422);
        const r = await db.prepare(
            "UPDATE aulas SET modulo = ?, titulo = ?, descricao = ?, video = ?, duracao_min = ?, gratis = ?, publicado = ? WHERE id = ?")
            .bind(a.modulo, a.titulo, a.descricao, a.video, a.minutos, a.gratis, a.publicado, id).run();
        if (!r.meta.changes) return json({ erro: "Aula não encontrada." }, 404);
        return json({ id });
    }
    if (id && metodo === "DELETE") {
        const [, r] = await db.batch([
            db.prepare("DELETE FROM progresso WHERE aula_id = ?").bind(id),
            db.prepare("DELETE FROM aulas WHERE id = ?").bind(id),
        ]);
        if (!r.meta.changes) return json({ erro: "Aula não encontrada." }, 404);
        return json({ ok: true, mensagem: "Aula apagada." });
    }
    return json({ erro: "Não encontrado." }, 404);
}

async function rotasMatricula(request, db, alunoId, cursoId, metodo) {
    const aluno = await db.prepare("SELECT id FROM alunos WHERE id = ?").bind(alunoId).first();
    if (!aluno) return json({ erro: "Aluno não encontrado." }, 404);
    if (!cursoId && metodo === "POST") {
        let d;
        try { d = await request.json(); } catch { return json({ erro: "Dados inválidos." }, 400); }
        const curso = await db.prepare("SELECT id, titulo FROM cursos WHERE id = ?").bind(Number(d?.curso_id)).first();
        if (!curso) return json({ erro: "Curso não encontrado." }, 404);
        const r = await db.prepare("INSERT OR IGNORE INTO matriculas (aluno_id, curso_id, origem) VALUES (?, ?, 'manual')")
            .bind(alunoId, curso.id).run();
        if (!r.meta.changes) return json({ erro: "O aluno já tem este curso." }, 409);
        return json({ ok: true, mensagem: `Curso "${curso.titulo}" liberado.` });
    }
    if (cursoId && metodo === "DELETE") {
        const m = await db.prepare("SELECT origem FROM matriculas WHERE aluno_id = ? AND curso_id = ?").bind(alunoId, cursoId).first();
        if (!m) return json({ erro: "O aluno não tem este curso." }, 404);
        if (m.origem !== "manual") return json({ erro: "Este curso foi comprado. Para tirar o acesso, faça o reembolso no Mercado Pago." }, 422);
        await db.prepare("DELETE FROM matriculas WHERE aluno_id = ? AND curso_id = ?").bind(alunoId, cursoId).run();
        return json({ ok: true, mensagem: "Acesso ao curso removido." });
    }
    return json({ erro: "Não encontrado." }, 404);
}

// ---------- Vendas ----------

async function vendas(db) {
    const [lista, totais] = await db.batch([
        db.prepare(
            `SELECT p.id, p.status, p.valor_centavos, p.criado_em, p.pago_em, p.mp_pagamento,
                    a.id AS aluno_id, a.nome AS aluno, a.email, c.titulo AS curso
             FROM pedidos p JOIN alunos a ON a.id = p.aluno_id JOIN cursos c ON c.id = p.curso_id
             WHERE p.status != 'erro' ORDER BY p.id DESC LIMIT 500`),
        db.prepare(
            `SELECT
                COALESCE(SUM(CASE WHEN status = 'aprovado' THEN valor_centavos END), 0) AS receita_total,
                COALESCE(SUM(CASE WHEN status = 'aprovado' AND pago_em >= datetime('now', 'start of month') THEN valor_centavos END), 0) AS receita_mes,
                SUM(status = 'aprovado') AS aprovados,
                SUM(status = 'pendente') AS pendentes
             FROM pedidos`),
    ]);
    const t = totais.results[0];
    return json({
        receita_total: reais(t.receita_total), receita_mes: reais(t.receita_mes),
        aprovados: t.aprovados || 0, pendentes: t.pendentes || 0,
        vendas: lista.results.map((v) => ({ ...v, valor: reais(v.valor_centavos) })),
    });
}
