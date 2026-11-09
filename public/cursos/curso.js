// Página do curso: botão Comprar. Sem login, manda para Entrar e volta para cá depois.
const compra = document.getElementById("compra");
if (compra) {
    const botao = document.getElementById("comprar");
    const erro = document.getElementById("erro");
    botao.addEventListener("click", async () => {
        botao.disabled = true;
        botao.textContent = "Abrindo o pagamento...";
        erro.hidden = true;
        try {
            const resposta = await fetch("/api/compras", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ curso_id: Number(compra.dataset.curso) }),
            });
            const dados = await resposta.json().catch(() => ({}));
            if (resposta.status === 401) {
                location.href = "/conta/entrar/?voltar=" + encodeURIComponent(location.pathname);
                return;
            }
            if (dados.ja_tem) {
                location.href = "/conta/";
                return;
            }
            if (!resposta.ok || !dados.checkout) throw new Error(dados.erro || "Não foi possível abrir o pagamento.");
            location.href = dados.checkout;
        } catch (falha) {
            erro.textContent = falha.message === "Failed to fetch" ? "Sem conexão. Tente de novo." : falha.message;
            erro.hidden = false;
            botao.disabled = false;
            botao.textContent = "Comprar o curso";
        }
    });
}
