# 💍 Boda Freddy & Priscila — Organizador Web + PWA + Android

Sistema completo para organizar la boda de **Freddy Peñafiel y Priscila Dumancela** (*viernes 26 de febrero de 2027*), basado en principios bíblicos y en el artículo de *La Atalaya* (diciembre de 2025): *"Cómo planear una boda que honre a Jehová"*.

## Módulos incluidos (9 módulos completos)

1. **Mi boda (Panel):** Cuenta regresiva, anillos de progreso, próximas tareas, avance por etapas, texto bíblico del día y edición rápida de los datos clave.
2. **Principios:** Los 13 principios del artículo de *La Atalaya* enlazados a `jw.org` / `wol.jw.org` y a las tareas que les corresponden.
3. **Tareas:** Checklist completo por etapas (Lo primero → El gran día) con filtros, búsqueda, asignación de responsables y control de atrasos.
4. **Invitados (100):** Lista con grupos, acompañantes, niños, RSVP en tiempo real, envío por WhatsApp con enlace personal, código único y exportación a CSV.
5. **Mesas:** Plano de mesas con arrastrar y soltar en escritorio + selector rápido en celular + hoja imprimible/PDF para los acomodadores.
6. **Presupuesto (USD):** Control "cero deudas" (`1 Juan 2:15-17`), gráfico por categoría, estimado vs. real y registro de abonos (Transferencia, Deuna, Banco Pichincha, Efectivo).
7. **Proveedores:** Directorio de cotizaciones con botones de llamada, WhatsApp y envío directo a Presupuesto.
8. **Equipo y Guías PDF:** Damas y caballeros (las 4 parejas), roles clave, Mix de baile (~8 min), generador de las 4 guías en PDF con datos reales y gestión de accesos (`admin` / `helper`).
9. **Web pública de la boda (`boda/index.html`):** Página elegante para los invitados con cuenta regresiva, mapas, código de vestimenta y confirmación RSVP segura por código.

---

## 1. Configurar la base de datos en Supabase (una sola vez)

1. Abre tu proyecto en [Supabase](https://supabase.com) → **SQL Editor → New query**.
2. Pega todo el contenido de `supabase/schema.sql` y pulsa **Run** *(si ya habías ejecutado la versión anterior, ejecuta solo `supabase/update_simple_phone.sql`)*.
3. Abre otra consulta (**New query**), pega `supabase/seed.sql` y pulsa **Run**.
4. ¡Listo! No necesitas configurar nada en Authentication ni correos.

## 2. Entrar y usarla

```bash
npm run dev
```

Abre `http://localhost:5500` (o tu enlace en GitHub Pages).
- Escribe solo tu **Nombre** y **Número de teléfono** y pulsa **Entrar** (la primera persona que entra queda automáticamente como **Administrador**).
- Luego, en **Equipo → Accesos al Sistema**, autorizas el teléfono de Priscila (como **Admin**) y de cualquier ayudante (como **Ayudante**).

## 3. Publicar en GitHub Pages

1. Crea un repositorio en GitHub (ej. `boda-freddy-priscila`) y sube esta carpeta a `main`.
2. Ve a **Settings → Pages → Source: `main` / `(root)`**.
3. ¡Listo! La web principal quedará en `https://tuusuario.github.io/boda-freddy-priscila/` y la web pública para invitados en `https://tuusuario.github.io/boda-freddy-priscila/boda/`.
4. **Instalar como App (PWA):** Al abrirla en Chrome en Android, pulsa el botón **"Instalar"** en la barra superior (o *"Añadir a pantalla de inicio"*).

## 4. Compilar APK para Android con Capacitor (opcional)

Igual que tu app `marilu-yanbal-app`:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npm run build:www
npx cap add android
npm run cap:sync
npx cap open android
```

Luego en Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
