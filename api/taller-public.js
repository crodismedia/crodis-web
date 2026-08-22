import tallerHandler from "./taller-html.js";

const SUPABASE_BROWSER = '<script src="https://unpkg.com/@supabase/supabase-js@2.111.0/dist/umd/supabase.js" data-tallermap-supabase-valoraciones="true"></script>';

function prepararFichaCanonica(html) {
    if (typeof html !== "string") return html;

    let output = html.replace(
        /\s*<script[^>]+src="[^"]*taller-legacy-redirect\.js[^"]*"[^>]*><\/script>/gi,
        ""
    );

    if (
        /<script[^>]+src="[^"]*valoraciones\.js[^"]*"/i.test(output) &&
        !/data-tallermap-supabase-valoraciones=/i.test(output) &&
        !/supabase-js@2\.111\.0\/dist\/umd\/supabase\.js/i.test(output)
    ) {
        output = output.replace(
            /(<script[^>]+src="[^"]*valoraciones\.js[^"]*"[^>]*><\/script>)/i,
            `${SUPABASE_BROWSER}\n$1`
        );
    }

    return output;
}

export default async function handler(request, response) {
    const originalSend = response.send.bind(response);

    response.send = (body) => originalSend(prepararFichaCanonica(body));

    return tallerHandler(request, response);
}
