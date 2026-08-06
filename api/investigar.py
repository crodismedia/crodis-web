import html
import ipaddress
import json
import os
import re
import socket
import unicodedata
from difflib import SequenceMatcher
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlencode, urljoin, urlparse
from urllib.request import Request, urlopen

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://cnyptelvbsndpkzbrete.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
USER_AGENT = "TallerMap/1.2 (contacto@tallermap.es)"
MAX_HTML_BYTES = 700_000
MAX_WEBS_ENRICHED = 5


def http_json(url, method="GET", headers=None, body=None, timeout=18):
    data = None if body is None else json.dumps(body).encode("utf-8")
    request = Request(url, data=data, method=method, headers=headers or {})
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def validar_admin(token):
    if not token or not SUPABASE_ANON_KEY:
        return False
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    try:
        return http_json(f"{SUPABASE_URL}/rest/v1/rpc/es_administrador", "POST", headers, {}) is True
    except Exception:
        return False


def normalizar(value):
    text = unicodedata.normalize("NFD", str(value or "").lower())
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    text = re.sub(r"\b(calle|c/|avenida|avda|av|carretera|ctra|talleres|taller)\b", " ", text)
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def similitud(left, right):
    a, b = normalizar(left), normalizar(right)
    if not a or not b:
        return None
    if a == b or a in b or b in a:
        return 1.0
    return SequenceMatcher(None, a, b).ratio()


def puntuar(ficha, candidato):
    checks = (("nombre", 35), ("direccion", 30), ("codigo_postal", 20), ("ciudad", 15))
    obtained = available = 0.0
    details = {}
    for field, weight in checks:
        score = similitud(ficha.get(field), candidato.get(field))
        details[field] = None if score is None else round(score * 100)
        if score is not None:
            available += weight
            obtained += weight * score
    candidato["coincidencia"] = round((obtained / available) * 100) if available else 0
    candidato["coincidencias"] = details
    return candidato


def geocodificar(datos):
    query = ", ".join(
        item for item in [datos.get("direccion"), datos.get("codigo_postal"), datos.get("ciudad"), datos.get("provincia"), "España"] if item
    )
    params = urlencode({"q": query, "format": "jsonv2", "limit": 1, "countrycodes": "es"})
    result = http_json(
        f"https://nominatim.openstreetmap.org/search?{params}",
        headers={"User-Agent": USER_AGENT},
    )
    if not result:
        return None
    return float(result[0]["lat"]), float(result[0]["lon"])


def limpiar_url(value):
    raw = str(value or "").strip()
    if not raw:
        return ""
    if not re.match(r"^https?://", raw, re.I):
        raw = "https://" + raw
    parsed = urlparse(raw)
    host = (parsed.hostname or "").lower().removeprefix("www.")
    if not host:
        return ""
    path = re.sub(r"/{2,}", "/", parsed.path or "/")
    if re.fullmatch(r"/(?:index\.(?:html?|php)|inicio|home)?/?", path, re.I):
        path = "/"
    return f"{parsed.scheme.lower()}://{host}{'' if path == '/' else path}".rstrip("/")


def host_publico(url):
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return False
    host = parsed.hostname.lower()
    if host in {"localhost", "localhost.localdomain"} or host.endswith(".local"):
        return False
    try:
        addresses = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
        for address in addresses:
            ip = ipaddress.ip_address(address[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return False
    except Exception:
        return False
    return True


def descargar_html(url):
    clean = limpiar_url(url)
    if not clean or not host_publico(clean):
        return "", ""
    request = Request(
        clean,
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
    )
    with urlopen(request, timeout=10) as response:
        final_url = response.geturl()
        if not host_publico(final_url):
            return "", ""
        content_type = response.headers.get("Content-Type", "").lower()
        if "text/html" not in content_type and "application/xhtml+xml" not in content_type:
            return "", ""
        raw = response.read(MAX_HTML_BYTES + 1)
        if len(raw) > MAX_HTML_BYTES:
            raw = raw[:MAX_HTML_BYTES]
        charset = response.headers.get_content_charset() or "utf-8"
        return raw.decode(charset, errors="replace"), limpiar_url(final_url)


def texto_visible(source):
    source = re.sub(r"<script\b[^>]*>.*?</script>", " ", source, flags=re.I | re.S)
    source = re.sub(r"<style\b[^>]*>.*?</style>", " ", source, flags=re.I | re.S)
    source = re.sub(r"<[^>]+>", " ", source)
    return re.sub(r"\s+", " ", html.unescape(source)).strip()


def primero(values):
    for value in values:
        value = str(value or "").strip()
        if value:
            return value
    return ""


def extraer_jsonld(source):
    found = []
    for block in re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', source, re.I | re.S):
        try:
            value = json.loads(html.unescape(block).strip())
            found.extend(value if isinstance(value, list) else [value])
        except Exception:
            continue
    flattened = []
    for item in found:
        if isinstance(item, dict) and isinstance(item.get("@graph"), list):
            flattened.extend(x for x in item["@graph"] if isinstance(x, dict))
        elif isinstance(item, dict):
            flattened.append(item)
    return flattened


def extraer_web(source, final_url):
    visible = texto_visible(source)
    emails = re.findall(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", source, re.I)
    phones = re.findall(r"(?:\+34[\s().-]*)?[6789](?:[\s().-]*\d){8}", visible)
    mailtos = re.findall(r'href=["\']mailto:([^?"\']+)', source, re.I)
    tels = re.findall(r'href=["\']tel:([^"\']+)', source, re.I)
    jsonld = extraer_jsonld(source)

    ld_phones, ld_emails, ld_hours = [], [], []
    for item in jsonld:
        ld_phones.append(item.get("telephone", ""))
        ld_emails.append(item.get("email", ""))
        opening = item.get("openingHours") or item.get("openingHoursSpecification")
        if isinstance(opening, str):
            ld_hours.append(opening)
        elif opening:
            ld_hours.append(json.dumps(opening, ensure_ascii=False))

    hours_patterns = re.findall(
        r"(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|lun(?:es)?\.?\s*(?:a|-)\s*vier(?:nes)?\.?).{0,100}?\d{1,2}[:.]\d{2}.{0,50}?\d{1,2}[:.]\d{2}",
        visible,
        re.I,
    )
    return {
        "telefono": primero(ld_phones + tels + phones),
        "email": primero(ld_emails + mailtos + emails).lower(),
        "horarios": primero(ld_hours + hours_patterns),
        "web": limpiar_url(final_url),
    }


def enriquecer_candidato(candidate):
    if not candidate.get("web"):
        candidate["web_verificada"] = False
        return candidate
    try:
        source, final_url = descargar_html(candidate["web"])
        if not source:
            candidate["web_verificada"] = False
            return candidate
        details = extraer_web(source, final_url)
        for field in ("telefono", "email", "horarios"):
            if not candidate.get(field) and details.get(field):
                candidate[field] = details[field]
        candidate["web"] = details.get("web") or limpiar_url(candidate["web"])
        candidate["web_verificada"] = True
        candidate["fuente_web"] = candidate["web"]
    except Exception:
        candidate["web_verificada"] = False
    return candidate


def investigar(datos):
    centro = geocodificar(datos)
    if not centro:
        return []
    lat, lon = centro
    query = f'''[out:json][timeout:20];(
      nwr(around:7000,{lat},{lon})[shop=car_repair];
      nwr(around:7000,{lat},{lon})[craft=car_repair];
      nwr(around:7000,{lat},{lon})[amenity=car_repair];
    );out center tags 60;'''
    payload = urlencode({"data": query}).encode("utf-8")
    request = Request("https://overpass-api.de/api/interpreter", data=payload, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=25) as response:
        raw = json.loads(response.read().decode("utf-8"))

    candidates, seen = [], set()
    for element in raw.get("elements", []):
        tags = element.get("tags", {})
        name = tags.get("name") or tags.get("brand") or "Taller sin nombre"
        street = " ".join(item for item in [tags.get("addr:street"), tags.get("addr:housenumber")] if item)
        candidate = {
            "nombre": name,
            "direccion": street,
            "codigo_postal": tags.get("addr:postcode", ""),
            "ciudad": tags.get("addr:city") or tags.get("addr:town") or tags.get("addr:village", ""),
            "provincia": tags.get("addr:province", ""),
            "telefono": tags.get("contact:phone") or tags.get("phone", ""),
            "web": limpiar_url(tags.get("contact:website") or tags.get("website", "")),
            "email": tags.get("contact:email") or tags.get("email", ""),
            "horarios": tags.get("opening_hours", ""),
            "fuente": "OpenStreetMap",
            "osm_tipo": element.get("type"),
            "osm_id": element.get("id"),
        }
        key = (normalizar(name), normalizar(street), candidate["codigo_postal"])
        if key in seen:
            continue
        seen.add(key)
        candidates.append(puntuar(datos, candidate))

    candidates.sort(key=lambda item: (item["coincidencia"], bool(item["telefono"]), bool(item["web"])), reverse=True)
    for candidate in candidates[:MAX_WEBS_ENRICHED]:
        enriquecer_candidato(candidate)
    candidates.sort(key=lambda item: (item["coincidencia"], bool(item["telefono"]), bool(item["email"]), bool(item["web"])), reverse=True)
    return candidates[:15]


class handler(BaseHTTPRequestHandler):
    def _send(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        token = self.headers.get("Authorization", "").replace("Bearer ", "").strip()
        if not validar_admin(token):
            self._send(401, {"error": "Acceso administrativo requerido"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            data = json.loads(self.rfile.read(length) or b"{}")
            if not data.get("nombre") or not (data.get("codigo_postal") or data.get("ciudad")):
                self._send(400, {"error": "Se necesita nombre y ubicación"})
                return
            results = investigar(data)
            self._send(200, {"resultados": results, "total": len(results), "enriquecimiento_web": True})
        except Exception as exc:
            self._send(502, {"error": "No se pudo completar la búsqueda automática", "detalle": str(exc)[:180]})
