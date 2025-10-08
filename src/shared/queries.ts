import { dataExtarctFromExcelSheet } from "./excel";

export async function GetUserQuery() {
  const queries = await dataExtarctFromExcelSheet();

  const result = queries.map(({ id, query }) => {
    const texts = query;
    return {
      id,
      query,
      chunks: texts,
    };
  });
  return result;
}