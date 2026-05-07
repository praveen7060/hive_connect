import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../../middleware/error.middleware";
import { createParameterSchema, updateParameterSchema } from "./parameter.schema";
import { parameterService } from "./parameter.service";

export const parameterController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await parameterService.list());
    } catch (err) {
      next(err);
    }
  },
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const row = await parameterService.getById(req.params.id);
      if (!row) throw new ApiError(404, "Parameter not found");
      res.json(row);
    } catch (err) {
      next(err);
    }
  },
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = createParameterSchema.parse(req.body);
      res.status(201).json(await parameterService.create(payload));
    } catch (err) {
      next(err);
    }
  },
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = updateParameterSchema.parse(req.body);
      res.json(await parameterService.update(req.params.id, payload));
    } catch (err) {
      next(err);
    }
  },
  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await parameterService.remove(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
  async importDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const vendor = String(req.body?.vendor ?? "").trim();
      if (!vendor) {
        throw new ApiError(400, "vendor is required");
      }

      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file?.buffer?.length) {
        throw new ApiError(400, "PDF file is required");
      }

      const persist = String(req.body?.persist ?? "true").trim().toLowerCase() !== "false";
      res.status(201).json(
        await parameterService.importDocument({
          vendor,
          fileName: file.originalname,
          buffer: file.buffer,
          persist,
        })
      );
    } catch (err) {
      next(err);
    }
  },
};
