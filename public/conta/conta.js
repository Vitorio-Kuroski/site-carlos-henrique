// Cadastro, login e área do aluno: conversa com as rotas /api/conta/* do Worker (src/alunos.js).

// Para onde ir depois de entrar: o "?voltar=" (só caminhos deste site) ou a área do aluno
function destinoDepoisDeEntrar() {
    const voltar = new URLSearchParams(location.search).get("voltar") || "";
    return /^\/(?![\/\\])/.test(voltar) ? voltar : "/conta/";
}

// Leva o "?voltar=" para os links entre Entrar e Criar conta
document.querySelectorAll(".conta__troca a").forEach((a) => {
    const voltar = new URLSearchParams(location.search).get("voltar");
    if (voltar) a.href += "?voltar=" + encodeURIComponent(voltar);
});

// Formulários de entrar e de criar conta: deu certo, vai para a área do aluno (ou de volta ao curso)
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
            location.href = destinoDepoisDeEntrar();
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
    mostrarCursos();
    conferirPedido();
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

// Área do aluno: cursos liberados
async function mostrarCursos() {
    const caixa = document.getElementById("cursos");
    const { cursos } = await (await fetch("/api/conta/cursos")).json();
    if (!cursos?.length) return;
    caixa.innerHTML = "<h2>Seus cursos</h2>";
    const lista = document.createElement("ul");
    lista.className = "conta__lista";
    for (const c of cursos) {
        const item = document.createElement("li");
        const titulo = document.createElement("strong");
        titulo.textContent = c.titulo;
        const nota = document.createElement("span");
        nota.textContent = "As aulas estão sendo preparadas e aparecem aqui em breve.";
        item.append(titulo, nota);
        lista.append(item);
    }
    caixa.append(lista);
}

// Volta do Mercado Pago (?pedido=123): mostra a situação do pagamento
async function conferirPedido() {
    const id = new URLSearchParams(location.search).get("pedido");
    if (!/^\d+$/.test(id || "")) return;
    history.replaceState(null, "", location.pathname);
    const aviso = document.getElementById("aviso-pedido");
    const textos = {
        aprovado: ["ok", "Pagamento aprovado! O curso já está liberado."],
        pendente: ["espera", "Recebemos o seu pedido. Assim que o pagamento for confirmado (no Pix, em segundos; no boleto, em até 3 dias úteis), o curso aparece aqui."],
        recusado: ["erro", "O pagamento não foi aprovado. Você pode tentar de novo pela página do curso."],
        cancelado: ["erro", "O pagamento foi cancelado. Você pode tentar de novo pela página do curso."],
        reembolsado: ["erro", "Este pagamento foi reembolsado."],
    };
    try {
        const pedido = await (await fetch("/api/conta/pedidos/" + id)).json();
        const [tipo, texto] = textos[pedido.status] || textos.pendente;
        aviso.className = "conta__aviso conta__aviso--" + tipo;
        aviso.textContent = texto;
        aviso.hidden = false;
        if (pedido.status === "aprovado") mostrarCursos();
    } catch {}
}
