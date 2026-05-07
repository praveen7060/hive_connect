import { config as loadEnv } from "dotenv";
import { resolve } from "path";

loadEnv({ path: resolve(__dirname, "../.env") });

// Load the Express app only after environment variables are present so Prisma
// and route modules see the correct DATABASE_URL during initialization.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const app = require("./app").default;

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
