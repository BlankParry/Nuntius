const express = require('express');
const path = require('path');
const http = require('http');
const socketio = require('socket.io');
const formatMessage = require('./Message');
const { MongoClient } = require('mongodb');

const dbname = 'Nuntius';
const chatCollection = 'Messages'; 
const userCollection = 'OnlineUsers'; 
const port = 5000;
const database = "mongodb://127.0.0.1:27017"; 
const app = express();

const server = http.createServer(app);
const io = socketio(server);


const client = new MongoClient(database, { useUnifiedTopology: true });


let db;

async function connectMongo() {
    try {
        await client.connect();
        db = client.db(dbname);
        console.log("MongoDB connected successfully");
    } catch (err) {
        console.error("MongoDB connection failed:", err);
        process.exit(1); 
    }
}

connectMongo();

io.on('connection', (socket) => {
    console.log(`New User Connected: ${socket.id}`);


    socket.on('Message', async (data) => {
        try {
            const dataElement = formatMessage(data);
            const chat = db.collection(chatCollection);
            const onlineUsers = db.collection(userCollection);

            await chat.insertOne(dataElement); 
            socket.emit('message', dataElement); 

            const recipient = await onlineUsers.findOne({ name: data.toUser }); 
            if (recipient) {
                socket.to(recipient.ID).emit('message', dataElement); 
            }
        } catch (err) {
            console.error("Error in Message:", err);
        }
    });

  
    socket.on('userDetails', async (data) => {
        try {
            const onlineUser = {
                ID: socket.id,
                name: data.fromUser,
            };
            const currentCollection = db.collection(chatCollection);
            const online = db.collection(userCollection);

           
            await online.insertOne(onlineUser);
            console.log(`${onlineUser.name} is online...`);

            const chats = await currentCollection.find({
                from: { $in: [data.fromUser, data.toUser] },
                to: { $in: [data.fromUser, data.toUser] },
            }).project({ _id: 0 }).toArray();

            socket.emit('output', chats); 
        } catch (err) {
            console.error("Error in userDetails:", err);
        }
    });

    socket.on('disconnect', async () => {
        try {
            const onlineUsers = db.collection(userCollection);
            await onlineUsers.deleteOne({ ID: socket.id }); 
            console.log(`User ${socket.id} went offline...`);
        } catch (err) {
            console.error("Error during disconnect:", err);
        }
    });
});

app.use(express.static(path.join(__dirname, 'frontend')));

server.listen(port, () => {
    console.log(`Listening on port ${port}...`);
    console.log(`Go to http://localhost:5000/chat.html`);
});
