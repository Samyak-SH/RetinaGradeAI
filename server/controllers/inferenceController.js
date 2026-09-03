const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const inferenceModel = require("../models/inferenceModel.js");

const SERVER_DIR = path.join(__dirname, "..");

const RESULTS_DIR = path.join(SERVER_DIR, "results");

async function predict(req, res) {
    try {
        //Check image
        if (!req.file) {
            return res.status(400).json({error: "No image uploaded"});
        }
        //Generate unique ID
        const imageId = crypto.randomUUID();

        //Create result directory

        const resultDir = path.join(RESULTS_DIR, imageId);

        fs.mkdirSync(resultDir,{recursive: true});

        console.log("");
        console.log("=================================");
        console.log("Prediction request");
        console.log("ID:", imageId);
        console.log("Image:", req.file.filename);
        console.log("=================================");


        //Run ML inference

        const result = await inferenceModel.runInference(req.file.path, resultDir);

        // Return result image
        return res.sendFile(result.resultPath, {headers: {
                    "Content-Type": "image/png",
                    "X-Image-ID": imageId
                }
            }
        );

    }
    catch (error) {
        console.error("Inference controller error:", error);

        return res.status(500).json({
            error: "Inference failed",
            details: error.message
        });
    }
}

module.exports = {
    predict
};