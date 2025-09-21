import { generateBalMd } from "./generate-bal";

const balFilePath = 'ballerina'

export async function agentWorkflow() {
    await generateBalMd(balFilePath);
}

