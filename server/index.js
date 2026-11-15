import express from "express"

const app = express();
const PORT = 5000;

app.get('/Health',(req,res)=>{
    console.log("Running...")
    res.send("Running...") 
})

app.listen(PORT, ()=>{
    console.log("Chal Gya 🚀")
})