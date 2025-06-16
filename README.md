# Blog Backend API

API REST Node.js/Express que sirve contenido de blog desde archivos Markdown.

## 🚀 Características

- **Conversión automática** de Markdown a HTML
- **Sanitización de contenido** con DOMPurify
- **Hot reload** - detecta cambios en archivos automáticamente
- **Caché inteligente** para mejor rendimiento
- **API REST completa** con paginación
- **CORS configurado** para desarrollo y producción

## 📋 Requisitos

- Node.js 16+ 
- npm o yarn

## ⚡ Inicio Rápido

```bash
# Instalar dependencias
npm install

# Desarrollo (con hot reload)
npm run dev

# Producción
npm start
```

La API estará disponible en: **http://localhost:3000**

## 📁 Estructura

```
backend/
├── posts/              # Archivos Markdown (fuente de contenido)
│   ├── post1.md
│   ├── post2.md
│   └── ...
├── server.js           # Servidor principal
├── package.json
└── README.md
```

## 📄 Endpoints API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/health` | Estado del servidor |
| GET | `/api/posts` | Listar posts (con paginación opcional) |
| GET | `/api/posts/:id` | Post específico (HTML convertido) |
| GET | `/api/posts/:id/raw` | Post específico (Markdown original) |
| GET | `/api/posts/search/:query` | Buscar posts |
| GET | `/api/posts/category/:category` | Posts por categoría |
| GET | `/api/posts/tag/:tag` | Posts por tag |
| POST | `/api/cache/clear` | Limpiar caché |

### Parámetros de Paginación

```bash
# Obtener primeros 6 posts
GET /api/posts?page=1&limit=6

# Obtener siguientes 4 posts  
GET /api/posts?page=2&limit=4
```

## 📝 Formato de Posts

Los archivos Markdown deben incluir front-matter:

```markdown
---
title: "Título del Post"
date: "2025-06-16"  # Formato: YYYY-MM-DD
summary: "Descripción breve"
tags: ["tag1", "tag2"]
author: "Autor"
category: "categoria"
subcategory: "subcategoria"
coverImage: "https://ejemplo.com/imagen.jpg"
---

# Contenido del Post

Tu contenido en Markdown aquí...
```

## 🔧 Variables de Entorno

Crea un archivo `.env` (opcional):

```env
PORT=3000
NODE_ENV=development
POSTS_DIR=./posts
```

## 🛠️ Scripts Disponibles

```bash
npm run dev     # Desarrollo con nodemon
npm start       # Producción
npm test        # Ejecutar tests (si existen)
```

## 🧪 Pruebas Rápidas

```bash
# Health check
curl http://localhost:3000/api/health

# Listar posts
curl http://localhost:3000/api/posts

# Post específico
curl http://localhost:3000/api/posts/introduccion

# Búsqueda
curl http://localhost:3000/api/posts/search/angular
```

## 📦 Dependencias

- **express**: Servidor web
- **marked**: Conversión Markdown → HTML
- **dompurify + jsdom**: Sanitización HTML
- **chokidar**: File watching
- **cors**: CORS headers
- **nodemon**: Hot reload (dev)

## 🔒 Seguridad

- Contenido HTML sanitizado con DOMPurify
- CORS configurado correctamente
- Headers de caché apropiados
- Validación de parámetros de entrada

## 📈 Rendimiento

- **Caché en memoria** para posts procesados
- **Headers de caché HTTP** (5min para listas, 1h para posts)
- **Hot reload** sin reiniciar servidor
- **Paginación eficiente**

## 🐛 Logs y Debug

El servidor muestra logs útiles:
```
🚀 Servidor corriendo en http://localhost:3000
📂 Directorio de posts: /ruta/a/posts
📁 Encontrados X archivos .md
✅ Post actualizado: nombre-post
📁 Watcher iniciado en: /ruta/a/posts
```

## 🤝 Contribuir

1. Fork del proyecto
2. Crear rama: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -m 'Agregar nueva funcionalidad'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Pull Request

## 📄 Licencia

MIT License - ver archivo LICENSE para detalles.