// Painel do administrador: só para quem está logado com um e-mail do segredo ADMIN_EMAILS.
//
// Rotas (JSON):
//   GET    /api/admin/resumo          número de alunos e de cadastros nos últimos 7 e 30 dias
//   GET    /api/admin/alunos?busca=   lista de alunos (nome, e-mail, data do cadastro), até 500
//   DELETE /api/admin/alunos/<id>     apaga a conta do aluno (e as sessões dele)
import { alunoLogado, ehAdmin, garantirTabelas, json } from "./alunos.js";

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
    if (url.pathname === "/api/admin/resumo" && metodo === "GET") {
        const r = await db.prepare(
            `SELECT COUNT(*) AS total,
                    SUM(criado_em >= datetime('now', '-7 days')) AS ultimos7,
                    SUM(criado_em >= datetime('now', '-30 days')) AS ultimos30
             FROM alunos`).first();
        return json({ total: r.total, ultimos7: r.ultimos7 || 0, ultimos30: r.ultimos30 || 0 });
    }

    if (url.pathname === "/api/admin/alunos" && metodo === "GET") {
        const busca = (url.searchParams.get("busca") || "").trim().slice(0, 100);
        const filtro = `%${busca.replace(/[%_\\]/g, "\\$&")}%`;
        const { results } = await db.prepare(
            `SELECT id, nome, email, criado_em FROM alunos
             WHERE ? = '' OR nome LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\'
             ORDER BY id DESC LIMIT 500`).bind(busca, filtro, filtro).all();
        return json({ alunos: results.map((a) => ({ ...a, admin: ehAdmin(env, a.email) })) });
    }

    const apagar = /^\/api\/admin\/alunos\/(\d+)$/.exec(url.pathname);
    if (apagar && metodo === "DELETE") {
        const id = Number(apagar[1]);
        if (id === eu.id) return json({ erro: "Você não pode apagar a sua própria conta por aqui." }, 422);
        const alvo = await db.prepare("SELECT email FROM alunos WHERE id = ?").bind(id).first();
        if (!alvo) return json({ erro: "Aluno não encontrado." }, 404);
        if (ehAdmin(env, alvo.email)) return json({ erro: "Não dá para apagar um administrador." }, 422);
        await db.batch([
            db.prepare("DELETE FROM sessoes WHERE aluno_id = ?").bind(id),
            db.prepare("DELETE FROM alunos WHERE id = ?").bind(id),
        ]);
        return json({ ok: true });
    }

    return json({ erro: "Não encontrado." }, 404);
}
