export interface Chunk {
    content: string;
    metadata: {
        type: string;
        name: string | null;
        file: string;
        line: number;
        endLine: number;
        position: {
            start: { line: number; column: number };
            end: { line: number; column: number };
        };
        id: string;
        hash: string;
        moduleName?: string;
        [key: string]: any;
    };
}