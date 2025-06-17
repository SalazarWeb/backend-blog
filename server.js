const express = require('express');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const cors = require('cors');
const { JSDOM } = require('jsdom');
const dompurify = require('dompurify')(new JSDOM('').window);
const chokidar = require('chokidar');

marked.setOptions({
  mangle: false,
  headerIds: false
});

const app = express();
const PORT = process.env.PORT || 3000;
 
const POSTS_DIR = path.join(__dirname, 'posts');
 
app.use(cors({
  origin: [
    'http://localhost:4200', 
    'http://127.0.0.1:4200',
    'https://dazaji-blog.vercel.app',
    /\.vercel\.app$/,
  ],
  credentials: true
}));
app.use(express.json());

// Caché para mejorar el rendimiento
const postsCache = {};
let postsMetadata = [];
 
function parseFrontMatter(content) {
  const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontMatterRegex);
  
  if (!match) {
    return {
      attributes: {},
      body: content
    };
  }

  const frontMatterText = match[1];
  const body = match[2];
  const attributes = {};

  // Parsear YAML mejorado
  const lines = frontMatterText.split('\n');
  let currentKey = null;
  let isArrayContext = false;

  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    // Detectar si es una línea de array
    if (trimmedLine.startsWith('- ')) {
      if (currentKey && isArrayContext) {
        if (!Array.isArray(attributes[currentKey])) {
          attributes[currentKey] = [];
        }
        attributes[currentKey].push(trimmedLine.substring(2).trim());
      }
      return;
    }

    // Parsear líneas clave: valor
    const colonIndex = line.indexOf(':');
    if (colonIndex > -1) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      
      // Reset array context
      isArrayContext = false;
      currentKey = key;

      // Si no hay valor después de los dos puntos, es probablemente un array
      if (!value) {
        isArrayContext = true;
        attributes[key] = [];
        return;
      }

      // Remover comillas
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      // Parsear arrays inline [item1, item2, item3]
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1)
          .split(',')
          .map(item => item.trim().replace(/['"]/g, ''))
          .filter(item => item.length > 0);
      }

      attributes[key] = value;
    }
  });

  return { attributes, body };
}

function normalizeDate(dateString) {
    if (!dateString) return new Date().toISOString().split('T')[0];
    
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateString)) {
        const [day, month, year] = dateString.split('-');
        return `${year}-${month}-${day}`;
    }
    console.warn(`Fecha en formato incorrecto: ${dateString}. Esperado: DD-MM-YYYY`);
    return new Date().toISOString().split('T')[0];
}

function extractMetadata(content, filename) {
  const id = filename.replace('.md', '');
  const parsed = parseFrontMatter(content);
  const metadata = parsed.attributes;

  const post = {
    id,
    fileName: filename,
    title: metadata.title || id.replace(/-/g, ' ').replace(/\w\S*/g, 
      txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()),
    date: normalizeDate(metadata.date),
    summary: metadata.summary || extractSummaryFromContent(parsed.body),
    tags: Array.isArray(metadata.tags) ? metadata.tags : (metadata.tags ? [metadata.tags] : []),
    author: metadata.author || 'Tu Nombre',
    category: metadata.category || 'general',
    subcategory: metadata.subcategory || '',
    coverImage: metadata.coverImage || '',
    content: parsed.body
  };

  return post;
}

function extractSummaryFromContent(content) {
  const lines = content.split('\n');
  for (let line of lines) {
    const cleanLine = line.trim();
    if (cleanLine && !cleanLine.startsWith('#') && !cleanLine.startsWith('```') && cleanLine.length > 50) {
      return cleanLine.substring(0, 150) + '...';
    }
  }
  return 'Contenido disponible para lectura';
}

const updateCache = (filePath) => {
  const filename = path.basename(filePath);
  const id = filename.replace('.md', '');
  
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (!err) {
      try {
        const post = extractMetadata(data, filename);
        const htmlContent = dompurify.sanitize(marked.parse(post.content));
        
        postsCache[id] = {
          ...post,
          htmlContent: htmlContent
        };

        postsMetadata = postsMetadata.filter(p => p.id !== id);
        const { content, ...metadataOnly } = post;
        postsMetadata.push(metadataOnly);
        postsMetadata.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        console.log(`✅ Post actualizado: ${id}`);
      } catch (error) {
        console.error(`❌ Error procesando ${filename}:`, error);
      }
    }
  });
};
 
const removeFromCache = (filePath) => {
  const id = path.basename(filePath, '.md');
  delete postsCache[id];
  postsMetadata = postsMetadata.filter(post => post.id !== id);
  console.log(`🗑️ Post eliminado: ${id}`);
};
 
const initializeCache = () => {
  if (fs.existsSync(POSTS_DIR)) {
    fs.readdir(POSTS_DIR, (err, files) => {
      if (err) {
        console.error('Error leyendo directorio de posts:', err);
        return;
      }
      
      console.log(`📁 Encontrados ${files.filter(f => f.endsWith('.md')).length} archivos .md`);
      
      files
        .filter(file => file.endsWith('.md'))
        .forEach(file => {
          updateCache(path.join(POSTS_DIR, file));
        });
    });
  } else {
    console.warn(`Directorio de posts no encontrado: ${POSTS_DIR}`);
  }
};
 
const watcher = chokidar.watch(POSTS_DIR, {
  ignored: /^\./, 
  persistent: true
});

watcher
  .on('add', updateCache)
  .on('change', updateCache)
  .on('unlink', removeFromCache)
  .on('ready', () => console.log('📁 Watcher iniciado en:', POSTS_DIR));
 
app.get('/api/posts', (req, res) => {
  try { 
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || (page === 1 ? 6 : 4); // 6 iniciales, luego 4
    const offset = page === 1 ? 0 : 6 + ((page - 2) * 4); // Ajustar offset para el patrón 6+4+4...
 
    const paginatedPosts = req.query.page 
      ? postsMetadata.slice(offset, offset + limit)
      : postsMetadata;

    res.set('Cache-Control', 'public, max-age=600');  
    res.json({
      posts: paginatedPosts,
      total: postsMetadata.length,
      page: page,
      limit: limit,
      hasMore: offset + limit < postsMetadata.length,
      totalPages: Math.ceil((postsMetadata.length - 6) / 4) + 1 // Calcular páginas con patrón 6+4+4...
    });
  } catch (error) {
    console.error('Error obteniendo posts:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint para un post específico with HTML convertido
app.get('/api/posts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const post = postsCache[id];
    
    if (!post) {
      return res.status(404).json({ error: 'Post no encontrado' });
    }
    
    res.set('Cache-Control', 'public, max-age=3600'); // 1 hora de caché
    res.json({
      ...post,
      content: post.htmlContent // Enviar HTML convertido
    });
  } catch (error) {
    console.error('Error obteniendo post:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint para obtener contenido raw (markdown original)
app.get('/api/posts/:id/raw', (req, res) => {
  try {
    const { id } = req.params;
    const post = postsCache[id];
    
    if (!post) {
      return res.status(404).json({ error: 'Post no encontrado' });
    }
    
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      ...post,
      content: post.content // Contenido markdown original
    });
  } catch (error) {
    console.error('Error obteniendo post raw:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint para buscar posts
app.get('/api/posts/search/:query', (req, res) => {
  try {
    const { query } = req.params;
    const searchTerm = query.toLowerCase();
    
    // Parámetros de paginación con patrón 6+4+4...
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || (page === 1 ? 6 : 4);
    const offset = page === 1 ? 0 : 6 + ((page - 2) * 4);
    
    const filteredPosts = postsMetadata.filter(post => 
      post.title.toLowerCase().includes(searchTerm) ||
      post.summary.toLowerCase().includes(searchTerm) ||
      (post.tags && post.tags.some(tag => tag.toLowerCase().includes(searchTerm))) ||
      (post.category && post.category.toLowerCase().includes(searchTerm)) ||
      (postsCache[post.id]?.content || '').toLowerCase().includes(searchTerm)
    );
    
    // Aplicar paginación a los resultados filtrados
    const paginatedResults = filteredPosts.slice(offset, offset + limit);
    
    res.json({
      posts: paginatedResults,
      total: filteredPosts.length,
      page: page,
      limit: limit,
      hasMore: offset + limit < filteredPosts.length,
      totalPages: Math.ceil((filteredPosts.length - 6) / 4) + 1,
      query: searchTerm
    });
  } catch (error) {
    console.error('Error en búsqueda:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint para obtener posts por categoría
app.get('/api/posts/category/:category', (req, res) => {
  try {
    const { category } = req.params;
    
    const filteredPosts = category === 'todos' 
      ? postsMetadata 
      : postsMetadata.filter(post => post.category === category);
    
    res.json({
      posts: filteredPosts,
      total: filteredPosts.length,
      category
    });
  } catch (error) {
    console.error('Error obteniendo posts por categoría:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint para obtener posts por tag
app.get('/api/posts/tag/:tag', (req, res) => {
  try {
    const { tag } = req.params;
    
    const filteredPosts = postsMetadata.filter(post => 
      post.tags && post.tags.includes(tag.toLowerCase())
    );
    
    res.json({
      posts: filteredPosts,
      total: filteredPosts.length,
      tag
    });
  } catch (error) {
    console.error('Error obteniendo posts por tag:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint raíz
app.get('/', (req, res) => {
  res.json({ 
    message: 'Blog Backend API',
    version: '1.0.0',
    endpoints: {
      posts: '/api/posts',
      health: '/api/health'
    }
  });
});

// Endpoint de health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    postsLoaded: Object.keys(postsCache).length,
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Endpoint para invalidar caché (útil para desarrollo)
app.post('/api/cache/clear', (req, res) => {
  Object.keys(postsCache).forEach(key => delete postsCache[key]);
  postsMetadata = [];
  initializeCache();
  res.json({ message: 'Caché limpiado y recargado' });
});

// Inicializar servidor
initializeCache();

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📂 Directorio de posts: ${POSTS_DIR}`);
  console.log(`📄 Endpoints disponibles:`);
  console.log(`   GET  /api/posts - Listar todos los posts`);
  console.log(`   GET  /api/posts/:id - Obtener post específico`);
  console.log(`   GET  /api/posts/:id/raw - Obtener markdown original`);
  console.log(`   GET  /api/posts/search/:query - Buscar posts`);
  console.log(`   GET  /api/posts/category/:category - Posts por categoría`);
  console.log(`   GET  /api/posts/tag/:tag - Posts por tag`);
  console.log(`   GET  /api/health - Estado del servidor`);
});
 
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});