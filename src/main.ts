import { run } from "./renderer/renderer";

run().then((hasRun) => {
    if (!hasRun) {
        document.getElementById("webgpu-available")!.innerText = "Looks like webgpu is not available :(";
    }
});
