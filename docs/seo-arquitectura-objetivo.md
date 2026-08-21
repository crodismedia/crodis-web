# Arquitectura SEO objetivo de TallerMap

Estructura única que deben respetar navegación, sitemap, canonical y rutas públicas:

```text
https://www.tallermap.es/
├── /provincias/alicante.html
│   └── /municipios/<municipio>-<codigo>.html
│       └── /talleres/<slug-unico>
├── /provincias/castellon.html
│   └── /municipios/<municipio>-<codigo>.html
│       └── /talleres/<slug-unico>
└── /provincias/valencia.html
    └── /municipios/<municipio>-<codigo>.html
        └── /talleres/<slug-unico>
```

Reglas:

- Una sola URL indexable por provincia.
- Una sola URL indexable por municipio.
- Una sola URL indexable por taller.
- `/talleres.html`, `/provincias/` y `/provincias/index.html` se consolidan hacia la portada.
- Las URLs legacy `/pages/taller.html?...` continúan únicamente como entrada de redirección hacia `/talleres/<slug-unico>`.
- Las páginas provinciales `?pagina=2`, `?pagina=3`, etc. pueden servir para navegación y descubrimiento de enlaces, pero no deben indexarse como páginas SEO independientes; canonicalizan a la provincia base.
- El sitemap provincial contiene exclusivamente las tres páginas provinciales canónicas.
