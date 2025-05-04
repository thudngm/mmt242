import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";

export default function PastStreams() {
  const [socket, setSocket] = useState(null);
  const [pastStreams, setPastStreams] = useState([]);
  const [selectedStream, setSelectedStream] = useState(null);
  const [comments, setComments] = useState([]);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Check authentication
  useEffect(() => {
    const userData = localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY);
    if (!userData) {
      navigate("/login");
    }
  }, [navigate]);

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
      newSocket.emit("get-stream-history");
    });

    newSocket.on("stream-history", (streams) => {
      setPastStreams(streams);
    });

    newSocket.on("past-stream-comments", ({ streamId, comments }) => {
      setComments(comments.map((c) => ({
        username: c.username,
        comment: c.comment,
        timestamp: new Date(c.timestamp).toLocaleString(),
      })));
    });

    newSocket.on("error", ({ message }) => {
      setError(message);
      if (message === "Authentication required") {
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
      newSocket.off("stream-history");
      newSocket.off("past-stream-comments");
      newSocket.off("error");
      newSocket.off("connect_error");
    };
  }, [navigate]);

  const handleSelectStream = (streamId) => {
    setSelectedStream(streamId);
    setComments([]);
    socket.emit("get-past-stream-comments", { streamId }, (response) => {
      if (response?.error) {
        setError(response.error);
      }
    });
  };

  const handleBack = () => {
    navigate("/");
  };

  if (!socket) {
    return <div>Loading...</div>;
  }

  return (
    <Wrapper>
      <Header>
        <BackButton onClick={handleBack}>← Back</BackButton>
        <Title>Past Livestreams</Title>
      </Header>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <StreamContainer>
        <StreamList>
          <h3>Ended Streams</h3>
          {pastStreams.length === 0 ? (
            <p>No ended streams available</p>
          ) : (
            <ul>
              {pastStreams.map((stream) => (
                <StreamItem
                  key={stream._id}
                  active={selectedStream === stream._id}
                  onClick={() => handleSelectStream(stream._id)}
                >
                  Stream by {stream.streamerId} <br />
                  Started: {new Date(stream.startTime).toLocaleString()} <br />
                  Ended: {stream.endTime ? new Date(stream.endTime).toLocaleString() : "Not ended"}
                </StreamItem>
              ))}
            </ul>
          )}
        </StreamList>
        <CommentSection>
          <h3>Comments {selectedStream ? `for Stream ${selectedStream}` : ""}</h3>
          {comments.length === 0 ? (
            <p>No comments available</p>
          ) : (
            <Comments>
              {comments.map((c, idx) => (
                <Comment key={idx}>
                  <Timestamp>{c.timestamp}</Timestamp> {c.username}: {c.comment}
                </Comment>
              ))}
            </Comments>
          )}
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

const StreamContainer = styled.div`
  flex: 1;
  display: flex;
  overflow: hidden;
`;

const StreamList = styled.div`
  width: 30%;
  padding: 1rem;
  background-color: #111;
  overflow-y: auto;
`;

const StreamItem = styled.li`
  padding: 0.5rem;
  cursor: pointer;
  background-color: ${(props) => (props.active ? "#333" : "transparent")};
  &:hover {
    background-color: #222;
  }
`;

const CommentSection = styled.div`
  width: 70%;
  padding: 1rem;
  background-color: #111;
  display: flex;
  flex-direction: column;
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

const Timestamp = styled.span`
  color: #888;
  margin-right: 0.5rem;
`;

const ErrorMessage = styled.p`
  color: red;
  padding: 0.5rem 2rem;
`;
