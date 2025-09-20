import { dataExtarctFromExcelSheet } from "../excel";

export async function chunkUserQuery() {
  const queries = await dataExtarctFromExcelSheet();

  const result = queries.map(({ id, query }) => {
    const texts = query.split(" ");
    return {
      id,
      query,
      chunks: texts,
    };
  });

  return result;
}