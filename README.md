# 🎭 Impostor Game

Un juego de palabras estilo "Impostor" donde los jugadores deben descubrir quién es el impostor basándose en las pistas que dan sobre una palabra secreta.

## 🎮 ¿Cómo se juega?

1. **Configuración inicial**: Ingresa los nombres de los jugadores (mínimo 3)
2. **Selecciona categorías**: Elige las categorías de palabras que quieres usar
3. **Configura la dificultad**: Fácil, Normal o Difícil
4. **Configura impostores**: Decide cuántos impostores habrá
5. **Opcional**: Añade bots para completar el grupo

### Durante el juego:
- Cada jugador ve su tarjeta en secreto
- Los jugadores normales ven la **palabra secreta**
- Los impostores ven que son impostores (con pista opcional)
- Por turnos, cada jugador da una pista sobre la palabra
- Al final, se vota para descubrir al impostor

## 🚀 Instalación

### Requisitos previos
- Node.js (v18 o superior)
- npm o bun

### Pasos

```bash
# 1. Clona el repositorio
git clone <URL_DEL_REPOSITORIO>

# 2. Entra al directorio
cd <NOMBRE_DEL_PROYECTO>

# 3. Instala las dependencias
npm install

# 4. Inicia el servidor de desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## 🛠️ Tecnologías

- **React** - Framework de UI
- **TypeScript** - Tipado estático
- **Vite** - Build tool
- **Tailwind CSS** - Estilos
- **shadcn/ui** - Componentes de UI
- **Supabase** - Backend (base de datos y funciones)

## 📁 Estructura del proyecto

```
src/
├── components/     # Componentes reutilizables
├── pages/          # Páginas de la aplicación
│   ├── Index.tsx   # Página principal
│   ├── Setup.tsx   # Configuración del juego
│   ├── Play.tsx    # Pantalla de juego
│   └── Traffic.tsx # Estadísticas de partidas
├── data/           # Datos (palabras por categoría)
├── hooks/          # Custom hooks
└── utils/          # Utilidades
```

## 🎯 Rutas

- `/` - Página de inicio
- `/setup` - Configuración de la partida
- `/play` - Pantalla de juego
- `/play-turns` - Modo por turnos
- `/traffic` - Estadísticas de partidas jugadas

## 📊 Base de datos

El juego registra las partidas en una base de datos con:
- Número de jugadores
- Número de bots
- Número de impostores
- Dificultad
- Nombres de jugadores
- Si se usó pista para impostores

## 🤝 Contribuir

1. Haz fork del proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Haz commit de tus cambios (`git commit -m 'Agrega nueva funcionalidad'`)
4. Haz push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

MIT
