import express from "express"
import { userLogin, userRegister, userLogout, getUserProfile, updateUserProfile } from "./user.controller.js";
import { userAuth } from "../../middleware/userAuth.js";
import { upload } from "../../middleware/multer.middleware.js"
const userRouter = express.Router();

userRouter.post("/register", userRegister);
userRouter.post("/login", userLogin);
userRouter.post("/logout", userLogout);
userRouter.get("/getuser",userAuth, getUserProfile);
userRouter.put("/update-profile", userAuth, upload.single("avatar"), updateUserProfile);
export default userRouter;