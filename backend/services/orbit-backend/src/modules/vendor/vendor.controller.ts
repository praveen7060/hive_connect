import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../../middleware/error.middleware";
import { createVendorSchema, updateVendorSchema } from "./vendor.schema";
import { importVendorPostmanSchema } from "./vendor-import.schema";
import { vendorService } from "./vendor.service";

export const vendorController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await vendorService.list());
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const row = await vendorService.getById(req.params.id);
      if (!row) throw new ApiError(404, "Vendor not found");
      res.json(row);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = createVendorSchema.parse(req.body);
      res.status(201).json(await vendorService.create(payload));
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = updateVendorSchema.parse(req.body);
      res.json(await vendorService.update(req.params.id, payload));
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await vendorService.remove(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async importPostmanCollection(req: Request, res: Response, next: NextFunction) {
    try {
      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file?.buffer?.length) {
        throw new ApiError(400, "Postman collection JSON file is required");
      }

      const payload = importVendorPostmanSchema.parse(req.body ?? {});
      const result = await vendorService.importPostmanCollection({
        fileName: file.originalname,
        buffer: file.buffer,
        vendorName: payload.vendorName,
        persist: payload.persist,
      });

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
};
