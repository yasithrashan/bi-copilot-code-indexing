import * as XLSX from 'xlsx';
import * as fs from 'fs';

export async function dataExtarctFromExcelSheet() {
    console.log("Extracting the data from excel sheet")
    const filePath = '/Users/yasithrashan/Downloads/BI-Copilot-Code-Indexing.xlsx';

    const fileBuffer = fs.readFileSync(filePath);

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    if (sheetName === undefined) {
        throw new Error("No sheets found in the Excel file.");
    }
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
        throw new Error("Worksheet not found.");
    }
    const data = XLSX.utils.sheet_to_json(worksheet);
    console.log(data);

}

