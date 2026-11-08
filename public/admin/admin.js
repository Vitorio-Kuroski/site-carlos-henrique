// Painel do administrador: conversa com as rotas /api/admin/* do Worker (src/admin.js).
const erro = document.getElementById("erro");
const formatoData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

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

function mostrarErro(texto) {
    erro.textContent = texto;
    erro.hidden = !texto;
}

async function carregarResumo() {
    const r = await api("/api/admin/resumo");
    for (const campo of ["total", "ultimos7", "ultimos30"]) document.getElementById(campo).textContent = r[campo];
}

async function carregarAlunos() {
    const busca = document.getElementById("busca").value.trim();
    const { alunos } = await api("/api/admin/alunos?busca=" + encodeURIComponent(busca));
    const corpo = document.getElementById("alunos");
    corpo.replaceChildren(...alunos.map((a) => {
        const linha = document.createElement("tr");
        const data = new Date(a.criado_em.replace(" ", "T") + "Z");
        for (const [texto, rotulo] of [[a.nome, "Nome"], [a.email, "E-mail"], [formatoData.format(data), "Cadastro"]]) {
            const celula = document.createElement("td");
            celula.dataset.rotulo = rotulo;
            celula.textContent = texto;
            linha.append(celula);
        }
        const acoes = document.createElement("td");
        if (a.admin) {
            acoes.innerHTML = '<span class="admin__selo">Administrador</span>';
        } else {
            const botao = document.createElement("button");
            botao.type = "button";
            botao.className = "admin__apagar";
            botao.textContent = "Apagar";
            botao.addEventListener("click", () => apagar(a));
            acoes.append(botao);
        }
        linha.append(acoes);
        return linha;
    }));
    document.getElementById("vazio").hidden = alunos.length > 0;
}

async function apagar(aluno) {
    if (!confirm(`Apagar a conta de ${aluno.nome} (${aluno.email})? Isso não pode ser desfeito.`)) return;
    try {
        await api(`/api/admin/alunos/${aluno.id}`, { method: "DELETE" });
        mostrarErro("");
        await Promise.all([carregarResumo(), carregarAlunos()]);
    } catch (falha) {
        mostrarErro(falha.message);
    }
}

let espera;
document.getElementById("busca").addEventListener("input", () => {
    clearTimeout(espera);
    espera = setTimeout(() => carregarAlunos().catch((f) => mostrarErro(f.message)), 300);
});

(async () => {
    try {
        await carregarResumo();
        document.getElementById("painel").hidden = false;
        await carregarAlunos();
    } catch (falha) {
        if (falha.status === 403) document.getElementById("negado").hidden = false;
        else mostrarErro(falha.message);
    }
})();
