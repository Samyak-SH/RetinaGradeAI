const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const PROJECT_DIR = path.join(__dirname, "../..");

const PYTHON = path.join(
    PROJECT_DIR,
    ".venv",
    "Scripts",
    "python.exe"
);

const INFER_SCRIPT = path.join(
    PROJECT_DIR,
    "infer_image.py"
);

function runInference(inputPath, resultDir) {

    return new Promise((resolve, reject) => {

        console.log("Starting inference...");
        console.log("Input:", inputPath);
        console.log("Result directory:", resultDir);

        const pythonProcess = spawn(
            PYTHON,
            [
                INFER_SCRIPT,
                inputPath,
                resultDir
            ],
            {
                cwd: PROJECT_DIR
            }
        );

        let stdout = "";
        let stderr = "";

        pythonProcess.stdout.on("data", (data) => {

            const text = data.toString();

            stdout += text;

            console.log(`[PYTHON] ${text}`);
        });

        pythonProcess.stderr.on("data", (data) => {

            const text = data.toString();

            stderr += text;

            console.error(`[PYTHON ERROR] ${text}`);
        });

        pythonProcess.on("error", (error) => {

            reject(error);
        });

        pythonProcess.on("close", (code) => {

            if (code !== 0) {

                return reject(
                    new Error(
                        `Python inference failed with code ${code}\n${stderr}`
                    )
                );
            }

            const resultPath = path.join(
                resultDir,
                "combined_overlay.png"
            );

            if (!fs.existsSync(resultPath)) {

                return reject(
                    new Error(
                        "Inference completed but combined_overlay.png was not generated"
                    )
                );
            }

            resolve({
                resultPath,
                stdout
            });
        });
    });
}

module.exports = {
    runInference
};