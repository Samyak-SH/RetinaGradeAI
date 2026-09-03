const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");

const inferenceController =
    require("../controllers/inferenceController.js");

const router = express.Router();


//Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../uploads"));
    },

    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();

        const filename = `${crypto.randomUUID()}${ext}`;
        cb(null, filename);
    }
});


const upload = multer({
    storage,
    limits: {fileSize: 20 * 1024 * 1024},

    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/jpg"
        ];

        if (!allowedTypes.includes(file.mimetype)) {
            return cb(
                new Error("Only JPG and PNG images are allowed")
            );
        }

        cb(null, true);
    }
});

// POST /predict
router.post(
    "/predict",
    upload.single("image"),
    inferenceController.predict
);


module.exports = router;