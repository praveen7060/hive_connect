import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../../middleware/error.middleware";
import { createMessageSchema, updateMessageSchema } from "./message.schema";
import { messageService } from "./message.service";

export const messageController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try { res.json(await messageService.list()); } catch (err) { next(err); }
  },
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const row = await messageService.getById(req.params.id);
      if (!row) throw new ApiError(404, "Message policy not found");
      res.json(row);
    } catch (err) { next(err); }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = createMessageSchema.parse(req.body);
      res.status(201).json(await messageService.create(payload));
    } catch (err) { next(err); }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = updateMessageSchema.parse(req.body);
      res.json(await messageService.update(req.params.id, payload));
    } catch (err) { next(err); }
  },
  async remove(req: Request, res: Response, next: NextFunction) {
    try { await messageService.remove(req.params.id); res.status(204).send(); } catch (err) { next(err); }
  },
};
  