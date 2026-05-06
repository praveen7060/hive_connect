import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../../middleware/error.middleware";
import { createDeviceSchema, discoveredDeviceSyncSchema, updateDeviceSchema } from "./device.schema";
import { deviceService } from "./device.service";

export const deviceController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try { res.json(await deviceService.list()); } catch (err) { next(err); }
  },
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const row = await deviceService.getById(req.params.id);
      if (!row) throw new ApiError(404, "Device not found");
      res.json(row);
    } catch (err) { next(err); }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = createDeviceSchema.parse(req.body);
      res.status(201).json(await deviceService.create(payload));
    } catch (err) { next(err); }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = updateDeviceSchema.parse(req.body);
      res.json(await deviceService.update(req.params.id, payload));
    } catch (err) { next(err); }
  },
  async upsertDiscovered(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = discoveredDeviceSyncSchema.parse(req.body);
      res.status(201).json(await deviceService.upsertDiscovered(payload));
    } catch (err) { next(err); }
  },
  async remove(req: Request, res: Response, next: NextFunction) {
    try { await deviceService.remove(req.params.id); res.status(204).send(); } catch (err) { next(err); }
  },
};
