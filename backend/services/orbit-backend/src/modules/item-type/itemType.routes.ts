import { Router } from "express";
import { itemTypeController } from "./itemType.controller";

const router = Router();

router.get("/", itemTypeController.list);
router.get("/:id", itemTypeController.getById);
router.post("/", itemTypeController.create);
router.patch("/:id", itemTypeController.update);
router.delete("/:id", itemTypeController.remove);

export default router;
