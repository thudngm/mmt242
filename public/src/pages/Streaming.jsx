import React, { useState, useEffect } from "react";
import styled from "styled-components";
import LiveStream from "../components/LiveStream";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";

export default function LiveStreamingPage() {
  const [isStreamer, setIsStreamer] = useState(false);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);
  const [streamers, setStreamers] = useState([]);
  const [selectedStreamer, setSelectedStreamer] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(undefined);
  const [socket, setSocket] = useState(null);

  // Check authentication on mount (support visitor mode)
  useEffect(() => {
    const checkUser = async () => {
      const userData = localStorage.getItem(
        process.env.REACT_APP_LOCALHOST_KEY
      );
      if (!userData) {
        setCurrentUser(undefined);
        return;
      }

      try {
        const user = await JSON.parse(userData);
        if (!user || !user.username) {
          localStorage.removeItem(process.env.REACT_APP_LOCALHOST_KEY);
          setCurrentUser(undefined);
        } else {
          setCurrentUser(user);
        }
      } catch (error) {
        console.error("Failed to parse user from localStorage:", error);
        localStorage.removeItem(process.env.REACT_APP_LOCALHOST_KEY);
        setCurrentUser(undefined);
      }
    };
    checkUser();
  }, []);

  // Initialize Socket.IO connection
  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_SERVER_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Connected to server:", newSocket.id);
      setError(null);
      if (!currentUser) {
        newSocket.emit("register-visitor", { nickname: `Visitor_${newSocket.id}` });
      }
      if (selectedStreamer) {
        newSocket.emit("get-comments", { streamerId: selectedStreamer });
      }
    });

    newSocket.on("disconnect", (reason) => {
      console.log("Disconnected from server:", reason);
      setError("Disconnected from server. Attempting to reconnect...");
    });

    newSocket.on("streamers-update", (activeStreamers) => {
      console.log("Received streamers-update:", activeStreamers);
      setStreamers(activeStreamers);
      if (
        selectedStreamer &&
        !activeStreamers.find((s) => s.id === selectedStreamer)
      ) {
        setSelectedStreamer(null);
        setComments([]);
        setError("Streamer disconnected");
      }
    });

    newSocket.on("receive-comment", ({ _id, comment, from, username }) => {
      setComments((prev) => {
        // Prevent duplicates by checking _id
        if (prev.some((c) => c._id === _id)) {
          return prev;
        }
        return [...prev, { _id, username, comment }];
      });
    });

    newSocket.on("comments-history", (comments) => {
      setComments(comments.map((c) => ({
        _id: c._id,
        username: c.username,
        comment: c.comment,
      })));
    });

    newSocket.on("error", ({ message }) => {
      setError(message);
      if (message === "Authentication required to start streaming") {
        navigate("/login");
      }
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket.IO connection error:", error);
      setError("Failed to connect to server. Please try again later.");
    });

    return () => {
      newSocket.disconnect();
      newSocket.off("connect");
      newSocket.off("streamers-update");
      newSocket.off("receive-comment");
      newSocket.off("comments-history");
      newSocket.off("error");
      newSocket.off("connect_error");
    };
  }, [navigate]);

  const startStreaming = () => {
    if (!currentUser) {
      setError("Please log in to start streaming");
      navigate("/login");
      return;
    }
    if (isStreamer) return;
    setIsStreamer(true);
    socket.emit("start-stream", {
      username: currentUser.username,
      channelId: "main",
    });
    navigate(`/live?streamerId=${socket.id}`);
    setSelectedStreamer(socket.id);
  };

  const stopStreaming = () => {
    setIsStreamer(false);
    socket.emit("stop-stream");
    setSelectedStreamer(null);
    navigate("/live");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    if (!currentUser) {
      setError("Please log in to comment");
      navigate("/login");
      return;
    }
    if (!socket.connected) {
      setError("Not connected to server. Attempting to reconnect...");
      const reconnectPromise = new Promise((resolve) => {
        socket.once("connect", () => resolve(true));
        setTimeout(() => resolve(false), 5000);
      });
      const reconnected = await reconnectPromise;
      if (!reconnected) {
        setError("Failed to reconnect. Please refresh the page.");
        return;
      }
    }
    try {
      socket.emit("send-comment", {
        comment,
        streamerId: isStreamer ? socket.id : selectedStreamer,
        username: currentUser.username,
      }, (response) => {
        if (response?.error) {
          setError(response.error);
        } else {
          setComment("");
        }
      });
    } catch (err) {
      console.error("Error sending comment:", err);
      setError("Failed to send comment. Please try again.");
    }
  };

  const handleBack = () => {
    stopStreaming();
    navigate("/");
  };

  if (!socket) {
    return <div>Loading...</div>;
  }

  return (
    <Wrapper>
      <Header>
        <BackButton onClick={handleBack}>← Back</BackButton>
        <Title>Live Stream</Title>
        {isStreamer ? (
          <RoleButton onClick={stopStreaming}>Stop Streaming</RoleButton>
        ) : (
          <RoleButton onClick={startStreaming} disabled={!currentUser}>
            Start Streaming
          </RoleButton>
        )}
      </Header>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <StreamContainer>
        <VideoBoard>
          {isStreamer ? (
            <LiveStream isStreamer={true} socket={socket} />
          ) : (
            <div>
              <h3>Available Streamers</h3>
              {streamers.length === 0 ? (
                <p>No active streamers</p>
              ) : (
                <ul>
                  {streamers.map((streamer) => (
                    <li key={streamer.id || streamer}>
                      <button
                        onClick={() =>
                          setSelectedStreamer(streamer.id || streamer)
                        }
                      >
                        Watch {streamer.username || streamer.id || streamer}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {selectedStreamer && (
                <LiveStream
                  isStreamer={false}
                  streamerId={selectedStreamer}
                  socket={socket}
                />
              )}
            </div>
          )}
        </VideoBoard>
        <CommentSection>
          <Comments>
            {comments.map((c) => (
              <Comment key={c._id}>{`${c.username}: ${c.comment}`}</Comment>
            ))}
          </Comments>
          <form onSubmit={handleSubmit}>
            <CommentInput
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Comment here..."
              disabled={!currentUser || !socket.connected}
            />
          </form>
        </CommentSection>
      </StreamContainer>
    </Wrapper>
  );
}

const Wrapper = styled.div`
  height: 100vh;
  width: 100vw;
  background-color: #000;
  color: #fff;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  padding: 1rem 2rem;
  background-color: #111;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const BackButton = styled.button`
  background: none;
  border: none;
  color: #ddd;
  font-size: 1.2rem;
  cursor: pointer;
  &:hover {
    color: #fff;
  }
`;

const Title = styled.h1`
  font-size: 1.5rem;
`;

const RoleButton = styled.button`
  background-color: #ff3b3b;
  border: none;
  padding: 0.6rem 1.2rem;
  color: white;
  font-weight: bold;
  border-radius: 8px;
  cursor: pointer;
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};
  pointer-events: ${(props) => (props.disabled ? "none" : "auto")};
  &:hover {
    background-color: #e60000;
  }
`;

const StreamContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const VideoBoard = styled.div`
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: black;
  position: relative;

  video {
    width: 100%;
    height: auto;
    max-height: 70vh;
    object-fit: contain;
    background-color: #000;
  }
`;

const CommentSection = styled.div`
  padding: 1rem;
  background-color: #111;
  display: flex;
  flex-direction: column;
  height: 30vh;
`;

const Comments = styled.div`
  flex: 1;
  overflow-y: auto;
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
`;

const Comment = styled.div`
  margin-bottom: 0.3rem;
  color: #ccc;
`;

const CommentInput = styled.input`
  padding: 0.6rem;
  font-size: 1rem;
  border-radius: 6px;
  border: none;
  outline: none;
  width: 100%;
  background-color: #222;
  color: #fff;
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};
`;

const ErrorMessage = styled.p`
  color: red;
  padding: 0.5rem 2rem;
`;
