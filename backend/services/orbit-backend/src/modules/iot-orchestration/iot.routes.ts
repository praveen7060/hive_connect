import { Router } from "express";
import { iotController } from "./iot.controller";

const router = Router();

router.post("/things/provision", iotController.provisionThing);
router.get("/devices/:deviceId", iotController.getDevice);
router.get("/devices/:deviceId/provisioning", iotController.getProvisioningStatus);
router.post("/devices/:deviceId/control", iotController.controlDevice);
router.post("/devices/:deviceId/publish", iotController.publishToDevice);
router.post("/devices/:deviceId/documents", iotController.getDeviceDocuments);
router.post("/topics/subscribe", iotController.subscribeTopics);

export default router;
