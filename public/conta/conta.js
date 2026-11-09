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

// Botão "aguarde" e mensagem de erro, comuns aos formulários abaixo
async function enviar(form, rota, corpo) {
    const erro = document.getElementById("erro");
    const botao = form.querySelector("button");
    const texto = botao.textContent;
    botao.disabled = true;
    botao.textContent = "Aguarde...";
    erro.hidden = true;
    try {
        const resposta = await fetch(rota, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(corpo),
        });
        const dados = await resposta.json().catch(() => ({}));
        if (!resposta.ok) throw new Error(dados.erro || "Não deu certo. Tente de novo.");
        return dados;
    } catch (falha) {
        erro.textContent = falha.message === "Failed to fetch" ? "Sem conexão. Tente de novo." : falha.message;
        erro.hidden = false;
        throw falha;
    } finally {
        botao.disabled = false;
        botao.textContent = texto;
    }
}

// Esqueci minha senha: pede o link e mostra a mesma mensagem, tendo conta ou não
function formularioEsqueci() {
    const form = document.getElementById("form");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!form.reportValidity()) return;
        try {
            await enviar(form, "/api/conta/esqueci", { email: form.email.value });
            form.hidden = true;
            document.getElementById("ok").hidden = false;
        } catch {}
    });
}

// Senha nova: lê o código do link, tira-o do endereço e salva a senha
function formularioNovaSenha() {
    const form = document.getElementById("form");
    const token = new URLSearchParams(location.search).get("token") || "";
    history.replaceState(null, "", location.pathname);
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!form.reportValidity()) return;
        if (form.senha.value !== form.confirmar.value) {
            const erro = document.getElementById("erro");
            erro.textContent = "As duas senhas não são iguais.";
            erro.hidden = false;
            return;
        }
        try {
            await enviar(form, "/api/conta/nova-senha", { token, senha: form.senha.value });
            location.href = "/conta/";
        } catch {}
    });
}
