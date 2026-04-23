import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../../middleware/error.middleware";
import { createCommunicationSchema, updateCommunicationSchema } from "./communication.schema";
import { communicationService } from "./communication.service";

export const communicationController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try { res.json(await communicationService.list()); } catch (err) { next(err); }

  },
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const row = await communicationService.getById(req.params.id);
      if (!row) throw new ApiError(404, "Communication policy not found");
      res.json(row);
    } catch (err) { next(err); }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try {  
      const payload = createCommunicationSchema.parse(req.body);
      res.status(201).json(await communicationService.create(payload));
    } catch (err) { next(err); }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = updateCommunicationSchema.parse(req.body);
      res.json(await communicationService.update(req.params.id, payload));
    } catch (err) { next(err); }
  },
  async remove(req: Request, res: Response, next: NextFunction) {
    try { await communicationService.remove(req.params.id); res.status(204).send(); } catch (err) { next(err); }
  },
};
          