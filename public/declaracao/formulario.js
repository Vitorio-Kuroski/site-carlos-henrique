// Formulário de pedido de declaração: envia para /api/declaracoes e mostra a confirmação na mesma página.
const form = document.getElementById("form-declaracao");
if (form) {
    const erro = document.getElementById("erro");
    const mostrarErro = (texto, campo) => {
        erro.textContent = texto;
        erro.hidden = false;
        (campo || erro).focus?.();
        erro.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        erro.hidden = true;
        const dados = new FormData(form);
        const corpo = {
            nome: dados.get("nome"),
            servico: dados.get("servico"),
            anos: dados.getAll("anos"),
            estado_civil: dados.get("estado_civil"),
            revenue: dados.get("revenue"),
            situacoes: dados.getAll("situacoes"),
            email: dados.get("email"),
            telefone: dados.get("telefone"),
            mensagem: dados.get("mensagem"),
            site: dados.get("site"),
            inicio: dados.get("inicio"),
        };
        // Conferência rápida antes de enviar (o servidor confere de novo)
        if (!String(corpo.nome || "").trim()) return mostrarErro("Escreva o seu nome completo.", form.nome);
        if (!corpo.servico) return mostrarErro("Escolha o serviço que você procura.", form.querySelector("[name=servico]"));
        if (!corpo.anos.length) return mostrarErro("Marque pelo menos um ano de imposto.", form.querySelector("[name=anos]"));
        if (!form.email.checkValidity() || !corpo.email) return mostrarErro("Informe um e-mail válido para a resposta.", form.email);

        const botao = form.querySelector("button[type=submit]");
        botao.disabled = true;
        botao.textContent = "Enviando...";
        try {
            const resposta = await fetch("/api/declaracoes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(corpo),
            });
            const r = await resposta.json().catch(() => ({}));
            if (!resposta.ok) throw new Error(r.erro || "Não foi possível enviar. Tente de novo.");
            document.getElementById("enviado-email").textContent = corpo.email;
            form.hidden = true;
            const ok = document.getElementById("enviado");
            ok.hidden = false;
            ok.focus({ preventScroll: true });
            // O formulário sumiu e a página encolheu: leva direto à confirmação
            window.scrollTo({ top: ok.getBoundingClientRect().top + window.scrollY - 100 });
        } catch (falha) {
            mostrarErro(falha.message === "Failed to fetch" ? "Sem conexão. Tente de novo." : falha.message);
            botao.disabled = false;
            botao.innerHTML = 'Enviar <span aria-hidden="true">→</span>';
        }
    });
}
