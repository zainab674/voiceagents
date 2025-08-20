import express from "express";
import { createToken } from "#controllers/livekitController.js";
const router = express.Router();

router.route("/create-token").post(createToken);

export default router;