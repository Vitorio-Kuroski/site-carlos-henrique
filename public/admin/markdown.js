// Converte o texto dos posts (Markdown simples) em HTML seguro.
// Usado pelo Worker (páginas do blog) e pelo painel (prévia do post), para os dois ficarem iguais.
//
// Aceita:  ## Título   ### Subtítulo   **negrito**   *itálico*   `código`   [link](https://...)
//          ![descrição](imagem)   - lista   1. lista numerada   > citação   --- (linha)
// Todo o texto é escapado antes: HTML digitado no post aparece como texto, nunca vira código.

export function esc(texto) {
    return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Só endereços seguros: https/http, e-mail, caminhos do próprio site e âncoras
function enderecoSeguro(url) {
    const u = url.replace(/&amp;/g, "&");
    return /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(u) ? url : null;
}

function inline(texto) {
    const codigos = [];
    let t = esc(texto).replace(/`([^`]+)`/g, (_, c) => `\u0000${codigos.push(c) - 1}\u0000`);
    t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (tudo, alt, url) => {
        const ok = enderecoSeguro(url);
        return ok ? `<img src="${ok}" alt="${alt}" loading="lazy">` : tudo;
    });
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (tudo, rotulo, url) => {
        const ok = enderecoSeguro(url);
        if (!ok) return tudo;
        const externo = /^https?:/i.test(ok) ? ' target="_blank" rel="noopener"' : "";
        return `<a href="${ok}"${externo}>${rotulo}</a>`;
    });
    t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*\w])\*(?!\s)(.+?)(?<!\s)\*(?!\w)/g, "$1<em>$2</em>")
        .replace(/(^|[^_\w])_(?!\s)(.+?)(?<!\s)_(?!\w)/g, "$1<em>$2</em>");
    return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codigos[Number(i)]}</code>`);
}

export function markdownParaHtml(texto) {
    const linhas = String(texto || "").replace(/\r\n?/g, "\n").split("\n");
    const saida = [];
    let i = 0;
    const vazia = (l) => !l.trim();
    const ehLista = (l) => /^\s*[-*]\s+/.test(l);
    const ehNumerada = (l) => /^\s*\d+[.)]\s+/.test(l);
    const ehCitacao = (l) => /^\s*>/.test(l);
    const ehTitulo = (l) => /^#{1,4}\s+/.test(l);
    const ehLinha = (l) => /^\s*(-{3,}|\*{3,})\s*$/.test(l);

    while (i < linhas.length) {
        const linha = linhas[i];
        if (vazia(linha)) { i++; continue; }
        if (ehLinha(linha)) { saida.push("<hr>"); i++; continue; }
        if (ehTitulo(linha)) {
            const [, marcas, conteudo] = /^(#{1,4})\s+(.*)$/.exec(linha);
            const nivel = Math.max(2, marcas.length); // o título do post já é o h1
            saida.push(`<h${nivel}>${inline(conteudo.replace(/\s+#+\s*$/, ""))}</h${nivel}>`);
            i++;
            continue;
        }
        if (ehLista(linha) || ehNumerada(linha)) {
            const numerada = ehNumerada(linha);
            const teste = numerada ? ehNumerada : ehLista;
            const itens = [];
            while (i < linhas.length && (teste(linhas[i]) || (!vazia(linhas[i]) && /^\s{2,}\S/.test(linhas[i]) && itens.length))) {
                if (teste(linhas[i])) itens.push(linhas[i].replace(numerada ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/, ""));
                else itens[itens.length - 1] += " " + linhas[i].trim();
                i++;
            }
            const tag = numerada ? "ol" : "ul";
            saida.push(`<${tag}>${itens.map((t) => `<li>${inline(t)}</li>`).join("")}</${tag}>`);
            continue;
        }
        if (ehCitacao(linha)) {
            const partes = [];
            while (i < linhas.length && ehCitacao(linhas[i])) partes.push(linhas[i++].replace(/^\s*>\s?/, ""));
            saida.push(`<blockquote>${markdownParaHtml(partes.join("\n"))}</blockquote>`);
            continue;
        }
        const partes = [];
        while (i < linhas.length && !vazia(linhas[i]) && !ehTitulo(linhas[i]) && !ehLista(linhas[i]) && !ehNumerada(linhas[i])
            && !ehCitacao(linhas[i]) && !ehLinha(linhas[i])) {
            partes.push(linhas[i++].trim());
        }
        const so = partes.length === 1 && /^!\[[^\]]*\]\([^)\s]+\)$/.test(partes[0]);
        const html = inline(partes.join("\n")).replace(/\n/g, "<br>");
        saida.push(so ? `<figure>${html}</figure>` : `<p>${html}</p>`);
    }
    return saida.join("\n");
}

// Tempo de leitura (200 palavras por minuto, no mínimo 1)
export function minutosDeLeitura(texto) {
    return Math.max(1, Math.round((String(texto || "").match(/[\p{L}\p{N}]+/gu) || []).length / 200));
}
