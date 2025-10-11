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

// Datos en memoria (serán reemplazados por MongoDB)
let users = [
  { id: 1, name: 'Admin', role: 'admin', email: 'admin@empresa.com' },
  { id: 2, name: 'Juan Pérez', role: 'employee', email: 'juan@empresa.com' },
  { id: 3, name: 'María García', role: 'employee', email: 'maria@empresa.com' },
  { id: 4, name: 'Carlos López', role: 'employee', email: 'carlos@empresa.com' }
];

let tasks = [
  { 
    id: 1, 
    title: 'Revisar informe mensual', 
    description: 'Revisar y aprobar el informe del mes anterior',
    assignedTo: 2, // Juan Pérez
    assignedBy: 1,
    status: 'in-progress',
    progress: 50,
    createdAt: new Date(),
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  },
  { 
    id: 2, 
    title: 'Preparar presentación cliente', 
    description: 'Crear slides para la reunión del jueves',
    assignedTo: 3, // María García
    assignedBy: 1,
    status: 'pending',
    progress: 0,
    createdAt: new Date(),
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
  },
  { 
    id: 3, 
    title: 'Desarrollar nueva funcionalidad', 
    description: 'Implementar el módulo de reportes en el sistema',
    assignedTo: 4, // Carlos López
    assignedBy: 1,
    status: 'in-progress', 
    progress: 25,
    createdAt: new Date(),
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  }
];

let messages = [];
let userLocations = {};
let onlineUsers = {};
let messageReadStatus = {};

// API Routes
app.get('/api/users', (req, res) => {
  res.json(users.filter(user => user.role === 'employee'));
});

app.get('/api/tasks', (req, res) => {
  const { userId } = req.query;
  if (userId) {
    res.json(tasks.filter(task => task.assignedTo == userId));
  } else {
    res.json(tasks);
  }
});

app.post('/api/tasks', (req, res) => {
  const task = {
    id: tasks.length + 1,
    ...req.body,
    createdAt: new Date(),
    status: 'pending',
    progress: 0
  };
  tasks.push(task);
  io.emit('taskCreated', task);
  res.json(task);
});

app.put('/api/tasks/:id', (req, res) => {
  const taskId = parseInt(req.params.id);
  const taskIndex = tasks.findIndex(task => task.id === taskId);
  
  if (taskIndex !== -1) {
    tasks[taskIndex] = { ...tasks[taskIndex], ...req.body };
    io.emit('taskUpdated', tasks[taskIndex]);
    res.json(tasks[taskIndex]);
  } else {
    res.status(404).json({ error: 'Tarea no encontrada' });
  }
});

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
    id: messages.length + 1,
    ...req.body,
    timestamp: new Date(),
    read: false
  };
  messages.push(message);
  console.log('📤 Emitiendo newMessage a todos los clientes');
  io.emit('newMessage', message);
  res.json(message);
});

// Nuevo endpoint para obtener estado de usuarios en línea
app.get('/api/online-users', (req, res) => {
  res.json(onlineUsers);
});

// Endpoint para obtener ubicaciones
app.get('/api/locations', (req, res) => {
  res.json(userLocations);
});

// Socket.io para comunicación en tiempo real
io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  // Evento cuando un usuario se identifica
  socket.on('userOnline', (userId) => {
    onlineUsers[userId] = {
      socketId: socket.id,
      lastSeen: new Date(),
      status: 'online'
    };
    console.log(`🟢 Usuario ${userId} en línea - Online users:`, Object.keys(onlineUsers));
    // ✅ Asegurar que se emite a TODOS los clientes
    io.emit('userStatusUpdate', { 
      userId, 
      status: 'online', 
      onlineUsers,
      action: 'user_online'
    });
  });

  // Evento para marcar mensajes como leídos
  // Reemplazar el evento markMessagesAsRead existente con este:
  socket.on('markMessagesAsRead', (data) => {
    const { userId, senderId, messageIds } = data;
    console.log(`📖 Marcando mensajes como leídos: ${senderId} -> ${userId}`);
    console.log(`📋 Mensajes específicos:`, messageIds);
    
    let markedCount = 0;
    
    // Marcar solo los mensajes específicos como leídos
    messages.forEach(msg => {
      if (messageIds && messageIds.includes(msg.id)) {
        // Marcar mensajes específicos
        if (!msg.read) {
          msg.read = true;
          msg.readAt = new Date();
          markedCount++;
        }
      } else if (!messageIds && msg.senderId === senderId && msg.receiverId === userId && !msg.read) {
        // Fallback: marcar todos los mensajes no leídos de este sender (comportamiento anterior)
        msg.read = true;
        msg.readAt = new Date();
        markedCount++;
      }
    });
    
    console.log(`✅ ${markedCount} mensajes marcados como leídos`);
    
    // Notificar al remitente que sus mensajes fueron leídos
    io.emit('messagesRead', { 
      readerId: userId, 
      senderId,
      messageIds: messageIds || 'all' // Indicar qué mensajes se leyeron
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
      task.progress = data.progress;
      task.status = data.progress === 100 ? 'completed' : 'in-progress';
      io.emit('taskUpdated', task);
    }
  });

  // Manejar desconexión
  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);
    
    // Encontrar y marcar usuario como offline
    for (const [userId, userData] of Object.entries(onlineUsers)) {
      if (userData.socketId === socket.id) {
        onlineUsers[userId] = {
          ...userData,
          status: 'offline',
          lastSeen: new Date()
        };
        console.log(`🔴 Usuario ${userId} desconectado`);
        // ✅ Asegurar que se emite a TODOS los clientes
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

// Endpoint de salud para verificar que el servidor está funcionando
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString(),
    users: users.length,
    tasks: tasks.length,
    messages: messages.length,
    onlineUsers: Object.keys(onlineUsers).filter(id => onlineUsers[id].status === 'online').length
  });
});

// Ruta de prueba para ver todos los datos
app.get('/api/debug', (req, res) => {
  res.json({
    users,
    tasks,
    messages,
    userLocations,
    onlineUsers
  });
});

// Manejo de errores 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejo de errores global
app.use((error, req, res, next) => {
  console.error('Error del servidor:', error);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📊 Usuarios: ${users.length}`);
  console.log(`📋 Tareas: ${tasks.length}`);
  console.log(`💬 Mensajes: ${messages.length}`);
  console.log(`🌍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔧 Debug: http://localhost:${PORT}/api/debug`);
});