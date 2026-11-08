// Cadastro, login e área do aluno: conversa com as rotas /api/conta/* do Worker (src/alunos.js).

// Formulários de entrar e de criar conta: deu certo, vai para a área do aluno
function formularioConta(rota) {
    const form = document.getElementById("form");
    const erro = document.getElementById("erro");
    const botao = form.querySelector("button");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!form.reportValidity()) return;
        const texto = botao.textContent;
        botao.disabled = true;
        botao.textContent = "Aguarde...";
        erro.hidden = true;
        try {
            const resposta = await fetch(rota, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(Object.fromEntries(new FormData(form))),
            });
            const dados = await resposta.json().catch(() => ({}));
            if (!resposta.ok) throw new Error(dados.erro || "Não deu certo. Tente de novo.");
            location.href = "/conta/";
        } catch (falha) {
            erro.textContent = falha.message === "Failed to fetch" ? "Sem conexão. Tente de novo." : falha.message;
            erro.hidden = false;
            botao.disabled = false;
            botao.textContent = texto;
        }
    });
}

// Área do aluno: sem login, manda para a página de entrar
async function areaDoAluno() {
    const resposta = await fetch("/api/conta/eu");
    if (resposta.status === 401) {
        location.replace("/conta/entrar/");
        return;
    }
    const aluno = await resposta.json();
    document.getElementById("nome").textContent = aluno.nome.split(" ")[0];
    document.getElementById("email").textContent = aluno.email;
    document.getElementById("admin").hidden = !aluno.admin;
    document.getElementById("sair").addEventListener("click", async () => {
        await fetch("/api/conta/sair", { method: "POST" });
        location.href = "/";
    });
}
