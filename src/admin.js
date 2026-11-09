// Painel do administrador: só para quem está logado com um e-mail do segredo ADMIN_EMAILS.
//
// Rotas (JSON):
//   GET    /api/admin/eu                     nome e e-mail do administrador logado (topo e menu do painel)
//   GET    /api/admin/resumo                 números do painel e os últimos cadastros
//   GET    /api/admin/alunos?busca=          lista de alunos, até 500
//   GET    /api/admin/alunos/<id>            ficha do aluno
//   POST   /api/admin/alunos/<id>/senha      manda ao aluno o link de senha nova
//   DELETE /api/admin/alunos/<id>            apaga a conta do aluno (e as sessões dele)
import { alunoLogado, ehAdmin, garantirTabelas, json, mandarLinkSenha } from "./alunos.js";

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
    const eu = await alunoLogado(request, env);
    if (!eu) return json({ erro: "Não está logado." }, 401);
    if (!ehAdmin(env, eu.email)) return json({ erro: "Acesso só para administradores." }, 403);

    const db = env.DB;
    const comAdmin = (a) => ({ ...a, admin: ehAdmin(env, a.email) });

    if (url.pathname === "/api/admin/eu" && metodo === "GET") {
        return json({ nome: eu.nome, email: eu.email });
    }

    if (url.pathname === "/api/admin/resumo" && metodo === "GET") {
        const [numeros, recentes] = await db.batch([
            db.prepare(
                `SELECT COUNT(*) AS total,
                        SUM(criado_em >= datetime('now', 'start of day')) AS hoje,
                        SUM(criado_em >= datetime('now', '-7 days')) AS ultimos7,
                        SUM(criado_em >= datetime('now', '-30 days')) AS ultimos30,
                        SUM(ultimo_acesso >= datetime('now', '-7 days')) AS ativos7
                 FROM alunos`),
            db.prepare(`SELECT ${COLUNAS} FROM alunos ORDER BY id DESC LIMIT 8`),
        ]);
        const n = numeros.results[0];
        return json({
            total: n.total, hoje: n.hoje || 0, ultimos7: n.ultimos7 || 0, ultimos30: n.ultimos30 || 0, ativos7: n.ativos7 || 0,
            recentes: recentes.results.map(comAdmin),
        });
    }

    if (url.pathname === "/api/admin/alunos" && metodo === "GET") {
        const busca = (url.searchParams.get("busca") || "").trim().slice(0, 100);
        const filtro = `%${busca.replace(/[%_\\]/g, "\\$&")}%`;
        const { results } = await db.prepare(
            `SELECT ${COLUNAS} FROM alunos
             WHERE ? = '' OR nome LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\'
             ORDER BY id DESC LIMIT 500`).bind(busca, filtro, filtro).all();
        return json({ alunos: results.map(comAdmin) });
    }

    const rota = /^\/api\/admin\/alunos\/(\d+)(\/senha)?$/.exec(url.pathname);
    if (!rota) return json({ erro: "Não encontrado." }, 404);
    const id = Number(rota[1]);
    const aluno = await db.prepare(`SELECT ${COLUNAS} FROM alunos WHERE id = ?`).bind(id).first();
    if (!aluno) return json({ erro: "Aluno não encontrado." }, 404);

    if (!rota[2] && metodo === "GET") {
        const { sessoes } = await db.prepare("SELECT COUNT(*) AS sessoes FROM sessoes WHERE aluno_id = ? AND expira_em > ?")
            .bind(id, Math.floor(Date.now() / 1000)).first();
        return json({ ...comAdmin(aluno), sessoes_ativas: sessoes });
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
        await db.batch([
            db.prepare("DELETE FROM sessoes WHERE aluno_id = ?").bind(id),
            db.prepare("DELETE FROM redefinicoes WHERE aluno_id = ?").bind(id),
            db.prepare("DELETE FROM alunos WHERE id = ?").bind(id),
        ]);
        return json({ ok: true });
    }

    return json({ erro: "Não encontrado." }, 404);
}
