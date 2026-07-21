(function () {
    "use strict";

    const provincias = [
        ["01", "Araba/Álava"], ["02", "Albacete"], ["03", "Alicante/Alacant"],
        ["04", "Almería"], ["05", "Ávila"], ["06", "Badajoz"],
        ["07", "Illes Balears"], ["08", "Barcelona"], ["09", "Burgos"],
        ["10", "Cáceres"], ["11", "Cádiz"], ["12", "Castellón/Castelló"],
        ["13", "Ciudad Real"], ["14", "Córdoba"], ["15", "A Coruña"],
        ["16", "Cuenca"], ["17", "Girona"], ["18", "Granada"],
        ["19", "Guadalajara"], ["20", "Gipuzkoa"], ["21", "Huelva"],
        ["22", "Huesca"], ["23", "Jaén"], ["24", "León"],
        ["25", "Lleida"], ["26", "La Rioja"], ["27", "Lugo"],
        ["28", "Madrid"], ["29", "Málaga"], ["30", "Murcia"],
        ["31", "Navarra"], ["32", "Ourense"], ["33", "Asturias"],
        ["34", "Palencia"], ["35", "Las Palmas"], ["36", "Pontevedra"],
        ["37", "Salamanca"], ["38", "Santa Cruz de Tenerife"],
        ["39", "Cantabria"], ["40", "Segovia"], ["41", "Sevilla"],
        ["42", "Soria"], ["43", "Tarragona"], ["44", "Teruel"],
        ["45", "Toledo"], ["46", "Valencia/València"], ["47", "Valladolid"],
        ["48", "Bizkaia"], ["49", "Zamora"], ["50", "Zaragoza"],
        ["51", "Ceuta"], ["52", "Melilla"]
    ].map(([codigo, nombre]) => ({ codigo, nombre }));

    const porCodigo = Object.fromEntries(
        provincias.map((provincia) => [provincia.codigo, provincia])
    );

    function provinciaPorCodigoPostal(codigoPostal) {
        const codigo = String(codigoPostal || "").trim();
        if (!/^[0-9]{5}$/.test(codigo)) return null;
        return porCodigo[codigo.slice(0, 2)] || null;
    }

    function coincide(codigoPostal, nombreProvincia) {
        const provincia = provinciaPorCodigoPostal(codigoPostal);
        return Boolean(provincia && provincia.nombre === nombreProvincia);
    }

    function esComunitatValenciana(codigoPostal) {
        const codigo = String(codigoPostal || "").trim();
        return /^[0-9]{5}$/.test(codigo)
            && ["03", "12", "46"].includes(codigo.slice(0, 2));
    }

    function rellenarSelect(select) {
        if (!select) return;
        select.replaceChildren();

        const opcionInicial = document.createElement("option");
        opcionInicial.value = "";
        opcionInicial.textContent = "Selecciona una provincia";
        select.appendChild(opcionInicial);

        [...provincias]
            .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }))
            .forEach((provincia) => {
                const opcion = document.createElement("option");
                opcion.value = provincia.nombre;
                opcion.textContent = `${provincia.nombre} (CP ${provincia.codigo}xxx)`;
                select.appendChild(opcion);
            });
    }

    function seleccionarSegunCodigo(codigoPostal, select) {
        const provincia = provinciaPorCodigoPostal(codigoPostal);
        if (provincia && select) select.value = provincia.nombre;
        return provincia;
    }

    function inicializar() {
        rellenarSelect(document.getElementById("provincia"));
    }

    window.TallerMapProvincias = {
        provincias,
        provinciaPorCodigoPostal,
        coincide,
        esComunitatValenciana,
        rellenarSelect,
        seleccionarSegunCodigo
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", inicializar);
    } else {
        inicializar();
    }
}());
