import { Router } from "express";
import vendorRoutes from "../modules/vendor/vendor.routes";
import parameterRoutes from "../modules/parameter/parameter.routes";
import itemTypeRoutes from "../modules/item-type/itemType.routes";
import communicationRoutes from "../modules/communication/communication.routes";
import messageRoutes from "../modules/message/message.routes";
import itemRoutes from "../modules/item/item.routes";
import deviceRoutes from "../modules/device-inventory/device.routes";
import iotRoutes from "../modules/iot-orchestration/iot.routes";

const router = Router();

router.use("/vendors", vendorRoutes);
router.use("/parameters", parameterRoutes);
router.use("/item-types", itemTypeRoutes);
router.use("/communications", communicationRoutes);
router.use("/messages", messageRoutes);
router.use("/items", itemRoutes);
router.use("/devices", deviceRoutes);
router.use("/iot", iotRoutes);

export default router;
