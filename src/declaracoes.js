// Pedidos de declaração de imposto: o formulário do site (substitui o Tally) e a lista no painel.
//
// Página:
//   GET  /declaracao/formulario/            formulário (aluno logado já vem com nome e e-mail preenchidos)
// Rotas (JSON):
//   POST /api/declaracoes                   envia um pedido
//   GET  /api/admin/declaracoes             pedidos e o número de novos
//   GET  /api/admin/declaracoes/novos       número de pedidos novos (aviso no menu do painel)
//   GET  /api/admin/declaracoes/<id>        um pedido
//   PUT  /api/admin/declaracoes/<id>        { status, notas } muda a situação e as anotações internas
//   DELETE /api/admin/declaracoes/<id>      apaga o pedido (a pessoa pode pedir para apagar os dados)
//
// Aviso por e-mail (Resend): os administradores recebem cada pedido novo, e quem pediu recebe a confirmação.
// Proteção contra robôs: campo escondido, tempo mínimo para preencher e até 5 pedidos por hora por conexão.
// O formulário avisa para não mandar PPSN, senhas nem documentos.
import { alunoLogado, ehAdmin, enviarEmail, garantirTabelas, json, listaAdmins } from "./alunos.js";
import { esc, pagina } from "./cursos.js";

const TABELAS = [
    `CREATE TABLE IF NOT EXISTS declaracoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT NOT NULL,
        telefone TEXT NOT NULL DEFAULT '',
        servico TEXT NOT NULL,
        anos TEXT NOT NULL DEFAULT '[]',
        estado_civil TEXT NOT NULL DEFAULT '',
        revenue TEXT NOT NULL DEFAULT '',
        situacoes TEXT NOT NULL DEFAULT '[]',
        mensagem TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'novo',
        notas TEXT NOT NULL DEFAULT '',
        aluno_id INTEGER,
        origem_hash TEXT NOT NULL DEFAULT '',
        criado_em TEXT NOT NULL DEFAULT (datetime('now')),
        atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS declaracoes_status ON declaracoes(status, id)`,
];

let prontas = false;
export async function garantirTabelasDeclaracoes(db) {
    if (prontas) return;
    await garantirTabelas(db);
    await db.batch(TABELAS.map((sql) => db.prepare(sql)));
    prontas = true;
}

// Respostas possíveis (o que fica salvo é a chave; o texto aparece no site, no painel e nos e-mails)
export const SERVICOS = {
    empregado: "Declaração individual (empregado)",
    autonomo: "Declaração de self-employed (autônomo)",
    os_dois: "Sou empregado e também autônomo",
    nao_sei: "Não sei qual é o meu caso",
};
export const ESTADOS_CIVIS = {
    solteiro: "Solteiro(a)",
    casado: "Casado(a) ou em união civil",
    uniao: "Mora junto (sem união civil)",
    separado: "Separado(a) ou divorciado(a)",
    viuvo: "Viúvo(a)",
};
export const REVENUE = { myaccount: "Tenho myAccount", ros: "Tenho ROS", nao: "Ainda não tenho" };
export const SITUACOES = {
    aluguel: "Pago aluguel",
    medicas: "Tive despesas médicas",
    empregos: "Tive mais de um emprego",
    emergency: "Paguei emergency tax",
};
export const STATUS = { novo: "Novo", andamento: "Em andamento", concluido: "Concluído", arquivado: "Arquivado" };

// Anos de imposto oferecidos: os 4 anteriores ao ano atual
function anosOferecidos() {
    const atual = new Date().getUTCFullYear();
    return [1, 2, 3, 4].map((i) => String(atual - i));
}

const EMAIL_VALIDO = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

// ---------- Página ----------

export async function paginaFormulario(request, env) {
    const aluno = await alunoLogado(request, env);
    const opcoes = (nome, lista, tipo, obrigatorio = false) => Object.entries(lista).map(([valor, texto], i) => `
                        <label class="escolha"><input type="${tipo}" name="${nome}" value="${valor}"${obrigatorio && i === 0 && tipo === "radio" ? " required" : ""}><span>${esc(texto)}</span></label>`).join("");
    return pagina(request, {
        titulo: "Pedido de declaração de imposto",
        descricao: "Responda às perguntas e o Carlos entra em contato pelo seu e-mail para fazer a sua declaração de imposto na Irlanda.",
        script: false,
        extraHead: '\n    <script src="/declaracao/formulario.js" defer></script>',
        conteudo: `
        <section class="hero hero--pagina">
            <div class="caixa">
                <p class="rotulo"><span class="rotulo__linha"></span>Declaração de imposto</p>
                <h1>Quer fazer sua <em>declaração de imposto?</em></h1>
                <p class="hero__lead">Responda às perguntas abaixo e eu entro em contato pelo e-mail informado.</p>
            </div>
        </section>
        <section class="secao secao--papel formulario">
            <div class="caixa">
                <form class="formulario__cartao" id="form-declaracao" novalidate>
                    <label class="campo">Nome completo *
                        <input name="nome" required maxlength="120" autocomplete="name" value="${esc(aluno?.nome || "")}"></label>

                    <fieldset class="grupo">
                        <legend>Qual serviço você procura? *</legend>
                        ${opcoes("servico", SERVICOS, "radio", true)}
                    </fieldset>

                    <fieldset class="grupo">
                        <legend>Qual ano de imposto? Pode marcar mais de um *</legend>
                        <div class="grupo__linha">${anosOferecidos().map((a) => `
                        <label class="escolha escolha--curta"><input type="checkbox" name="anos" value="${a}"><span>${a}</span></label>`).join("")}
                        </div>
                    </fieldset>

                    <label class="campo">Estado civil
                        <select name="estado_civil">
                            <option value="">Selecione</option>
                            ${Object.entries(ESTADOS_CIVIS).map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join("")}
                        </select></label>

                    <fieldset class="grupo">
                        <legend>Você já tem acesso à Revenue?</legend>
                        ${opcoes("revenue", REVENUE, "radio")}
                    </fieldset>

                    <fieldset class="grupo">
                        <legend>Algum destes se aplica a você?</legend>
                        ${opcoes("situacoes", SITUACOES, "checkbox")}
                    </fieldset>

                    <div class="formulario__duas">
                        <label class="campo">Seu e-mail para resposta *
                            <input type="email" name="email" required maxlength="190" autocomplete="email" placeholder="voce@email.com" value="${esc(aluno?.email || "")}"></label>
                        <label class="campo">Telefone ou WhatsApp
                            <input type="tel" name="telefone" maxlength="40" autocomplete="tel" placeholder="+353 ..."></label>
                    </div>

                    <label class="campo">Algo mais que eu deva saber?
                        <textarea name="mensagem" rows="4" maxlength="3000"></textarea></label>

                    <p class="formulario__alerta">Não coloque seu PPSN, senhas nem documentos aqui. Se forem necessários, combinamos por e-mail a forma segura de enviar.</p>

                    <!-- Campo escondido: só robôs preenchem -->
                    <label class="formulario__robo" aria-hidden="true">Não preencha<input name="site" tabindex="-1" autocomplete="off"></label>
                    <input type="hidden" name="inicio" value="${Date.now()}">

                    <p class="conta__erro" id="erro" role="alert" hidden></p>
                    <button type="submit" class="botao">Enviar <span aria-hidden="true">→</span></button>
                </form>
                <div class="formulario__cartao formulario__ok" id="enviado" hidden tabindex="-1">
                    <p class="rotulo"><span class="rotulo__linha"></span>Pedido enviado</p>
                    <h2>Recebi o seu <em>pedido.</em></h2>
                    <p>Vou analisar as suas respostas e entro em contato pelo e-mail <strong id="enviado-email"></strong>. Confira também a caixa de spam.</p>
                    <p><a class="link-seta" href="/">Voltar para o site</a></p>
                </div>
            </div>
        </section>`,
    });
}

// ---------- Envio ----------

async function hashOrigem(request) {
    const ip = request.headers.get("CF-Connecting-IP") || "local";
    const dia = new Date().toISOString().slice(0, 10);
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ip}|${dia}|declaracao`));
    return [...new Uint8Array(bytes)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function linhas(d) {
    const anos = JSON.parse(d.anos);
    const situacoes = JSON.parse(d.situacoes);
    return [
        ["Nome", d.nome],
        ["E-mail", d.email],
        ["Telefone/WhatsApp", d.telefone || "—"],
        ["Serviço", SERVICOS[d.servico] || d.servico],
        ["Ano(s) de imposto", anos.join(", ") || "—"],
        ["Estado civil", ESTADOS_CIVIS[d.estado_civil] || "—"],
        ["Acesso à Revenue", REVENUE[d.revenue] || "—"],
        ["Se aplica", situacoes.map((s) => SITUACOES[s] || s).join(", ") || "—"],
        ["Mensagem", d.mensagem || "—"],
    ];
}

function emails(request, env, d) {
    const origem = new URL(request.url).origin;
    const tabela = linhas(d).map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#56645C;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;white-space:pre-line">${esc(v)}</td></tr>`).join("");
    const texto = linhas(d).map(([k, v]) => `${k}: ${v}`).join("\n");
    const estilo = 'style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#18261F;max-width:560px"';
    const envios = [];
    const admins = listaAdmins(env);
    if (admins.length) {
        const link = `${origem}/admin/#/declaracoes/${d.id}`;
        envios.push(enviarEmail(env, {
            para: admins,
            assunto: `Novo pedido de declaração: ${d.nome}`,
            html: `<div ${estilo}><p>Chegou um pedido de declaração pelo site.</p><table>${tabela}</table>
<p><a href="${esc(link)}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#0F3D2E;color:#F6F2E9;text-decoration:none">Abrir no painel</a></p></div>`,
            texto: `Chegou um pedido de declaração pelo site.\n\n${texto}\n\nAbrir no painel: ${link}`,
        }));
    }
    const primeiro = d.nome.split(" ")[0];
    envios.push(enviarEmail(env, {
        para: [d.email],
        assunto: "Recebi o seu pedido de declaração",
        html: `<div ${estilo}><p>Olá, ${esc(primeiro)}!</p><p>Recebi o seu pedido de declaração de imposto. Vou analisar as suas respostas e retorno por este e-mail.</p>
<p><strong>Não envie PPSN, senhas nem documentos por e-mail sem combinarmos antes</strong>: se forem necessários, eu explico a forma segura de enviar.</p>
<p>Carlos Henrique<br><span style="color:#56645C">Part-Qualified Accountant · Dublin</span></p></div>`,
        texto: `Olá, ${primeiro}!\n\nRecebi o seu pedido de declaração de imposto. Vou analisar as suas respostas e retorno por este e-mail.\n\n` +
            "Não envie PPSN, senhas nem documentos por e-mail sem combinarmos antes: se forem necessários, eu explico a forma segura de enviar.\n\nCarlos Henrique",
    }));
    return Promise.all(envios);
}

async function enviarPedido(request, env, ctx) {
    let d;
    try { d = await request.json(); } catch { return json({ erro: "Dados inválidos." }, 400); }
    // Robô: preencheu o campo escondido ou enviou rápido demais. Responde "ok" sem salvar.
    if (String(d?.site || "").trim() || Date.now() - Number(d?.inicio || 0) < 3000) return json({ ok: true });

    const nome = String(d?.nome || "").trim().replace(/\s+/g, " ");
    const email = String(d?.email || "").trim().toLowerCase();
    const telefone = String(d?.telefone || "").trim().slice(0, 40);
    const servico = String(d?.servico || "");
    const anosValidos = anosOferecidos();
    const anos = [...new Set((Array.isArray(d?.anos) ? d.anos : []).map(String))].filter((a) => anosValidos.includes(a)).sort().reverse();
    const estadoCivil = ESTADOS_CIVIS[d?.estado_civil] ? d.estado_civil : "";
    const revenue = REVENUE[d?.revenue] ? d.revenue : "";
    const situacoes = [...new Set((Array.isArray(d?.situacoes) ? d.situacoes : []).map(String))].filter((s) => SITUACOES[s]);
    const mensagem = String(d?.mensagem || "").replace(/\r\n?/g, "\n").trim().slice(0, 3000);

    if (nome.length < 3 || nome.length > 120) return json({ erro: "Escreva o seu nome completo." }, 422);
    if (!SERVICOS[servico]) return json({ erro: "Escolha o serviço que você procura." }, 422);
    if (!anos.length) return json({ erro: "Marque pelo menos um ano de imposto." }, 422);
    if (!EMAIL_VALIDO.test(email) || email.length > 190) return json({ erro: "Informe um e-mail válido para a resposta." }, 422);
    if (telefone && !/^[+()\d\s.-]{6,40}$/.test(telefone)) return json({ erro: "O telefone só pode ter números, espaços e +." }, 422);
    // PPSN tem 7 números e 1 ou 2 letras (ex.: 1234567T): melhor não guardar
    if (/\b\d{7}[a-w][a-iw]?\b/i.test(`${mensagem} ${nome}`)) {
        return json({ erro: "Parece que você escreveu um número PPSN. Apague esse número, por segurança: se for preciso, combinamos por e-mail." }, 422);
    }

    const db = env.DB;
    const origemHash = await hashOrigem(request);
    const recentes = await db.prepare("SELECT COUNT(*) AS n FROM declaracoes WHERE origem_hash = ? AND criado_em >= datetime('now', '-1 hour')")
        .bind(origemHash).first();
    if (recentes.n >= 5) return json({ erro: "Você enviou vários pedidos seguidos. Espere um pouco ou escreva pelo Instagram." }, 429);

    const aluno = await alunoLogado(request, env);
    const novo = await db.prepare(
        `INSERT INTO declaracoes (nome, email, telefone, servico, anos, estado_civil, revenue, situacoes, mensagem, aluno_id, origem_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`)
        .bind(nome, email, telefone, servico, JSON.stringify(anos), estadoCivil, revenue, JSON.stringify(situacoes), mensagem,
            aluno?.id ?? null, origemHash).first();
    const avisos = emails(request, env, novo).catch((erro) => console.error("Falha nos e-mails do pedido de declaração", erro));
    if (ctx?.waitUntil) ctx.waitUntil(avisos); else await avisos;
    return json({ ok: true }, 201);
}

// ---------- Painel ----------

function comTextos(d) {
    return {
        ...d,
        anos: JSON.parse(d.anos),
        situacoes: JSON.parse(d.situacoes),
        servico_texto: SERVICOS[d.servico] || d.servico,
        estado_civil_texto: ESTADOS_CIVIS[d.estado_civil] || "",
        revenue_texto: REVENUE[d.revenue] || "",
        situacoes_texto: JSON.parse(d.situacoes).map((s) => SITUACOES[s] || s),
    };
}

async function rotasAdminDeclaracoes(request, env, url, metodo) {
    const db = env.DB;
    const eu = await alunoLogado(request, env);
    if (!eu) return json({ erro: "Não está logado." }, 401);
    if (!ehAdmin(env, eu.email)) return json({ erro: "Acesso só para administradores." }, 403);

    if (url.pathname === "/api/admin/declaracoes/novos" && metodo === "GET") {
        const { n } = await db.prepare("SELECT COUNT(*) AS n FROM declaracoes WHERE status = 'novo'").first();
        return json({ novos: n });
    }
    if (url.pathname === "/api/admin/declaracoes" && metodo === "GET") {
        const filtro = STATUS[url.searchParams.get("status")] ? url.searchParams.get("status") : "";
        const [lista, contagem] = await db.batch([
            db.prepare(`SELECT d.*, a.id AS aluno FROM declaracoes d LEFT JOIN alunos a ON a.id = d.aluno_id OR lower(a.email) = d.email
                        WHERE ? = '' OR d.status = ? GROUP BY d.id ORDER BY d.id DESC LIMIT 500`).bind(filtro, filtro),
            db.prepare("SELECT status, COUNT(*) AS n FROM declaracoes GROUP BY status"),
        ]);
        return json({
            declaracoes: lista.results.map(comTextos),
            contagem: Object.fromEntries(contagem.results.map((c) => [c.status, c.n])),
        });
    }
    const id = Number(/^\/api\/admin\/declaracoes\/(\d+)$/.exec(url.pathname)?.[1]);
    if (!id) return json({ erro: "Não encontrado." }, 404);
    if (metodo === "GET") {
        const d = await db.prepare(
            `SELECT d.*, (SELECT id FROM alunos a WHERE a.id = d.aluno_id OR lower(a.email) = d.email LIMIT 1) AS aluno
             FROM declaracoes d WHERE d.id = ?`).bind(id).first();
        return d ? json({ declaracao: comTextos(d) }) : json({ erro: "Pedido não encontrado." }, 404);
    }
    if (metodo === "PUT") {
        let d;
        try { d = await request.json(); } catch { return json({ erro: "Dados inválidos." }, 400); }
        if (!STATUS[d?.status]) return json({ erro: "Situação inválida." }, 422);
        const notas = String(d?.notas || "").slice(0, 5000);
        const r = await db.prepare("UPDATE declaracoes SET status = ?, notas = ?, atualizado_em = datetime('now') WHERE id = ?")
            .bind(d.status, notas, id).run();
        return r.meta.changes ? json({ ok: true }) : json({ erro: "Pedido não encontrado." }, 404);
    }
    if (metodo === "DELETE") {
        const r = await db.prepare("DELETE FROM declaracoes WHERE id = ?").bind(id).run();
        return r.meta.changes ? json({ ok: true }) : json({ erro: "Pedido não encontrado." }, 404);
    }
    return json({ erro: "Não encontrado." }, 404);
}

// ---------- Roteamento ----------

export async function rotasDeclaracoes(request, env, ctx) {
    const url = new URL(request.url);
    const metodo = request.method;
    if (metodo !== "GET" && metodo !== "HEAD") {
        const origem = request.headers.get("Origin");
        if (!origem || new URL(origem).host !== url.host) return json({ erro: "Origem não permitida." }, 403);
    }
    await garantirTabelasDeclaracoes(env.DB);
    if (url.pathname === "/declaracao/formulario") return Response.redirect(new URL("/declaracao/formulario/", url).toString(), 301);
    if (url.pathname === "/declaracao/formulario/" && (metodo === "GET" || metodo === "HEAD")) return paginaFormulario(request, env);
    if (url.pathname === "/api/declaracoes" && metodo === "POST") return enviarPedido(request, env, ctx);
    if (url.pathname.startsWith("/api/admin/declaracoes")) return rotasAdminDeclaracoes(request, env, url, metodo);
    return null;
}
