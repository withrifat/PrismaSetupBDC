import dotenv from "dotenv";
import { Prisma } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

export default prisma;
