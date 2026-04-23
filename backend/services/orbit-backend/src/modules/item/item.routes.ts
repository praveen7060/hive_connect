import { Router } from "express";
import { itemController } from "./item.controller";

const router = Router();

router.get("/", itemController.list);
router.get("/:id", itemController.getById);
router.post("/", itemController.create);
router.patch("/:id", itemController.update);
router.delete("/:id", itemController.remove);

export default router;
