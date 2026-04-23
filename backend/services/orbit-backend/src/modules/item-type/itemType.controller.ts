import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../../middleware/error.middleware";
import { createItemTypeSchema, updateItemTypeSchema } from "./itemType.schema";
import { itemTypeService } from "./itemType.service";

export const itemTypeController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try { res.json(await itemTypeService.list()); } catch (err) { next(err); }
  },
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const row = await itemTypeService.getById(req.params.id);
      if (!row) throw new ApiError(404, "ItemType not found");
      res.json(row);
    } catch (err) { next(err); }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = createItemTypeSchema.parse(req.body);
      res.status(201).json(await itemTypeService.create(payload));
    } catch (err) { next(err); }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = updateItemTypeSchema.parse(req.body);
      res.json(await itemTypeService.update(req.params.id, payload));
    } catch (err) { next(err); }
  },
  async remove(req: Request, res: Response, next: NextFunction) {
    try { await itemTypeService.remove(req.params.id); res.status(204).send(); } catch (err) { next(err); }
  },
};
