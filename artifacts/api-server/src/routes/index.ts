import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gameRouter from "./game";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(gameRouter);

export default router;
