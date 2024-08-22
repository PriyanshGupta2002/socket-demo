import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import axios from "axios";

// Define TypeScript interfaces
interface User {
  _id: string;
  username: string;
}

interface Message {
  conversationId: string;
  message: string;
  fromUserId: string;
  toUserId: string;
  timestamp: Date;
}

interface Conversation {
  _id: string;
  fromId: string;
  toId: string;
}

const socket = io("http://localhost:5000");

const ChatApp: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [conversationId, setConversationId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    // Fetch users from the backend
    axios
      .get<User[]>("http://localhost:5000/users")
      .then((response) => {
        setUsers(response.data);
      })
      .catch((error) => {
        console.error("Error fetching users", error);
      });

    // Listen for incoming messages
    socket.on("receiveMessage", (newMessage: Message) => {
      setMessages((prevMessages) => [...prevMessages, newMessage]);
    });

    // Clean up the socket connection on unmount
    return () => {
      socket.off("receiveMessage");
    };
  }, []);

  const handleUserClick = async (user: User) => {
    setSelectedUser(user);

    // Create or fetch conversation
    try {
      const { data } = await axios.post<{ convo: Conversation }>(
        "http://localhost:5000/create-conversation",
        {
          fromId: currentUserId,
          toId: user._id,
        }
      );

      const { convo } = data;
      setConversationId(convo._id);

      // Join the conversation room
      socket.emit("joinConversation", convo._id);

      // Fetch conversation history
      axios
        .get<{ messages: Message[] }>(
          `http://localhost:5000/messages/${convo._id}`
        )
        .then((response) => {
          setMessages(response.data.messages);
        })
        .catch((error) => {
          console.error("Error fetching conversation messages", error);
        });
    } catch (error) {
      console.error("Error creating or fetching conversation", error);
    }
  };

  const handleSendMessage = () => {
    if (!message.trim()) return;

    const newMessage: Message = {
      conversationId,
      message,
      toUserId: selectedUser?._id || "",
      fromUserId: currentUserId,
      timestamp: new Date(),
    };

    // Emit the message to the server
    socket.emit("sendMessage", newMessage);

    // Clear the input field after sending
    setMessage("");
  };

  return (
    <div style={{ display: "flex" }}>
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Enter your User ID"
          value={currentUserId}
          onChange={(e) => setCurrentUserId(e.target.value)}
          className="bg-gray-500"
        />
        <button onClick={() => console.log(currentUserId)}>
          Add current id
        </button>
      </div>
      <div
        style={{ width: "30%", borderRight: "1px solid #ccc", padding: "10px" }}
      >
        <h3>User List</h3>
        {users.map((user) => (
          <div
            key={user._id}
            onClick={() => handleUserClick(user)}
            style={{ padding: "10px", cursor: "pointer" }}
          >
            {user?.username}
          </div>
        ))}
      </div>
      <div style={{ width: "70%", padding: "10px" }}>
        <h3>Chat Window - {selectedUser?.username}</h3>
        <div
          style={{
            border: "1px solid #ccc",
            height: "400px",
            overflowY: "scroll",
            padding: "10px",
          }}
        >
          {messages.map((msg, index) => (
            <div key={index}>
              <strong>
                {msg.fromUserId === currentUserId
                  ? "You"
                  : selectedUser?.username}
              </strong>
              : {msg.message}
            </div>
          ))}
        </div>
        {selectedUser && (
          <>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Type your message..."
              style={{ width: "80%", padding: "10px", marginTop: "10px" }}
            />
            <button
              onClick={handleSendMessage}
              style={{ padding: "10px", marginLeft: "10px" }}
            >
              Send
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ChatApp;
