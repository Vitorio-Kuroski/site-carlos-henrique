// Menu do celular (☰): aparece quando o menu de cima não cabe (telas com menos de 900 px).
// Monta a lista a partir dos links do menu de computador da própria página (.topo .menu), mais Ajuda e
// Área do aluno, então qualquer link novo no menu entra aqui sozinho.
(() => {
    const topo = document.querySelector(".topo");
    const menu = topo?.querySelector(".menu");
    const acoes = topo?.querySelector(".topo__acoes");
    if (!menu || !acoes) return;

    const ingles = document.documentElement.lang.startsWith("en");
    const textos = ingles
        ? { abrir: "Open menu", fechar: "Close menu", menu: "Menu", inicio: "Home", ajuda: "Help", conta: "Student area" }
        : { abrir: "Abrir menu", fechar: "Fechar menu", menu: "Menu", inicio: "Início", ajuda: "Ajuda", conta: "Área do aluno" };

    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "topo__menu";
    botao.setAttribute("aria-expanded", "false");
    botao.setAttribute("aria-controls", "menu-celular");
    botao.setAttribute("aria-label", textos.abrir);
    botao.innerHTML = '<svg class="icone" viewBox="0 0 24 24" aria-hidden="true"><path class="topo__menu-a" d="M4 7h16"/><path class="topo__menu-b" d="M4 12h16"/><path class="topo__menu-c" d="M4 17h16"/></svg>';
    acoes.append(botao);

    const painel = document.createElement("nav");
    painel.id = "menu-celular";
    painel.className = "menu-celular";
    painel.setAttribute("aria-label", textos.menu);
    painel.hidden = true;
    const lista = document.createElement("div");
    lista.className = "caixa menu-celular__lista";
    const item = (href, texto, extra = "") => {
        const a = document.createElement("a");
        a.href = href;
        a.textContent = texto;
        if (extra) a.className = extra;
        lista.append(a);
    };
    const inicio = topo.querySelector(".marca")?.getAttribute("href") || "/";
    item(inicio, textos.inicio);
    menu.querySelectorAll("a").forEach((a) => item(a.getAttribute("href"), a.textContent.trim()));
    item("/conta/mensagens/", textos.ajuda, "menu-celular__extra");
    item("/conta/", textos.conta, "menu-celular__extra");
    painel.append(lista);
    topo.append(painel);

    const abrir = (aberto) => {
        painel.hidden = !aberto;
        botao.setAttribute("aria-expanded", String(aberto));
        botao.setAttribute("aria-label", aberto ? textos.fechar : textos.abrir);
        document.documentElement.classList.toggle("menu-aberto", aberto);
    };
    botao.addEventListener("click", () => abrir(painel.hidden));
    painel.addEventListener("click", (e) => { if (e.target.closest("a")) abrir(false); });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !painel.hidden) { abrir(false); botao.focus(); }
    });
    document.addEventListener("click", (e) => { if (!painel.hidden && !topo.contains(e.target)) abrir(false); });
    matchMedia("(min-width: 900px)").addEventListener("change", (e) => { if (e.matches) abrir(false); });
})();
