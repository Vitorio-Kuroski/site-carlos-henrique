// Páginas dos cursos: botão Comprar (sem login, manda para Entrar e volta para cá depois) e aulas.
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

// Página da aula: "Marcar como concluída" salva o progresso e leva para a próxima aula
const concluir = document.getElementById("concluir");
if (concluir) {
    const aula = document.getElementById("aula").dataset.aula;
    const erro = document.getElementById("erro");
    const check = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    const play = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>';
    concluir.addEventListener("click", async () => {
        const marcar = concluir.getAttribute("aria-pressed") !== "true";
        concluir.disabled = true;
        erro.hidden = true;
        try {
            const resposta = await fetch(`/api/conta/aulas/${aula}/concluida`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ concluida: marcar }),
            });
            const dados = await resposta.json().catch(() => ({}));
            if (!resposta.ok) throw new Error(dados.erro || "Não foi possível salvar. Tente de novo.");
            concluir.setAttribute("aria-pressed", String(marcar));
            concluir.classList.toggle("botao--feito", marcar);
            concluir.innerHTML = marcar ? check + " Aula concluída" : "Marcar como concluída";
            const item = document.querySelector(`.aulas__item[data-aula="${aula}"]`);
            if (item) {
                item.classList.toggle("aulas__item--feita", marcar);
                item.querySelector(".aulas__icone").innerHTML = marcar ? check : play;
            }
            const progresso = document.getElementById("progresso");
            if (progresso) {
                const total = Number(progresso.dataset.total);
                document.getElementById("progresso-texto").textContent = `${dados.concluidas} de ${total}`;
                document.getElementById("progresso-barra").style.width = Math.round((dados.concluidas / total) * 100) + "%";
                progresso.querySelector("[role=progressbar]").setAttribute("aria-valuenow", dados.concluidas);
            }
            // Concluiu: segue para a próxima aula depois de um instante
            if (marcar && concluir.dataset.proxima) setTimeout(() => { location.href = concluir.dataset.proxima; }, 700);
        } catch (falha) {
            erro.textContent = falha.message === "Failed to fetch" ? "Sem conexão. Tente de novo." : falha.message;
            erro.hidden = false;
        } finally {
            concluir.disabled = false;
        }
    });
}
