import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const createPrismaClient = () =>
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  }).$extends({
    query: {
      $allModels: {
        async create({ args, query }) {
          if (args.data && typeof args.data === "object") {
            const data = args.data as Record<string, unknown>;
            if (!data.id) data.id = randomUUID();
          }
          return query(args);
        },
        async createMany({ args, query }) {
          if (args.data) {
            const rows = Array.isArray(args.data) ? args.data : [args.data];
            for (const row of rows) {
              if (row && typeof row === "object") {
                const data = row as Record<string, unknown>;
                if (!data.id) data.id = randomUUID();
              }
            }
          }
          return query(args);
        },
        async upsert({ args, query }) {
          if (args.create && typeof args.create === "object") {
            const data = args.create as Record<string, unknown>;
            if (!data.id) data.id = randomUUID();
          }
          return query(args);
        },
      },
    },
  });

type PrismaWithExtensions = ReturnType<typeof createPrismaClient>;

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaWithExtensions | undefined;
}

export const prisma = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") global.prisma = prisma;
