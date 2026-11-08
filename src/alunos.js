// Cadastro e login de alunos, com o banco de dados D1 (binding DB).
//
// Rotas (todas em JSON):
//   POST /api/conta/cadastro  { nome, email, senha }  cria a conta e já entra
//   POST /api/conta/entrar    { email, senha }        entra
//   POST /api/conta/sair                              sai (apaga a sessão)
//   GET  /api/conta/eu                                dados de quem está logado (e se é administrador), ou 401
//
// Administradores: os e-mails do segredo ADMIN_EMAILS (painel do Cloudflare, separados por vírgula).
// Ficam fora do código porque o repositório é público.
// Senhas: PBKDF2-SHA256 com sal aleatório; nunca são guardadas em texto.
// Sessão: token aleatório num cookie HttpOnly; no banco fica só o hash do token.
// Tentativas de login: 5 erros em 15 minutos bloqueiam aquele e-mail por 15 minutos.

const ITERACOES = 100000; // máximo aceito pelo PBKDF2 do Cloudflare Workers
const SESSAO_DIAS = 30;
const LIMITE_ERROS = 5;
const JANELA_ERROS = 15 * 60; // segundos
const COOKIE = "sessao";

// Cria as tabelas na primeira requisição (não precisa rodar migração à parte)
const TABELAS = [
    `CREATE TABLE IF NOT EXISTS alunos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        nome TEXT NOT NULL,
        senha_hash TEXT NOT NULL,
        senha_sal TEXT NOT NULL,
        criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS sessoes (
        token_hash TEXT PRIMARY KEY,
        aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
        expira_em INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS sessoes_aluno ON sessoes(aluno_id)`,
    `CREATE TABLE IF NOT EXISTS tentativas_login (
        email TEXT NOT NULL,
        momento INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS tentativas_email ON tentativas_login(email, momento)`,
];
let tabelasProntas = false;

export async function garantirTabelas(db) {
    if (tabelasProntas) return;
    await db.batch(TABELAS.map((sql) => db.prepare(sql)));
    tabelasProntas = true;
}

const agora = () => Math.floor(Date.now() / 1000);
const paraHex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
const deHex = (hex) => new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));

export function json(dados, status = 200, cabecalhos = {}) {
    return new Response(JSON.stringify(dados), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cabecalhos },
    });
}

async function hashSenha(senha, salHex) {
    const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", hash: "SHA-256", salt: deHex(salHex), iterations: ITERACOES }, chave, 256);
    return paraHex(bits);
}

// Comparação em tempo constante, para não vazar quanto do hash bateu
function iguais(a, b) {
    if (a.length !== b.length) return false;
    let dif = 0;
    for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return dif === 0;
}

async function sha256(texto) {
    return paraHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)));
}

function tokenDoCookie(request) {
    return new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]{64})`).exec(request.headers.get("Cookie") || "")?.[1];
}

function cookieSessao(token, maxAge) {
    return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

async function criarSessao(db, alunoId) {
    const token = paraHex(crypto.getRandomValues(new Uint8Array(32)));
    const expira = agora() + SESSAO_DIAS * 86400;
    await db.batch([
        db.prepare("DELETE FROM sessoes WHERE expira_em < ?").bind(agora()),
        db.prepare("INSERT INTO sessoes (token_hash, aluno_id, expira_em) VALUES (?, ?, ?)")
            .bind(await sha256(token), alunoId, expira),
    ]);
    return cookieSessao(token, SESSAO_DIAS * 86400);
}

// Aluno da sessão atual, ou null. Exportado para as próximas etapas (liberar cursos, área do aluno).
export async function alunoLogado(request, env) {
    const token = tokenDoCookie(request);
    if (!token) return null;
    await garantirTabelas(env.DB);
    return env.DB.prepare(
        `SELECT a.id, a.nome, a.email FROM sessoes s JOIN alunos a ON a.id = s.aluno_id
         WHERE s.token_hash = ? AND s.expira_em > ?`).bind(await sha256(token), agora()).first();
}

// O e-mail está na lista do segredo ADMIN_EMAILS?
export function ehAdmin(env, email) {
    const lista = String(env.ADMIN_EMAILS || "").toLowerCase().split(/[,;\s]+/).filter(Boolean);
    return Boolean(email) && lista.includes(String(email).toLowerCase());
}

async function lerDados(request) {
    try {
        const dados = await request.json();
        return dados && typeof dados === "object" ? dados : null;
    } catch {
        return null;
    }
}

const emailValido = (email) => email.length <= 200 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email);

async function cadastro(request, env) {
    const dados = await lerDados(request);
    if (!dados) return json({ erro: "Dados inválidos." }, 400);
    const nome = String(dados.nome || "").trim().replace(/\s+/g, " ");
    const email = String(dados.email || "").trim().toLowerCase();
    const senha = String(dados.senha || "");
    if (!nome || nome.length > 100) return json({ erro: "Informe o seu nome." }, 422);
    if (!emailValido(email)) return json({ erro: "Informe um e-mail válido." }, 422);
    if (senha.length < 8 || senha.length > 200) return json({ erro: "A senha precisa ter pelo menos 8 caracteres." }, 422);

    const sal = paraHex(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await hashSenha(senha, sal);
    let aluno;
    try {
        aluno = await env.DB.prepare(
            "INSERT INTO alunos (email, nome, senha_hash, senha_sal) VALUES (?, ?, ?, ?) RETURNING id")
            .bind(email, nome, hash, sal).first();
    } catch (erro) {
        if (/UNIQUE/i.test(String(erro))) return json({ erro: "Já existe uma conta com este e-mail. Entre com a sua senha." }, 409);
        throw erro;
    }
    return json({ nome, email }, 201, { "Set-Cookie": await criarSessao(env.DB, aluno.id) });
}

async function entrar(request, env) {
    const dados = await lerDados(request);
    if (!dados) return json({ erro: "Dados inválidos." }, 400);
    const email = String(dados.email || "").trim().toLowerCase();
    const senha = String(dados.senha || "");
    const db = env.DB;

    const { erros } = await db.prepare("SELECT COUNT(*) AS erros FROM tentativas_login WHERE email = ? AND momento > ?")
        .bind(email, agora() - JANELA_ERROS).first();
    if (erros >= LIMITE_ERROS) {
        return json({ erro: "Muitas tentativas. Espere 15 minutos e tente de novo." }, 429);
    }

    const aluno = await db.prepare("SELECT id, nome, email, senha_hash, senha_sal FROM alunos WHERE email = ?")
        .bind(email).first();
    // Sem conta, calcula um hash mesmo assim: a resposta leva o mesmo tempo e não revela quem tem conta
    const hash = await hashSenha(senha, aluno?.senha_sal || "00".repeat(16));
    if (!aluno || !iguais(hash, aluno.senha_hash)) {
        await db.batch([
            db.prepare("DELETE FROM tentativas_login WHERE momento < ?").bind(agora() - JANELA_ERROS),
            db.prepare("INSERT INTO tentativas_login (email, momento) VALUES (?, ?)").bind(email, agora()),
        ]);
        return json({ erro: "E-mail ou senha incorretos." }, 401);
    }
    await db.prepare("DELETE FROM tentativas_login WHERE email = ?").bind(email).run();
    return json({ nome: aluno.nome, email: aluno.email }, 200, { "Set-Cookie": await criarSessao(db, aluno.id) });
}

async function sair(request, env) {
    const token = tokenDoCookie(request);
    if (token) await env.DB.prepare("DELETE FROM sessoes WHERE token_hash = ?").bind(await sha256(token)).run();
    return json({ ok: true }, 200, { "Set-Cookie": cookieSessao("", 0) });
}

export async function rotasConta(request, env) {
    const { pathname } = new URL(request.url);
    const metodo = request.method;
    if (metodo === "POST") {
        // Só aceita envios do próprio site
        const origem = request.headers.get("Origin");
        if (origem && new URL(origem).host !== new URL(request.url).host) return json({ erro: "Origem não permitida." }, 403);
    }
    await garantirTabelas(env.DB);

    if (pathname === "/api/conta/cadastro" && metodo === "POST") return cadastro(request, env);
    if (pathname === "/api/conta/entrar" && metodo === "POST") return entrar(request, env);
    if (pathname === "/api/conta/sair" && metodo === "POST") return sair(request, env);
    if (pathname === "/api/conta/eu" && metodo === "GET") {
        const aluno = await alunoLogado(request, env);
        return aluno ? json({ nome: aluno.nome, email: aluno.email, admin: ehAdmin(env, aluno.email) })
            : json({ erro: "Não está logado." }, 401);
    }
    return json({ erro: "Não encontrado." }, 404);
}
