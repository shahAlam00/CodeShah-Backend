import "dotenv/config"
import connectDB from "./config/db.js";
import app from "./app.js";
import "dotenv/config";
connectDB();
 
 


app.listen(process.env.PORT,()=>{
    console.log(`Server is running on port ${process.env.PORT}`);
})  