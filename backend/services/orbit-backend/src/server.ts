import "dotenv/config";
import app from "./app";

const PORT = Number(process.env.PORT ?? 4000);

const server = app.listen(PORT, () => {
  console.log(`orbit-backend running on http://localhost:${PORT}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the existing process or change PORT in .env.`
    );
    process.exit(1);
  }

  throw error;
});
