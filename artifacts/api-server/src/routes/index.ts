import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import shiftsRouter from "./shifts";
import usersRouter from "./users";
import ratingsRouter from "./ratings";
import paymentsRouter from "./payments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(shiftsRouter);
router.use(usersRouter);
router.use(ratingsRouter);
router.use(paymentsRouter);

export default router;
