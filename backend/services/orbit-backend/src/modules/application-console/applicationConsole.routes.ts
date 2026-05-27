import { Router } from "express";
import { applicationConsoleController } from "./applicationConsole.controller";

const router = Router();

router.get("/apps", applicationConsoleController.listApps);
router.get("/apps/:appId", applicationConsoleController.getAppById);
router.post("/apps", applicationConsoleController.createApp);
router.patch("/apps/:appId", applicationConsoleController.updateApp);
router.delete("/apps/:appId", applicationConsoleController.deleteApp);
router.post("/apps/:appId/link-qrs", applicationConsoleController.createAppLinkQr);

router.post("/devices/:deviceId/enrollment-qrs", applicationConsoleController.createEnrollmentQr);
router.post("/claims", applicationConsoleController.claimEnrollmentQr);
router.post("/link-accounts/claim", applicationConsoleController.claimAppLinkQr);
router.get("/apps/:appId/devices", applicationConsoleController.listClaimedDevices);
router.post(
  "/apps/:appId/devices/:deviceId/commands/:commandKey",
  applicationConsoleController.executeClaimedCommand
);

export default router;
