import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";
import {
  catalogExecuteCommandSchema,
  catalogProvisionSchema,
  catalogSubscriptionSchema,
  controlDeviceSchema,
  deviceDocumentsSchema,
  provisionThingSchema,
  publishDeviceSchema,
  subscribeTopicsSchema,
  telemetryIngestSchema,
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

  async getCatalogProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await iotService.getCatalogProfile(req.params.id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async getCatalogCapabilities(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await iotService.getCatalogCapabilities(req.params.id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async provisionCatalogDevice(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = catalogProvisionSchema.parse(req.body ?? {});
      const data = await iotService.provisionCatalogDevice(req.params.id, payload, getCorrelationId(req));
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async executeCatalogCommand(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = catalogExecuteCommandSchema.parse(req.body ?? {});
      const data = await iotService.executeCatalogCommand(
        req.params.id,
        req.params.commandKey,
        payload,
        getCorrelationId(req)
      );
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async subscribeCatalogDevice(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = catalogSubscriptionSchema.parse(req.body);
      const data = await iotService.subscribeCatalogDevice(req.params.id, payload, getCorrelationId(req));
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  async ingestTelemetry(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = telemetryIngestSchema.parse(req.body);
      const data = await iotService.ingestTelemetry(payload, getCorrelationId(req));
      res.json(data);
    } catch (error) {
      next(error);
    }
  },
};
