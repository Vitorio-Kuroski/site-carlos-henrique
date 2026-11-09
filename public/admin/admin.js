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
    mensagem: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
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
                <a class="adm-botao" href="#/mensagens/${a.id}">${ICONES.mensagem}Mensagens</a>
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

// ---------- Blog ----------

const ICONES_EDITOR = [
    ["negrito", "Negrito", "<b>B</b>"], ["italico", "Itálico", "<i>I</i>"], ["h2", "Título", "T"], ["h3", "Subtítulo", "t"],
    ["lista", "Lista", "•"], ["numerada", "Lista numerada", "1."], ["link", "Link", "🔗"], ["citacao", "Citação", "❝"], ["imagem", "Imagem", "🖼"],
];

function dataPost(iso) {
    const [a, m, d] = iso.split("-");
    return `${d}/${m}/${a}`;
}

function seloPost(p, hoje) {
    if (p.status === "rascunho") return '<span class="adm-selo adm-selo--cinza">Rascunho</span>';
    if (p.data > hoje) return '<span class="adm-selo adm-selo--ouro">Agendado</span>';
    return '<span class="adm-selo adm-selo--verde">Publicado</span>';
}

// Reduz a foto no navegador (no máximo 1600 px) antes de enviar: a página do post carrega rápido
async function reduzirImagem(arquivo, maximo = 1600) {
    if (!/^image\/(jpeg|png|webp|heic|heif|gif)$/i.test(arquivo.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(arquivo.name)) {
        throw new Error("Escolha uma imagem (JPG, PNG ou WebP).");
    }
    let bitmap;
    try { bitmap = await createImageBitmap(arquivo); } catch { throw new Error("Não foi possível abrir esta imagem. Tente salvar como JPG e enviar de novo."); }
    const escala = Math.min(1, maximo / Math.max(bitmap.width, bitmap.height));
    const tela = document.createElement("canvas");
    tela.width = Math.round(bitmap.width * escala);
    tela.height = Math.round(bitmap.height * escala);
    const ctx = tela.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, tela.width, tela.height);
    ctx.drawImage(bitmap, 0, 0, tela.width, tela.height);
    const gerar = (tipo, qualidade) => new Promise((ok) => tela.toBlob(ok, tipo, qualidade));
    let blob = await gerar("image/webp", 0.82);
    if (!blob || blob.type !== "image/webp") blob = await gerar("image/jpeg", 0.85);
    return blob;
}

async function enviarImagem(arquivo) {
    const blob = await reduzirImagem(arquivo);
    const r = await api("/api/admin/imagens", { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
    return r.url;
}

async function paginaBlog() {
    titulo.textContent = "Blog";
    const { posts, hoje } = await api("/api/admin/posts");
    conteudo.innerHTML = `
        <div class="adm-cabeca"><h1>Blog<small>Escreva, publique e o post aparece no site na hora.</small></h1>
            <div class="adm-acoes"><a class="adm-botao" href="/blog/" target="_blank" rel="noopener">Ver o blog</a>
            <a class="adm-botao adm-botao--principal" href="#/blog/novo">+ Novo post</a></div></div>
        <section class="adm-bloco">
            ${posts.length ? `<table class="adm-tabela">
                <thead><tr><th>Post</th><th>Data</th><th>Situação</th><th></th></tr></thead><tbody>
                ${posts.map((p) => `<tr data-post="${p.id}" tabindex="0">
                    <td data-rotulo="Post"><div class="adm-post">${p.capa ? `<img src="${esc(p.capa)}" alt="" loading="lazy">` : '<span class="adm-post__sem"></span>'}
                        <span><strong>${esc(p.titulo)}</strong><small>${esc(p.resumo || "Sem resumo")}</small></span></div></td>
                    <td data-rotulo="Data">${dataPost(p.data)}</td>
                    <td>${seloPost(p, hoje)}</td>
                    <td class="adm-seta" aria-hidden="true">→</td></tr>`).join("")}
                </tbody></table>` : '<p class="adm-vazio">Nenhum post ainda. Toque em "Novo post" para escrever o primeiro.</p>'}
        </section>`;
    conteudo.querySelectorAll("tr[data-post]").forEach((tr) => {
        const abrir = () => { location.hash = `#/blog/${tr.dataset.post}`; };
        tr.addEventListener("click", abrir);
        tr.addEventListener("keydown", (e) => { if (e.key === "Enter") abrir(); });
    });
}

async function paginaPostForm(id, mensagem = "", tipo = "ok") {
    let novo = id === "novo";
    titulo.textContent = novo ? "Novo post" : "Editar post";
    const { post, hoje } = novo ? { post: null, hoje: new Date().toISOString().slice(0, 10) } : await api(`/api/admin/posts/${id}`);
    const p = post || { titulo: "", slug: "", resumo: "", conteudo: "", capa: "", status: "rascunho", data: hoje };
    const publicado = p.status === "publicado";
    conteudo.innerHTML = `
        ${aviso(mensagem, tipo)}
        <p class="adm-aviso adm-aviso--recuperar" id="recuperar" role="status" hidden></p>
        <div class="adm-cabeca"><h1>${novo ? "Novo post" : esc(p.titulo)}<small>${novo ? "Comece como rascunho; publique quando estiver pronto." : seloPost(p, hoje)}</small></h1>
            <div class="adm-acoes"><a class="adm-botao" href="#/blog">${ICONES.voltar}Voltar</a>
            ${novo ? "" : `<a class="adm-botao" href="/blog/${esc(p.slug)}/" target="_blank" rel="noopener">${publicado ? "Ver no site" : "Ver como vai ficar"}</a>
            <button type="button" class="adm-botao adm-botao--perigo" id="apagar-post">${ICONES.lixo}Apagar</button>`}</div></div>
        <form class="adm-bloco adm-form" id="form-post" novalidate>
            <label class="campo">Título<input name="titulo" required maxlength="160" value="${esc(p.titulo)}" placeholder="Ex.: Como funciona o imposto para quem é PAYE"></label>
            <label class="campo">Endereço do post <span class="adm-form__dica">henriqueaccountant.com/blog/<b id="previa-slug">${esc(p.slug) || "…"}</b>/</span>
                <input name="slug" required maxlength="80" pattern="[a-z0-9]+(-[a-z0-9]+)*" value="${esc(p.slug)}"></label>
            <label class="campo">Resumo <span class="adm-form__dica">aparece no Google e na lista do blog · <span id="conta-resumo">${p.resumo.length}</span>/300</span>
                <textarea name="resumo" class="adm-form__curto" maxlength="300">${esc(p.resumo)}</textarea></label>
            <div class="campo">Imagem de capa <span class="adm-form__dica">opcional; aparece no topo do post, na lista e quando o link é compartilhado</span>
                <div class="adm-capa">
                    <img id="capa-previa" alt="" ${p.capa ? `src="${esc(p.capa)}"` : "hidden"}>
                    <div class="adm-capa__acoes">
                        <label class="adm-botao">${p.capa ? "Trocar capa" : "Enviar capa"}<input type="file" accept="image/*" id="capa-arquivo" hidden></label>
                        <button type="button" class="adm-botao" id="capa-remover" ${p.capa ? "" : "hidden"}>Remover</button>
                        <span class="adm-form__dica" id="capa-status" role="status"></span>
                    </div>
                </div>
            </div>
            <div class="campo">Texto do post
                <div class="adm-editor">
                    <div class="adm-editor__barra" role="toolbar" aria-label="Formatação">
                        ${ICONES_EDITOR.map(([acao, rotulo, icone]) => `<button type="button" data-acao="${acao}" title="${rotulo}" aria-label="${rotulo}">${icone}</button>`).join("")}
                        <span class="adm-editor__abas" role="tablist">
                            <button type="button" role="tab" aria-selected="true" data-aba="escrever">Escrever</button>
                            <button type="button" role="tab" aria-selected="false" data-aba="previa">Prévia</button>
                        </span>
                    </div>
                    <textarea name="conteudo" id="editor" maxlength="100000" placeholder="Escreva aqui. Use os botões acima para títulos, listas, links e imagens.">${esc(p.conteudo)}</textarea>
                    <div class="adm-editor__previa post__texto" id="previa" hidden></div>
                    <input type="file" accept="image/*" id="imagem-arquivo" hidden>
                </div>
            </div>
            <label class="campo adm-form__data">Data do post <span class="adm-form__dica">se for uma data futura, o post só aparece no site nesse dia</span>
                <input type="date" name="data" required value="${esc(p.data)}"></label>
            <p class="conta__erro" id="erro-post" role="alert" hidden></p>
            <div class="adm-form__acoes">
                ${publicado
                    ? `<button type="submit" class="adm-botao adm-botao--principal" data-status="publicado">Salvar alterações</button>
                       <button type="submit" class="adm-botao" data-status="rascunho">Tirar do ar (voltar para rascunho)</button>`
                    : `<button type="submit" class="adm-botao adm-botao--principal" data-status="publicado">Publicar</button>
                       <button type="submit" class="adm-botao" data-status="rascunho">Salvar rascunho</button>`}
                <span class="adm-form__auto" id="auto-status" role="status" aria-live="polite"></span>
            </div>
        </form>`;

    const form = document.getElementById("form-post");
    const editor = document.getElementById("editor");
    const previa = document.getElementById("previa");
    let capa = p.capa;
    let sujo = false;
    form.addEventListener("input", mudou);

    // ---------- Salvamento automático ----------
    // Rascunho: salva no site 3 segundos depois da última mudança.
    // Post publicado: não muda o site sozinho; as mudanças ficam guardadas no aparelho até "Salvar alterações".
    // Sempre: uma cópia fica no aparelho (localStorage); se a aba fechar ou a internet cair, dá para recuperar.
    const CAMPOS = ["titulo", "slug", "resumo", "conteudo", "capa", "data"];
    const chave = () => `blog-post-${novo ? "novo" : id}`;
    const autoStatus = document.getElementById("auto-status");
    const campos = () => ({ titulo: form.titulo.value, slug: form.slug.value, resumo: form.resumo.value, conteudo: editor.value, capa, data: form.data.value });
    const igualAoSalvo = (c) => CAMPOS.every((k) => String(c[k] ?? "") === String(p[k] ?? ""));
    const guardarLocal = () => { try { localStorage.setItem(chave(), JSON.stringify({ ...campos(), guardado_em: Date.now() })); } catch { /* sem espaço ou bloqueado */ } };
    const apagarLocal = (k = chave()) => { try { localStorage.removeItem(k); } catch { /* nada */ } };
    const hora = (t) => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const podeSalvar = (c) => c.titulo.trim() && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.slug);
    let timer = null;
    let salvando = null;

    function mudou() {
        sujo = true;
        guardarLocal();
        clearTimeout(timer);
        if (p.status === "rascunho") {
            autoStatus.textContent = "Alterações ainda não salvas…";
            timer = setTimeout(salvarAutomatico, 3000);
        } else {
            autoStatus.textContent = "Alterações guardadas neste aparelho. Toque em “Salvar alterações” para atualizar o site.";
        }
    }

    async function salvarAutomatico() {
        timer = null;
        if (!sujo || p.status !== "rascunho" || !form.isConnected) return;
        if (salvando) { await salvando; return salvarAutomatico(); }
        if (!form.slug.value && form.titulo.value.trim()) {
            form.slug.value = slugDe(form.titulo.value);
            document.getElementById("previa-slug").textContent = form.slug.value || "…";
        }
        const c = campos();
        if (!podeSalvar(c)) {
            autoStatus.textContent = "Rascunho guardado neste aparelho. Escreva o título para salvar no site.";
            return;
        }
        autoStatus.textContent = "Salvando…";
        salvando = (async () => {
            try {
                const r = await api(novo ? "/api/admin/posts" : `/api/admin/posts/${id}`, {
                    method: novo ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...c, status: "rascunho" }),
                });
                if (novo) {
                    // O post novo passou a existir: o endereço do painel muda sem recarregar a página
                    apagarLocal();
                    novo = false;
                    id = String(r.id);
                    hashAtual = `#/blog/${id}`;
                    history.replaceState(null, "", hashAtual);
                    titulo.textContent = "Editar post";
                }
                Object.assign(p, c);
                sujo = !igualAoSalvo(campos()); // continuou escrevendo enquanto salvava?
                if (sujo) guardarLocal(); else apagarLocal();
                autoStatus.textContent = `Rascunho salvo automaticamente às ${hora(Date.now())}.`;
            } catch (falha) {
                const motivo = /fetch|network/i.test(falha.message) ? "sem conexão." : falha.message;
                autoStatus.textContent = `Não salvou no site: ${motivo} O texto continua guardado neste aparelho e salva quando a conexão voltar.`;
            }
        })();
        await salvando;
        salvando = null;
    }

    // Ao sair da página (ou trocar de aplicativo no celular), manda o rascunho pendente na hora
    function descarregar() {
        if (!sujo || p.status !== "rascunho" || novo || !podeSalvar(campos())) return;
        clearTimeout(timer);
        fetch(`/api/admin/posts/${id}`, {
            method: "PUT", keepalive: true, headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...campos(), status: "rascunho" }),
        }).catch(() => { /* a cópia no aparelho continua */ });
    }
    formularioSujo = () => {
        if (p.status === "rascunho" && !novo) { descarregar(); return false; }
        return sujo;
    };

    // Versão guardada no aparelho e diferente da salva: oferece recuperar
    let guardado = null;
    try { guardado = JSON.parse(localStorage.getItem(chave()) || "null"); } catch { /* nada */ }
    if (guardado && !igualAoSalvo(guardado)) {
        const caixa = document.getElementById("recuperar");
        const quando = new Date(guardado.guardado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
        caixa.innerHTML = `<span>Há uma versão deste post que não foi salva no site (${esc(quando)}).</span>
            <button type="button" class="adm-botao adm-botao--principal" id="recuperar-sim">Recuperar</button>
            <button type="button" class="adm-botao" id="recuperar-nao">Descartar</button>`;
        caixa.hidden = false;
        document.getElementById("recuperar-sim").addEventListener("click", () => {
            form.titulo.value = guardado.titulo || "";
            form.slug.value = guardado.slug || "";
            form.resumo.value = guardado.resumo || "";
            editor.value = guardado.conteudo || "";
            form.data.value = guardado.data || form.data.value;
            capa = guardado.capa || "";
            const img = document.getElementById("capa-previa");
            if (capa) img.src = capa;
            img.hidden = !capa;
            document.getElementById("capa-remover").hidden = !capa;
            document.getElementById("previa-slug").textContent = form.slug.value || "…";
            document.getElementById("conta-resumo").textContent = form.resumo.value.length;
            // O endereço continua seguindo o título, a não ser que tenha sido mudado à mão
            slugManual = Boolean(form.slug.value) && form.slug.value !== slugDe(form.titulo.value);
            caixa.hidden = true;
            mudou();
        });
        document.getElementById("recuperar-nao").addEventListener("click", () => { apagarLocal(); caixa.hidden = true; });
    } else if (guardado) {
        apagarLocal();
    }

    // Endereço gerado pelo título enquanto o post é novo
    let slugManual = !novo;
    form.slug.addEventListener("input", () => { slugManual = true; document.getElementById("previa-slug").textContent = form.slug.value || "…"; });
    form.titulo.addEventListener("input", () => {
        if (slugManual) return;
        form.slug.value = slugDe(form.titulo.value);
        document.getElementById("previa-slug").textContent = form.slug.value || "…";
    });
    form.resumo.addEventListener("input", () => { document.getElementById("conta-resumo").textContent = form.resumo.value.length; });

    // Capa
    const capaStatus = document.getElementById("capa-status");
    document.getElementById("capa-arquivo").addEventListener("change", async (e) => {
        const arquivo = e.target.files[0];
        e.target.value = "";
        if (!arquivo) return;
        capaStatus.textContent = "Enviando…";
        try {
            capa = await enviarImagem(arquivo);
            const img = document.getElementById("capa-previa");
            img.src = capa;
            img.hidden = false;
            document.getElementById("capa-remover").hidden = false;
            capaStatus.textContent = "Capa enviada.";
            mudou();
        } catch (falha) {
            capaStatus.textContent = falha.message;
        }
    });
    document.getElementById("capa-remover").addEventListener("click", () => {
        capa = "";
        document.getElementById("capa-previa").hidden = true;
        document.getElementById("capa-remover").hidden = true;
        capaStatus.textContent = "Capa removida.";
        mudou();
    });

    // Barra de formatação: escreve as marcas no texto, em volta do que estiver selecionado
    const inserir = (antes, depois = "", exemplo = "") => {
        const { selectionStart: ini, selectionEnd: fim, value } = editor;
        const sel = value.slice(ini, fim) || exemplo;
        editor.setRangeText(antes + sel + depois, ini, fim, "end");
        if (!value.slice(ini, fim) && exemplo) editor.setSelectionRange(ini + antes.length, ini + antes.length + exemplo.length);
        editor.focus();
        mudou();
    };
    // Marca o começo de cada linha selecionada (ou da linha do cursor)
    const inicioDeLinha = (marca, exemplo) => {
        const { selectionStart: ini, selectionEnd: fim, value } = editor;
        const comeco = value.lastIndexOf("\n", ini - 1) + 1;
        const quebra = value.indexOf("\n", fim);
        const final = quebra === -1 ? value.length : quebra;
        const trecho = value.slice(comeco, final) || exemplo;
        const linhas = trecho.split("\n").map((l, i) => (typeof marca === "function" ? marca(i) : marca) + l.replace(/^(#{1,4}\s+|[-*]\s+|\d+[.)]\s+|>\s?)/, ""));
        editor.setRangeText(linhas.join("\n"), comeco, final, "end");
        editor.focus();
        mudou();
    };
    const acoes = {
        negrito: () => inserir("**", "**", "texto em negrito"),
        italico: () => inserir("*", "*", "texto em itálico"),
        h2: () => inicioDeLinha("## ", "Título da seção"),
        h3: () => inicioDeLinha("### ", "Subtítulo"),
        lista: () => inicioDeLinha("- ", "Item da lista"),
        numerada: () => inicioDeLinha((i) => `${i + 1}. `, "Primeiro item"),
        citacao: () => inicioDeLinha("> ", "Citação"),
        link: () => {
            const url = prompt("Endereço do link (comece com https://):", "https://");
            if (!url || url === "https://") return;
            if (!/^(https?:\/\/|mailto:|\/)/i.test(url)) { alert("Use um endereço que comece com https://"); return; }
            inserir("[", `](${url.trim()})`, "texto do link");
        },
        imagem: () => document.getElementById("imagem-arquivo").click(),
    };
    form.querySelectorAll("[data-acao]").forEach((b) => b.addEventListener("click", () => acoes[b.dataset.acao]()));
    document.getElementById("imagem-arquivo").addEventListener("change", async (e) => {
        const arquivo = e.target.files[0];
        e.target.value = "";
        if (!arquivo) return;
        const descricao = (prompt("Descreva a imagem em poucas palavras (ajuda no Google e para quem usa leitor de tela):", "") || "").replace(/[\[\]]/g, "");
        const marcador = `![Enviando imagem…]()`;
        editor.setSelectionRange(editor.selectionEnd, editor.selectionEnd); // entra depois do que estiver selecionado
        inserir("\n\n" + marcador + "\n\n");
        try {
            const url = await enviarImagem(arquivo);
            editor.value = editor.value.replace(marcador, `![${descricao}](${url})`);
        } catch (falha) {
            editor.value = editor.value.replace(marcador, "");
            alert(falha.message);
        }
        mudou();
    });
    // Ctrl+B / Ctrl+I
    editor.addEventListener("keydown", (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        if (e.key.toLowerCase() === "b") { e.preventDefault(); acoes.negrito(); }
        if (e.key.toLowerCase() === "i") { e.preventDefault(); acoes.italico(); }
    });

    // Abas Escrever / Prévia
    form.querySelectorAll("[data-aba]").forEach((aba) => aba.addEventListener("click", () => {
        const verPrevia = aba.dataset.aba === "previa";
        form.querySelectorAll("[data-aba]").forEach((a) => a.setAttribute("aria-selected", String(a === aba)));
        if (verPrevia) previa.innerHTML = window.markdownParaHtml ? window.markdownParaHtml(editor.value) || "<p><em>Nada escrito ainda.</em></p>" : "<p>Prévia indisponível.</p>";
        previa.hidden = !verPrevia;
        editor.hidden = verPrevia;
        form.querySelectorAll("[data-acao]").forEach((b) => { b.disabled = verPrevia; });
    }));

    // Salvar / publicar
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const status = e.submitter?.dataset.status || p.status;
        const erro = document.getElementById("erro-post");
        erro.hidden = true;
        const botoes = form.querySelectorAll("button[type=submit]");
        botoes.forEach((b) => { b.disabled = true; });
        clearTimeout(timer);
        if (salvando) await salvando; // espera o salvamento automático terminar (pode ter criado o post)
        try {
            const corpo = {
                titulo: form.titulo.value, slug: form.slug.value, resumo: form.resumo.value, conteudo: editor.value,
                capa, status, data: form.data.value,
            };
            const r = await api(novo ? "/api/admin/posts" : `/api/admin/posts/${id}`, {
                method: novo ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo),
            });
            sujo = false;
            apagarLocal();
            const msg = status === "publicado"
                ? (corpo.data > hoje ? `Post agendado para ${dataPost(corpo.data)}.` : "Post publicado! Já está no site.")
                : "Rascunho salvo.";
            if (novo) {
                avisoPendente = msg;
                location.hash = `#/blog/${r.id}`;
            } else {
                await paginaPostForm(id, msg, "ok");
            }
        } catch (falha) {
            erro.textContent = falha.message;
            erro.hidden = false;
            botoes.forEach((b) => { b.disabled = false; });
        }
    });

    document.getElementById("apagar-post")?.addEventListener("click", async () => {
        if (!confirm(`Apagar o post "${p.titulo}"? Não dá para desfazer.`)) return;
        try {
            await api(`/api/admin/posts/${id}`, { method: "DELETE" });
            sujo = false;
            apagarLocal();
            location.hash = "#/blog";
        } catch (falha) {
            alert(falha.message);
        }
    });
}

// ---------- Pedidos de declaração ----------

const STATUS_DECLARACAO = { novo: ["ouro", "Novo"], andamento: ["verde", "Em andamento"], concluido: ["cinza", "Concluído"], arquivado: ["cinza", "Arquivado"] };
function seloDeclaracao(status) {
    const [cor, texto] = STATUS_DECLARACAO[status] || ["cinza", status];
    return `<span class="adm-selo adm-selo--${cor}">${esc(texto)}</span>`;
}

async function atualizarDeclaracoes() {
    try {
        const { novos } = await api("/api/admin/declaracoes/novos");
        const contador = document.getElementById("contador-declaracoes");
        contador.textContent = novos > 99 ? "99+" : novos;
        contador.hidden = !novos;
    } catch { /* tenta de novo depois */ }
}

async function paginaDeclaracoes(filtro = "") {
    titulo.textContent = "Pedidos de declaração";
    const { declaracoes, contagem } = await api(`/api/admin/declaracoes${filtro ? `?status=${filtro}` : ""}`);
    const total = Object.values(contagem).reduce((a, b) => a + b, 0);
    const abas = [["", "Todos", total], ...Object.entries(STATUS_DECLARACAO).map(([k, [, t]]) => [k, t, contagem[k] || 0])];
    conteudo.innerHTML = `
        <div class="adm-cabeca"><h1>Pedidos de declaração<small>Enviados pelo formulário do site. Quem pede recebe uma confirmação por e-mail.</small></h1>
            <div class="adm-acoes"><a class="adm-botao" href="/declaracao/formulario/" target="_blank" rel="noopener">Ver o formulário</a></div></div>
        <nav class="adm-abas" aria-label="Filtrar por situação">
            ${abas.map(([k, t, n]) => `<a href="#/declaracoes${k ? `?${k}` : ""}" class="${k === filtro ? "ativa" : ""}">${t} <span>${n}</span></a>`).join("")}
        </nav>
        <section class="adm-bloco">
            ${declaracoes.length ? `<table class="adm-tabela">
                <thead><tr><th>Nome</th><th>Serviço</th><th>Anos</th><th>Recebido</th><th>Situação</th><th></th></tr></thead><tbody>
                ${declaracoes.map((d) => `<tr data-declaracao="${d.id}" tabindex="0">
                    <td data-rotulo="Nome"><strong>${esc(d.nome)}</strong><br><small>${esc(d.email)}</small></td>
                    <td data-rotulo="Serviço">${esc(d.servico_texto)}</td>
                    <td data-rotulo="Anos">${esc(d.anos.join(", "))}</td>
                    <td data-rotulo="Recebido">${data(d.criado_em, true)}</td>
                    <td>${seloDeclaracao(d.status)}</td>
                    <td class="adm-seta" aria-hidden="true">→</td></tr>`).join("")}
                </tbody></table>` : `<p class="adm-vazio">${filtro ? "Nenhum pedido nesta situação." : "Nenhum pedido ainda. Eles chegam pelo formulário em /declaracao/formulario/."}</p>`}
        </section>`;
    conteudo.querySelectorAll("tr[data-declaracao]").forEach((tr) => {
        const abrir = () => { location.hash = `#/declaracoes/${tr.dataset.declaracao}`; };
        tr.addEventListener("click", abrir);
        tr.addEventListener("keydown", (e) => { if (e.key === "Enter") abrir(); });
    });
    atualizarDeclaracoes();
}

async function paginaDeclaracao(id, mensagem = "", tipo = "ok") {
    titulo.textContent = "Pedido de declaração";
    const { declaracao: d } = await api(`/api/admin/declaracoes/${id}`);
    // Abrir um pedido novo já o coloca "em andamento"
    if (d.status === "novo") {
        await api(`/api/admin/declaracoes/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "andamento", notas: d.notas }) });
        d.status = "andamento";
        atualizarDeclaracoes();
    }
    const assunto = encodeURIComponent(`Sua declaração de imposto (${d.anos.join(", ")})`);
    const whatsapp = d.telefone.replace(/\D/g, "");
    const linha = (rotulo, valor) => `<div><dt>${rotulo}</dt><dd>${valor}</dd></div>`;
    conteudo.innerHTML = `
        ${aviso(mensagem, tipo)}
        <div class="adm-cabeca"><h1>${esc(d.nome)}<small>Pedido #${d.id} · recebido em ${data(d.criado_em, true)}</small></h1>
            <div class="adm-acoes"><a class="adm-botao" href="#/declaracoes">${ICONES.voltar}Todos os pedidos</a>
            <a class="adm-botao adm-botao--principal" href="mailto:${esc(d.email)}?subject=${assunto}">${ICONES.email}Responder por e-mail</a>
            ${whatsapp.length >= 8 ? `<a class="adm-botao" href="https://wa.me/${whatsapp}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
            ${d.aluno ? `<a class="adm-botao" href="#/alunos/${d.aluno}">Ficha do aluno</a>` : ""}</div></div>
        <section class="adm-bloco">
            <div class="adm-bloco__cabeca"><h2>Respostas</h2>${seloDeclaracao(d.status)}</div>
            <dl class="adm-respostas">
                ${linha("Serviço", esc(d.servico_texto))}
                ${linha("Ano(s) de imposto", esc(d.anos.join(", ")))}
                ${linha("Estado civil", esc(d.estado_civil_texto || "—"))}
                ${linha("Acesso à Revenue", esc(d.revenue_texto || "—"))}
                ${linha("Se aplica", d.situacoes_texto.length ? d.situacoes_texto.map(esc).join("<br>") : "Nenhum")}
                ${linha("E-mail", `<a href="mailto:${esc(d.email)}">${esc(d.email)}</a>`)}
                ${linha("Telefone/WhatsApp", esc(d.telefone || "—"))}
                ${linha("Mensagem", d.mensagem ? `<span class="adm-respostas__texto">${esc(d.mensagem)}</span>` : "—")}
            </dl>
        </section>
        <section class="adm-bloco">
            <div class="adm-bloco__cabeca"><h2>Acompanhamento</h2></div>
            <form class="adm-form" id="form-declaracao">
                <label class="campo">Situação
                    <select name="status" class="adm-select">${Object.entries(STATUS_DECLARACAO).map(([k, [, t]]) => `<option value="${k}" ${k === d.status ? "selected" : ""}>${t}</option>`).join("")}</select></label>
                <label class="campo">Anotações internas <span class="adm-form__dica">só administradores veem (valor combinado, documentos pedidos, prazos…)</span>
                    <textarea name="notas" maxlength="5000">${esc(d.notas)}</textarea></label>
                <p class="conta__erro" id="erro-declaracao" role="alert" hidden></p>
                <div class="adm-form__acoes"><button type="submit" class="adm-botao adm-botao--principal">Salvar</button>
                    <button type="button" class="adm-botao adm-botao--perigo" id="apagar-declaracao">${ICONES.lixo}Apagar pedido</button></div>
            </form>
        </section>`;
    const form = document.getElementById("form-declaracao");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
            await api(`/api/admin/declaracoes/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: form.status.value, notas: form.notas.value }) });
            await paginaDeclaracao(id, "Pedido atualizado.", "ok");
            atualizarDeclaracoes();
        } catch (falha) {
            const erro = document.getElementById("erro-declaracao");
            erro.textContent = falha.message;
            erro.hidden = false;
        }
    });
    document.getElementById("apagar-declaracao").addEventListener("click", async () => {
        if (!confirm(`Apagar o pedido de ${d.nome}? Os dados somem de vez (use quando a pessoa pedir para apagar).`)) return;
        try {
            await api(`/api/admin/declaracoes/${id}`, { method: "DELETE" });
            location.hash = "#/declaracoes";
        } catch (falha) {
            alert(falha.message);
        }
    });
}

// ---------- Mensagens ----------

// Texto já escapado, com os endereços https:// clicáveis
function comLinks(texto) {
    return esc(texto).replace(/https:\/\/[^\s<]+[^\s<.,;:!?)]/g, (link) => `<a href="${link}" target="_blank" rel="noopener">${link}</a>`);
}

let tituloBase = document.title;
let pararConversa = null;

async function atualizarMensagens() {
    try {
        const { nao_lidas: n } = await api("/api/admin/mensagens/nao-lidas");
        const contador = document.getElementById("contador-mensagens");
        contador.textContent = n > 99 ? "99+" : n;
        contador.hidden = !n;
        document.title = n ? `(${n}) ${tituloBase}` : tituloBase;
    } catch { /* tenta de novo na próxima */ }
}

async function paginaMensagens() {
    titulo.textContent = "Mensagens";
    const { conversas } = await api("/api/admin/mensagens");
    conteudo.innerHTML = `
        <div class="adm-cabeca"><h1>Mensagens<small>Conversas com os alunos. Você e os outros administradores veem e respondem.</small></h1></div>
        <section class="adm-bloco">
            ${conversas.length ? `<ul class="adm-conversas">${conversas.map((c) => `
                <li><a href="#/mensagens/${c.aluno_id}" class="${c.nao_lidas ? "nao-lida" : ""}">
                    <span class="adm-avatar" aria-hidden="true">${esc(iniciais(c.nome))}</span>
                    <span class="adm-conversas__texto"><strong>${esc(c.nome)}</strong>
                        <span>${c.de_admin ? `${esc(c.autor)}: ` : ""}${esc(c.texto.slice(0, 140))}</span></span>
                    <span class="adm-conversas__lado"><small>${data(c.criado_em, true)}</small>
                        ${c.nao_lidas ? `<span class="adm-menu__contador">${c.nao_lidas}</span>` : ""}</span>
                </a></li>`).join("")}</ul>`
                : '<p class="adm-vazio">Nenhuma mensagem ainda. Quando um aluno escrever pela área do aluno, a conversa aparece aqui. Para puxar conversa, abra a ficha do aluno e toque em "Mensagens".</p>'}
        </section>`;
    atualizarMensagens();
}

async function paginaConversa(alunoId) {
    titulo.textContent = "Mensagens";
    let ultimoId = -1;
    const desenhar = (mensagens) => {
        const lista = document.getElementById("conversa");
        const ultimo = mensagens.length ? mensagens[mensagens.length - 1].id : 0;
        if (!lista || ultimo === ultimoId) return;
        ultimoId = ultimo;
        lista.innerHTML = mensagens.length ? mensagens.map((m) => `
            <div class="adm-msg ${m.de_admin ? "adm-msg--nossa" : "adm-msg--aluno"}">
                <p class="adm-msg__autor">${esc(m.autor)} · ${data(m.criado_em, true)}${m.de_admin ? (m.lida_em ? " · lida" : " · não lida") : ""}</p>
                <p class="adm-msg__texto">${comLinks(m.texto)}</p>
            </div>`).join("") : '<p class="adm-vazio">Nenhuma mensagem ainda. Escreva a primeira abaixo.</p>';
        lista.scrollTop = lista.scrollHeight;
    };
    const { aluno, mensagens } = await api(`/api/admin/mensagens/${alunoId}`);
    conteudo.innerHTML = `
        <div class="adm-cabeca"><h1>${esc(aluno.nome)}<small>${esc(aluno.email)}</small></h1>
            <div class="adm-acoes"><a class="adm-botao" href="#/mensagens">${ICONES.voltar}Todas as conversas</a>
            <a class="adm-botao" href="#/alunos/${aluno.id}">Ficha do aluno</a></div></div>
        <section class="adm-bloco adm-chat">
            <div class="adm-chat__lista" id="conversa"></div>
            <form class="adm-chat__form" id="form-resposta" novalidate>
                <label class="sr-only" for="resposta">Resposta</label>
                <textarea id="resposta" rows="3" maxlength="4000" placeholder="Escreva a resposta… (Ctrl+Enter envia)"></textarea>
                <p class="conta__erro" id="erro-resposta" role="alert" hidden></p>
                <p class="adm-chat__nota" id="nota-resposta" role="status"></p>
                <button type="submit" class="adm-botao adm-botao--principal">Enviar</button>
            </form>
        </section>`;
    desenhar(mensagens);
    atualizarMensagens();
    const form = document.getElementById("form-resposta");
    const campo = document.getElementById("resposta");
    campo.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) form.requestSubmit(); });
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const erro = document.getElementById("erro-resposta");
        const nota = document.getElementById("nota-resposta");
        const botao = form.querySelector("button");
        erro.hidden = true;
        botao.disabled = true;
        try {
            const r = await api(`/api/admin/mensagens/${alunoId}`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto: campo.value }),
            });
            campo.value = "";
            nota.textContent = r.email === "enviado" ? "Enviada. O aluno recebeu um aviso por e-mail."
                : r.email === "sem_chave" ? "Enviada. (O aviso por e-mail ainda não está configurado: falta o RESEND_API_KEY.)"
                : r.email === "falhou" ? "Enviada, mas o aviso por e-mail falhou. O aluno vê a resposta quando entrar no site."
                : "Enviada.";
            desenhar((await api(`/api/admin/mensagens/${alunoId}`)).mensagens);
        } catch (falha) {
            erro.textContent = falha.message;
            erro.hidden = false;
        } finally {
            botao.disabled = false;
            campo.focus();
        }
    });
    // Mensagens novas do aluno aparecem sozinhas enquanto a conversa está aberta
    const timer = setInterval(async () => {
        if (document.hidden) return;
        try { desenhar((await api(`/api/admin/mensagens/${alunoId}`)).mensagens); atualizarMensagens(); } catch { /* próxima */ }
    }, 10000);
    pararConversa = () => clearInterval(timer);
}

// ---------- Navegação e menu ----------

function atualizarContador(novos) {
    const contador = document.getElementById("contador-novos");
    contador.textContent = novos;
    contador.hidden = !novos;
}

let formularioSujo = null; // formulário com mudanças não salvas: pergunta antes de sair
let avisoPendente = "";   // mensagem para mostrar na próxima página (ex.: "Post publicado!")
let hashAtual = location.hash;

async function mostrar() {
    if (formularioSujo?.() && location.hash !== hashAtual && !confirm("Sair sem salvar? As mudanças vão se perder.")) {
        history.replaceState(null, "", hashAtual || "#/");
        return;
    }
    formularioSujo = null;
    hashAtual = location.hash;
    const caminho = location.hash.replace(/^#/, "") || "/";
    const post = /^\/blog\/(novo|\d+)$/.exec(caminho);
    const aluno = /^\/alunos\/(\d+)$/.exec(caminho);
    const curso = /^\/cursos\/(novo|\d+)$/.exec(caminho);
    const aula = /^\/cursos\/(\d+)\/aulas\/(nova|\d+)$/.exec(caminho);
    const conversa = /^\/mensagens\/(\d+)$/.exec(caminho);
    pararConversa?.();
    pararConversa = null;
    const declaracao = /^\/declaracoes\/(\d+)$/.exec(caminho);
    const pagina = caminho.startsWith("/declaracoes") ? "declaracoes" : caminho.startsWith("/blog") ? "blog" : caminho.startsWith("/mensagens") ? "mensagens" : aluno || caminho.startsWith("/alunos") ? "alunos"
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
        else if (conversa) await paginaConversa(conversa[1]);
        else if (post) { const msg = avisoPendente; avisoPendente = ""; await paginaPostForm(post[1], msg, "ok"); }
        else if (caminho === "/blog") await paginaBlog();
        else if (declaracao) await paginaDeclaracao(declaracao[1]);
        else if (caminho.startsWith("/declaracoes")) await paginaDeclaracoes((caminho.split("?")[1] || "").replace(/[^a-z]/g, ""));
        else if (caminho === "/mensagens") await paginaMensagens();
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
    addEventListener("beforeunload", (e) => { if (formularioSujo?.()) { e.preventDefault(); e.returnValue = ""; } });
    document.addEventListener("visibilitychange", () => { if (document.hidden) formularioSujo?.(); });
    await mostrar();
    // Aviso de mensagens novas no menu e no título da aba, conferido a cada 30 segundos
    atualizarMensagens();
    atualizarDeclaracoes();
    setInterval(() => { if (!document.hidden) { atualizarMensagens(); atualizarDeclaracoes(); } }, 30000);
})();
