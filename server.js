import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Datos en memoria
let users = [
  { 
    id: 1, 
    name: 'Administrador', 
    role: 'admin', 
    email: 'admin@empresa.com',
    password: 'admin123',
    department: 'Administración'
  },
  { 
    id: 2, 
    name: 'Juan Pérez', 
    role: 'employee', 
    email: 'juan@empresa.com',
    password: 'juan123',
    department: 'Ventas'
  },
  { 
    id: 3, 
    name: 'María García', 
    role: 'employee', 
    email: 'maria@empresa.com',
    password: 'maria123',
    department: 'Marketing'
  },
  { 
    id: 4, 
    name: 'Carlos López', 
    role: 'employee', 
    email: 'carlos@empresa.com',
    password: 'carlos123',
    department: 'IT'
  }
];

// Tareas de ejemplo
let tasks = [
  { 
    id: 1, 
    title: 'Revisar informe mensual', 
    description: 'Revisar y aprobar el informe del mes anterior',
    assignedTo: [2, 3],
    assignedBy: 1,
    status: 'in-progress',
    progress: 50,
    individualProgress: {
      2: 75,
      3: 25
    },
    createdAt: new Date(),
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  },
  { 
    id: 2, 
    title: 'Preparar presentación cliente', 
    description: 'Crear slides para la reunión del jueves',
    assignedTo: [3],
    assignedBy: 1,
    status: 'pending',
    progress: 0,
    individualProgress: {},
    createdAt: new Date(),
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
  },
  { 
    id: 3, 
    title: 'Desarrollar nueva funcionalidad', 
    description: 'Implementar el módulo de reportes en el sistema',
    assignedTo: [4],
    assignedBy: 1,
    status: 'in-progress', 
    progress: 25,
    individualProgress: {
      4: 25
    },
    createdAt: new Date(),
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  }
];

let messages = [];
let userLocations = {};
let onlineUsers = {};
let messageReadStatus = {};

app.use((req, res, next) => {
  console.log(`📍 ${req.method} ${req.path}`, req.body || '');
  next();
});

// Endpoint de Login
app.post('/api/auth/login', (req, res) => {
  console.log('🔐 Intento de login:', req.body);
  
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Email y contraseña son requeridos' 
    });
  }
  
  const user = users.find(u => u.email === email);
  
  if (!user) {
    console.log('❌ Usuario no encontrado:', email);
    return res.status(401).json({ 
      success: false, 
      message: 'Credenciales inválidas' 
    });
  }
  
  if (user.password !== password) {
    console.log('❌ Contraseña incorrecta para:', email);
    return res.status(401).json({ 
      success: false, 
      message: 'Credenciales inválidas' 
    });
  }
  
  console.log('✅ Login exitoso:', user.name);
  
  const { password: _, ...userWithoutPassword } = user;
  
  res.json({
    success: true,
    message: 'Login exitoso',
    user: userWithoutPassword,
    token: `fake-jwt-token-${user.id}`
  });
});

// Endpoint para obtener usuarios
app.get('/api/users', (req, res) => {
  const usersWithoutPasswords = users
    .filter(user => user.role === 'employee')
    .map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  
  res.json(usersWithoutPasswords);
});

// ✅ CORREGIDO: Endpoint GET /api/tasks - MEJORADO PARA NORMALIZAR TIPOS
app.get('/api/tasks', (req, res) => {
  const { userId } = req.query;
  console.log('📋 GET /api/tasks - userId:', userId);
  
  // ✅ CORREGIDO: Normalizar datos antes de enviar
  const normalizedTasks = tasks.map(task => ({
    ...task,
    assignedTo: Array.isArray(task.assignedTo) 
      ? task.assignedTo.map(id => parseInt(id))
      : [parseInt(task.assignedTo)],
    individualProgress: task.individualProgress || {}
  }));
  
  if (userId) {
    const userIdNum = parseInt(userId);
    const userTasks = normalizedTasks.filter(task => {
      const isAssigned = task.assignedTo.includes(userIdNum);
      console.log(`📝 Tarea "${task.title}": assignedTo=${JSON.stringify(task.assignedTo)}, userId=${userIdNum}, isAssigned=${isAssigned}`);
      return isAssigned;
    });
    
    console.log(`✅ Tareas filtradas para usuario ${userId}:`, userTasks.length);
    res.json(userTasks);
  } else {
    console.log('📋 Todas las tareas:', normalizedTasks.length);
    res.json(normalizedTasks);
  }
});

// ✅ CORREGIDO: Endpoint POST /api/tasks con validación
app.post('/api/tasks', (req, res) => {
  const { title, description, assignedTo, dueDate, assignedBy } = req.body;
  
  // ✅ CORREGIDO: Validar datos de entrada
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'El título de la tarea es requerido' });
  }
  
  if (!assignedTo || (Array.isArray(assignedTo) && assignedTo.length === 0)) {
    return res.status(400).json({ error: 'La tarea debe asignarse al menos a un empleado' });
  }
  
  const task = {
    id: Date.now(), // ✅ CORREGIDO: Usar timestamp para IDs únicos
    title: title.trim(),
    description: description || '',
    assignedTo: Array.isArray(assignedTo) ? assignedTo.map(id => parseInt(id)) : [parseInt(assignedTo)],
    assignedBy: parseInt(assignedBy),
    individualProgress: {},
    createdAt: new Date(),
    status: 'pending',
    progress: 0,
    dueDate: dueDate ? new Date(dueDate) : null
  };
  
  tasks.push(task);
  
  console.log('✅ Tarea creada:', task.title, 'para usuarios:', task.assignedTo);
  io.emit('taskCreated', task);
  
  res.json(task);
});

// Endpoint PUT /api/tasks/:id
app.put('/api/tasks/:id', (req, res) => {
  const taskId = parseInt(req.params.id);
  const taskIndex = tasks.findIndex(task => task.id === taskId);
  
  if (taskIndex !== -1) {
    const updatedTask = { ...tasks[taskIndex], ...req.body };
    
    if (req.body.individualProgress) {
      const individualProgress = req.body.individualProgress;
      const totalProgress = Object.values(individualProgress).reduce((sum, progress) => sum + progress, 0);
      updatedTask.progress = Math.round(totalProgress / Object.keys(individualProgress).length);
      
      const allCompleted = Object.values(individualProgress).every(progress => progress === 100);
      const someInProgress = Object.values(individualProgress).some(progress => progress > 0 && progress < 100);
      
      if (allCompleted) {
        updatedTask.status = 'completed';
      } else if (someInProgress || updatedTask.progress > 0) {
        updatedTask.status = 'in-progress';
      } else {
        updatedTask.status = 'pending';
      }
    }
    
    tasks[taskIndex] = updatedTask;
    io.emit('taskUpdated', updatedTask);
    res.json(updatedTask);
  } else {
    res.status(404).json({ error: 'Tarea no encontrada' });
  }
});

// ✅ CORREGIDO: Endpoint para progreso individual con mejor manejo
app.put('/api/tasks/:id/progress/:userId', (req, res) => {
  const taskId = parseInt(req.params.id);
  const userId = parseInt(req.params.userId);
  const { progress } = req.body;
  
  console.log(`📊 Actualizando progreso: taskId=${taskId}, userId=${userId}, progress=${progress}`);
  
  // ✅ CORREGIDO: Validar progreso
  if (progress < 0 || progress > 100) {
    return res.status(400).json({ error: 'El progreso debe estar entre 0 y 100' });
  }
  
  const taskIndex = tasks.findIndex(task => task.id === taskId);
  
  if (taskIndex !== -1) {
    const task = tasks[taskIndex];
    
    // ✅ CORREGIDO: Normalizar assignedTo
    const assignedTo = Array.isArray(task.assignedTo) 
      ? task.assignedTo.map(id => parseInt(id))
      : [parseInt(task.assignedTo)];
    
    if (!assignedTo.includes(userId)) {
      return res.status(403).json({ error: 'Usuario no asignado a esta tarea' });
    }
    
    // ✅ CORREGIDO: Asegurar que individualProgress existe
    if (!task.individualProgress) {
      task.individualProgress = {};
    }
    
    task.individualProgress[userId] = progress;
    
    // Calcular progreso general
    const progressValues = Object.values(task.individualProgress);
    const totalProgress = progressValues.reduce((sum, p) => sum + p, 0);
    task.progress = progressValues.length > 0 ? Math.round(totalProgress / progressValues.length) : 0;
    
    // Determinar estado
    const allCompleted = progressValues.every(p => p === 100);
    const someInProgress = progressValues.some(p => p > 0 && p < 100);
    
    if (allCompleted) {
      task.status = 'completed';
    } else if (someInProgress || task.progress > 0) {
      task.status = 'in-progress';
    } else {
      task.status = 'pending';
    }
    
    console.log(`✅ Progreso actualizado: "${task.title}" - progreso general: ${task.progress}%`);
    io.emit('taskUpdated', task);
    res.json(task);
  } else {
    res.status(404).json({ error: 'Tarea no encontrada' });
  }
});

// Otros endpoints...
app.get('/api/messages/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const userMessages = messages.filter(msg => 
    msg.senderId === userId || msg.receiverId === userId
  );
  res.json(userMessages);
});

app.post('/api/messages', (req, res) => {
  console.log('📩 POST /api/messages recibido:', req.body);
  const message = {
    id: Date.now(), // ✅ CORREGIDO: Usar timestamp para IDs únicos
    ...req.body,
    timestamp: new Date(),
    read: false
  };
  messages.push(message);
  io.emit('newMessage', message);
  res.json(message);
});

app.get('/api/online-users', (req, res) => {
  res.json(onlineUsers);
});

app.get('/api/locations', (req, res) => {
  res.json(userLocations);
});

// ✅ CORREGIDO: Socket.io con mejor manejo de conexiones
io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  socket.on('userOnline', (userId) => {
    onlineUsers[userId] = {
      socketId: socket.id,
      lastSeen: new Date(),
      status: 'online'
    };
    console.log(`🟢 Usuario ${userId} en línea`);
    io.emit('userStatusUpdate', { 
      userId, 
      status: 'online', 
      onlineUsers,
      action: 'user_online'
    });
  });

  socket.on('markMessagesAsRead', (data) => {
    const { userId, senderId, messageIds } = data;
    
    let markedCount = 0;
    messages.forEach(msg => {
      if (messageIds && messageIds.includes(msg.id)) {
        if (msg.senderId === senderId && msg.receiverId === userId && !msg.read) {
          msg.read = true;
          msg.readAt = new Date();
          markedCount++;
        }
      }
    });
    
    console.log(`📖 ${markedCount} mensajes marcados como leídos por usuario ${userId}`);
    
    io.emit('messagesRead', { 
      readerId: userId, 
      senderId,
      messageIds: messageIds || []
    });
  });

  socket.on('userViewingChat', (data) => {
    const { userId, partnerId, isViewing } = data;
    console.log(`👀 Usuario ${userId} ${isViewing ? 'viendo' : 'dejó de ver'} chat con ${partnerId}`);
    
    socket.broadcast.emit('chatViewingStatus', {
      userId,
      partnerId, 
      isViewing
    });
  });

  socket.on('userLocation', (data) => {
    userLocations[data.userId] = {
      ...data.location,
      lastUpdate: new Date()
    };
    io.emit('locationUpdate', { userId: data.userId, location: userLocations[data.userId] });
  });

  socket.on('taskProgress', (data) => {
    const task = tasks.find(t => t.id === data.taskId);
    if (task) {
      if (data.userId && data.progress !== undefined) {
        // ✅ CORREGIDO: Asegurar que individualProgress existe
        if (!task.individualProgress) {
          task.individualProgress = {};
        }
        
        task.individualProgress[data.userId] = data.progress;
        
        const progressValues = Object.values(task.individualProgress);
        const totalProgress = progressValues.reduce((sum, p) => sum + p, 0);
        task.progress = progressValues.length > 0 ? Math.round(totalProgress / progressValues.length) : 0;
        
        const allCompleted = progressValues.every(p => p === 100);
        const someInProgress = progressValues.some(p => p > 0 && p < 100);
        
        if (allCompleted) {
          task.status = 'completed';
        } else if (someInProgress || task.progress > 0) {
          task.status = 'in-progress';
        }
      }
      
      io.emit('taskUpdated', task);
    }
  });

  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);
    
    for (const [userId, userData] of Object.entries(onlineUsers)) {
      if (userData.socketId === socket.id) {
        onlineUsers[userId] = {
          ...userData,
          status: 'offline',
          lastSeen: new Date()
        };
        console.log(`🔴 Usuario ${userId} desconectado`);
        io.emit('userStatusUpdate', { 
          userId, 
          status: 'offline', 
          onlineUsers,
          action: 'user_offline'
        });
        break;
      }
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString(),
    users: users.length,
    tasks: tasks.length,
    messages: messages.length
  });
});

app.get('/api/debug', (req, res) => {
  res.json({
    users: users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    }),
    tasks: tasks.map(task => ({
      ...task,
      assignedTo: Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo]
    })),
    messages,
    userLocations,
    onlineUsers
  });
});

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((error, req, res, next) => {
  console.error('Error del servidor:', error);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📊 Usuarios: ${users.length}`);
  console.log(`📋 Tareas: ${tasks.length}`);
  console.log(`🌍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🐛 Debug: http://localhost:${PORT}/api/debug`);
});