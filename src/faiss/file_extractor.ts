import { readdir, readFile } from "fs/promises";
import path from "path";

// Recursively load all .bal files in a directory
export async function loadBallerinaFiles(dir: string): Promise<string[]> {
    let files: string[] = [];
    const dirents = await readdir(dir, { withFileTypes: true });

    for (const dirent of dirents) {
        const fullPath = path.join(dir, dirent.name);

        if (dirent.isDirectory()) {
            const nestedFiles = await loadBallerinaFiles(fullPath);
            files = files.concat(nestedFiles);
        } else if (dirent.name.endsWith(".bal")) {
            files.push(fullPath);
        }
    }

    return files;
}

export interface FileData {
    filePath: string;
    content: string;
}

// Read multiple files asynchronously and keep file path with content
export async function readFileContents(files: string[]): Promise<FileData[]> {
    const contents = await Promise.all(
        files.map(async (filePath) => {
            const content = await readFile(filePath, "utf-8");
            return { filePath, content };
        })
    );
    return contents;
}
