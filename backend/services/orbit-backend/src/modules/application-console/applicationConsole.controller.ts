import type { NextFunction, Request, Response } from "express";
import {
  claimEnrollmentQrSchema,
  createConsoleApplicationSchema,
  createEnrollmentQrSchema,
  executeClaimedCommandSchema,
  updateConsoleApplicationSchema,
} from "./applicationConsole.schema";
import { applicationConsoleService } from "./applicationConsole.service";

function readAppKey(req: Request) {
  const header = req.header("x-app-key");
  return header?.trim();
}

export const applicationConsoleController = {
  async listApps(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await applicationConsoleService.listApps());
    } catch (error) {
      next(error);
    }
  },

  async getAppById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await applicationConsoleService.getAppById(req.params.appId));
    } catch (error) {
      next(error);
    }
  },

  async createApp(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = createConsoleApplicationSchema.parse(req.body);
      res.status(201).json(await applicationConsoleService.createApp(payload));
    } catch (error) {
      next(error);
    }
  },

  async updateApp(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = updateConsoleApplicationSchema.parse(req.body);
      res.json(await applicationConsoleService.updateApp(req.params.appId, payload));
    } catch (error) {
      next(error);
    }
  },

  async deleteApp(req: Request, res: Response, next: NextFunction) {
    try {
      await applicationConsoleService.deleteApp(req.params.appId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async createEnrollmentQr(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = createEnrollmentQrSchema.parse(req.body ?? {});
      res.status(201).json(await applicationConsoleService.createEnrollmentQr(req.params.deviceId, payload));
    } catch (error) {
      next(error);
    }
  },

  async claimEnrollmentQr(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = claimEnrollmentQrSchema.parse(req.body);
      res.status(201).json(await applicationConsoleService.claimEnrollmentQr(payload));
    } catch (error) {
      next(error);
    }
  },

  async listClaimedDevices(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(
        await applicationConsoleService.listClaimedDevices(req.params.appId, readAppKey(req))
      );
    } catch (error) {
      next(error);
    }
  },

  async executeClaimedCommand(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = executeClaimedCommandSchema.parse(req.body ?? {});
      res.json(
        await applicationConsoleService.executeClaimedCommand(
          req.params.appId,
          req.params.deviceId,
          req.params.commandKey,
          payload,
          readAppKey(req)
        )
      );
    } catch (error) {
      next(error);
    }
  },
};
