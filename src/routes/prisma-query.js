import {Router} from "express";
import prisma from "../lib/prisma.js";

const router = Router();

router.get('/students', async(req , res)=>{
    try{
        const students = await prisma.student.findMany();

        return res.status(200).json({
            status: true,
            message: "Students Fetch Successfully ",
            data: students ,
        })
    }catch{
        return res.status(500).json({
            status: false,
            message: "Failed to fetch students"
        });
    }
})



export default router; 