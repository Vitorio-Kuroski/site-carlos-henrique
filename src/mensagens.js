// Mensagens entre os alunos e o Carlos (e os outros administradores).
// Cada aluno tem uma conversa só; qualquer administrador (ADMIN_EMAILS) lê e responde.
//
// Aluno (logado):
//   GET  /api/conta/mensagens               a conversa (marca como lidas as respostas)
//   POST /api/conta/mensagens  { texto }    manda uma mensagem
//   GET  /api/conta/mensagens/novas         número de respostas não lidas (aviso na área do aluno)
// Administrador:
//   GET  /api/admin/mensagens               conversas, da mais recente para a mais antiga
//   GET  /api/admin/mensagens/nao-lidas     número de mensagens de alunos ainda não lidas (aviso no menu)
//   GET  /api/admin/mensagens/<aluno>       a conversa com o aluno (marca como lidas as mensagens dele)
//   POST /api/admin/mensagens/<aluno>  { texto }   responde ao aluno
//
// Aviso por e-mail (Resend): o aluno recebe um e-mail quando chega uma resposta e ele ainda não tinha nenhuma
// para ler; os administradores, quando um aluno escreve e não havia mensagem dele esperando. Assim uma conversa
// rápida não vira uma enxurrada de e-mails.
import { alunoLogado, ehAdmin, enviarEmail, garantirTabelas, json, listaAdmins } from "./alunos.js";

const TABELAS = [
    `CREATE TABLE IF NOT EXISTS mensagens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
        de_admin INTEGER NOT NULL DEFAULT 0,
        autor TEXT NOT NULL DEFAULT '',
        texto TEXT NOT NULL,
        criado_em TEXT NOT NULL DEFAULT (datetime('now')),
        lida_em TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS mensagens_aluno ON mensagens(aluno_id, id)`,
];

let prontas = false;
export async function garantirTabelasMensagens(db) {
    if (prontas) return;
    await garantirTabelas(db);
    await db.batch(TABELAS.map((sql) => db.prepare(sql)));
    prontas = true;
}

const LIMITE_TEXTO = 4000;
const COLUNAS = "id, de_admin, autor, texto, criado_em, lida_em";

function esc(texto) {
    return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

async function lerTexto(request) {
    let d;
    try { d = await request.json(); } catch { return { erro: "Dados inválidos." }; }
    const texto = String(d?.texto || "").replace(/\r\n/g, "\n").trim();
    if (!texto) return { erro: "Escreva a mensagem." };
    if (texto.length > LIMITE_TEXTO) return { erro: `A mensagem passou de ${LIMITE_TEXTO} caracteres. Divida em duas.` };
    return { texto };
}

function emailAviso({ titulo, nome, trecho, link, botao }) {
    const curto = trecho.length > 300 ? trecho.slice(0, 300) + "…" : trecho;
    const html = `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#18261F;max-width:520px">
<p>${esc(titulo)}</p>
<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #C9A24A;background:#F6F2E9;white-space:pre-line">${esc(curto)}</blockquote>
<p><a href="${esc(link)}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#0F3D2E;color:#F6F2E9;text-decoration:none">${esc(botao)}</a></p>
<p style="color:#56645C;font-size:13px">Responda pelo site, não por este e-mail.</p>
</div>`;
    return { html, texto: `${titulo}\n\n${nome}: ${curto}\n\n${botao}: ${link}\n\nResponda pelo site, não por este e-mail.` };
}

// ---------- Aluno ----------

async function rotasAluno(request, env, ctx, pathname, metodo) {
    const db = env.DB;
    const aluno = await alunoLogado(request, env);
    if (!aluno) return json({ erro: "Entre na sua conta de novo." }, 401);

    if (pathname === "/api/conta/mensagens/novas" && metodo === "GET") {
        const { n } = await db.prepare("SELECT COUNT(*) AS n FROM mensagens WHERE aluno_id = ? AND de_admin = 1 AND lida_em IS NULL")
            .bind(aluno.id).first();
        return json({ nao_lidas: n });
    }
    if (pathname !== "/api/conta/mensagens") return json({ erro: "Não encontrado." }, 404);

    if (metodo === "GET") {
        const [, lista] = await db.batch([
            db.prepare("UPDATE mensagens SET lida_em = datetime('now') WHERE aluno_id = ? AND de_admin = 1 AND lida_em IS NULL").bind(aluno.id),
            db.prepare(`SELECT ${COLUNAS} FROM (SELECT ${COLUNAS} FROM mensagens WHERE aluno_id = ? ORDER BY id DESC LIMIT 300) ORDER BY id`).bind(aluno.id),
        ]);
        return json({ mensagens: lista.results });
    }
    if (metodo === "POST") {
        const m = await lerTexto(request);
        if (m.erro) return json({ erro: m.erro }, 422);
        const recentes = await db.prepare(
            "SELECT COUNT(*) AS n FROM mensagens WHERE aluno_id = ? AND de_admin = 0 AND criado_em >= datetime('now', '-10 minutes')")
            .bind(aluno.id).first();
        if (recentes.n >= 20) return json({ erro: "Você mandou muitas mensagens seguidas. Espere alguns minutos." }, 429);
        // Já havia mensagem do aluno esperando leitura? Então os administradores já foram avisados
        const esperando = await db.prepare("SELECT 1 FROM mensagens WHERE aluno_id = ? AND de_admin = 0 AND lida_em IS NULL")
            .bind(aluno.id).first();
        const nova = await db.prepare(`INSERT INTO mensagens (aluno_id, de_admin, autor, texto) VALUES (?, 0, ?, ?) RETURNING ${COLUNAS}`)
            .bind(aluno.id, aluno.nome, m.texto).first();
        const admins = listaAdmins(env).filter((email) => email !== aluno.email.toLowerCase());
        if (!esperando && admins.length) {
            const link = new URL(`/admin/#/mensagens/${aluno.id}`, request.url).toString();
            const e = emailAviso({ titulo: `${aluno.nome} mandou uma mensagem pelo site.`, nome: aluno.nome, trecho: m.texto, link, botao: "Responder no painel" });
            ctx?.waitUntil?.(enviarEmail(env, { para: admins, assunto: `Mensagem de ${aluno.nome}`, html: e.html, texto: e.texto }));
        }
        return json({ mensagem: nova }, 201);
    }
    return json({ erro: "Não encontrado." }, 404);
}

// ---------- Administrador ----------

async function rotasAdminMensagens(request, env, ctx, pathname, metodo) {
    const db = env.DB;
    const eu = await alunoLogado(request, env);
    if (!eu) return json({ erro: "Não está logado." }, 401);
    if (!ehAdmin(env, eu.email)) return json({ erro: "Acesso só para administradores." }, 403);

    if (pathname === "/api/admin/mensagens/nao-lidas" && metodo === "GET") {
        const { n } = await db.prepare("SELECT COUNT(*) AS n FROM mensagens WHERE de_admin = 0 AND lida_em IS NULL").first();
        return json({ nao_lidas: n });
    }
    if (pathname === "/api/admin/mensagens" && metodo === "GET") {
        const { results } = await db.prepare(
            `SELECT a.id AS aluno_id, a.nome, a.email, m.texto, m.de_admin, m.autor, m.criado_em,
                    (SELECT COUNT(*) FROM mensagens x WHERE x.aluno_id = a.id AND x.de_admin = 0 AND x.lida_em IS NULL) AS nao_lidas
             FROM mensagens m JOIN alunos a ON a.id = m.aluno_id
             WHERE m.id = (SELECT MAX(id) FROM mensagens WHERE aluno_id = m.aluno_id)
             ORDER BY m.id DESC LIMIT 500`).all();
        return json({ conversas: results });
    }
    const alunoId = Number(/^\/api\/admin\/mensagens\/(\d+)$/.exec(pathname)?.[1]);
    if (!alunoId) return json({ erro: "Não encontrado." }, 404);
    const aluno = await db.prepare("SELECT id, nome, email FROM alunos WHERE id = ?").bind(alunoId).first();
    if (!aluno) return json({ erro: "Aluno não encontrado." }, 404);

    if (metodo === "GET") {
        const [, lista] = await db.batch([
            db.prepare("UPDATE mensagens SET lida_em = datetime('now') WHERE aluno_id = ? AND de_admin = 0 AND lida_em IS NULL").bind(alunoId),
            db.prepare(`SELECT ${COLUNAS} FROM (SELECT ${COLUNAS} FROM mensagens WHERE aluno_id = ? ORDER BY id DESC LIMIT 300) ORDER BY id`).bind(alunoId),
        ]);
        return json({ aluno, mensagens: lista.results });
    }
    if (metodo === "POST") {
        const m = await lerTexto(request);
        if (m.erro) return json({ erro: m.erro }, 422);
        // Só avisa por e-mail se o aluno não tinha nenhuma resposta esperando leitura
        const esperando = await db.prepare("SELECT 1 FROM mensagens WHERE aluno_id = ? AND de_admin = 1 AND lida_em IS NULL")
            .bind(alunoId).first();
        const autor = eu.nome.split(" ")[0];
        const nova = await db.prepare(`INSERT INTO mensagens (aluno_id, de_admin, autor, texto) VALUES (?, 1, ?, ?) RETURNING ${COLUNAS}`)
            .bind(alunoId, autor, m.texto).first();
        let email = "nao_precisou";
        if (!esperando) {
            const link = new URL("/conta/mensagens/", request.url).toString();
            const e = emailAviso({ titulo: `Olá, ${aluno.nome.split(" ")[0]}! Você recebeu uma resposta no site do Carlos Henrique.`,
                nome: autor, trecho: m.texto, link, botao: "Ver a mensagem" });
            email = await enviarEmail(env, { para: [aluno.email], assunto: "Você tem uma nova mensagem", html: e.html, texto: e.texto });
        }
        return json({ mensagem: nova, email }, 201);
    }
    return json({ erro: "Não encontrado." }, 404);
}

export async function rotasMensagens(request, env, ctx) {
    const url = new URL(request.url);
    const metodo = request.method;
    if (metodo !== "GET") {
        const origem = request.headers.get("Origin");
        if (!origem || new URL(origem).host !== url.host) return json({ erro: "Origem não permitida." }, 403);
    }
    await garantirTabelasMensagens(env.DB);
    if (url.pathname.startsWith("/api/admin/")) return rotasAdminMensagens(request, env, ctx, url.pathname, metodo);
    return rotasAluno(request, env, ctx, url.pathname, metodo);
}
