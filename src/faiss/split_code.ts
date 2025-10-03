import path from "path";
import { writeFileSync, mkdirSync } from "fs";
import { createHash } from "crypto";

interface SimpleChunk {
    id: string;
    content: string;
}

export class codeSplitter {
    private processedChunks = new Set<string>();

    // Generate unique hash-based ID
    private generateId(type: string, name: string | null, line: number, filePath: string, httpMethod?: string, content?: string): string {
        const rawId = `${filePath}:${type}:${name || "unnamed"}:${line}:${httpMethod || ""}:${content || ""}`;
        return this.generateHash(rawId);
    }

    // Extract module name from file path
    private extractModuleName(filePath: string): string {
        const pathParts = filePath.split(path.sep);
        for (let i = pathParts.length - 1; i >= 0; i--) {
            if (pathParts[i] === 'modules' && i > 0) {
                return pathParts[i + 1] || 'default';
            }
        }
        return pathParts[pathParts.length - 2] || 'default';
    }

    // Get line number from index
    private getLineNumber(code: string, index: number): number {
        return code.slice(0, index).split(/\r?\n/).length;
    }

    // Normalize content for consistency
    private normalizeContent(content: string): string {
        return content
            .split('\n')
            .map(line => line.trimRight())
            .join('\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    // Generate hash for duplicate detection
    private generateHash(content: string): string {
        return createHash('sha256').update(content.trim()).digest('hex').substring(0, 16);
    }

    // Check for duplicates
    private isDuplicate(content: string, type: string, name: string | null): boolean {
        const key = `${type}:${name}:${this.generateHash(content)}`;
        if (this.processedChunks.has(key)) {
            return true;
        }
        this.processedChunks.add(key);
        return false;
    }

    // Main chunking function
    chunkBallerinaCode(code: string, filePath: string): SimpleChunk[] {
        const chunks: SimpleChunk[] = [];
        this.processedChunks.clear();
        let match: RegExpExecArray | null;

        // 1. Import statements
        const importRegex = /import\s+(?:ballerina\/\w+|[a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*(?:\s+as\s+\w+)?)\s*;/g;
        while ((match = importRegex.exec(code)) !== null) {
            if (match.index === undefined) continue;

            const content = this.normalizeContent(match[0]);
            const line = this.getLineNumber(code, match.index);

            if (!this.isDuplicate(content, "import", null)) {
                chunks.push({
                    id: this.generateId("import", null, line, filePath),
                    content: content
                });
            }
        }

        // 2. Configurable variables
        const configurableRegex = /configurable\s+(?:readonly\s+)?([a-zA-Z_]\w*(?:\[\])?(?:<[^>]+>)?)\s+(\w+)\s*=\s*[^;]+;/g;
        while ((match = configurableRegex.exec(code)) !== null) {
            if (match.index === undefined || !match[2]) continue;

            const variableName = match[2];
            const content = this.normalizeContent(match[0]);
            const line = this.getLineNumber(code, match.index);

            if (!this.isDuplicate(content, "configurable_variable", variableName)) {
                chunks.push({
                    id: this.generateId("configurable_variable", variableName, line, filePath),
                    content: content
                });
            }
        }

        // 3. Module-level variables
        const moduleVariableRegex = /^(?!.*(function|service|resource|type|import|configurable|class)).*?(?:(public|isolated|final)\s+)?([a-zA-Z_]\w*(?:<[^>]+>)?(?:\[\])?)\s+(\w+)\s*=\s*[^;]+;/gm;
        while ((match = moduleVariableRegex.exec(code)) !== null) {
            if (match.index === undefined || !match[3]) continue;

            const variableName = match[3];
            const content = this.normalizeContent(match[0]);
            const line = this.getLineNumber(code, match.index);

            if (!this.isDuplicate(content, "module_variable", variableName)) {
                chunks.push({
                    id: this.generateId("module_variable", variableName, line, filePath),
                    content: content
                });
            }
        }

        // 4. Type definitions
        const typeRegex = /(?:public\s+)?type\s+(\w+)\s+(?:record\s*\{[^}]*\}|enum\s*\{[^}]*\}|[^;]+);/g;
        while ((match = typeRegex.exec(code)) !== null) {
            if (match.index === undefined || !match[1]) continue;

            const typeName = match[1];
            const content = this.normalizeContent(match[0]);
            const line = this.getLineNumber(code, match.index);

            if (!this.isDuplicate(content, "type_definition", typeName)) {
                chunks.push({
                    id: this.generateId("type_definition", typeName, line, filePath),
                    content: content
                });
            }
        }

        // 5. Functions
        const functionRegex = /(?:public\s+|isolated\s+)*function\s+(\w+)\s*\([^)]*\)(?:\s*returns\s*[^{]+)?\s*\{/g;
        while ((match = functionRegex.exec(code)) !== null) {
            if (match.index === undefined || !match[1]) continue;

            const functionName = match[1];
            const functionStart = match.index;
            const openBraceIndex = match.index + match[0].length - 1;
            const closeBraceIndex = this.findMatchingBrace(code, openBraceIndex);

            if (closeBraceIndex === -1) continue;

            const fullFunction = code.substring(functionStart, closeBraceIndex + 1);
            const content = this.normalizeContent(fullFunction);
            const line = this.getLineNumber(code, match.index);

            if (!this.isDuplicate(content, "function", functionName)) {
                chunks.push({
                    id: this.generateId("function", functionName, line, filePath),
                    content: content
                });
            }
        }

        // 6. Constants
        const constantRegex = /(?:public\s+)?const\s+([a-zA-Z_]\w*(?:<[^>]+>)?(?:\[\])?)\s+(\w+)\s*=\s*[^;]+;/g;
        while ((match = constantRegex.exec(code)) !== null) {
            if (match.index === undefined || !match[2]) continue;

            const constantName = match[2];
            const content = this.normalizeContent(match[0]);
            const line = this.getLineNumber(code, match.index);

            if (!this.isDuplicate(content, "constant", constantName)) {
                chunks.push({
                    id: this.generateId("constant", constantName, line, filePath),
                    content: content
                });
            }
        }

        // 7. Services and Resources
        const serviceRegex = /service(?:\s+class\s+(\w+))?\s+(\/[\/\w\d_-]*|\w+)(?:\s+on\s+([^{]+))?\s*\{/g;
        while ((match = serviceRegex.exec(code)) !== null) {
            if (match.index === undefined || !match[2]) continue;

            const servicePath = match[2];
            const serviceStart = match.index;
            const openBraceIndex = match.index + match[0].length - 1;
            const closeBraceIndex = this.findMatchingBrace(code, openBraceIndex);

            if (closeBraceIndex === -1) continue;

            const serviceDeclaration = code.substring(serviceStart, openBraceIndex + 1);
            const serviceBody = code.substring(openBraceIndex + 1, closeBraceIndex);
            const serviceName = servicePath.replace(/^\//, "") || "unnamed_service";
            const line = this.getLineNumber(code, match.index);

            // Add service declaration chunk
            const serviceContent = this.normalizeContent(serviceDeclaration);
            if (!this.isDuplicate(serviceContent, "service", serviceName)) {
                chunks.push({
                    id: this.generateId("service", serviceName, line, filePath),
                    content: serviceContent
                });
            }

            // Extract resources
            const resourceRegex = /resource\s+function\s+(get|post|put|delete|patch|head|options)\s+([^\s(]*)\s*\(([^)]*)\)(?:\s*returns\s*([^{]+?))?\s*\{/g;
            let resourceMatch: RegExpExecArray | null;

            while ((resourceMatch = resourceRegex.exec(serviceBody)) !== null) {
                if (resourceMatch.index === undefined || !resourceMatch[1]) continue;

                const httpMethod = resourceMatch[1];
                const pathPart = resourceMatch[2] || "";
                const resourceStartInService = resourceMatch.index;
                const resourceOpenBraceIndex = resourceMatch.index + resourceMatch[0].length - 1;
                const resourceCloseBraceIndex = this.findMatchingBrace(serviceBody, resourceOpenBraceIndex);

                if (resourceCloseBraceIndex === -1) continue;

                const fullResource = serviceBody.substring(resourceStartInService, resourceCloseBraceIndex + 1);
                const resourceName = `${httpMethod} ${pathPart}`.trim();
                const resourceContent = this.normalizeContent(fullResource);

                if (!this.isDuplicate(resourceContent, "resource", resourceName)) {
                    chunks.push({
                        id: this.generateId("resource", resourceName, line, filePath, httpMethod),
                        content: resourceContent
                    });
                }
            }
        }

        // 8. Classes
        const classRegex = /(?:public\s+)?class\s+(\w+)(?:\s*\{[^}]*\}|\s+[^{]*\{)/g;
        while ((match = classRegex.exec(code)) !== null) {
            if (match.index === undefined || !match[1]) continue;

            const className = match[1];
            const classStart = match.index;
            const openBraceIndex = code.indexOf('{', classStart);

            if (openBraceIndex === -1) continue;

            const closeBraceIndex = this.findMatchingBrace(code, openBraceIndex);
            if (closeBraceIndex === -1) continue;

            const fullClass = code.substring(classStart, closeBraceIndex + 1);
            const content = this.normalizeContent(fullClass);
            const line = this.getLineNumber(code, match.index);

            if (!this.isDuplicate(content, "class", className)) {
                chunks.push({
                    id: this.generateId("class", className, line, filePath),
                    content: content
                });
            }
        }

        return chunks;
    }

    // Helper to find matching brace
    private findMatchingBrace(code: string, startIndex: number): number {
        let braceCount = 0;
        let index = startIndex;

        while (index < code.length) {
            if (code[index] === '{') {
                braceCount++;
            } else if (code[index] === '}') {
                braceCount--;
                if (braceCount === 0) {
                    return index;
                }
            }
            index++;
        }

        return -1;
    }

    // Save simplified chunks
    saveChunksToJson(chunks: SimpleChunk[], ballerinaDir: string): string {
        const testsDir = "faiss_outputs";
        mkdirSync(testsDir, { recursive: true });

        const filename = `source_code_split.json`;
        const filepath = path.join(testsDir, filename);

        // Create simple output with just chunks
        const jsonOutput = {
            sourceDirectory: ballerinaDir,
            chunks: chunks
        };

        writeFileSync(filepath, JSON.stringify(jsonOutput, null, 2), "utf-8");

        console.log(`Simple chunks saved: ${filepath}`);
        console.log(`Total chunks: ${chunks.length}`);

        return filepath;
    }

    // Utility method to get chunks by type from ID
    getChunksByType(chunks: SimpleChunk[], type: string): SimpleChunk[] {
        return chunks.filter(chunk => chunk.id.includes(`:${type}:`));
    }

    // Get chunk statistics
    getChunkStatistics(chunks: SimpleChunk[]): Record<string, number> {
        const stats: Record<string, number> = {};

        chunks.forEach(chunk => {
            const parts = chunk.id.split(':');
            const type = parts[2]; // type is at index 2 in the ID structure
            if (typeof type === "string" && type.length > 0) {
                stats[type] = (stats[type] || 0) + 1;
            }
        });

        return stats;
    }
}