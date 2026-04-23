import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";
import {
  controlDeviceSchema,
  deviceDocumentsSchema,
  provisionThingSchema,
  publishDeviceSchema,
  subscribeTopicsSchema,
} from "./iot.schema";
import { iotService } from "./iot.service";

function getCorrelationId(req: Request) {
  const headerValue = req.header("x-correlation-id");
  return headerValue?.trim() || randomUUID();
}

export const iotController = {
  async provisionThing(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = provisionThingSchema.parse(req.body);
      const data = await iotService.provisionThing(payload, getCorrelationId(req));
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async getDevice(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await iotService.getDevice(req.params.deviceId, getCorrelationId(req));
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async getProvisioningStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await iotService.getProvisioningStatus(req.params.deviceId, getCorrelationId(req));
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async controlDevice(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = controlDeviceSchema.parse(req.body);
      const data = await iotService.controlDevice(req.params.deviceId, payload, getCorrelationId(req));
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async publishToDevice(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = publishDeviceSchema.parse(req.body);
      const data = await iotService.publishToDevice(req.params.deviceId, payload, getCorrelationId(req));
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async getDeviceDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = deviceDocumentsSchema.parse(req.body ?? {});
      const data = await iotService.getDeviceDocuments(req.params.deviceId, payload, getCorrelationId(req));
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async subscribeTopics(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = subscribeTopicsSchema.parse(req.body);
      const data = await iotService.subscribeTopics(payload, getCorrelationId(req));
      res.json(data);
    } catch (error) {
      next(error);
    }
  },
};
