import express from "express";

const app = express();

app.use("/", (req, res)=>{
    res.json({status: "ok"});
})


app.listen(5000, (req, res)=>{
    console.log("server started");
})