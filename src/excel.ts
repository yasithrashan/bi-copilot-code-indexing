import * as XLSX from 'xlsx';
import * as fs from 'fs';

export interface QueryWithId {
    id: number;
    query: string;
}

// Extract data from Excel
export async function dataExtarctFromExcelSheet(): Promise<QueryWithId[]> {
    console.log("Extracting the data from excel sheet");
    const filePath = '/Users/yasithrashan/Downloads/BI-Copilot-Code-Indexing.xlsx';

    const fileBuffer = fs.readFileSync(filePath);

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        throw new Error("No sheets found in the Excel file.");
    }

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
        throw new Error("Worksheet not found.");
    }

    const data = XLSX.utils.sheet_to_json(worksheet);

    const queries: QueryWithId[] = data.map((row: any) => ({
        id: row["Query Id"],
        query: row["User Query"]
    }));

    // Save the user query and
    const dirPath = 'rag_outputs/user_queries'
    fs.mkdirSync(dirPath, { recursive: true })

    const jsonFilePath = `${dirPath}/user_queries.json`;
    fs.writeFileSync(jsonFilePath, JSON.stringify(queries, null, 2));

    return queries;
}

export async function saveRelevantChunksToExcel(userQueries: QueryWithId[], relevantChunksArray: any[][]) {
    const filePath = '/Users/yasithrashan/Downloads/BI-Copilot-Code-Indexing.xlsx';
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        throw new Error("No sheets found in the Excel file.");
    }
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
        throw new Error("Worksheet not found.");
    }

    const data: any[] = XLSX.utils.sheet_to_json(worksheet);

    // Add or update "Relevant Chunks from RAG" column
    data.forEach((row, index) => {
        const chunks = relevantChunksArray[index] || [];
        // Save only scores + payload text if needed
        row['Relevant Chunks from RAG'] = JSON.stringify(chunks, null, 2);
    });

    // Convert JSON back to worksheet
    const newWorksheet = XLSX.utils.json_to_sheet(data);
    workbook.Sheets[sheetName] = newWorksheet;

    // Save updated workbook
    XLSX.writeFile(workbook, filePath);

    console.log(`Updated Excel file saved with relevant chunks in "Relevant Chunks from RAG" column.`);
}