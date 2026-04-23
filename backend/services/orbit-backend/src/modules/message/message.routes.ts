import { Router } from "express";
import { messageController } from "./message.controller";

const router = Router();

router.get("/", messageController.list);
router.get("/:id", messageController.getById);
router.post("/", messageController.create);
router.patch("/:id", messageController.update);
router.delete("/:id", messageController.remove);

export default router;
