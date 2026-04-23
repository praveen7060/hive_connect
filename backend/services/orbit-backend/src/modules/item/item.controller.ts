import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../../middleware/error.middleware";
import { createItemSchema, updateItemSchema } from "./item.schema";
import { itemService } from "./item.service";

export const itemController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try { res.json(await itemService.list()); } catch (err) { next(err); }
  },
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const row = await itemService.getById(req.params.id);
      if (!row) throw new ApiError(404, "Item not found");
      res.json(row);
    } catch (err) { next(err); }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = createItemSchema.parse(req.body);
      res.status(201).json(await itemService.create(payload));
    } catch (err) { next(err); }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = updateItemSchema.parse(req.body);
      res.json(await itemService.update(req.params.id, payload));
    } catch (err) { next(err); }
  },
  async remove(req: Request, res: Response, next: NextFunction) {
    try { await itemService.remove(req.params.id); res.status(204).send(); } catch (err) { next(err); }
  },
};
