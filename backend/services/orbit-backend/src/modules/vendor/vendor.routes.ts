import { Router } from "express";
import multer from "multer";
import { vendorController } from "./vendor.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", vendorController.list);
router.get("/:id", vendorController.getById);
router.post("/import-postman", upload.single("file"), vendorController.importPostmanCollection);
router.post("/", vendorController.create);
router.patch("/:id", vendorController.update);
router.delete("/:id", vendorController.remove);

export default router;
 
