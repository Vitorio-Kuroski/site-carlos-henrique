// Cadastro, login e área do aluno: conversa com as rotas /api/conta/* do Worker (src/alunos.js).

// Para onde ir depois de entrar: o "?voltar=" (só caminhos deste site); se não houver,
// o administrador vai direto para o painel e o aluno para a área do aluno
function destinoDepoisDeEntrar(admin = false) {
    const voltar = new URLSearchParams(location.search).get("voltar") || "";
    if (/^\/(?![\/\\])/.test(voltar)) return voltar;
    return admin ? "/admin/" : "/conta/";
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
            location.href = destinoDepoisDeEntrar(dados.admin);
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
    // Administrador não usa a área do aluno: vai direto para o painel
    if (aluno.admin) {
        location.replace("/admin/");
        return;
    }
    document.getElementById("nome").textContent = aluno.nome.split(" ")[0];
    document.getElementById("email").textContent = aluno.email;
    mostrarCursos();
    conferirPedido();
    mostrarNaoLidas();
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
        item.append(titulo, nota);
        if (!c.aulas) {
            nota.textContent = "As aulas estão sendo preparadas e aparecem aqui em breve.";
        } else {
            const pronto = c.concluidas >= c.aulas;
            nota.textContent = pronto ? `Curso concluído · ${c.aulas} aulas` : `${c.concluidas} de ${c.aulas} aulas concluídas`;
            const barra = document.createElement("div");
            barra.className = "barra";
            barra.setAttribute("role", "progressbar");
            barra.setAttribute("aria-label", "Progresso em " + c.titulo);
            barra.setAttribute("aria-valuemin", "0");
            barra.setAttribute("aria-valuemax", String(c.aulas));
            barra.setAttribute("aria-valuenow", String(c.concluidas));
            const cheio = document.createElement("span");
            cheio.style.width = Math.round((c.concluidas / c.aulas) * 100) + "%";
            barra.append(cheio);
            const ir = document.createElement("a");
            ir.className = "botao botao--pequeno";
            ir.href = c.continuar;
            ir.textContent = pronto ? "Rever as aulas" : c.concluidas ? "Continuar" : "Começar o curso";
            item.append(barra, ir);
        }
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

// ---------- Mensagens ----------

// Respostas não lidas, no atalho "Mensagens" da área do aluno
async function mostrarNaoLidas() {
    try {
        const { nao_lidas: n } = await (await fetch("/api/conta/mensagens/novas")).json();
        const selo = document.getElementById("nao-lidas");
        selo.textContent = n === 1 ? "1 nova" : `${n} novas`;
        selo.hidden = !n;
    } catch { /* sem aviso, sem problema */ }
}

// Texto da mensagem com os endereços https:// clicáveis (sem HTML vindo do servidor)
function textoComLinks(texto) {
    const fragmento = document.createDocumentFragment();
    let ultimo = 0;
    for (const achado of texto.matchAll(/https:\/\/[^\s<]+[^\s<.,;:!?)]/g)) {
        fragmento.append(texto.slice(ultimo, achado.index));
        const a = document.createElement("a");
        a.href = achado[0];
        a.textContent = achado[0];
        a.target = "_blank";
        a.rel = "noopener";
        fragmento.append(a);
        ultimo = achado.index + achado[0].length;
    }
    fragmento.append(texto.slice(ultimo));
    return fragmento;
}

function horario(data) {
    const d = new Date(data.replace(" ", "T") + "Z");
    const hoje = new Date().toDateString() === d.toDateString();
    return hoje ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function paginaMensagens() {
    const lista = document.getElementById("conversa");
    const form = document.getElementById("form-mensagem");
    const campo = document.getElementById("texto");
    const erro = document.getElementById("erro");
    let ultimoId = -1;

    function desenhar(mensagens) {
        const ultimo = mensagens.length ? mensagens[mensagens.length - 1].id : 0;
        if (ultimo === ultimoId) return;
        ultimoId = ultimo;
        lista.innerHTML = "";
        if (!mensagens.length) {
            const vazio = document.createElement("p");
            vazio.className = "chat__vazio";
            vazio.textContent = "Nenhuma mensagem ainda. Escreva a primeira abaixo.";
            lista.append(vazio);
            return;
        }
        for (const m of mensagens) {
            const balao = document.createElement("div");
            balao.className = "chat__msg " + (m.de_admin ? "chat__msg--deles" : "chat__msg--minha");
            const autor = document.createElement("p");
            autor.className = "chat__autor";
            autor.textContent = (m.de_admin ? m.autor : "Você") + " · " + horario(m.criado_em);
            const texto = document.createElement("p");
            texto.className = "chat__texto";
            texto.append(textoComLinks(m.texto));
            balao.append(autor, texto);
            lista.append(balao);
        }
        lista.scrollTop = lista.scrollHeight;
    }

    async function carregar() {
        const resposta = await fetch("/api/conta/mensagens");
        if (resposta.status === 401) {
            location.replace("/conta/entrar/?voltar=" + encodeURIComponent(location.pathname));
            return;
        }
        desenhar((await resposta.json()).mensagens || []);
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const botao = form.querySelector("button");
        erro.hidden = true;
        botao.disabled = true;
        try {
            const resposta = await fetch("/api/conta/mensagens", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texto: campo.value }),
            });
            const dados = await resposta.json().catch(() => ({}));
            if (!resposta.ok) throw new Error(dados.erro || "Não foi possível enviar. Tente de novo.");
            campo.value = "";
            await carregar();
        } catch (falha) {
            erro.textContent = falha.message === "Failed to fetch" ? "Sem conexão. Tente de novo." : falha.message;
            erro.hidden = false;
        } finally {
            botao.disabled = false;
            campo.focus();
        }
    });
    // Ctrl+Enter (ou Cmd+Enter) envia; Enter sozinho pula linha
    campo.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) form.requestSubmit();
    });

    await carregar();
    // Confere respostas novas a cada 15 segundos enquanto a página está aberta e visível
    setInterval(() => { if (!document.hidden) carregar().catch(() => {}); }, 15000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) carregar().catch(() => {}); });
}
