import { Router } from "express";
import multer from "multer";
import { parameterController } from "./parameter.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", parameterController.list);
router.get("/:id", parameterController.getById);
router.post("/import-document", upload.single("file"), parameterController.importDocument);
router.post("/", parameterController.create);
router.patch("/:id", parameterController.update);
router.delete("/:id", parameterController.remove);

export default router;
