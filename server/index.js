import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose, { Schema } from "mongoose";
import cors from "cors";

const app = express();
const httpServer = createServer(app);
app.use(cors());
app.use(express.json());

const io = new Server(httpServer, {
  /* options */
  cors: {
    origin: "http://localhost:5173",
  },
});
mongoose.connect(
  "mongodb+srv://appginie:zrLcmcVKJhbRuNvh@cluster0.jifxokr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
  { useNewUrlParser: true, useUnifiedTopology: true }
);

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  // Add other fields as needed, e.g., profile picture, status
});

const User = mongoose.model("User", userSchema);

// Conversation Schema

const conversationSchema = new Schema({
  fromId: {
    type: mongoose.Types.ObjectId,
    ref: "User",
    required: true,
  },
  toId: {
    type: mongoose.Types.ObjectId,
    ref: "User",
    required: true,
  },
});

const Conversations = mongoose.model("Conversations", conversationSchema);

const messagesSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "Conversation",
  },
  message: { type: String, required: true },
  fromUserId: { type: mongoose.Types.ObjectId, ref: "User", required: true },
  toUserId: { type: mongoose.Types.ObjectId, ref: "User", required: true },
  timestamp: { type: Date, default: Date.now },
});

const Messages = mongoose.model("Messages", messagesSchema);

app.get("/users", async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

app.post("/create-conversation", async (req, res) => {
  console.log(req.body);
  const { toId, fromId } = req.body;
  const doesConversationExist = await Conversations.findOne({
    $or: [
      { fromId: fromId, toId: toId },
      { fromId: toId, toId: fromId },
    ],
  });

  if (doesConversationExist) {
    return res
      .status(200)
      .json({ message: "Success", convo: doesConversationExist });
  }
  const newConv = new Conversations({
    fromId,
    toId,
  });
  await newConv.save();
  return res.status(200).json({ message: "Success", convo: newConv });
});

app.get("/messages/:conversationId", async (req, res) => {
  const { conversationId } = req.params;
  const messages = await Messages.find({
    conversationId,
  });
  return res.status(200).json({ message: "Success", messages });
});

io.on("connection", (socket) => {
  console.log("User connected: " + socket.id);

  socket.on("joinConversation", (conversationId) => {
    socket.join(conversationId);
    console.log(`User joined conversation: ${conversationId}`);
  });

  socket.on(
    "sendMessage",
    async ({ conversationId, message, toUserId, fromUserId }) => {
      const newMessage = new Messages({
        conversationId,
        message,
        fromUserId,
        toUserId,
      });
      await newMessage.save();

      // Emit the message to everyone in the room (both users in the conversation)
      io.to(conversationId).emit("receiveMessage", newMessage);
    }
  );

  socket.on("disconnect", () => {
    console.log("User disconnected: " + socket.id);
  });
});

httpServer.listen(5000, () => {
  console.log("Server is running on port 5000");
});
