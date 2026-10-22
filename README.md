# Ahorro Luxury — App móvil

Versión móvil (React Native + Expo Go) del portal web **AhorroLuxury-Web**, desde el login en adelante
(sin landing page). Usa el mismo backend: **AhorroLuxury-Back**.

## Requisitos

- Node 22.13+ (requerido por este proyecto)
- App **Expo Go** compatible con SDK 57 en el celular
- Para el simulador de iOS se requiere macOS y Xcode; desde Windows, prueba en un iPhone físico con Expo Go
- Backend corriendo (`npm run dev` en AhorroLuxury-Back → `http://localhost:3000`)

## Puesta en marcha

```bash
npm ci
npx expo start
```

Escanea el QR con Expo Go. El celular y el PC deben estar en **la misma red Wi‑Fi**.

### ¿A qué URL se conecta?

`src/config.ts` resuelve la URL del backend en este orden:

1. `EXPO_PUBLIC_API_URL` (archivo `.env`, ver `.env.example`)
2. La IP del PC que corre Metro (la que usa Expo Go) + `:3000`
3. Emulador Android → `10.0.2.2:3000`; resto → `localhost:3000`

En modo desarrollo, la pantalla de login muestra la URL activa abajo para depurar rápido.
Si el celular no conecta, revisa que el firewall del PC permita el puerto 3000.

## Estructura

```
src/
├─ app/                      Rutas (Expo Router)
│  ├─ _layout.tsx            Raíz: sesión + rutas protegidas
│  ├─ login.tsx              Login  → POST /api/login/check-user
│  ├─ change-password.tsx    Cambio obligatorio (resetPassword = 1)
│  └─ (app)/                 Zona autenticada
│     ├─ index.tsx           Dashboard financiero
│     ├─ usuarios.tsx        Socios (alta, edición, estado, reset clave, boletas)
│     ├─ ahorro.tsx          Ahorro programado y mora
│     ├─ rifa/[type].tsx     Rifa 1 / 2 (tablero 00–99)
│     ├─ prestamos.tsx       Préstamos y abonos mixtos
│     ├─ pagos.tsx           Pagos y multas
│     └─ egresos.tsx         Egresos
├─ api/                      client.ts · services.ts · types.ts
├─ auth/AuthContext.tsx      Sesión, persistencia e inactividad (30 min)
├─ components/               Navegación inferior, cierre de sesión y controles compartidos
└─ utils/format.ts           Moneda COP, fechas, boletas
```

## Comportamiento replicado de la web

- Sesión guardada en el dispositivo; se cierra tras **30 min de inactividad**.
- Navegación inferior con accesos a Inicio, Ahorro, Pagos y Usuarios, más un menú central para Rifas, Préstamos y Egresos.
- Cierre de sesión disponible en la esquina superior derecha.
- Perfil **3 (socio)**: ve el aviso "Dashboard no disponible" y no accede a módulos.
- Perfiles 1 y 2: acceso a todos los módulos.
- Cambio de contraseña obligatorio en primer ingreso, con las mismas reglas de la web.
- Egreso automático al entregar un préstamo (valida fondos antes de crear el préstamo).

## Notas sobre el backend

- Las rutas de usuarios que la app usa son las que el backend **realmente** expone:
  `PUT /api/users` (id en el body), `PATCH /api/users/status` y
  `POST /api/users/reset-password` (documento en el body).
- El backend no emite token (JWT): la sesión es local y los endpoints no están protegidos.
  Si se agrega autenticación, solo hay que enviar el token en `src/api/client.ts`.
