import json
import os
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlencode
from urllib.request import Request, urlopen

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://cnyptelvbsndpkzbrete.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
USER_AGENT = "TallerMap/1.0 (contacto@tallermap.es)"


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
        result = http_json(f"{SUPABASE_URL}/rest/v1/rpc/es_administrador", "POST", headers, {})
        return result is True
    except Exception:
        return False


def geocodificar(datos):
    query = ", ".join(x for x in [datos.get("direccion"), datos.get("codigo_postal"), datos.get("ciudad"), datos.get("provincia"), "España"] if x)
    params = urlencode({"q": query, "format": "jsonv2", "limit": 1, "countrycodes": "es"})
    result = http_json(f"https://nominatim.openstreetmap.org/search?{params}", headers={"User-Agent": USER_AGENT})
    if not result:
        return None
    return float(result[0]["lat"]), float(result[0]["lon"])


def investigar(datos):
    centro = geocodificar(datos)
    if not centro:
        return []
    lat, lon = centro
    query = f'''[out:json][timeout:20];(
      nwr(around:5000,{lat},{lon})[shop=car_repair];
      nwr(around:5000,{lat},{lon})[craft=car_repair];
      nwr(around:5000,{lat},{lon})[amenity=car_repair];
    );out center tags 30;'''
    payload = urlencode({"data": query}).encode("utf-8")
    req = Request("https://overpass-api.de/api/interpreter", data=payload, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=25) as response:
        raw = json.loads(response.read().decode("utf-8"))

    candidatos = []
    for element in raw.get("elements", []):
        tags = element.get("tags", {})
        name = tags.get("name") or tags.get("brand") or "Taller sin nombre"
        street = " ".join(x for x in [tags.get("addr:street"), tags.get("addr:housenumber")] if x)
        candidatos.append({
            "nombre": name,
            "direccion": street,
            "codigo_postal": tags.get("addr:postcode", ""),
            "ciudad": tags.get("addr:city") or tags.get("addr:town") or tags.get("addr:village", ""),
            "telefono": tags.get("contact:phone") or tags.get("phone", ""),
            "web": tags.get("contact:website") or tags.get("website", ""),
            "email": tags.get("contact:email") or tags.get("email", ""),
            "horarios": tags.get("opening_hours", ""),
            "fuente": "OpenStreetMap",
            "osm_tipo": element.get("type"),
            "osm_id": element.get("id"),
        })
    return candidatos


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
            datos = json.loads(self.rfile.read(length) or b"{}")
            resultados = investigar(datos)
            self._send(200, {"resultados": resultados, "total": len(resultados)})
        except Exception as exc:
            self._send(502, {"error": "No se pudo completar la búsqueda automática", "detalle": str(exc)[:180]})
