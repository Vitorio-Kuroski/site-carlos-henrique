// Painel do administrador: menu lateral, barra de cima e as páginas Painel, Alunos e Ficha do aluno.
// Conversa com as rotas /api/admin/* do Worker (src/admin.js). Navegação pelo endereço: #/, #/alunos, #/alunos/<id>.
const conteudo = document.getElementById("conteudo");
const titulo = document.querySelector(".adm-barra__titulo");
const formatoData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const formatoDataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const ICONES = {
    email: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/></svg>',
    chave: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/></svg>',
    lixo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    voltar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
};

// Texto do usuário entra sempre escapado
function esc(texto) {
    return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Datas do banco vêm em UTC ("2026-11-09 18:30:00")
function data(valor, comHora = false) {
    if (!valor) return "—";
    const d = new Date(valor.replace(" ", "T") + "Z");
    return (comHora ? formatoDataHora : formatoData).format(d);
}

function iniciais(nome) {
    const partes = String(nome || "").trim().split(/\s+/);
    return ((partes[0]?.[0] || "") + (partes.length > 1 ? partes.at(-1)[0] : "")).toUpperCase() || "··";
}

async function api(rota, opcoes) {
    const resposta = await fetch(rota, opcoes);
    if (resposta.status === 401) {
        location.replace("/conta/entrar/");
        throw new Error("Não está logado.");
    }
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw Object.assign(new Error(dados.erro || "Não deu certo."), { status: resposta.status });
    return dados;
}

function aviso(texto, tipo) {
    return texto ? `<p class="adm-aviso adm-aviso--${tipo}" role="status">${esc(texto)}</p>` : "";
}

function seloAluno(a) {
    if (a.admin) return '<span class="adm-selo adm-selo--ouro">Administrador</span>';
    if (!a.ultimo_acesso) return '<span class="adm-selo adm-selo--cinza">Sem acesso</span>';
    const dias = (Date.now() - new Date(a.ultimo_acesso.replace(" ", "T") + "Z")) / 86400000;
    return dias <= 7 ? '<span class="adm-selo adm-selo--verde">Ativo</span>' : '<span class="adm-selo adm-selo--cinza">Inativo</span>';
}

const SELOS_PEDIDO = {
    aprovado: ["verde", "Aprovado"], pendente: ["ouro", "Pendente"], recusado: ["vermelho", "Recusado"],
    cancelado: ["cinza", "Cancelado"], reembolsado: ["vermelho", "Reembolsado"],
};
function seloPedido(status) {
    const [cor, texto] = SELOS_PEDIDO[status] || ["cinza", status];
    return `<span class="adm-selo adm-selo--${cor}">${esc(texto)}</span>`;
}

function tabelaAlunos(alunos, vazio) {
    if (!alunos.length) return `<p class="adm-vazio">${esc(vazio)}</p>`;
    const linhas = alunos.map((a) => `
        <tr data-id="${a.id}" tabindex="0">
            <td data-rotulo="Nome">${esc(a.nome)}</td>
            <td data-rotulo="E-mail">${esc(a.email)}</td>
            <td data-rotulo="Cadastro">${data(a.criado_em)}</td>
            <td data-rotulo="Último acesso">${data(a.ultimo_acesso)}</td>
            <td>${seloAluno(a)}</td>
            <td class="adm-seta" aria-hidden="true">→</td>
        </tr>`).join("");
    return `<table class="adm-tabela">
        <thead><tr><th>Nome</th><th>E-mail</th><th>Cadastro</th><th>Último acesso</th><th>Situação</th><th></th></tr></thead>
        <tbody>${linhas}</tbody></table>`;
}

// Clique (ou Enter) numa linha abre a ficha do aluno
conteudo.addEventListener("click", (e) => {
    const linha = e.target.closest("tr[data-id]");
    if (linha) location.hash = `#/alunos/${linha.dataset.id}`;
});
conteudo.addEventListener("keydown", (e) => {
    const linha = e.target.closest("tr[data-id]");
    if (linha && e.key === "Enter") location.hash = `#/alunos/${linha.dataset.id}`;
});

// ---------- Páginas ----------

async function paginaPainel() {
    titulo.textContent = "Painel de controle";
    const r = await api("/api/admin/resumo");
    atualizarContador(r.ultimos7);
    conteudo.innerHTML = `
        <div class="adm-cabeca"><h1>Visão geral<small>Como está a área do aluno hoje.</small></h1>
            <div class="adm-acoes"><a class="adm-botao adm-botao--principal" href="#/alunos">Ver todos os alunos</a></div></div>
        <div class="adm-cartoes">
            <div class="adm-cartao"><p class="adm-cartao__rotulo">Alunos cadastrados</p><p class="adm-cartao__valor">${r.total}</p></div>
            <div class="adm-cartao adm-cartao--verde"><p class="adm-cartao__rotulo">Novos hoje</p><p class="adm-cartao__valor">${r.hoje}</p></div>
            <div class="adm-cartao"><p class="adm-cartao__rotulo">Novos em 7 dias</p><p class="adm-cartao__valor">${r.ultimos7}</p>
                <p class="adm-cartao__nota">${r.ultimos30} nos últimos 30 dias</p></div>
            <div class="adm-cartao"><p class="adm-cartao__rotulo">Ativos em 7 dias</p><p class="adm-cartao__valor">${r.ativos7}</p>
                <p class="adm-cartao__nota">entraram na conta na última semana</p></div>
            <div class="adm-cartao adm-cartao--verde"><p class="adm-cartao__rotulo">Receita do mês</p><p class="adm-cartao__valor">${esc(r.receita_mes)}</p>
                <p class="adm-cartao__nota">${r.vendas_mes} ${r.vendas_mes === 1 ? "venda aprovada" : "vendas aprovadas"} · <a href="#/vendas">ver vendas</a></p></div>
        </div>
        <section class="adm-bloco">
            <div class="adm-bloco__cabeca"><h2>Últimos cadastros</h2><a class="link-seta" href="#/alunos">Ver todos</a></div>
            ${tabelaAlunos(r.recentes, "Ainda não há alunos cadastrados.")}
        </section>
`;
}

async function paginaAlunos() {
    titulo.textContent = "Alunos";
    conteudo.innerHTML = `
        <div class="adm-cabeca"><h1>Alunos<small>Toque num aluno para abrir a ficha.</small></h1></div>
        <section class="adm-bloco">
            <div class="adm-bloco__cabeca"><h2 id="qtd">Todos</h2>
                <label class="campo"><span class="sr-only">Buscar</span>
                    <input id="busca" type="search" placeholder="Buscar por nome ou e-mail" maxlength="100"></label>
            </div>
            <div id="lista"><p class="adm-vazio">Carregando…</p></div>
        </section>`;
    const busca = document.getElementById("busca");
    async function carregar() {
        const { alunos } = await api("/api/admin/alunos?busca=" + encodeURIComponent(busca.value.trim()));
        document.getElementById("qtd").textContent = `${alunos.length} ${alunos.length === 1 ? "aluno" : "alunos"}`;
        document.getElementById("lista").innerHTML = tabelaAlunos(alunos, "Nenhum aluno encontrado.");
    }
    let espera;
    busca.addEventListener("input", () => { clearTimeout(espera); espera = setTimeout(carregar, 300); });
    await carregar();
}

async function paginaAluno(id, mensagem = "", tipo = "ok") {
    titulo.textContent = "Ficha do aluno";
    const a = await api(`/api/admin/alunos/${id}`);
    conteudo.innerHTML = `
        ${aviso(mensagem, tipo)}
        <div class="adm-cabeca">
            <h1>Aluno #${a.id}<small>${esc(a.nome)}</small></h1>
            <div class="adm-acoes">
                <a class="adm-botao" href="#/alunos">${ICONES.voltar}Voltar</a>
                <a class="adm-botao" href="mailto:${esc(a.email)}">${ICONES.email}Mandar e-mail</a>
                <button type="button" class="adm-botao adm-botao--principal" id="senha">${ICONES.chave}Enviar link de senha nova</button>
                ${a.admin ? "" : `<button type="button" class="adm-botao adm-botao--perigo" id="apagar">${ICONES.lixo}Apagar conta</button>`}
            </div>
        </div>
        <div class="adm-cartoes">
            <div class="adm-cartao"><p class="adm-cartao__rotulo">Aluno</p><p class="adm-cartao__valor adm-cartao__valor--texto">${esc(a.nome)}</p>
                <p class="adm-cartao__nota">${esc(a.email)}</p></div>
            <div class="adm-cartao"><p class="adm-cartao__rotulo">Situação</p><p class="adm-cartao__valor adm-cartao__valor--texto">${seloAluno(a)}</p>
                <p class="adm-cartao__nota">${a.sessoes_ativas} ${a.sessoes_ativas === 1 ? "sessão aberta" : "sessões abertas"}</p></div>
            <div class="adm-cartao"><p class="adm-cartao__rotulo">Cadastro</p><p class="adm-cartao__valor adm-cartao__valor--texto">${data(a.criado_em, true)}</p></div>
            <div class="adm-cartao"><p class="adm-cartao__rotulo">Último acesso</p><p class="adm-cartao__valor adm-cartao__valor--texto">${data(a.ultimo_acesso, true)}</p></div>
            <div class="adm-cartao adm-cartao--verde"><p class="adm-cartao__rotulo">Total pago</p><p class="adm-cartao__valor">${esc(a.total_pago)}</p></div>
        </div>
        <section class="adm-bloco">
            <div class="adm-bloco__cabeca"><h2>Cursos (${a.cursos.length})</h2></div>
            ${a.cursos.length ? `<table class="adm-tabela adm-tabela--fixa">
                <thead><tr><th>Curso</th><th>Progresso</th><th>Liberado em</th><th>Como</th><th></th></tr></thead><tbody>
                ${a.cursos.map((c) => `<tr><td data-rotulo="Curso">${esc(c.titulo)}</td>
                    <td data-rotulo="Progresso">${c.aulas ? `${c.concluidas} de ${c.aulas} aulas` : "—"}</td><td data-rotulo="Liberado em">${data(c.criado_em)}</td>
                    <td data-rotulo="Como">${c.origem === "compra" ? "Compra" : "Liberado à mão"}</td>
                    <td>${c.origem === "manual" ? `<button type="button" class="adm-mini" data-remover="${c.id}" data-titulo="${esc(c.titulo)}">Remover acesso</button>` : ""}</td></tr>`).join("")}
                </tbody></table>` : '<p class="adm-vazio">Este aluno ainda não tem cursos.</p>'}
            <div class="adm-liberar">
                <select id="curso-liberar" aria-label="Curso para liberar"><option value="">Carregando os cursos…</option></select>
                <button type="button" class="adm-botao adm-botao--principal" id="liberar">Liberar curso</button>
            </div>
        </section>
        <section class="adm-bloco">
            <div class="adm-bloco__cabeca"><h2>Pagamentos</h2></div>
            ${a.pedidos.length ? `<table class="adm-tabela adm-tabela--fixa">
                <thead><tr><th>Pedido</th><th>Curso</th><th>Valor</th><th>Data</th><th>Situação</th></tr></thead><tbody>
                ${a.pedidos.map((p) => `<tr><td data-rotulo="Pedido">#${p.id}</td><td data-rotulo="Curso">${esc(p.titulo)}</td>
                    <td data-rotulo="Valor">${esc(p.valor)}</td><td data-rotulo="Data">${data(p.pago_em || p.criado_em, true)}</td><td>${seloPedido(p.status)}</td></tr>`).join("")}
                </tbody></table>` : '<p class="adm-vazio">Nenhum pagamento.</p>'}
        </section>`;

    // Liberar curso: só os que o aluno ainda não tem
    const { cursos } = await api("/api/admin/cursos");
    const temCurso = new Set(a.cursos.map((c) => c.id));
    const opcoes = cursos.filter((c) => !temCurso.has(c.id));
    const select = document.getElementById("curso-liberar");
    select.innerHTML = opcoes.length
        ? '<option value="">Escolha um curso…</option>' + opcoes.map((c) => `<option value="${c.id}">${esc(c.titulo)}${c.publicado ? "" : " (não publicado)"}</option>`).join("")
        : `<option value="">${cursos.length ? "O aluno já tem todos os cursos" : "Nenhum curso cadastrado"}</option>`;
    document.getElementById("liberar").disabled = !opcoes.length;
    document.getElementById("liberar").addEventListener("click", async (e) => {
        if (!select.value) return;
        const titulo = select.options[select.selectedIndex].text;
        if (!confirm(`Liberar "${titulo}" para ${a.nome}, sem pagamento?`)) return;
        e.currentTarget.disabled = true;
        try {
            const r = await api(`/api/admin/alunos/${a.id}/cursos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ curso_id: Number(select.value) }) });
            await paginaAluno(a.id, r.mensagem, "ok");
        } catch (falha) {
            await paginaAluno(a.id, falha.message, "erro");
        }
    });
    conteudo.querySelectorAll("[data-remover]").forEach((botao) => botao.addEventListener("click", async () => {
        if (!confirm(`Tirar o acesso de ${a.nome} ao curso "${botao.dataset.titulo}"?`)) return;
        try {
            const r = await api(`/api/admin/alunos/${a.id}/cursos/${botao.dataset.remover}`, { method: "DELETE" });
            await paginaAluno(a.id, r.mensagem, "ok");
        } catch (falha) {
            await paginaAluno(a.id, falha.message, "erro");
        }
    }));

    document.getElementById("senha").addEventListener("click", async (e) => {
        if (!confirm(`Enviar um link de senha nova para ${a.email}?`)) return;
        e.currentTarget.disabled = true;
        try {
            const r = await api(`/api/admin/alunos/${a.id}/senha`, { method: "POST" });
            await paginaAluno(a.id, r.mensagem, "ok");
        } catch (falha) {
            await paginaAluno(a.id, falha.message, "erro");
        }
    });
    document.getElementById("apagar")?.addEventListener("click", async (e) => {
        if (!confirm(`Apagar a conta de ${a.nome} (${a.email})? Isso não pode ser desfeito.`)) return;
        e.currentTarget.disabled = true;
        try {
            await api(`/api/admin/alunos/${a.id}`, { method: "DELETE" });
            location.hash = "#/alunos";
        } catch (falha) {
            await paginaAluno(a.id, falha.message, "erro");
        }
    });
}

async function paginaCursos() {
    titulo.textContent = "Cursos";
    const { cursos } = await api("/api/admin/cursos");
    conteudo.innerHTML = `
        <div class="adm-cabeca"><h1>Cursos<small>Os publicados aparecem em /cursos/ para venda.</small></h1>
            <div class="adm-acoes"><a class="adm-botao" href="/cursos/" target="_blank" rel="noopener">Ver a página de cursos</a>
            <a class="adm-botao adm-botao--principal" href="#/cursos/novo">+ Novo curso</a></div></div>
        <section class="adm-bloco">
            ${cursos.length ? `<table class="adm-tabela">
                <thead><tr><th>Curso</th><th>Preço</th><th>Aulas</th><th>Alunos</th><th>Situação</th><th></th></tr></thead><tbody>
                ${cursos.map((c) => `<tr data-curso="${c.id}" tabindex="0"><td data-rotulo="Curso">${esc(c.titulo)}</td><td data-rotulo="Preço">${esc(c.preco)}</td>
                    <td data-rotulo="Aulas">${c.aulas}</td><td data-rotulo="Alunos">${c.alunos}</td>
                    <td>${c.publicado ? '<span class="adm-selo adm-selo--verde">Publicado</span>' : '<span class="adm-selo adm-selo--cinza">Rascunho</span>'}</td>
                    <td class="adm-seta" aria-hidden="true">→</td></tr>`).join("")}
                </tbody></table>` : '<p class="adm-vazio">Nenhum curso ainda. Toque em "Novo curso" para criar o primeiro.</p>'}
        </section>`;
    conteudo.querySelectorAll("tr[data-curso]").forEach((tr) => {
        const abrir = () => { location.hash = `#/cursos/${tr.dataset.curso}`; };
        tr.addEventListener("click", abrir);
        tr.addEventListener("keydown", (e) => { if (e.key === "Enter") abrir(); });
    });
}

function slugDe(texto) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

async function paginaCursoForm(id, mensagem = "", tipo = "ok") {
    const novo = id === "novo";
    titulo.textContent = novo ? "Novo curso" : "Editar curso";
    const c = novo ? { titulo: "", slug: "", resumo: "", descricao: "", preco_centavos: 0, publicado: 0 }
        : (await api("/api/admin/cursos")).cursos.find((x) => x.id === Number(id));
    if (!c) throw new Error("Curso não encontrado.");
    const preco = c.preco_centavos ? (c.preco_centavos / 100).toFixed(2).replace(".", ",") : "";
    conteudo.innerHTML = `
        ${aviso(mensagem, tipo)}
        <div class="adm-cabeca"><h1>${novo ? "Novo curso" : esc(c.titulo)}<small>${novo ? "Comece como rascunho e publique quando estiver pronto." : `${c.alunos} ${c.alunos === 1 ? "aluno" : "alunos"} · endereço /cursos/${esc(c.slug)}/`}</small></h1>
            <div class="adm-acoes"><a class="adm-botao" href="#/cursos">${ICONES.voltar}Voltar</a>
            ${!novo && c.publicado ? `<a class="adm-botao" href="/cursos/${esc(c.slug)}/" target="_blank" rel="noopener">Ver a página</a>` : ""}</div></div>
        <section class="adm-bloco">
            <form class="adm-form" id="form-curso" novalidate>
                <div class="adm-form__linha">
                    <label class="campo">Título<input name="titulo" required maxlength="120" value="${esc(c.titulo)}"></label>
                    <label class="campo">Preço (R$)<input name="preco" required inputmode="decimal" placeholder="97,00" value="${preco}"></label>
                </div>
                <label class="campo">Endereço da página <span class="adm-form__dica">henriqueaccountant.com/cursos/<b id="previa-slug">${esc(c.slug) || "…"}</b>/</span>
                    <input name="slug" required maxlength="80" pattern="[a-z0-9]+(-[a-z0-9]+)*" value="${esc(c.slug)}"></label>
                <label class="campo">Resumo <span class="adm-form__dica">uma ou duas frases, aparece na lista e no Google</span>
                    <input name="resumo" maxlength="300" value="${esc(c.resumo)}"></label>
                <label class="campo">Descrição <span class="adm-form__dica">para quem é, o que a pessoa aprende… Deixe uma linha em branco entre os parágrafos; linhas começando com "- " viram lista.</span>
                    <textarea name="descricao" maxlength="20000">${esc(c.descricao)}</textarea></label>
                <label class="adm-check"><input type="checkbox" name="publicado" ${c.publicado ? "checked" : ""}> Publicado (aparece em /cursos/ e pode ser comprado)</label>
                <p class="conta__erro" id="erro-curso" role="alert" hidden></p>
                <div class="adm-form__acoes"><button type="submit" class="adm-botao adm-botao--principal">${novo ? "Criar curso" : "Salvar"}</button></div>
            </form>
        </section>
        ${novo ? "" : '<section class="adm-bloco" id="bloco-aulas"><p class="adm-vazio">Carregando as aulas…</p></section>'}`;
    if (!novo) await blocoAulas(c);
    const form = document.getElementById("form-curso");
    let slugManual = !novo;
    form.slug.addEventListener("input", () => { slugManual = true; document.getElementById("previa-slug").textContent = form.slug.value || "…"; });
    form.titulo.addEventListener("input", () => {
        if (slugManual) return;
        form.slug.value = slugDe(form.titulo.value);
        document.getElementById("previa-slug").textContent = form.slug.value || "…";
    });
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const erro = document.getElementById("erro-curso");
        erro.hidden = true;
        const botao = form.querySelector("button[type=submit]");
        botao.disabled = true;
        try {
            const corpo = {
                titulo: form.titulo.value, slug: form.slug.value, resumo: form.resumo.value, descricao: form.descricao.value,
                preco: form.preco.value, publicado: form.publicado.checked,
            };
            const r = await api(novo ? "/api/admin/cursos" : `/api/admin/cursos/${id}`, {
                method: novo ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo),
            });
            if (novo) location.hash = `#/cursos/${r.id}`;
            else await paginaCursoForm(id, "Curso salvo.", "ok");
        } catch (falha) {
            erro.textContent = falha.message;
            erro.hidden = false;
            botao.disabled = false;
        }
    });
}

// Aulas do curso, dentro da página de editar curso: lista, ordem (subir/descer) e link para editar
async function blocoAulas(curso) {
    const bloco = document.getElementById("bloco-aulas");
    const { aulas } = await api(`/api/admin/cursos/${curso.id}/aulas`);
    bloco.innerHTML = `
        <div class="adm-bloco__cabeca"><h2>Aulas (${aulas.length})</h2>
            <div class="adm-acoes">${aulas.length ? `<a class="adm-botao" href="/cursos/${esc(curso.slug)}/assistir/" target="_blank" rel="noopener">Ver como aluno</a>` : ""}
            <a class="adm-botao adm-botao--principal" href="#/cursos/${curso.id}/aulas/nova">+ Nova aula</a></div></div>
        ${aulas.length ? `<table class="adm-tabela adm-tabela--aulas">
            <thead><tr><th>Ordem</th><th>Aula</th><th>Vídeo</th><th>Duração</th><th>Concluíram</th><th></th></tr></thead><tbody>
            ${aulas.map((a, i) => `<tr data-aula="${a.id}" tabindex="0">
                <td class="adm-ordem"><button type="button" class="adm-mini adm-mini--neutro" data-mover="-1" aria-label="Subir ${esc(a.titulo)}" ${i ? "" : "disabled"}>↑</button><button type="button" class="adm-mini adm-mini--neutro" data-mover="1" aria-label="Descer ${esc(a.titulo)}" ${i < aulas.length - 1 ? "" : "disabled"}>↓</button></td>
                <td data-rotulo="Aula"><strong>${i + 1}. ${esc(a.titulo)}</strong>${a.modulo ? `<br><small>${esc(a.modulo)}</small>` : ""}
                    ${a.gratis ? ' <span class="adm-selo adm-selo--ouro">Grátis</span>' : ""}${a.publicado ? "" : ' <span class="adm-selo adm-selo--cinza">Rascunho</span>'}</td>
                <td data-rotulo="Vídeo">${a.video ? "Sim" : '<span class="adm-selo adm-selo--vermelho">Sem vídeo</span>'}</td>
                <td data-rotulo="Duração">${a.duracao_min ? `${a.duracao_min} min` : "—"}</td>
                <td data-rotulo="Concluíram">${a.concluiram}</td>
                <td class="adm-seta" aria-hidden="true">→</td></tr>`).join("")}
            </tbody></table>` : '<p class="adm-vazio">Nenhuma aula ainda. Toque em "Nova aula" para cadastrar a primeira.</p>'}`;
    bloco.querySelectorAll("tr[data-aula]").forEach((tr) => {
        const abrir = () => { location.hash = `#/cursos/${curso.id}/aulas/${tr.dataset.aula}`; };
        tr.addEventListener("click", (e) => { if (!e.target.closest("button")) abrir(); });
        tr.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target === tr) abrir(); });
    });
    bloco.querySelectorAll("[data-mover]").forEach((botao) => botao.addEventListener("click", async () => {
        const ids = aulas.map((a) => a.id);
        const i = ids.indexOf(Number(botao.closest("tr").dataset.aula));
        const j = i + Number(botao.dataset.mover);
        [ids[i], ids[j]] = [ids[j], ids[i]];
        bloco.querySelectorAll("button").forEach((b) => { b.disabled = true; });
        try {
            await api(`/api/admin/cursos/${curso.id}/aulas/ordem`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
        } catch (falha) {
            alert(falha.message);
        }
        await blocoAulas(curso);
        bloco.querySelector(`tr[data-aula="${ids[j]}"] [data-mover="${botao.dataset.mover}"]`)?.focus();
    }));
}

async function paginaAulaForm(cursoId, id, mensagem = "", tipo = "ok") {
    const nova = id === "nova";
    titulo.textContent = nova ? "Nova aula" : "Editar aula";
    const [{ cursos }, { aulas }] = await Promise.all([api("/api/admin/cursos"), api(`/api/admin/cursos/${cursoId}/aulas`)]);
    const curso = cursos.find((c) => c.id === Number(cursoId));
    if (!curso) throw new Error("Curso não encontrado.");
    const ultima = aulas[aulas.length - 1];
    const a = nova ? { modulo: ultima?.modulo || "", titulo: "", video: "", duracao_min: "", descricao: "", gratis: 0, publicado: 1 }
        : aulas.find((x) => x.id === Number(id));
    if (!a) throw new Error("Aula não encontrada.");
    const modulos = [...new Set(aulas.map((x) => x.modulo).filter(Boolean))];
    conteudo.innerHTML = `
        ${aviso(mensagem, tipo)}
        <div class="adm-cabeca"><h1>${nova ? "Nova aula" : esc(a.titulo)}<small>${esc(curso.titulo)}</small></h1>
            <div class="adm-acoes"><a class="adm-botao" href="#/cursos/${curso.id}">${ICONES.voltar}Voltar ao curso</a>
            ${nova ? "" : `<a class="adm-botao" href="/cursos/${esc(curso.slug)}/aulas/${a.id}/" target="_blank" rel="noopener">Ver a aula</a>
            <button type="button" class="adm-botao adm-botao--perigo" id="apagar-aula">${ICONES.lixo}Apagar aula</button>`}</div></div>
        <section class="adm-bloco">
            <form class="adm-form" id="form-aula" novalidate>
                <div class="adm-form__linha">
                    <label class="campo">Título da aula<input name="titulo" required maxlength="160" value="${esc(a.titulo)}"></label>
                    <label class="campo">Módulo <span class="adm-form__dica">opcional, agrupa as aulas</span>
                        <input name="modulo" maxlength="120" list="modulos" placeholder="Ex.: Módulo 1 · Primeiros passos" value="${esc(a.modulo)}"></label>
                    <datalist id="modulos">${modulos.map((m) => `<option value="${esc(m)}">`).join("")}</datalist>
                </div>
                <div class="adm-form__linha">
                    <label class="campo">Link do vídeo <span class="adm-form__dica">YouTube (não listado), Vimeo, Bunny Stream ou Cloudflare Stream</span>
                        <input name="video" maxlength="500" inputmode="url" placeholder="https://vimeo.com/123456789" value="${esc(a.video)}"></label>
                    <label class="campo">Duração (minutos)<input name="duracao_min" inputmode="numeric" pattern="[0-9]*" maxlength="4" value="${a.duracao_min || ""}"></label>
                </div>
                <label class="campo">Texto da aula <span class="adm-form__dica">resumo, exercícios, links de materiais (endereços https:// viram links). Linha em branco separa parágrafos; "- " vira lista.</span>
                    <textarea name="descricao" maxlength="20000">${esc(a.descricao)}</textarea></label>
                <label class="adm-check"><input type="checkbox" name="publicado" ${a.publicado ? "checked" : ""}> Publicada (os alunos do curso já veem)</label>
                <label class="adm-check"><input type="checkbox" name="gratis" ${a.gratis ? "checked" : ""}> Aula grátis (qualquer pessoa pode assistir, como amostra na página de venda)</label>
                <p class="conta__erro" id="erro-aula" role="alert" hidden></p>
                <div class="adm-form__acoes"><button type="submit" class="adm-botao adm-botao--principal">${nova ? "Criar aula" : "Salvar"}</button>
                    ${nova ? '<button type="submit" class="adm-botao" data-outra>Criar e cadastrar outra</button>' : ""}</div>
            </form>
        </section>`;
    const form = document.getElementById("form-aula");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const outra = e.submitter?.hasAttribute("data-outra");
        const erro = document.getElementById("erro-aula");
        erro.hidden = true;
        const botoes = form.querySelectorAll("button[type=submit]");
        botoes.forEach((b) => { b.disabled = true; });
        try {
            const corpo = {
                titulo: form.titulo.value, modulo: form.modulo.value, video: form.video.value, descricao: form.descricao.value,
                duracao_min: Number(form.duracao_min.value || 0), gratis: form.gratis.checked, publicado: form.publicado.checked,
            };
            if (!Number.isInteger(corpo.duracao_min)) throw new Error("Duração: use só números (minutos).");
            const r = await api(nova ? `/api/admin/cursos/${curso.id}/aulas` : `/api/admin/aulas/${id}`, {
                method: nova ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo),
            });
            if (outra) await paginaAulaForm(cursoId, "nova", `Aula "${corpo.titulo}" criada. Cadastre a próxima.`, "ok");
            else if (nova) location.hash = `#/cursos/${curso.id}/aulas/${r.id}`;
            else await paginaAulaForm(cursoId, id, "Aula salva.", "ok");
        } catch (falha) {
            erro.textContent = falha.message;
            erro.hidden = false;
            botoes.forEach((b) => { b.disabled = false; });
        }
    });
    document.getElementById("apagar-aula")?.addEventListener("click", async () => {
        if (!confirm(`Apagar a aula "${a.titulo}"? O progresso dos alunos nela também é apagado.`)) return;
        try {
            await api(`/api/admin/aulas/${a.id}`, { method: "DELETE" });
            location.hash = `#/cursos/${curso.id}`;
        } catch (falha) {
            await paginaAulaForm(cursoId, id, falha.message, "erro");
        }
    });
}

async function paginaVendas() {
    titulo.textContent = "Vendas";
    const v = await api("/api/admin/vendas");
    document.getElementById("contador-pendentes").textContent = v.pendentes;
    document.getElementById("contador-pendentes").hidden = !v.pendentes;
    conteudo.innerHTML = `
        <div class="adm-cabeca"><h1>Vendas<small>Pagamentos pelo Mercado Pago. O curso é liberado sozinho quando o pagamento é aprovado.</small></h1></div>
        <div class="adm-cartoes">
            <div class="adm-cartao adm-cartao--verde"><p class="adm-cartao__rotulo">Receita do mês</p><p class="adm-cartao__valor">${esc(v.receita_mes)}</p></div>
            <div class="adm-cartao"><p class="adm-cartao__rotulo">Receita total</p><p class="adm-cartao__valor">${esc(v.receita_total)}</p></div>
            <div class="adm-cartao"><p class="adm-cartao__rotulo">Vendas aprovadas</p><p class="adm-cartao__valor">${v.aprovados}</p></div>
            <div class="adm-cartao"><p class="adm-cartao__rotulo">Pendentes</p><p class="adm-cartao__valor">${v.pendentes}</p>
                <p class="adm-cartao__nota">aguardando Pix ou boleto</p></div>
        </div>
        <section class="adm-bloco">
            ${v.vendas.length ? `<table class="adm-tabela">
                <thead><tr><th>Aluno</th><th>Curso</th><th>Valor</th><th>Data</th><th>Situação</th><th></th></tr></thead><tbody>
                ${v.vendas.map((p) => `<tr data-id="${p.aluno_id}" tabindex="0"><td data-rotulo="Aluno">${esc(p.aluno)}</td><td data-rotulo="Curso">${esc(p.curso)}</td>
                    <td data-rotulo="Valor">${esc(p.valor)}</td><td data-rotulo="Data">${data(p.pago_em || p.criado_em, true)}</td>
                    <td>${seloPedido(p.status)}</td><td class="adm-seta" aria-hidden="true">→</td></tr>`).join("")}
                </tbody></table>` : '<p class="adm-vazio">Nenhuma venda ainda.</p>'}
        </section>`;
}

// ---------- Navegação e menu ----------

function atualizarContador(novos) {
    const contador = document.getElementById("contador-novos");
    contador.textContent = novos;
    contador.hidden = !novos;
}

async function mostrar() {
    const caminho = location.hash.replace(/^#/, "") || "/";
    const aluno = /^\/alunos\/(\d+)$/.exec(caminho);
    const curso = /^\/cursos\/(novo|\d+)$/.exec(caminho);
    const aula = /^\/cursos\/(\d+)\/aulas\/(nova|\d+)$/.exec(caminho);
    const pagina = aluno || caminho.startsWith("/alunos") ? "alunos"
        : caminho.startsWith("/cursos") ? "cursos" : caminho.startsWith("/vendas") ? "vendas" : "painel";
    document.querySelectorAll(".adm-menu__nav a[data-pagina]").forEach((a) => a.classList.toggle("ativo", a.dataset.pagina === pagina));
    abrirMenu(false);
    try {
        if (aluno) await paginaAluno(aluno[1]);
        else if (caminho === "/alunos") await paginaAlunos();
        else if (curso) await paginaCursoForm(curso[1]);
        else if (aula) await paginaAulaForm(aula[1], aula[2]);
        else if (caminho === "/cursos") await paginaCursos();
        else if (caminho === "/vendas") await paginaVendas();
        else await paginaPainel();
        scrollTo(0, 0);
    } catch (falha) {
        conteudo.innerHTML = aviso(falha.message, "erro") + '<a class="adm-botao" href="#/">Voltar ao painel</a>';
    }
}

function abrirMenu(aberto) {
    document.getElementById("menu").classList.toggle("aberto", aberto);
    document.getElementById("veu").hidden = !aberto;
    document.getElementById("abrir-menu").setAttribute("aria-expanded", aberto);
}
document.getElementById("abrir-menu").addEventListener("click", () => abrirMenu(true));
document.getElementById("veu").addEventListener("click", () => abrirMenu(false));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") abrirMenu(false); });

document.getElementById("sair").addEventListener("click", async () => {
    await fetch("/api/conta/sair", { method: "POST" });
    location.href = "/";
});

(async () => {
    try {
        const eu = await api("/api/admin/eu");
        for (const id of ["menu-avatar", "barra-avatar"]) document.getElementById(id).textContent = iniciais(eu.nome);
        document.getElementById("menu-nome").textContent = eu.nome;
        document.getElementById("menu-email").textContent = eu.email;
        document.getElementById("barra-nome").textContent = eu.nome.split(" ")[0];
    } catch (falha) {
        if (falha.status === 403) {
            document.querySelector(".adm-area").hidden = true;
            document.getElementById("menu").hidden = true;
            document.getElementById("negado").hidden = false;
            document.body.classList.replace("adm-corpo", "conta-pagina");
        }
        return;
    }
    addEventListener("hashchange", mostrar);
    await mostrar();
})();
