const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const ADUR = 5 * 60 * 1000;

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

let users = [
  { id: "u1", name: "Alice" },
  { id: "u2", name: "Bob" },
  { id: "u3", name: "Charlie" }
];

let items = [];
let notifs = [];

function gid() {
  return "_" + Math.random().toString(36).slice(2, 9);
}

function topBid(item) {
  if (!item.bids.length) return null;
  return item.bids.reduce((best, b) => {
    if (!best) return b;
    if (b.amount > best.amount) return b;
    if (b.amount === best.amount && b.timestamp < best.timestamp) return b;
    return best;
  }, null);
}

function tick() {
  const now = Date.now();

  items.forEach(item => {
    if (item.status !== "active" || now < item.endTime) return;

    const h = topBid(item);

    if (!h) {
      item.startTime = now;
      item.endTime = now + ADUR;
    } else {
      item.status = "sold";
      item.winner = h.userId;
      item.finalPrice = h.amount;
    }
  });

  // io.emit("state", { users, items, notifs });
}

setInterval(tick, 1000);

io.on("connection", socket => {
  socket.emit("state", { users, items, notifs });

  socket.on("createAuction", data => {
    const item = {
      id: gid(),
      title: data.title,
      description: data.description,
      sellerId: data.sellerId,
      startingBid: Number(data.startingBid),
      bids: [],
      startTime: Date.now(),
      endTime: Date.now() + ADUR,
      status: "active"
    };
    items.push(item);
    io.emit("state", { users, items, notifs });
  });

  socket.on("placeBid", data => {
    const item = items.find(i => i.id === data.itemId);
    if (!item || item.status !== "active") return;

    item.bids.push({
      id: gid(),
      userId: data.userId,
      amount: Number(data.amount),
      timestamp: Date.now()
    });

    io.emit("state", { users, items, notifs });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Running on http://localhost:${PORT}`);
});
