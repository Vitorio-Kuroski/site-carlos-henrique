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
        </div>
        <section class="adm-bloco">
            <div class="adm-bloco__cabeca"><h2>Últimos cadastros</h2><a class="link-seta" href="#/alunos">Ver todos</a></div>
            ${tabelaAlunos(r.recentes, "Ainda não há alunos cadastrados.")}
        </section>
        <section class="adm-bloco">
            <div class="adm-bloco__cabeca"><h2>Em breve</h2></div>
            <div class="adm-bloco__corpo"><p>Cursos, vendas pelo Mercado Pago e cupons aparecem aqui quando a próxima etapa da plataforma estiver pronta.</p></div>
        </section>`;
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
        </div>
        <section class="adm-bloco">
            <div class="adm-bloco__cabeca"><h2>Cursos</h2></div>
            <div class="adm-bloco__corpo"><p>Este aluno ainda não tem cursos. Quando a venda de cursos estiver pronta, as compras e o botão "Liberar curso" aparecem aqui.</p></div>
        </section>`;

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

// ---------- Navegação e menu ----------

function atualizarContador(novos) {
    const contador = document.getElementById("contador-novos");
    contador.textContent = novos;
    contador.hidden = !novos;
}

async function mostrar() {
    const caminho = location.hash.replace(/^#/, "") || "/";
    const aluno = /^\/alunos\/(\d+)$/.exec(caminho);
    const pagina = aluno || caminho.startsWith("/alunos") ? "alunos" : "painel";
    document.querySelectorAll(".adm-menu__nav a[data-pagina]").forEach((a) => a.classList.toggle("ativo", a.dataset.pagina === pagina));
    abrirMenu(false);
    try {
        if (aluno) await paginaAluno(aluno[1]);
        else if (caminho === "/alunos") await paginaAlunos();
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
