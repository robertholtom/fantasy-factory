import express from "express";
import apiRouter from "./routes/api.js";
import gameRouter from "./routes/game.js";
import { startGameLoop } from "./game/loop.js";

const app = express();
const PORT = 3001;

app.use(express.json());
app.use("/api", apiRouter);
app.use("/api/game", gameRouter);

startGameLoop();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
