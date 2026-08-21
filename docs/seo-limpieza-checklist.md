# Checklist de validación antes de producción

- [ ] `/` responde 200 y es indexable.
- [ ] `/talleres.html` redirige permanentemente a la portada.
- [ ] `/provincias/` redirige permanentemente a la portada.
- [ ] `/provincias/index.html` redirige permanentemente a la portada.
- [ ] Las tres provincias responden 200, `index,follow` y canonical propio.
- [ ] `?pagina=2` y superiores responden con `noindex,follow` y canonical a la provincia base.
- [ ] Los municipios responden 200, `index,follow` y canonical propio.
- [ ] Las fichas `/talleres/<slug>` responden 200, `index,follow` y canonical propio.
- [ ] Las URLs legacy `/pages/taller.html?...` redirigen a la ficha canónica correspondiente.
- [ ] `sitemap-provincias.xml` contiene solo Alicante, Castellón y Valencia.
- [ ] Screaming Frog no descubre rutas SEO paralelas inesperadas.
