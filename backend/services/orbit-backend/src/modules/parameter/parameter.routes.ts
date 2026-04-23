import { Router } from "express";
import { parameterController } from "./parameter.controller";

const router = Router();

router.get("/", parameterController.list);
router.get("/:id", parameterController.getById);
router.post("/", parameterController.create);
router.patch("/:id", parameterController.update);
router.delete("/:id", parameterController.remove);

export default router;
