import { Router } from "express";
import { deviceController } from "./device.controller";

const router = Router();

router.get("/", deviceController.list);
router.post("/internal/discovered", deviceController.upsertDiscovered);
router.get("/:id", deviceController.getById);
router.post("/", deviceController.create);
router.patch("/:id", deviceController.update);
router.delete("/:id", deviceController.remove);

export default router;
