import tallerHandler from "./taller-html.js";

function prepararFichaCanonica(html) {
    if (typeof html !== "string") return html;

    return html
        .replace(
            /\s*<script[^>]+src="[^"]*taller-legacy-redirect\.js[^"]*"[^>]*><\/script>/gi,
            ""
        )
        .replace(
            /\s*<script[^>]+src="https:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net)\/[^"]*supabase[^"]*"[^>]*><\/script>/gi,
            ""
        );
}

export default async function handler(request, response) {
    const originalSend = response.send.bind(response);

    response.send = (body) => originalSend(prepararFichaCanonica(body));

    return tallerHandler(request, response);
}
