require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");

const inferenceRoutes = require("./routes/inferenceRoutes.js");

const app = express();

const PORT = process.env.PORT || 3030;

// Directories
fs.mkdirSync(path.join(__dirname, "uploads"), { recursive: true });

fs.mkdirSync(path.join(__dirname, "results"), { recursive: true });

//middleware
app.use(express.json());


//Frontend
app.use(express.static(path.join(__dirname, "..", "frontend")));


//Routes
app.use("/", inferenceRoutes);

//Error handler
app.use((err, req, res, next) => {
    console.error(err);
    return res.status(400).json({error: err.message || "Something went wrong"});
});

//Start server
app.listen(PORT, () => {
        console.log("");
        console.log("==============================");
        console.log("DR Inference Server");
        console.log("==============================");
        console.log(`http://localhost:${PORT}`);
        console.log("==============================");
    }
);