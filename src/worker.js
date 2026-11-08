// Worker do site no Cloudflare (no GitHub Pages este arquivo não é usado).
//
// /api/conta/*: cadastro e login de alunos (src/alunos.js, banco de dados D1).
// /api/admin/*: painel do administrador (src/admin.js).
//
// Escolhe o idioma da página inicial:
// 1. Cookie "idioma": a escolha feita no seletor PT/EN.
// 2. Idioma do navegador: português vê a versão em português; o resto, a em inglês.
// Robôs de busca e de prévia de links sempre recebem a página pedida, para o Google indexar cada idioma.
import { rotasAdmin } from "./admin.js";
import { rotasConta } from "./alunos.js";

const ROBOS = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|lighthouse/i;

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname.startsWith("/api/conta/")) return rotasConta(request, env);
        if (url.pathname.startsWith("/api/admin/")) return rotasAdmin(request, env);
        if (url.pathname === "/" && !ROBOS.test(request.headers.get("User-Agent") || "")) {
            const cookie = /(?:^|;\s*)idioma=(pt|en)/.exec(request.headers.get("Cookie") || "")?.[1];
            const navegador = /^\s*pt\b/i.test(request.headers.get("Accept-Language") || "") ? "pt" : "en";
            if ((cookie || navegador) === "en") {
                return Response.redirect(new URL("/en/" + url.search, url).toString(), 302);
            }
        }
        return env.ASSETS.fetch(request);
    },
};
