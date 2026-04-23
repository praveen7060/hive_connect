import { Router } from "express";
import { communicationController } from "./communication.controller";

const router = Router();

router.get("/", communicationController.list);
router.get("/:id", communicationController.getById);
router.post("/", communicationController.create);
router.patch("/:id", communicationController.update);
router.delete("/:id", communicationController.remove);

export default router;
