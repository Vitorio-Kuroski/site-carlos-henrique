// Aulas dos cursos (etapa 3): página da aula com o vídeo, lista de aulas e progresso do aluno.
//
// Páginas:
//   GET  /cursos/<slug>/assistir/          leva para a próxima aula que o aluno ainda não terminou
//   GET  /cursos/<slug>/aulas/<id>/        aula: vídeo, texto, lista de aulas, anterior/próxima
// Rotas (JSON):
//   POST /api/conta/aulas/<id>/concluida  { concluida: true|false }   marca ou desmarca a aula
//
// Quem vê uma aula: aluno matriculado no curso, administrador, ou qualquer pessoa se a aula for "grátis"
// (aula de amostra). Os vídeos ficam num serviço de vídeo (YouTube não listado, Vimeo, Bunny Stream ou
// Cloudflare Stream); o site guarda só o link e mostra o player dentro da página da aula.
import { alunoLogado, ehAdmin, json } from "./alunos.js";
import { duracao, esc, pagina, paragrafos } from "./cursos.js";

// ---------- Vídeo ----------

// Converte o link colado no painel no endereço do player. Devolve null se o link não for de um serviço aceito.
export function playerDoVideo(link) {
    const texto = String(link || "").trim();
    if (!texto) return null;
    // Cloudflare Stream: só o ID (32 letras/números) ou um link do Stream
    if (/^[a-f0-9]{32}$/i.test(texto)) return `https://iframe.videodelivery.net/${texto}`;
    let url;
    try { url = new URL(texto); } catch { return null; }
    if (url.protocol !== "https:") return null;
    const host = url.hostname.replace(/^www\.|^m\./, "");
    const partes = url.pathname.split("/").filter(Boolean);
    const id = (valor, regra) => (regra.test(valor || "") ? valor : null);

    if (host === "youtube.com" || host === "youtube-nocookie.com") {
        const v = id(url.searchParams.get("v"), /^[\w-]{11}$/)
            || (["embed", "shorts", "live"].includes(partes[0]) && id(partes[1], /^[\w-]{11}$/));
        return v ? `https://www.youtube-nocookie.com/embed/${v}?rel=0&modestbranding=1` : null;
    }
    if (host === "youtu.be") {
        const v = id(partes[0], /^[\w-]{11}$/);
        return v ? `https://www.youtube-nocookie.com/embed/${v}?rel=0&modestbranding=1` : null;
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
        const i = partes[0] === "video" ? 1 : 0;
        const v = id(partes[i], /^\d+$/);
        if (!v) return null;
        const hash = id(partes[i + 1], /^[a-f0-9]+$/i) || id(url.searchParams.get("h"), /^[a-f0-9]+$/i);
        return `https://player.vimeo.com/video/${v}${hash ? `?h=${hash}` : ""}`;
    }
    if (host === "iframe.mediadelivery.net" || host === "player.mediadelivery.net") {
        // Bunny Stream: /embed/<biblioteca>/<id> ou /play/<biblioteca>/<id>
        const biblioteca = id(partes[1], /^\d+$/);
        const v = id(partes[2], /^[a-f0-9-]{36}$/i);
        return ["embed", "play"].includes(partes[0]) && biblioteca && v ? `https://iframe.mediadelivery.net/embed/${biblioteca}/${v}` : null;
    }
    if (host === "iframe.videodelivery.net" || /^customer-[a-z0-9]+\.cloudflarestream\.com$/.test(host)) {
        const v = id(partes[0], /^[a-f0-9]{32}$/i);
        return v ? `https://iframe.videodelivery.net/${v}` : null;
    }
    return null;
}

// ---------- Dados ----------

// Aulas publicadas do curso, na ordem, com "concluida" para o aluno (0 se não houver aluno)
export async function aulasDoCurso(db, cursoId, alunoId = 0, comRascunhos = false) {
    const { results } = await db.prepare(
        `SELECT a.id, a.modulo, a.titulo, a.duracao_min, a.gratis, a.publicado,
                (p.aula_id IS NOT NULL) AS concluida
         FROM aulas a LEFT JOIN progresso p ON p.aula_id = a.id AND p.aluno_id = ?
         WHERE a.curso_id = ? ${comRascunhos ? "" : "AND a.publicado = 1"}
         ORDER BY a.ordem, a.id`).bind(alunoId, cursoId).all();
    return results;
}

// Agrupa as aulas pelos módulos, na ordem em que aparecem
export function porModulo(aulas) {
    const grupos = [];
    for (const aula of aulas) {
        const ultimo = grupos[grupos.length - 1];
        if (ultimo && ultimo.nome === aula.modulo) ultimo.aulas.push(aula);
        else grupos.push({ nome: aula.modulo, aulas: [aula] });
    }
    return grupos;
}

async function temMatricula(db, alunoId, cursoId) {
    return Boolean(await db.prepare("SELECT 1 FROM matriculas WHERE aluno_id = ? AND curso_id = ?").bind(alunoId, cursoId).first());
}

// Progresso de cada curso do aluno: total de aulas, concluídas e a próxima aula
export async function progressoDosCursos(db, alunoId) {
    const { results } = await db.prepare(
        `SELECT a.curso_id, a.id, (p.aula_id IS NOT NULL) AS concluida
         FROM aulas a JOIN matriculas m ON m.curso_id = a.curso_id AND m.aluno_id = ?
         LEFT JOIN progresso p ON p.aula_id = a.id AND p.aluno_id = ?
         WHERE a.publicado = 1 ORDER BY a.ordem, a.id`).bind(alunoId, alunoId).all();
    const porCurso = {};
    for (const a of results) {
        const c = (porCurso[a.curso_id] ??= { total: 0, concluidas: 0, proxima: null });
        c.total++;
        if (a.concluida) c.concluidas++;
        else if (!c.proxima) c.proxima = a.id;
    }
    return porCurso;
}

// ---------- Páginas ----------

const ICONE_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const ICONE_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>';

function listaDeAulas(curso, aulas, atual, podeTudo) {
    return porModulo(aulas).map((m) => `
                    <div class="aulas__modulo">
                        ${m.nome ? `<p class="aulas__nome">${esc(m.nome)}</p>` : ""}
                        <ol class="aulas__lista">${m.aulas.map((a) => {
                            const liberada = podeTudo || a.gratis;
                            const classe = ["aulas__item", a.id === atual ? "aulas__item--atual" : "", a.concluida ? "aulas__item--feita" : ""].filter(Boolean).join(" ");
                            const conteudo = `<span class="aulas__icone">${a.concluida ? ICONE_CHECK : ICONE_PLAY}</span>
                                <span class="aulas__titulo">${esc(a.titulo)}${a.publicado ? "" : " <em>(rascunho)</em>"}</span>
                                <span class="aulas__tempo">${duracao(a.duracao_min)}</span>`;
                            return `
                            <li class="${classe}" data-aula="${a.id}">${liberada
                                ? `<a href="/cursos/${esc(curso.slug)}/aulas/${a.id}/"${a.id === atual ? ' aria-current="page"' : ""}>${conteudo}</a>`
                                : `<span class="aulas__bloqueada">${conteudo}</span>`}</li>`;
                        }).join("")}
                        </ol>
                    </div>`).join("");
}

function redirecionar(request, caminho) {
    return Response.redirect(new URL(caminho, request.url).toString(), 302);
}

// Quem é a pessoa e o que ela pode ver neste curso
async function acesso(request, env, curso) {
    const aluno = await alunoLogado(request, env);
    const admin = Boolean(aluno && ehAdmin(env, aluno.email));
    const matriculado = Boolean(aluno && await temMatricula(env.DB, aluno.id, curso.id));
    return { aluno, admin, matriculado, podeTudo: admin || matriculado };
}

export async function paginaAssistir(request, env, slug) {
    const curso = await env.DB.prepare("SELECT * FROM cursos WHERE slug = ?").bind(slug).first();
    if (!curso) return redirecionar(request, "/cursos/");
    const { aluno, podeTudo } = await acesso(request, env, curso);
    if (!aluno) return redirecionar(request, `/conta/entrar/?voltar=${encodeURIComponent(`/cursos/${slug}/assistir/`)}`);
    if (!podeTudo) return redirecionar(request, `/cursos/${slug}/`);
    const aulas = await aulasDoCurso(env.DB, curso.id, aluno.id);
    const proxima = aulas.find((a) => !a.concluida) || aulas[0];
    if (!proxima) {
        return pagina(request, {
            titulo: curso.titulo, descricao: curso.resumo, indexar: false,
            conteudo: `<section class="hero hero--pagina"><div class="caixa"><p class="rotulo"><span class="rotulo__linha"></span>${esc(curso.titulo)}</p>
                <h1>As aulas estão <em>a caminho.</em></h1><p class="hero__lead">Você já tem acesso ao curso. As aulas aparecem aqui assim que forem publicadas.</p>
                <p style="margin-top:2rem"><a class="botao" href="/conta/">Voltar para a área do aluno</a></p></div></section>`,
        });
    }
    return redirecionar(request, `/cursos/${slug}/aulas/${proxima.id}/`);
}

export async function paginaAula(request, env, slug, aulaId) {
    const db = env.DB;
    const curso = await db.prepare("SELECT * FROM cursos WHERE slug = ?").bind(slug).first();
    const aula = curso && await db.prepare("SELECT * FROM aulas WHERE id = ? AND curso_id = ?").bind(aulaId, curso.id).first();
    if (!aula) return redirecionar(request, curso ? `/cursos/${slug}/` : "/cursos/");

    const { aluno, admin, matriculado, podeTudo } = await acesso(request, env, curso);
    if (!aula.publicado && !admin) return redirecionar(request, `/cursos/${slug}/`);
    if (!podeTudo && !aula.gratis) {
        if (!aluno) return redirecionar(request, `/conta/entrar/?voltar=${encodeURIComponent(new URL(request.url).pathname)}`);
        return redirecionar(request, `/cursos/${slug}/#compra`);
    }

    const aulas = await aulasDoCurso(db, curso.id, matriculado ? aluno.id : 0, admin);
    const posicao = aulas.findIndex((a) => a.id === aula.id);
    const liberada = (a) => a && (podeTudo || a.gratis);
    const anterior = liberada(aulas[posicao - 1]) ? aulas[posicao - 1] : null;
    const proxima = liberada(aulas[posicao + 1]) ? aulas[posicao + 1] : null;
    const concluidas = aulas.filter((a) => a.concluida).length;
    const feita = Boolean(aulas[posicao]?.concluida);
    const player = playerDoVideo(aula.video);
    const link = (a) => `/cursos/${esc(slug)}/aulas/${a.id}/`;
    const meta = [aula.modulo, `Aula ${posicao + 1} de ${aulas.length}`, duracao(aula.duracao_min)].filter(Boolean).map(esc).join(" · ");

    const lateral = matriculado
        ? `<div class="aulas__progresso" id="progresso" data-total="${aulas.length}">
                        <p><strong id="progresso-texto">${concluidas} de ${aulas.length}</strong> aulas concluídas</p>
                        <div class="barra" role="progressbar" aria-label="Progresso no curso" aria-valuemin="0" aria-valuemax="${aulas.length}" aria-valuenow="${concluidas}">
                            <span id="progresso-barra" style="width:${aulas.length ? Math.round((concluidas / aulas.length) * 100) : 0}%"></span></div>
                    </div>`
        : podeTudo
            ? `<p class="nota aulas__aviso">Você está vendo como administrador. O progresso só é salvo para alunos.</p>`
            : `<div class="aulas__progresso"><p><strong>Aula grátis</strong> de amostra.</p>
                        <a class="botao botao--pequeno" href="/cursos/${esc(slug)}/#compra">Ver o curso completo</a></div>`;

    return pagina(request, {
        titulo: `${aula.titulo} · ${curso.titulo}`,
        descricao: curso.resumo || curso.titulo,
        indexar: false,
        conteudo: `
        <section class="aula" id="aula" data-aula="${aula.id}">
            <div class="caixa aula__grade">
                <div class="aula__principal">
                    <p class="aula__curso"><a href="/cursos/${esc(slug)}/">← ${esc(curso.titulo)}</a></p>
                    ${player
                        ? `<div class="aula__video"><iframe src="${esc(player)}" title="${esc(aula.titulo)}" loading="lazy"
                            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
                        : aula.video
                            ? `<div class="aula__video aula__video--vazio"><p>O link do vídeo desta aula não é reconhecido.</p></div>`
                            : ""}
                    <p class="aula__meta">${meta}</p>
                    <h1 class="aula__titulo">${esc(aula.titulo)}</h1>
                    ${aula.descricao ? `<div class="post__texto aula__texto">${paragrafos(aula.descricao)}</div>` : ""}
                    <div class="aula__acoes">
                        ${matriculado ? `<button type="button" class="botao${feita ? " botao--feito" : ""}" id="concluir" aria-pressed="${feita}"
                            data-proxima="${proxima ? link(proxima) : ""}">${feita ? `${ICONE_CHECK} Aula concluída` : "Marcar como concluída"}</button>` : ""}
                        <p class="conta__erro" id="erro" role="alert" hidden></p>
                    </div>
                    <nav class="aula__nav" aria-label="Outras aulas">
                        ${anterior ? `<a class="link-seta" href="${link(anterior)}"><span aria-hidden="true">←</span> ${esc(anterior.titulo)}</a>` : "<span></span>"}
                        ${proxima ? `<a class="link-seta" href="${link(proxima)}">${esc(proxima.titulo)} <span aria-hidden="true">→</span></a>` : ""}
                    </nav>
                </div>
                <aside class="aula__lateral" aria-label="Aulas do curso">
                    ${lateral}
                    ${listaDeAulas(curso, aulas, aula.id, podeTudo)}
                </aside>
            </div>
        </section>`,
    });
}

// ---------- Progresso ----------

export async function marcarAula(request, env, aulaId) {
    const aluno = await alunoLogado(request, env);
    if (!aluno) return json({ erro: "Entre na sua conta de novo." }, 401);
    const aula = await env.DB.prepare("SELECT id, curso_id FROM aulas WHERE id = ? AND publicado = 1").bind(aulaId).first();
    if (!aula || !await temMatricula(env.DB, aluno.id, aula.curso_id)) return json({ erro: "Aula não encontrada." }, 404);
    let d;
    try { d = await request.json(); } catch { return json({ erro: "Dados inválidos." }, 400); }
    if (d?.concluida === false) {
        await env.DB.prepare("DELETE FROM progresso WHERE aluno_id = ? AND aula_id = ?").bind(aluno.id, aula.id).run();
    } else {
        await env.DB.prepare("INSERT OR IGNORE INTO progresso (aluno_id, aula_id) VALUES (?, ?)").bind(aluno.id, aula.id).run();
    }
    const { n } = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM progresso p JOIN aulas a ON a.id = p.aula_id
         WHERE p.aluno_id = ? AND a.curso_id = ? AND a.publicado = 1`).bind(aluno.id, aula.curso_id).first();
    return json({ ok: true, concluida: d?.concluida !== false, concluidas: n });
}
