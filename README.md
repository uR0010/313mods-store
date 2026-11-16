# 313 Mods — web de la tienda

Web propia de 313 Mods conectada a Tebex con la Headless API. Los productos, precios, categorías e imágenes se leen de Tebex en cada visita: **todo se sigue gestionando desde el panel de Tebex** y la web se actualiza sola.

- El pago, los impuestos, la entrega a Cfx.re y los reembolsos los hace Tebex (checkout de Tebex).
- Idiomas: inglés por defecto; español y portugués se activan solos según el idioma del navegador, o con el selector EN / ES / PT.
- No necesita servidor ni compilar nada: son archivos estáticos (HTML, CSS y JavaScript).

## Qué editar

| Quiero cambiar… | Archivo |
|---|---|
| Enlace de Discord, token público, nº de productos en «New drop» | `assets/js/config.js` |
| Textos de la web (banners, avisos, pie) en EN / ES / PT | `assets/js/i18n.js` |
| Imágenes de los banners | `assets/img/banner-*.webp` (1920×840 y versión `-960`) |
| Colores y estilo | `assets/css/site.css` |

## Ofertas y secciones de la portada (`assets/js/config.js`)

| Ajuste | Qué hace |
|---|---|
| `newDrop` | IDs de Tebex de los productos de «New drop», en orden. Ahora: Male V1 + Violet Hour Crewneck + Undertow Jeans. |
| `welcomeOffer` | Llamada de bienvenida con descuento para quien entra por primera vez. El código (`WELCOME10`) tiene que existir en Tebex → Engagement → Coupons. `enabled: false` la apaga. |
| `basketGift` | Mensaje de regalo para quien deja productos en la cesta y vuelve después de `afterMinutes`, o mueve el ratón para cerrar la pestaña. El código (`GIFT10`) tiene que existir en Tebex. |
| `upcoming` | Aviso «Coming soon» de Female V1. Cuando exista en Tebex, pon su ID en `packageId`. Cuando crees el pack Duo, pon su ID en `duoPackageId` y los IDs que incluye en `duoIncludes`: la web calcula sola el precio tachado y lo que se ahorra. |

Para ver las ventanas sin esperar: `https://313mods.shop/?preview=call` y `https://313mods.shop/?preview=gift`.

Las preguntas frecuentes y los pasos de entrega están en `assets/js/i18n.js` (claves `faq` y `how.*`), en los tres idiomas.

Las etiquetas **FiveM** y **Story Mode** de cada producto salen solas según la descripción del paquete en Tebex: si menciona FiveM, fxmanifest, Cfx.re, Escrow, ESX o QBCore aparece «FiveM»; si menciona OpenIV, Story Mode, single player, Menyoo u .oiv aparece «Story Mode».

## Seguridad

`config.js` solo lleva el **token público** de Tebex, que está hecho para usarse en webs. **Nunca** pongas aquí la clave privada.

## Probar en local

```bash
python3 -m http.server 8313
```

Abre http://localhost:8313

## Publicar con GitHub Pages

La web está publicada con GitHub Pages en **https://313mods.shop** (rama `main`, carpeta raíz). Cada cambio que se sube a `main` se publica solo en uno o dos minutos.

El dominio se compró en Hostinger y apunta a GitHub con 4 registros A (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) y un CNAME `www` → `ur0010.github.io`. El archivo `CNAME` de este repositorio lo crea GitHub: no lo borres.
